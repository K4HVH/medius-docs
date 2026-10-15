import {
  DEVICE_KIND_MOUSE,
  EmitMode,
  type DeviceInfo,
  type EmitPace,
  type ImperfectStatus,
  type Rate,
  type Version,
} from '../../../dashboard/protocol';

// A setting the connected device needs, read off what the box reports about it. The fixes are the Devices
// page's Device fixes, offered where the owner already is.

export interface Signals {
  version: Version | null;
  device: DeviceInfo | null;
  imperfect: ImperfectStatus | null;
  emit: EmitPace | null;
  rate: Rate | null;
}

export type Offer =
  // `update`: firmware before v3.4.4 leaves a fifth IN endpoint unanswered, so Windows resets such a clone.
  | { kind: 'imperfect'; update: boolean }
  | { kind: 'logitech'; hz: number }
  | { kind: 'razer' };

const LOGITECH = 0x046d;
const RAZER = 0x1532;
const RATE_HZ = 1000;

const before = (v: Version, major: number, minor: number, patch: number) =>
  v.fwMajor !== major ? v.fwMajor < major : v.fwMinor !== minor ? v.fwMinor < minor : v.fwPatch < patch;

export function offerFor(s: Signals): Offer | null {
  const { version, device, imperfect, emit, rate } = s;
  if (!version || !imperfect) return null;
  // A device the box refused reads no ids, so this one rests on the flags the box sets.
  if (!imperfect.allowed && (imperfect.overCapacity || imperfect.cloneImperfect))
    return { kind: 'imperfect', update: imperfect.overCapacity && before(version, 3, 4, 4) };
  if (!device || device.kind !== DEVICE_KIND_MOUSE) return null;
  if (device.vid === LOGITECH && emit && emit.advertisedHz > 0 && emit.advertisedHz <= 125 && !emit.forceActive)
    return { kind: 'logitech', hz: emit.advertisedHz };
  // Razer's 8K mice keep their rate as a divider of 8000 Hz: set to 1000 Hz on a PC, they run at 125 Hz
  // through the box, which polls at most every millisecond.
  if (device.vid === RAZER && rate?.confident && rate.nativePeriodUs >= 7000 && rate.nativePeriodUs <= 9000) return { kind: 'razer' };
  return null;
}

// What Dismiss puts an offer away under: the device, or one the box reads no ids for.
export function offerKey(s: Signals): string {
  const d = s.device;
  const hex = (n: number) => n.toString(16).padStart(4, '0');
  return d && (d.vid || d.pid) ? `${hex(d.vid)}:${hex(d.pid)}` : 'unread';
}

// The box's side of a fix: reads return null when the box doesn't reply (it restarts as a setting takes),
// and writes get no reply.
export interface FixIO {
  now(): number;
  sleep(ms: number): Promise<void>;
  // Neither chip is on probation, as a restart then would roll a just-installed firmware back; null when
  // the box doesn't answer.
  confirmed(): Promise<boolean | null>;
  emit(): Promise<EmitPace | null>;
  imperfect(): Promise<ImperfectStatus | null>;
  setEmit(mode: EmitMode, rateHz: number, forceHz: number): Promise<void>;
  allowImperfect(): Promise<void>;
}

export type Outcome =
  | { kind: 'fast' }
  | { kind: 'capped'; hz: number }
  | { kind: 'native'; hz: number }
  | { kind: 'replug'; hz: number }
  | { kind: 'gone' }
  | { kind: 'allowed' }
  | { kind: 'checking' }
  | { kind: 'refused' }
  | { kind: 'silent' }
  | { kind: 'changed' };

const POLL_MS = 200;

// Reads until `ok` holds or the time runs out; the last value read either way.
async function waitFor<T>(io: FixIO, read: () => Promise<T | null>, ok: (v: T) => boolean, ms: number): Promise<{ hit: T | null; last: T | null }> {
  const end = io.now() + ms;
  let last: T | null = null;
  for (;;) {
    const v = await read().catch(() => null);
    if (v !== null) {
      last = v;
      if (ok(v)) return { hit: v, last };
    }
    if (io.now() >= end) return { hit: null, last };
    await io.sleep(POLL_MS);
  }
}

// A write, then reads until it shows, four times over: a write lost on the way gets no reply to say so.
async function setUntil<T>(io: FixIO, write: () => Promise<void>, read: () => Promise<T | null>, ok: (v: T) => boolean): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    await write().catch(() => undefined);
    await io.sleep(300);
    if ((await waitFor(io, read, ok, 4_000)).hit) return true;
  }
  return false;
}

// Waits out a probation: ok, or why not (still on it, or no answer at all).
async function confirmed(io: FixIO): Promise<'ok' | 'checking' | 'silent'> {
  const end = io.now() + 60_000;
  let answered = false;
  for (;;) {
    const c = await io.confirmed().catch(() => null);
    if (c) return 'ok';
    if (c === false) answered = true;
    if (io.now() >= end) return answered ? 'checking' : 'silent';
    await io.sleep(500);
  }
}

const set = (e: EmitPace) => e.mode === EmitMode.Fixed && e.fixedHz === RATE_HZ && e.forceHz === RATE_HZ;

// The Logitech fix, as medius-fw's tools/logitech_fix does it: injection paced at a fixed 1000 Hz, the wire rate forced
// to 1000 Hz and imperfect clone on. A device that only goes slower forced keeps the rate it declares.
export async function logitechFix(io: FixIO): Promise<Outcome> {
  const ready = await confirmed(io);
  if (ready !== 'ok') return { kind: ready };
  const first = await io.emit().catch(() => null);
  const allowed = await io.imperfect().catch(() => null);
  if (!first || !allowed) return { kind: 'silent' };
  const native = first.advertisedHz;
  if (!set(first) && !(await setUntil(io, () => io.setEmit(EmitMode.Fixed, RATE_HZ, RATE_HZ), io.emit, set)))
    return { kind: 'refused' };
  if (!allowed.allowed && !(await setUntil(io, io.allowImperfect, io.imperfect, (s) => s.allowed))) return { kind: 'refused' };

  // The box restarts to clone the device again at the new rate.
  const { hit, last } = await waitFor(io, io.emit, (e) => e.forceActive && e.advertisedHz > 0, 20_000);
  if (hit) {
    if (native > 0 && hit.advertisedHz < native) {
      const off = await setUntil(io, () => io.setEmit(EmitMode.Fixed, RATE_HZ, 0), io.emit, (e) => e.forceHz === 0);
      return off ? { kind: 'native', hz: native } : { kind: 'refused' };
    }
    return hit.advertisedHz === RATE_HZ ? { kind: 'fast' } : { kind: 'capped', hz: hit.advertisedHz };
  }
  return last && last.advertisedHz > 0 ? { kind: 'replug', hz: last.advertisedHz } : { kind: 'gone' };
}

export async function allowImperfect(io: FixIO): Promise<Outcome> {
  const ready = await confirmed(io);
  if (ready !== 'ok') return { kind: ready };
  return (await setUntil(io, io.allowImperfect, io.imperfect, (s) => s.allowed)) ? { kind: 'allowed' } : { kind: 'refused' };
}
