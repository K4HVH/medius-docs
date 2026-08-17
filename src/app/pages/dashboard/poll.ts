// One poller for the whole dashboard. Cards ask for a value and get a signal; the poller owns the
// timers, deduplicates subscribers, and stops a query the moment nothing is watching it.
//
// It exists because the control link is one 4 Mbaud pipe shared with the catch event stream. Four
// cards each running their own interval put a steady round-trip load on that pipe whether or not
// anyone was looking, and the persistent-option reads repeated four times a second for values that
// only change when the dashboard changes them.

import { type Accessor, createSignal, onCleanup } from 'solid-js';
import type {
  Caps,
  CatchState,
  ClipStatus,
  DeviceInfo,
  EmitPace,
  Health,
  ImperfectStatus,
  Locks,
  Rate,
  Stats,
  Version,
} from '../../../dashboard/protocol';
import type { SerialLink } from '../../../dashboard/serial';

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
  emit: EmitPace;
  clip: ClipStatus;
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
  emit: (l) => l.queryEmitPace(),
  clip: (l) => l.queryClip(),
};

// The box drops injection, locks, the catch table and the loaded clip after this long with no
// inbound control frame, and any valid frame resets that timer. Everything the Control tab does
// therefore depends on something being polled faster than this.
export const SILENCE_CLEAR_MS = 1000;
export const KEEPALIVE_MS = SILENCE_CLEAR_MS / 2;

// The interval a subscriber gets when it does not ask for one. Persistent options sit at 4 s
// because only another client can change them behind our back; a write refreshes them at once.
const DEFAULT_MS: Record<PollKey, number> = {
  health: KEEPALIVE_MS,
  version: 4000,
  deviceInfo: 2000,
  caps: 2000,
  rate: 2000,
  stats: 2000,
  locks: 1000,
  // Catch events and log lines arrive unsolicited, so this query is only the drop counts, the
  // clock estimate and the accepted table. None of that needs keepalive cadence; the health poll
  // is what holds the subscription alive.
  catch: 2000,
  imperfect: 4000,
  moveRide: 4000,
  emit: 4000,
  clip: 1000,
};

const MIN_MS = 100;

interface Slot {
  read: Accessor<unknown>;
  write: (v: unknown) => void;
  // Token to requested interval. The slot runs at the smallest interval anyone asked for, so one
  // card wanting a fast readout speeds the shared query up rather than starting a second one.
  subs: Map<symbol, number>;
  timer: ReturnType<typeof setTimeout> | null;
  // Bumped to abandon an in-flight tick. A tick that resolves after its generation is stale must
  // not write its value: the link may have changed underneath it.
  gen: number;
}

export interface Poller {
  // Subscribe for the lifetime of the calling component. Returns null until the first reply lands.
  subscribe<K extends PollKey>(key: K, everyMs?: number): Accessor<PollValues[K] | null>;
  // Re-read now, without waiting for the next tick. Call it after a write so the readout reflects
  // what was just set instead of showing the old value for up to one interval.
  refresh(key: PollKey): void;
  // Drop every cached value and restart the live slots. For a link change, where holding the
  // previous box's numbers on screen would be worse than showing nothing.
  reset(): void;
}

export function createPoller(link: Accessor<SerialLink | null>): Poller {
  const slots = new Map<PollKey, Slot>();

  const slotFor = (key: PollKey): Slot => {
    let s = slots.get(key);
    if (!s) {
      const [read, write] = createSignal<unknown>(null);
      s = { read, write: (v) => write(() => v), subs: new Map(), timer: null, gen: 0 };
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
    // Skipped while there is no link, purely to avoid a thrown call per tick; the catch below would
    // swallow it either way, so this is cost, not correctness.
    // Polled even while the tab is hidden. Nothing on screen needs it, but the box drops every
    // injected hold, every lock, the catch table and the loaded clip after a second with no
    // inbound frame, and this poll is what prevents that. Browsers clamp a hidden tab's timers to
    // about a second, so this is best effort rather than a guarantee; the cards watch the health
    // flags and report it when the box clears anyway.
    if (l) {
      try {
        const v = await RUN[key](l);
        // Re-check after the await: a reset or a link change during the round trip means this
        // value belongs to a box we are no longer talking to.
        if (s.gen !== gen || link() !== l) return;
        s.write(v);
      } catch {
        // A transient miss is fine; the next tick tries again. A real drop closes the link.
      }
    }
    // The check at the top of the tick is what actually stops a stale loop; this one only avoids
    // arming a timer that would immediately fail that check.
    if (s.gen !== gen) return;
    s.timer = setTimeout(() => void tick(key, gen), intervalOf(s));
  };

  // Restart a slot's loop from now. Always the way a loop starts, so there is exactly one running
  // per slot: bumping the generation strands whatever was already scheduled.
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
    // A first subscriber starts the loop. A later one that wants it faster restarts it, so the
    // shorter interval applies now rather than after the tick already scheduled at the old one.
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
      restart(key);
    }
  };

  // The keepalive lives here rather than in a card. The box drops every injected hold, every lock,
  // the catch table and the loaded clip after SILENCE_CLEAR_MS with no inbound frame, and any valid
  // frame resets that timer. Owning it here means no card can take it away by not needing health.
  subscribe('health', KEEPALIVE_MS);

  if (typeof document !== 'undefined') {
    // Coming back to the tab, read everything again rather than waiting out a clamped interval.
    const onVisible = () => {
      if (!document.hidden) for (const key of slots.keys()) refresh(key);
    };
    document.addEventListener('visibilitychange', onVisible);
    onCleanup(() => document.removeEventListener('visibilitychange', onVisible));
  }

  return { subscribe, refresh, reset };
}
