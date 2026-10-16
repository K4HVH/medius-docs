import { describe, it, expect } from 'vitest';
import { DEVICE_KIND_KEYBOARD, DEVICE_KIND_MOUSE, EmitMode, type DeviceInfo, type EmitPace, type ImperfectStatus, type Version } from '../../src/dashboard/protocol';
import { type FixIO, type Signals, allowImperfect, logitechFix, offerFor, offerKey } from '../../src/app/pages/dashboard/fixes';

const version = (fw: string, protoVer = 9): Version => {
  const [fwMajor, fwMinor, fwPatch] = fw.split('.').map(Number);
  return { protoVer, fwMajor, fwMinor, fwPatch, mac: [1, 2, 3, 4, 5, 6], name: 'Desk' };
};
const device = (vid: number, pid: number, kind = DEVICE_KIND_MOUSE): DeviceInfo => ({
  vid, pid, bcdDevice: 0, bcdUsb: 0x200, hasSerial: false, hasBos: false, kind, product: 'Mouse',
});
const NOTHING = device(0, 0, 0);
const imp = (over: Partial<ImperfectStatus> = {}): ImperfectStatus => ({ allowed: false, overCapacity: false, cloneImperfect: false, ...over });
const emit = (over: Partial<EmitPace> = {}): EmitPace => ({
  mode: EmitMode.Learned, fixedHz: 0, resolvedHz: 1000, forceHz: 0, advertisedHz: 1000, forceActive: false, ...over,
});
const signals = (over: Partial<Signals> = {}): Signals => ({
  version: version('3.4.5'), device: device(0x046d, 0xc547), imperfect: imp(), emit: emit(), rate: null, ...over,
});

describe('offerFor', () => {
  it('offers imperfect clone for a device the box refused, though it reads no ids', () => {
    expect(offerFor(signals({ device: NOTHING, imperfect: imp({ overCapacity: true }) }))).toEqual({ kind: 'imperfect', update: false });
    expect(offerFor(signals({ device: NOTHING, imperfect: imp({ cloneImperfect: true }) }))).toEqual({ kind: 'imperfect', update: false });
  });

  it('sends a device over capacity on firmware before v3.4.4 to Update first, and only that case', () => {
    expect(offerFor(signals({ version: version('3.4.3'), device: NOTHING, imperfect: imp({ overCapacity: true }) }))).toEqual({ kind: 'imperfect', update: true });
    expect(offerFor(signals({ version: version('3.3.4', 6), device: NOTHING, imperfect: imp({ overCapacity: true }) }))).toEqual({ kind: 'imperfect', update: true });
    expect(offerFor(signals({ version: version('3.4.3'), device: NOTHING, imperfect: imp({ cloneImperfect: true }) }))).toEqual({ kind: 'imperfect', update: false });
  });

  it('offers nothing once imperfect clone is allowed', () => {
    expect(offerFor(signals({ device: NOTHING, imperfect: imp({ allowed: true, overCapacity: true }) }))).toBeNull();
  });

  it('offers the Logitech fix for a Logitech mouse declaring 125 Hz or slower, and not forced', () => {
    expect(offerFor(signals({ emit: emit({ advertisedHz: 125 }) }))).toEqual({ kind: 'logitech', hz: 125 });
    expect(offerFor(signals({ emit: emit({ advertisedHz: 100 }) }))).toEqual({ kind: 'logitech', hz: 100 });
    // A force stood but never applied, imperfect clone being off: the fix still has work to do.
    expect(offerFor(signals({ emit: emit({ advertisedHz: 125, forceHz: 1000 }) }))).toEqual({ kind: 'logitech', hz: 125 });
  });

  it('offers no Logitech fix for a keyboard, a fast mouse, one already forced, or one not cloned', () => {
    expect(offerFor(signals({ device: device(0x046d, 0xc33f, DEVICE_KIND_KEYBOARD), emit: emit({ advertisedHz: 125 }) }))).toBeNull();
    expect(offerFor(signals({ emit: emit({ advertisedHz: 1000 }) }))).toBeNull();
    expect(offerFor(signals({ emit: emit({ advertisedHz: 1000, forceHz: 1000, forceActive: true }) }))).toBeNull();
    expect(offerFor(signals({ emit: emit({ advertisedHz: 0 }) }))).toBeNull();
    expect(offerFor(signals({ device: device(0x1234, 0x0001), emit: emit({ advertisedHz: 125 }) }))).toBeNull();
  });

  it('notes a Razer mouse measured at 125 Hz, and only once the box is sure of the rate', () => {
    const razer = device(0x1532, 0x00c1);
    expect(offerFor(signals({ device: razer, rate: { nativePeriodUs: 8000, pollPeriodUs: 1000, confident: true, changeDriven: false } }))).toEqual({ kind: 'razer' });
    expect(offerFor(signals({ device: razer, rate: { nativePeriodUs: 8000, pollPeriodUs: 1000, confident: false, changeDriven: false } }))).toBeNull();
    expect(offerFor(signals({ device: razer, rate: { nativePeriodUs: 1000, pollPeriodUs: 1000, confident: true, changeDriven: false } }))).toBeNull();
    expect(offerFor(signals({ device: device(0x1532, 0x0266, DEVICE_KIND_KEYBOARD), rate: { nativePeriodUs: 8000, pollPeriodUs: 1000, confident: true, changeDriven: false } }))).toBeNull();
  });

  it('offers nothing it cannot read yet, and nothing for a box with no device', () => {
    expect(offerFor(signals({ imperfect: null, emit: null }))).toBeNull();
    expect(offerFor(signals({ device: NOTHING, emit: emit({ advertisedHz: 0 }) }))).toBeNull();
    expect(offerFor(signals({ version: null }))).toBeNull();
  });

  it('keys an offer by its device, and a device the box reads no ids for as one', () => {
    expect(offerKey(signals())).toBe('046d:c547');
    expect(offerKey(signals({ device: NOTHING }))).toBe('unread');
  });
});

// A box that answers as the flow's reads and writes go: a script of what each read returns, in turn.
function box(script: { emit: (EmitPace | null)[]; imperfect: (ImperfectStatus | null)[]; pending?: number }) {
  let t = 0;
  let pending = script.pending ?? 0;
  const at = { emit: 0, imperfect: 0 };
  const next = <K extends 'emit' | 'imperfect'>(k: K) => {
    const list = script[k] as unknown[];
    const v = list[Math.min(at[k], list.length - 1)];
    at[k]++;
    return v;
  };
  const writes: string[] = [];
  const io: FixIO = {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    confirmed: async () => (pending-- > 0 ? false : true),
    emit: async () => next('emit') as EmitPace | null,
    imperfect: async () => next('imperfect') as ImperfectStatus | null,
    setEmit: async (mode, rate, force) => {
      writes.push(`emit ${mode} ${rate} ${force}`);
    },
    allowImperfect: async () => {
      writes.push('allow');
    },
  };
  return { io, writes, elapsed: () => t };
}

const FIXED = (over: Partial<EmitPace> = {}) => emit({ mode: EmitMode.Fixed, fixedHz: 1000, forceHz: 1000, ...over });

describe('logitechFix', () => {
  it('sets the rate and imperfect clone, rides out the restart, and ends at 1000 Hz', async () => {
    const b = box({
      emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 125 }), null, null, null, FIXED({ advertisedHz: 1000, forceActive: true })],
      imperfect: [imp(), imp({ allowed: true })],
    });
    expect(await logitechFix(b.io)).toEqual({ kind: 'fast' });
    expect(b.writes).toEqual(['emit 2 1000 1000', 'allow']);
  });

  it('takes the force off again for a device that goes slower forced than as it was', async () => {
    const b = box({
      emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 125 }), FIXED({ advertisedHz: 62, forceActive: true }), FIXED({ forceHz: 0, advertisedHz: 125 })],
      imperfect: [imp(), imp({ allowed: true })],
    });
    expect(await logitechFix(b.io)).toEqual({ kind: 'native', hz: 125 });
    expect(b.writes).toEqual(['emit 2 1000 1000', 'allow', 'emit 2 1000 0']);
  });

  it('says what a forced device runs at when its speed caps it below 1000 Hz', async () => {
    const b = box({ emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 500, forceActive: true })], imperfect: [imp({ allowed: true })] });
    expect(await logitechFix(b.io)).toEqual({ kind: 'capped', hz: 500 });
  });

  it('asks for a replug when the box keeps the old rate, and when the mouse never comes back', async () => {
    const stuck = box({ emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 125 })], imperfect: [imp({ allowed: true })] });
    expect(await logitechFix(stuck.io)).toEqual({ kind: 'replug', hz: 125 });
    const gone = box({ emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 125 }), FIXED({ advertisedHz: 0 })], imperfect: [imp({ allowed: true })] });
    expect(await logitechFix(gone.io)).toEqual({ kind: 'gone' });
  });

  it('changes nothing while the box is still checking a new firmware', async () => {
    const b = box({ emit: [emit({ advertisedHz: 125 })], imperfect: [imp()], pending: 1000 });
    expect(await logitechFix(b.io)).toEqual({ kind: 'checking' });
    expect(b.writes).toEqual([]);
  });

  it('waits out a short check, then applies', async () => {
    const b = box({ emit: [emit({ advertisedHz: 125 }), FIXED({ advertisedHz: 1000, forceActive: true })], imperfect: [imp(), imp({ allowed: true })], pending: 3 });
    expect(await logitechFix(b.io)).toEqual({ kind: 'fast' });
  });

  it('gives up with the box refusing after four tries', async () => {
    const b = box({ emit: [emit({ advertisedHz: 125 })], imperfect: [imp()] });
    expect(await logitechFix(b.io)).toEqual({ kind: 'refused' });
    expect(b.writes).toEqual(['emit 2 1000 1000', 'emit 2 1000 1000', 'emit 2 1000 1000', 'emit 2 1000 1000']);
  });

  it('writes nothing already set, and only waits for the force', async () => {
    const b = box({ emit: [FIXED({ advertisedHz: 125 }), FIXED({ advertisedHz: 1000, forceActive: true })], imperfect: [imp({ allowed: true })] });
    expect(await logitechFix(b.io)).toEqual({ kind: 'fast' });
    expect(b.writes).toEqual([]);
  });

  it('is done within about a minute however the box answers', async () => {
    const b = box({ emit: [emit({ advertisedHz: 125 }), null], imperfect: [imp(), null] });
    await logitechFix(b.io);
    expect(b.elapsed()).toBeLessThanOrEqual(90_000);
  });
});

describe('a box that never answers', () => {
  it('says so, rather than that it is checking a firmware', async () => {
    const b = box({ emit: [null], imperfect: [null] });
    b.io.confirmed = async () => null;
    expect(await allowImperfect(b.io)).toEqual({ kind: 'silent' });
    expect(await logitechFix(b.io)).toEqual({ kind: 'silent' });
    expect(b.writes).toEqual([]);
  });
});

describe('allowImperfect', () => {
  it('allows it and waits for the box to clone the device again', async () => {
    const b = box({ emit: [emit()], imperfect: [imp({ overCapacity: true }), null, null, imp({ allowed: true, overCapacity: true })] });
    expect(await allowImperfect(b.io)).toEqual({ kind: 'allowed' });
    expect(b.writes).toEqual(['allow']);
  });

  it('changes nothing while the box is checking a new firmware, and says so', async () => {
    const b = box({ emit: [emit()], imperfect: [imp({ overCapacity: true })], pending: 1000 });
    expect(await allowImperfect(b.io)).toEqual({ kind: 'checking' });
    expect(b.writes).toEqual([]);
  });

  it('reports a box that never takes it', async () => {
    const b = box({ emit: [emit()], imperfect: [imp({ overCapacity: true })] });
    expect(await allowImperfect(b.io)).toEqual({ kind: 'refused' });
  });
});
