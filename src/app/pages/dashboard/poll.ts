// One poller for the dashboard: shared timers, deduplicated subscribers, and a query stops once
// nothing watches it.

import { type Accessor, createSignal, onCleanup } from 'solid-js';
import type {
  Bearing,
  Caps,
  CatchState,
  ClipStatus,
  DeviceInfo,
  EmitPace,
  Render,
  Spread,
  Health,
  ImperfectStatus,
  Locks,
  Rate,
  RewriteTable,
  PatchSet,
  TransformTable,
  Stats,
  Version,
} from '../../../dashboard/protocol';
import { type SerialLink, UnreadableReplyError } from '../../../dashboard/serial';

export interface PollValues {
  health: Health;
  version: Version;
  deviceInfo: DeviceInfo;
  caps: Caps;
  rate: Rate;
  stats: Stats;
  locks: Locks;
  catch: CatchState;
  imperfect: ImperfectStatus;
  moveRide: number;
  bearing: Bearing;
  emit: EmitPace;
  render: Render;
  spread: Spread;
  clip: ClipStatus;
  rewrite: RewriteTable;
  patches: PatchSet;
  transforms: TransformTable;
}

export type PollKey = keyof PollValues;

const RUN: { [K in PollKey]: (l: SerialLink) => Promise<PollValues[K]> } = {
  health: (l) => l.queryHealth(),
  version: (l) => l.queryVersion(),
  deviceInfo: (l) => l.queryDeviceInfo(),
  caps: (l) => l.queryCaps(),
  rate: (l) => l.queryRate(),
  stats: (l) => l.queryStats(),
  locks: (l) => l.queryLocks(),
  catch: (l) => l.queryCatch(),
  imperfect: (l) => l.queryImperfect(),
  moveRide: (l) => l.queryMovementRiding(),
  bearing: (l) => l.queryBearing(),
  emit: (l) => l.queryEmitPace(),
  render: (l) => l.queryRender(),
  spread: (l) => l.querySpread(),
  clip: (l) => l.queryClip(),
  rewrite: (l) => l.queryRewrite(),
  patches: (l) => l.queryPatches(),
  transforms: (l) => l.queryTransforms(),
};

// The box drops injection, locks, the catch table and the clip after this long without a control
// frame.
export const SILENCE_CLEAR_MS = 1000;
export const KEEPALIVE_MS = SILENCE_CLEAR_MS / 2;

// Default intervals. Persistent options sit at 4 s: only another client changes them, and a write
// refreshes at once.
const DEFAULT_MS: Record<PollKey, number> = {
  health: KEEPALIVE_MS,
  version: 4000,
  deviceInfo: 2000,
  caps: 2000,
  rate: 2000,
  stats: 2000,
  locks: 1000,
  // Events arrive unsolicited; this reads drop counts, the clock estimate and the table.
  catch: 2000,
  imperfect: 4000,
  moveRide: 4000,
  bearing: 4000,
  emit: 4000,
  render: 4000,
  spread: 4000,
  clip: 1000,
  // Session state a safety clear releases, so the editors poll fast.
  rewrite: 1000,
  transforms: 1000,
  // Patches persist, so only a client changes them; a write refreshes at once.
  patches: 2000,
};

const MIN_MS = 100;

interface Slot {
  read: Accessor<unknown>;
  write: (v: unknown) => void;
  // The last reply's layout didn't decode. A decoded value clears it; a miss leaves it.
  unreadable: Accessor<boolean>;
  setUnreadable: (v: boolean) => void;
  // Token to requested interval; the slot runs at the smallest.
  subs: Map<symbol, number>;
  timer: ReturnType<typeof setTimeout> | null;
  // Bumped to abandon an in-flight tick, whose link may have changed.
  gen: number;
}

export interface Poller {
  // Subscribe for the lifetime of the calling component. Returns null until the first reply lands.
  subscribe<K extends PollKey>(key: K, everyMs?: number): Accessor<PollValues[K] | null>;
  // True when the box replies in a layout this build can't decode; the value then stays null.
  unreadable(key: PollKey): Accessor<boolean>;
  // Re-read now; call after a write.
  refresh(key: PollKey): void;
  // Drop every cached value and restart the live slots, for a link change.
  reset(): void;
}

export function createPoller(link: Accessor<SerialLink | null>): Poller {
  const slots = new Map<PollKey, Slot>();

  const slotFor = (key: PollKey): Slot => {
    let s = slots.get(key);
    if (!s) {
      const [read, write] = createSignal<unknown>(null);
      const [unreadable, setUnreadable] = createSignal(false);
      s = { read, write: (v) => write(() => v), unreadable, setUnreadable, subs: new Map(), timer: null, gen: 0 };
      slots.set(key, s);
    }
    return s;
  };

  const intervalOf = (s: Slot): number => {
    let ms = Infinity;
    for (const v of s.subs.values()) ms = Math.min(ms, v);
    return Number.isFinite(ms) ? Math.max(MIN_MS, ms) : MIN_MS;
  };

  const tick = async (key: PollKey, gen: number): Promise<void> => {
    const s = slots.get(key);
    if (!s || s.gen !== gen) return;
    const l = link();
    // Skipped with no link only to save a thrown call per tick.
    if (l) {
      try {
        const v = await RUN[key](l);
        // A reset or link change during the round trip makes this value stale.
        if (s.gen !== gen || link() !== l) return;
        s.write(v);
        s.setUnreadable(false);
      } catch (e) {
        // A transient miss is fine; the next tick tries again. A real drop closes the link.
        if (e instanceof UnreadableReplyError && s.gen === gen && link() === l) s.setUnreadable(true);
      }
    }
    // Only avoids arming a timer the top check would reject.
    if (s.gen !== gen) return;
    s.timer = setTimeout(() => void tick(key, gen), intervalOf(s));
  };

  // The only way a loop starts, so one runs per slot: bumping the generation strands the old one.
  const restart = (key: PollKey): void => {
    const s = slotFor(key);
    if (s.timer !== null) {
      clearTimeout(s.timer);
      s.timer = null;
    }
    s.gen++;
    if (s.subs.size > 0) void tick(key, s.gen);
  };

  const subscribe = <K extends PollKey>(key: K, everyMs?: number): Accessor<PollValues[K] | null> => {
    const s = slotFor(key);
    const token = Symbol(key);
    const before = s.subs.size === 0 ? Infinity : intervalOf(s);
    s.subs.set(token, Math.max(MIN_MS, everyMs ?? DEFAULT_MS[key]));
    // A first subscriber starts the loop; a faster later one restarts it so its interval applies now.
    if (intervalOf(s) < before) restart(key);
    onCleanup(() => {
      s.subs.delete(token);
      if (s.subs.size === 0) {
        s.gen++;
        if (s.timer !== null) {
          clearTimeout(s.timer);
          s.timer = null;
        }
      }
    });
    return s.read as Accessor<PollValues[K] | null>;
  };

  const refresh = (key: PollKey): void => {
    if (slots.has(key)) restart(key);
  };

  const reset = (): void => {
    for (const [key, s] of slots) {
      s.write(null);
      s.setUnreadable(false);
      restart(key);
    }
  };

  // The keepalive lives here rather than in a card.
  subscribe('health', KEEPALIVE_MS);

  if (typeof document !== 'undefined') {
    // On tab return, re-read everything rather than wait out a clamped interval.
    const onVisible = () => {
      if (!document.hidden) for (const key of slots.keys()) refresh(key);
    };
    document.addEventListener('visibilitychange', onVisible);
    onCleanup(() => document.removeEventListener('visibilitychange', onVisible));
  }

  const unreadable = (key: PollKey): Accessor<boolean> => slotFor(key).unreadable;

  return { subscribe, unreadable, refresh, reset };
}
