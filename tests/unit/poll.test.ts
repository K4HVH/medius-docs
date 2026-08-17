import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { KEEPALIVE_MS, SILENCE_CLEAR_MS, createPoller } from '../../src/app/pages/dashboard/poll';
import type { SerialLink } from '../../src/dashboard/serial';

// A link stub that counts calls per query and resolves on demand, so a test can drive the poller's
// scheduling without a serial port.
const makeLink = () => {
  const calls = { health: 0, locks: 0, emit: 0 };
  return {
    calls,
    link: {
      queryHealth: async () => {
        calls.health++;
        return { linkUp: true } as never;
      },
      queryLocks: async () => {
        calls.locks++;
        return { entries: [] } as never;
      },
      queryEmitPace: async () => {
        calls.emit++;
        return { mode: 0, fixedHz: 0, resolvedHz: 0 } as never;
      },
    } as unknown as SerialLink,
  };
};

// Let the poller's pending promise chain settle without advancing wall-clock time.
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('dashboard poller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the keepalive faster than the box clears its state', () => {
    // Every Control-tab feature is dropped by the box after this long with no inbound frame, so
    // this is a correctness bound, not a display preference.
    expect(KEEPALIVE_MS).toBeLessThan(SILENCE_CLEAR_MS);
  });

  it('shares one query across every subscriber of the same value', async () => {
    const { calls, link } = makeLink();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      poller.subscribe('health', 1000);
      poller.subscribe('health', 1000);
      poller.subscribe('health', 1000);
      await settle();
      // Three cards asking for health is still one round trip, not three.
      expect(calls.health).toBe(1);
      dispose();
    });
  });

  it('runs at the shortest interval any subscriber asked for', async () => {
    const { calls, link } = makeLink();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      poller.subscribe('locks', 4000);
      poller.subscribe('locks', 200);
      await settle();
      const first = calls.locks;
      await vi.advanceTimersByTimeAsync(250);
      await settle();
      expect(calls.locks).toBeGreaterThan(first);
      dispose();
    });
  });

  it('stops querying once nothing is subscribed', async () => {
    const { calls, link } = makeLink();
    await createRoot(async (outer) => {
      const poller = createPoller(() => link);
      let drop = () => {};
      createRoot((inner) => {
        poller.subscribe('emit', 100);
        drop = inner;
      });
      await settle();
      expect(calls.emit).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(250);
      await settle();
      expect(calls.emit).toBeGreaterThan(1);
      // Unmounting the only card that wanted this value must end its round trips, not leave a
      // timer running for a card that no longer exists.
      drop();
      await settle();
      const after = calls.emit;
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(calls.emit).toBe(after);
      outer();
    });
  });

  it('does not query while the link is null', async () => {
    const { calls, link } = makeLink();
    const [live, setLive] = createSignal(false);
    await createRoot(async (dispose) => {
      const poller = createPoller(() => (live() ? link : null));
      poller.subscribe('health', 100);
      await settle();
      expect(calls.health).toBe(0);
      setLive(true);
      await vi.advanceTimersByTimeAsync(150);
      await settle();
      expect(calls.health).toBeGreaterThan(0);
      dispose();
    });
  });

  it('drops cached values on reset, so one box never shows another box numbers', async () => {
    const { link } = makeLink();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      const health = poller.subscribe('health', 1000);
      await settle();
      expect(health()).not.toBeNull();
      poller.reset();
      expect(health()).toBeNull();
      dispose();
    });
  });

  it('refresh re-reads at once instead of waiting out the interval', async () => {
    const { calls, link } = makeLink();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      poller.subscribe('locks', 60_000);
      await settle();
      const before = calls.locks;
      poller.refresh('locks');
      await settle();
      expect(calls.locks).toBe(before + 1);
      dispose();
    });
  });

  it('polls health on its own, faster than the box clears its state', async () => {
    // The keepalive is the poller's own job, not a card's. When it lived on a subscription in the
    // context, deleting that line passed the whole suite while every Control-tab feature silently
    // stopped surviving more than a second.
    const { calls, link } = makeLink();
    await createRoot(async (dispose) => {
      createPoller(() => link);
      await settle();
      await vi.advanceTimersByTimeAsync(SILENCE_CLEAR_MS);
      await settle();
      expect(calls.health).toBeGreaterThan(1);
      dispose();
    });
  });

  it('floors an interval a caller asks to be faster than', async () => {
    const { calls, link } = makeLink();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      poller.subscribe('locks', 0);
      await settle();
      await vi.advanceTimersByTimeAsync(50);
      await settle();
      // A zero interval would busy-poll the link; the floor keeps one 50 ms window to one query.
      expect(calls.locks).toBe(1);
      dispose();
    });
  });

  it('never shows one box a value that was in flight to another', async () => {
    // The reply for box A can land after the link has already been swapped for box B. Writing it
    // then would put A's numbers on screen while connected to B.
    let resolveA: ((v: unknown) => void) | null = null;
    const linkA = {
      queryLocks: () =>
        new Promise((r) => {
          resolveA = r;
        }),
    } as unknown as SerialLink;
    const linkB = { queryLocks: async () => ({ entries: ['B'] }) } as unknown as SerialLink;

    const [which, setWhich] = createSignal(linkA);
    await createRoot(async (dispose) => {
      const poller = createPoller(() => which());
      const locks = poller.subscribe('locks', 10_000);
      await settle();
      setWhich(linkB);
      resolveA?.({ entries: ['A'] });
      await settle();
      expect(locks()).toBeNull();
      dispose();
    });
  });

  it('an unsubscribe during an in-flight query ends the loop', async () => {
    // The stub in the other tests resolves immediately, so the subscriber is always dropped
    // between ticks and the in-flight case never runs.
    let release: ((v: unknown) => void) | null = null;
    let calls = 0;
    const link = {
      queryLocks: () => {
        calls++;
        return new Promise((r) => {
          release = r;
        });
      },
    } as unknown as SerialLink;

    await createRoot(async (outer) => {
      const poller = createPoller(() => link);
      let drop = () => {};
      createRoot((inner) => {
        poller.subscribe('locks', 50);
        drop = inner;
      });
      await settle();
      expect(calls).toBe(1);
      drop();
      release?.({ entries: [] });
      await settle();
      await vi.advanceTimersByTimeAsync(500);
      await settle();
      expect(calls).toBe(1);
      outer();
    });
  });

  it('a slow reply does not stack overlapping queries', async () => {
    // The old cards used setInterval around an async refresh, so a reply slower than the interval
    // left several in flight at once and an older one could land last with a stale value. The
    // interval must be the gap between replies, not a fixed firing rate.
    const REPLY_MS = 300;
    const INTERVAL_MS = 100;
    let inFlight = 0;
    let maxInFlight = 0;
    let starts = 0;
    const link = {
      queryLocks: async () => {
        starts++;
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((r) => setTimeout(r, REPLY_MS));
        inFlight--;
        return { entries: [] } as never;
      },
    } as unknown as SerialLink;

    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      poller.subscribe('locks', INTERVAL_MS);
      await settle();
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
      expect(maxInFlight).toBe(1);
      // 2000 ms of 300 ms replies spaced 100 ms apart is at most 6 round trips; firing every
      // 100 ms regardless would be 20.
      expect(starts).toBeLessThanOrEqual(6);
      expect(starts).toBeGreaterThan(1);
      dispose();
    });
  });
});
