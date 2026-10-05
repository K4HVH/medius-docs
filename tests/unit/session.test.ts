import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import {
  IDENTIFY_MS,
  REATTACH_MS,
  type SessionHooks,
  createBoxSession,
} from '../../src/app/pages/dashboard/session';
import { KEEPALIVE_MS } from '../../src/app/pages/dashboard/poll';
import { LedMode, LedTarget } from '../../src/dashboard/protocol';
import type { Probe } from '../../src/dashboard/serial';
import { DEVICE, FakeBox, FakePort, asPort, makeFakeLink, settle } from './fake-boxes';

const sessions: { dispose: () => void }[] = [];

const open = (box: FakeBox | null, opts: { probe?: Probe | null; hooks?: Partial<SessionHooks> } = {}) => {
  const port = new FakePort(box);
  const [flashing, setFlashing] = createSignal(false);
  const held = vi.fn();
  const released = vi.fn();
  const s = createBoxSession(
    { port: asPort(port), probe: opts.probe ?? null },
    {
      supported: true,
      secure: true,
      nativeFlashing: flashing,
      makeLink: makeFakeLink,
      held,
      released,
      ...opts.hooks,
    },
  );
  sessions.push(s.ctl);
  return { ...s, port, setFlashing, held, released };
};

const probed = (box: FakeBox): Probe => ({ kind: 'box', version: box.version, device: DEVICE, baud: box.baud });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  while (sessions.length) sessions.pop()!.dispose();
  vi.useRealTimers();
});

// A dead box fails each read at once.
const keepalives = (n: number) => vi.advanceTimersByTimeAsync(KEEPALIVE_MS * n);

describe('box session', () => {
  it('attaches at the probed rate first and becomes connected and held', async () => {
    const box = new FakeBox({ baud: 4_000_000, name: 'Desk' });
    const { api, held } = open(box, { probe: probed(box) });
    await api.connect();
    expect(box.opens).toEqual([4_000_000]);
    expect(api.status()).toBe('connected');
    expect(api.held()).toBe(true);
    expect(api.version()?.name).toBe('Desk');
    expect(held).toHaveBeenCalledWith(box.mac, 'Desk');
  });

  it('a probe that arrives later also sets the rate tried first', async () => {
    const box = new FakeBox({ baud: 4_000_000 });
    const { api, ctl } = open(box);
    ctl.setProbe(probed(box));
    await api.connect();
    expect(box.opens).toEqual([4_000_000]);
  });

  it('a failed attach is a verdict on the session and a probe the list can show', async () => {
    const box = new FakeBox();
    box.busy = true;
    const { api } = open(box, { probe: probed(box) });
    await api.connect();
    expect(api.status()).toBe('disconnected');
    expect(api.verdict()).toEqual({ kind: 'busy' });
    expect(api.probe()).toEqual({ kind: 'busy' });
    expect(api.held()).toBe(false);
  });

  it('three missed keepalives with no frame go lost, and the link is closed', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(2);
    expect(api.status()).toBe('connected');
    await keepalives(1);
    expect(api.status()).toBe('lost');
    expect(api.link()).toBeNull();
    expect(box.isOpen).toBe(false);
  });

  it('a frame between misses restarts the count, so a streaming box is never lost', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    box.alive = false;
    for (let i = 0; i < 10; i++) {
      await keepalives(1);
      (api.link() as unknown as { lastRxAt: number }).lastRxAt = Date.now();
    }
    expect(api.status()).toBe('connected');
  });

  it('only missed reads count, so a tab whose timers Chrome throttles stays connected', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 120_000);
      await keepalives(1);
    }
    expect(api.status()).toBe('connected');
  });

  it('lost reattaches by itself when the same box answers', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(3);
    expect(api.status()).toBe('lost');
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 3);
    expect(api.status()).toBe('lost');
    box.alive = true;
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    expect(api.status()).toBe('connected');
    expect(api.link()).not.toBeNull();
    expect(api.held()).toBe(true);
  });

  it('lost lets go of a port another box answers on, and stops trying it', async () => {
    const box = new FakeBox();
    const { api, port } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(3);
    const other = new FakeBox({ mac: [1, 2, 3, 4, 5, 6] });
    port.box = other;
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    expect(api.status()).toBe('lost');
    expect(api.present()).toBe(false);
    expect(other.isOpen).toBe(false);
    const tries = other.opens.length;
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 5);
    expect(other.opens.length).toBe(tries);
  });

  it('lost waits while a native flash runs', async () => {
    const box = new FakeBox();
    const { api, setFlashing } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(3);
    setFlashing(true);
    box.alive = true;
    const before = box.opens.length;
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 5);
    expect(box.opens.length).toBe(before);
    setFlashing(false);
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    expect(api.status()).toBe('connected');
  });

  it('a read loop that ends while held goes lost; disconnect stops the reattach and forgets', async () => {
    const box = new FakeBox();
    const { api, released } = open(box);
    await api.connect();
    box.drop();
    await settle();
    expect(api.status()).toBe('lost');
    await api.disconnect();
    expect(api.status()).toBe('disconnected');
    expect(api.held()).toBe(false);
    expect(released).toHaveBeenCalledWith(box.mac);
    const before = box.opens.length;
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 5);
    expect(box.opens.length).toBe(before);
  });

  it('Forget disconnects and forgets the box for good; Disconnect forgets only the connection', async () => {
    const box = new FakeBox();
    const forgotten = vi.fn();
    const { api, released } = open(box, { hooks: { forgotten } });
    await api.connect();
    await api.disconnect();
    expect(released).toHaveBeenCalledWith(box.mac);
    expect(forgotten).not.toHaveBeenCalled();
    await api.connect();
    box.drop();
    await settle();
    await api.forget();
    expect(api.status()).toBe('disconnected');
    expect(api.held()).toBe(false);
    expect(forgotten).toHaveBeenCalledWith(box.mac);
  });

  it('a lost box replugged on a new port is picked up there', async () => {
    const box = new FakeBox();
    const { api, ctl } = open(box);
    await api.connect();
    ctl.setPort(null);
    box.drop();
    await settle();
    expect(api.status()).toBe('lost');
    expect(api.present()).toBe(false);
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 3);
    const moved = new FakePort(box);
    ctl.setPort(asPort(moved));
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    expect(api.status()).toBe('connected');
    expect((api.link() as unknown as { port: FakePort }).port).toBe(moved);
  });

  it('a box the user disconnected stays disconnected when its port returns', async () => {
    const box = new FakeBox();
    const { api, ctl } = open(box);
    await api.connect();
    ctl.setPort(null);
    box.drop();
    await settle();
    await api.disconnect();
    expect(api.held()).toBe(false);
    ctl.setPort(asPort(new FakePort(box)));
    await settle();
    expect(api.status()).toBe('disconnected');
  });

  it('identify on a held box blinks both chips, then returns the LED to auto', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    const run = api.identify();
    await settle();
    expect(api.identifying()).toBe(true);
    expect(box.leds).toEqual([[LedTarget.Both, LedMode.Blink, 255]]);
    await vi.advanceTimersByTimeAsync(IDENTIFY_MS);
    await run;
    expect(box.leds.at(-1)).toEqual([LedTarget.Both, LedMode.Auto, 0]);
    expect(api.identifying()).toBe(false);
  });

  it('identify does nothing on a box that is not connected', async () => {
    const box = new FakeBox();
    const { api } = open(box, { probe: probed(box) });
    const run = api.identify();
    expect(api.identifying()).toBe(false);
    await run;
    expect(box.opens).toEqual([]);
    expect(box.leds).toEqual([]);
  });
  it('the name follows the box, so a rename shows without reconnecting', async () => {
    const box = new FakeBox({ name: 'Desk' });
    const { api, held } = open(box);
    await api.connect();
    expect(api.name()).toBe('Desk');
    // As the Options card does.
    const card = createRoot((dispose) => {
      api.poll('version');
      return dispose;
    });
    box.rename('Left');
    api.refreshPoll('version');
    await settle();
    expect(api.name()).toBe('Left');
    expect(held).toHaveBeenLastCalledWith(box.mac, 'Left');
    card();
  });

  it('a box known only from a probe is named by it', () => {
    const box = new FakeBox({ name: 'Spare' });
    const { api } = open(box, { probe: probed(box) });
    expect(api.name()).toBe('Spare');
    expect(api.present()).toBe(true);
  });

  it('a session with no port asks the registry, and shows what it said', async () => {
    const acquire = vi.fn(async () => ({ kind: 'no-port' as const }));
    const blank = createBoxSession({ port: null }, { supported: true, secure: true, nativeFlashing: () => false, acquire });
    sessions.push(blank.ctl);
    await blank.api.connect();
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(blank.api.verdict()).toEqual({ kind: 'no-port' });
    expect(blank.api.status()).toBe('disconnected');
  });

  it('a box with a port is connected on that port, never through the chooser', async () => {
    const acquire = vi.fn(async () => null);
    const box = new FakeBox();
    const { api } = open(box, { hooks: { acquire } });
    await api.connect();
    expect(acquire).not.toHaveBeenCalled();
    expect(api.status()).toBe('connected');
  });

  it('Disconnect during a reattach handshake stays disconnected, and closes what that handshake opened', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(3);
    expect(api.status()).toBe('lost');
    box.alive = true;
    const release = box.hold();
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    expect(box.isOpen).toBe(true);
    await api.disconnect();
    release();
    await settle();
    expect(api.status()).toBe('disconnected');
    expect(api.held()).toBe(false);
    expect(box.isOpen).toBe(false);
  });

  it('a held box that comes back on a protocol this page cannot speak stops being retried, and says why', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    box.alive = false;
    await keepalives(3);
    box.version = { ...box.version, protoVer: 4 };
    box.alive = true;
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 2);
    expect(api.status()).toBe('disconnected');
    expect(api.verdict()).toMatchObject({ kind: 'old-firmware' });
    const tries = box.opens.length;
    await vi.advanceTimersByTimeAsync(REATTACH_MS * 5);
    expect(box.opens.length).toBe(tries);
  });

  it('identify blinks for the full IDENTIFY_MS', async () => {
    const box = new FakeBox();
    const { api } = open(box);
    await api.connect();
    void api.identify();
    await vi.advanceTimersByTimeAsync(IDENTIFY_MS - 1);
    expect(box.leds).toEqual([[LedTarget.Both, LedMode.Blink, 255]]);
    await vi.advanceTimersByTimeAsync(1);
    expect(box.leds.at(-1)).toEqual([LedTarget.Both, LedMode.Auto, 0]);
  });

  it('two connects asked for at once make one attach', async () => {
    const box = new FakeBox();
    const { api } = open(box, { probe: probed(box) });
    const release = box.hold();
    const one = api.connect();
    const two = api.connect();
    expect(api.status()).toBe('connecting');
    release();
    await Promise.all([one, two]);
    expect(api.status()).toBe('connected');
    expect(api.verdict()).toBeNull();
    expect(box.opens).toEqual([6_000_000]);
    expect(box.doubleOpens).toBe(0);
  });

  it('another box answering on the port gives it up without blaming the cables', async () => {
    const box = new FakeBox();
    const { api, port } = open(box, { probe: probed(box) });
    port.box = new FakeBox({ mac: [1, 2, 3, 4, 5, 6] });
    await api.connect();
    expect(api.present()).toBe(false);
    expect(api.verdict()).toBeNull();
  });
});
