import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMemo, createRoot, createSignal } from 'solid-js';
import { type Boxes, NEW_BOX, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { REATTACH_MS } from '../../src/app/pages/dashboard/session';
import { STORE_KEY, createBoxStore } from '../../src/app/pages/dashboard/store';
import { probePort } from '../../src/dashboard/serial';
import { FakeBox, FakeLocks, FakePort, FakeSerial, asPort, makeFakeLink, otherTab, settle } from './fake-boxes';

const probes: SerialPort[] = [];
const fakeProbe = (p: SerialPort) => {
  probes.push(p);
  return probePort(p, (pp) => makeFakeLink(pp, {}));
};

const roots: (() => void)[] = [];
const [flashing, setFlashing] = createSignal(false);
const mount = (
  serial: FakeSerial,
  store = createBoxStore(null),
  opts: { start?: boolean; locks?: FakeLocks } = {},
): Boxes =>
  createRoot((dispose) => {
    roots.push(dispose);
    const b = createBoxes({
      serial,
      store,
      supported: true,
      secure: true,
      nativeFlashing: flashing,
      probe: fakeProbe,
      makeLink: makeFakeLink,
      choose: () => serial.choose(),
      locks: opts.locks,
    });
    if (opts.start !== false) b.start();
    return b;
  });

const mac = (n: number) => [0x58, 0x8c, 0x81, 0xe0, 0x82, n];
const box = (n: number, name = `Box ${n}`) => new FakeBox({ mac: mac(n), name });
const portsOf = (...boxes: (FakeBox | null)[]) => boxes.map((b) => new FakePort(b));
const keys = (b: Boxes) => b.entries().map((e) => e.key);
const names = (b: Boxes) => b.entries().map((e) => e.session.name());
const entry = (b: Boxes, key: string) => b.entries().find((e) => e.key === key)!;
const ready = async () => {
  await settle();
  await vi.advanceTimersByTimeAsync(0);
  await settle();
};
// A box picked in the list, then Connect on its card.
const pick = async (b: Boxes, key: string) => {
  b.select(key);
  await b.entries().find((e) => e.key === key)!.session.connect();
  await ready();
};

beforeEach(() => {
  vi.useFakeTimers();
  probes.length = 0;
});
afterEach(() => {
  while (roots.length) roots.pop()!();
  setFlashing(false);
  localStorage.clear();
  vi.useRealTimers();
});

const watch = <T,>(fn: () => T) =>
  createRoot((dispose) => {
    roots.push(dispose);
    return createMemo(fn);
  });

describe('box registry', () => {
  it('lists every granted port by the name its box answers with, in order of first sight', async () => {
    const [a, b, c] = [box(1, 'Desk'), box(2), box(3, 'Spare')];
    b.busy = true;
    const boxes = mount(new FakeSerial(portsOf(a, b, c)));
    await ready();
    expect(keys(boxes)).toEqual([a.mac, expect.stringMatching(/^port:\d+$/), c.mac]);
    expect(names(boxes)).toEqual(['Desk', null, 'Spare']);
    expect(boxes.entries()[1].session.probe()).toEqual({ kind: 'busy' });
  });

  it('a port that never answered is listed by number until it does, then by its MAC', async () => {
    const a = box(1);
    a.alive = false;
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const [anon] = keys(boxes);
    expect(anon).toMatch(/^port:/);
    a.alive = true;
    await pick(boxes, anon);
    expect(keys(boxes)).toEqual([a.mac]);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
    expect(boxes.selected()?.key).toBe(a.mac);
  });

  it('a selected row keeps the selection when its port answers and takes its MAC', async () => {
    const [a, b] = [box(1), box(2)];
    b.alive = false;
    const store = createBoxStore(null);
    store.hold(a.mac, 'Box 1');
    const boxes = mount(new FakeSerial(portsOf(a, b)), store);
    await ready();
    const anon = keys(boxes)[1];
    b.alive = true;
    await pick(boxes, anon);
    expect(boxes.selected()?.key).toBe(b.mac);
    expect(store.selected()).toBe(b.mac);
  });

  it('a remembered box connects when its port is found, and only that box', async () => {
    const [a, b] = [box(1), box(2)];
    const store = createBoxStore(null);
    store.hold(b.mac, 'Box 2');
    const boxes = mount(new FakeSerial(portsOf(a, b)), store);
    await ready();
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
    expect(entry(boxes, a.mac).session.status()).toBe('disconnected');
  });

  it('selecting a box opens nothing; Connect on its card does', async () => {
    const [a, b] = [box(1), box(2)];
    const boxes = mount(new FakeSerial(portsOf(a, b)));
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
    a.opens.length = 0;
    b.opens.length = 0;
    boxes.select(b.mac);
    await ready();
    expect(boxes.scope()).toBe(entry(boxes, b.mac).session);
    expect(b.opens).toEqual([]);
    await boxes.scope().connect();
    await ready();
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
    expect(entry(boxes, a.mac).session.status()).toBe('disconnected');
  });

  it('selection on its own never lands on a port that never answered', async () => {
    const [sim, a] = [box(9), box(1)];
    sim.alive = false;
    const boxes = mount(new FakeSerial(portsOf(sim, a)));
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
    const lone = box(8);
    lone.alive = false;
    const only = mount(new FakeSerial(portsOf(lone)));
    await ready();
    expect(only.selected()).toBeNull();
    expect(only.scope().present()).toBe(false);
  });

  it('selection restores the stored box, else the first held, else the first answering', async () => {
    const [a, b, c] = [box(1), box(2), box(3)];
    let store = createBoxStore(null);
    store.setSelected(c.mac);
    let boxes = mount(new FakeSerial(portsOf(a, b, c)), store);
    await ready();
    expect(boxes.selected()?.key).toBe(c.mac);

    store = createBoxStore(null);
    store.hold(b.mac, 'Box 2');
    boxes = mount(new FakeSerial(portsOf(a, b, c)), store);
    await ready();
    expect(boxes.selected()?.key).toBe(b.mac);

    const busy = box(4);
    busy.busy = true;
    boxes = mount(new FakeSerial(portsOf(busy, a)));
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
  });

  it('unplugging an unheld box removes it; a held one stays, not plugged in', async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    await pick(boxes, b.mac);
    serial.unplug(ports[0]);
    serial.unplug(ports[1]);
    await ready();
    expect(keys(boxes)).toEqual([b.mac]);
    expect(entry(boxes, b.mac).session.present()).toBe(false);
    expect(entry(boxes, b.mac).session.held()).toBe(true);
  });

  it('a held box replugged on another port reconnects there, with no second row', async () => {
    const b = box(2);
    const ports = portsOf(box(1), b);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    await pick(boxes, b.mac);
    serial.unplug(ports[1]);
    await ready();
    const moved = new FakePort(b);
    serial.plug(moved);
    await ready();
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    await ready();
    expect(keys(boxes)).toHaveLength(2);
    const s = entry(boxes, b.mac).session;
    expect(s.status()).toBe('connected');
    expect((s.link() as unknown as { port: FakePort }).port).toBe(moved);
  });

  it('focus re-probes busy ports only; a silent one waits for a click', async () => {
    const [busy, silent] = [box(1), box(2)];
    busy.busy = true;
    silent.alive = false;
    const ports = portsOf(busy, silent);
    mount(new FakeSerial(ports));
    await ready();
    probes.length = 0;
    window.dispatchEvent(new Event('focus'));
    await ready();
    expect(probes).toEqual([asPort(ports[0])]);
  });

  it('a port a session holds is never probed', async () => {
    const a = box(1);
    const ports = portsOf(a);
    const boxes = mount(new FakeSerial(ports));
    await ready();
    await pick(boxes, a.mac);
    probes.length = 0;
    window.dispatchEvent(new Event('focus'));
    await boxes.rescan();
    await ready();
    expect(probes).toEqual([]);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
  });

  it("a second tab lists the first tab's boxes as in use, and never takes them", async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const first = mount(new FakeSerial(ports));
    await ready();
    await pick(first, a.mac);
    await pick(first, b.mac);
    const second = mount(new FakeSerial(otherTab(ports)));
    await ready();
    window.dispatchEvent(new Event('focus'));
    await ready();
    expect(second.entries().map((e) => e.session.probe())).toEqual([{ kind: 'busy' }, { kind: 'busy' }]);
    expect(entry(first, a.mac).session.status()).toBe('connected');
    expect(entry(first, b.mac).session.status()).toBe('connected');
  });

  it('storage that throws leaves the list, selection and connect working', async () => {
    const storage = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as Storage;
    const a = box(1);
    const boxes = mount(new FakeSerial(portsOf(a)), createBoxStore(storage));
    await ready();
    await pick(boxes, a.mac);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
  });

  it('with nothing listed, the page connects whatever is picked in the chooser', async () => {
    const serial = new FakeSerial([]);
    const boxes = mount(serial);
    await ready();
    expect(boxes.selected()).toBeNull();
    const blank = boxes.scope();
    await blank.connect();
    expect(blank.verdict()).toEqual({ kind: 'no-port' });
    const a = box(1);
    serial.chosen = new FakePort(a);
    await blank.connect();
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
    expect(boxes.scope().status()).toBe('connected');
  });

  it('add selects the port picked, connecting it when it answers', async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    serial.chosen = ports[1];
    await boxes.add();
    await ready();
    expect(keys(boxes)).toEqual([a.mac, b.mac]);
    expect(boxes.selected()?.key).toBe(b.mac);
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
  });

  it('connectNew connects the box that answers now and did not before', async () => {
    const [a, b] = [box(1), box(2)];
    b.alive = false;
    const boxes = mount(new FakeSerial(portsOf(a, b)));
    await ready();
    const before = boxes.snapshot();
    expect([...before.answering]).toEqual([a.mac]);
    b.alive = true;
    expect(await boxes.connectNew(before)).toBeNull();
    await ready();
    expect(boxes.selected()?.key).toBe(b.mac);
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
    expect(entry(boxes, a.mac).session.status()).toBe('disconnected');
  });

  it('two ports answering with one MAC keep the first', async () => {
    const [first, second] = [box(1), box(1)];
    const boxes = mount(new FakeSerial(portsOf(first, second)));
    await ready();
    expect(keys(boxes)).toEqual([first.mac]);
    await pick(boxes, first.mac);
    expect(first.isOpen).toBe(true);
    expect(second.isOpen).toBe(false);
  });

  it('a getPorts that rejects leaves an empty list, and Add a box still works', async () => {
    const serial = new FakeSerial([]);
    serial.getPortsFails = true;
    const boxes = mount(serial);
    await ready();
    expect(boxes.entries()).toEqual([]);
    serial.chosen = new FakePort(box(1));
    await boxes.add();
    await ready();
    expect(boxes.entries()).toHaveLength(1);
  });

  it('a connect waits for the startup probe of its port', async () => {
    const a = box(1);
    const release = a.hold();
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const s = boxes.entries()[0].session;
    const connecting = s.connect();
    await ready();
    release();
    await connecting;
    await ready();
    expect(a.doubleOpens).toBe(0);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
    expect(entry(boxes, a.mac).session.verdict()).toBeNull();
  });

  it('never probes a port while its session attaches or reattaches', async () => {
    const a = box(1);
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const s = entry(boxes, a.mac).session;
    const release = a.hold();
    boxes.select(a.mac);
    void s.connect();
    await ready();
    probes.length = 0;
    window.dispatchEvent(new Event('focus'));
    void boxes.rescan();
    await ready();
    expect(probes).toEqual([]);
    release();
    await ready();
    expect(s.status()).toBe('connected');
    a.alive = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.status()).toBe('lost');
    void boxes.rescan();
    await ready();
    expect(probes).toEqual([]);
    expect(a.doubleOpens).toBe(0);
  });

  it('two probes asked for at once open the port once', async () => {
    const a = box(1);
    a.alive = false;
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    a.opens.length = 0;
    await Promise.all([boxes.rescan(), boxes.rescan()]);
    expect(a.opens).toEqual([6_000_000, 4_000_000]);
  });

  it('a row that is not answering explains itself, and a fresh answer clears the old reason', async () => {
    const a = box(1);
    a.busy = true;
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const s = boxes.entries()[0].session;
    expect(s.verdict()).toEqual({ kind: 'busy' });
    await s.connect();
    expect(s.verdict()).toEqual({ kind: 'busy' });
    a.busy = false;
    window.dispatchEvent(new Event('focus'));
    await ready();
    expect(boxes.entries()[0].session.verdict()).toBeNull();
  });

  it('Try again on a silent box retries that box, and connects once it answers', async () => {
    const a = box(1);
    a.alive = false;
    const ports = portsOf(a);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    const s = boxes.entries()[0].session;
    expect(s.verdict()).toEqual({ kind: 'silent' });
    a.alive = true;
    await s.connect();
    await ready();
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
    expect(serial.chooserCalls).toBe(0);
  });

  it('adding a box selects it and keeps it selected over a box already held', async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const serial = new FakeSerial([ports[0]]);
    const store = createBoxStore(null);
    store.hold(a.mac, 'Box 1');
    const boxes = mount(serial, store);
    await ready();
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
    serial.chosen = ports[1];
    await boxes.add();
    await ready();
    expect(boxes.selected()?.key).toBe(b.mac);
    expect(store.selected()).toBe(b.mac);
  });

  it('adding a remembered box on a new port selects that box, with no second row', async () => {
    const [a, b] = [box(1), box(2)];
    // b first, so a fallback would pick b.
    const ports = portsOf(b, a);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    await pick(boxes, b.mac);
    await pick(boxes, a.mac);
    serial.unplug(ports[1]);
    await ready();
    const moved = new FakePort(a);
    serial.chosen = moved;
    const added = await boxes.add();
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    await ready();
    expect(added.ok && added.entry.key).toBe(a.mac);
    expect(keys(boxes)).toEqual([b.mac, a.mac]);
    expect(boxes.selected()?.key).toBe(a.mac);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
  });

  it('selecting a box stores it, and never stores a port that has no MAC', async () => {
    const [a, b] = [box(1), box(2)];
    b.alive = false;
    const store = createBoxStore(null);
    const boxes = mount(new FakeSerial(portsOf(a, b)), store);
    await ready();
    boxes.select(a.mac);
    expect(store.selected()).toBe(a.mac);
    boxes.select(keys(boxes)[1]);
    await ready();
    expect(store.selected()).toBe(a.mac);
  });

  it('a row keeps its identity when its port first answers, so its button keeps focus', async () => {
    const a = box(1);
    a.alive = false;
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const row = boxes.entries()[0];
    a.alive = true;
    await pick(boxes, row.key);
    expect(boxes.entries()[0]).toBe(row);
    expect(row.key).toBe(a.mac);
  });

  it('a selected port that turns out to be a remembered box moves the selection to that box', async () => {
    const [a, b] = [box(1), box(2)];
    // b first, so a fallback would pick b.
    const ports = portsOf(b, a);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    await pick(boxes, b.mac);
    await pick(boxes, a.mac);
    serial.unplug(ports[1]);
    await ready();
    a.alive = false;
    const moved = new FakePort(a);
    serial.plug(moved);
    await ready();
    const anon = keys(boxes).find((k) => k.startsWith('port:'))!;
    boxes.select(anon);
    a.alive = true;
    window.dispatchEvent(new Event('focus'));
    await boxes.rescan();
    await vi.advanceTimersByTimeAsync(REATTACH_MS);
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
  });

  it('only a box answering after the install counts as the one installed', async () => {
    const [a, b] = [box(1), box(2)];
    b.alive = false;
    const store = createBoxStore(null);
    store.hold(a.mac, 'Box 1');
    const serial = new FakeSerial(portsOf(a, b));
    const boxes = mount(serial, store);
    await ready();
    const before = boxes.snapshot();
    expect(await boxes.connectNew(before)).toEqual({ kind: 'no-port' });
    expect(serial.chooserCalls).toBe(1);
  });

  it('a remembered box still connecting after the install is the one installed', async () => {
    const a = box(1);
    a.alive = false;
    const store = createBoxStore(null);
    const serial = new FakeSerial(portsOf(a));
    const boxes = mount(serial, store);
    await ready();
    const before = boxes.snapshot();
    store.hold(a.mac, 'Box 1');
    a.alive = true;
    const release = a.hold();
    const found = boxes.connectNew(before);
    await ready();
    release();
    expect(await found).toBeNull();
    expect(boxes.selected()?.key).toBe(a.mac);
    expect(serial.chooserCalls).toBe(0);
  });

  it('one silent port new since the install reports its verdict', async () => {
    const serial = new FakeSerial([]);
    const boxes = mount(serial);
    await ready();
    const before = boxes.snapshot();
    const a = box(1);
    a.alive = false;
    serial.plug(new FakePort(a));
    await ready();
    expect(await boxes.connectNew(before)).toEqual({ kind: 'silent' });
    expect(serial.chooserCalls).toBe(0);
  });

  it('touches no port until the dashboard is opened', async () => {
    const a = box(1);
    const boxes = mount(new FakeSerial(portsOf(a)), createBoxStore(null), { start: false });
    await ready();
    expect(a.opens).toEqual([]);
    expect(boxes.entries()).toEqual([]);
    boxes.start();
    boxes.start();
    await ready();
    expect(keys(boxes)).toEqual([a.mac]);
    expect(a.opens).toEqual([6_000_000]);
  });

  it('writes to no box while a chip is flashed over its own USB', async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const boxes = mount(new FakeSerial(ports));
    await ready();
    await pick(boxes, a.mac);
    setFlashing(true);
    const queries = a.healthQueries;
    probes.length = 0;
    await vi.advanceTimersByTimeAsync(3000);
    expect(a.healthQueries).toBe(queries);
    boxes.select(b.mac);
    await boxes.rescan();
    await entry(boxes, b.mac).session.identify();
    await ready();
    expect(probes).toEqual([]);
    expect(b.opens).toEqual([6_000_000]);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
  });

  it("a box another tab holds is in use there, even in the moment that tab's port is closed", async () => {
    const a = box(1);
    const ports = portsOf(a);
    const locks = new FakeLocks();
    const shared = new Map<string, string>();
    const storage = {
      getItem: (k: string) => shared.get(k) ?? null,
      setItem: (k: string, v: string) => void shared.set(k, v),
    } as unknown as Storage;
    const first = mount(new FakeSerial(ports), createBoxStore(storage), { locks });
    await ready();
    await pick(first, a.mac);
    const theirs = otherTab(ports);
    const second = mount(new FakeSerial(theirs), createBoxStore(storage), { locks });
    await ready();
    expect(second.entries()[0].session.verdict()).toEqual({ kind: 'busy' });
    // As an update does between activate and reconnect.
    await entry(first, a.mac).session.link()!.close();
    window.dispatchEvent(new Event('focus'));
    await ready();
    expect(second.entries()[0].session.status()).not.toBe('connected');
    expect(second.entries()[0].session.verdict()).toEqual({ kind: 'busy' });
  });

  it('a held box replugged while it still boots is found when it starts answering', async () => {
    const a = box(1);
    const ports = portsOf(a);
    const serial = new FakeSerial(ports);
    const boxes = mount(serial);
    await ready();
    await pick(boxes, a.mac);
    serial.unplug(ports[0]);
    await ready();
    a.alive = false;
    serial.plug(new FakePort(a));
    await ready();
    a.alive = true;
    await vi.advanceTimersByTimeAsync(8000);
    await ready();
    expect(keys(boxes)).toEqual([a.mac]);
    expect(entry(boxes, a.mac).session.status()).toBe('connected');
  });

  it('a port that is not a control adapter is never listed or probed', async () => {
    const rom = new FakePort(box(9), { usbVendorId: 0x303a, usbProductId: 0x0009 });
    const serial = new FakeSerial([rom]);
    const boxes = mount(serial);
    await ready();
    serial.plug(new FakePort(box(8), { usbVendorId: 0x303a, usbProductId: 0x0009 }));
    await ready();
    expect(boxes.entries()).toEqual([]);
    expect(probes).toEqual([]);
  });

  it('Forget on a box that is not plugged in takes its row away', async () => {
    const a = box(1);
    const ports = portsOf(a);
    const serial = new FakeSerial(ports);
    const store = createBoxStore(null);
    const boxes = mount(serial, store);
    await ready();
    await pick(boxes, a.mac);
    serial.unplug(ports[0]);
    await ready();
    await entry(boxes, a.mac).session.forget();
    await ready();
    expect(boxes.entries()).toEqual([]);
    expect(store.held()).toEqual([]);
  });

  it('a chosen icon follows its box through Disconnect, and Forget clears it', async () => {
    const a = box(1);
    const ports = portsOf(a);
    const serial = new FakeSerial(ports);
    const store = createBoxStore(null);
    const boxes = mount(serial, store);
    await ready();
    const icon = watch(() => boxes.icon(a.mac));
    expect(icon()).toBe('box');
    await pick(boxes, a.mac);
    boxes.setIcon(a.mac, 'mouse');
    expect(icon()).toBe('mouse');
    await entry(boxes, a.mac).session.disconnect();
    await ready();
    expect(icon()).toBe('mouse');
    expect(store.icons()).toEqual({ [a.mac]: 'mouse' });
    await pick(boxes, a.mac);
    serial.unplug(ports[0]);
    await ready();
    await entry(boxes, a.mac).session.forget();
    await ready();
    expect(icon()).toBe('box');
    expect(store.icons()).toEqual({});
  });

  it("an icon another tab stores shows here at once", async () => {
    const a = box(1);
    const boxes = mount(new FakeSerial(portsOf(a)), createBoxStore(localStorage));
    await ready();
    const icon = watch(() => boxes.icon(a.mac));
    createBoxStore(localStorage).setIcon(a.mac, 'keyboard');
    window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY }));
    expect(icon()).toBe('keyboard');
  });

  it('knows when any box, selected or not, is mid-update', async () => {
    const [a, b] = [box(1), box(2)];
    const boxes = mount(new FakeSerial(portsOf(a, b)));
    await ready();
    await pick(boxes, a.mac);
    await pick(boxes, b.mac);
    expect(boxes.anyUpdating()).toBe(false);
    const release = a.hold();
    void entry(boxes, a.mac).session.updateOverControl({ device: new Uint8Array([0xe9]) });
    await ready();
    expect(boxes.anyUpdating()).toBe(true);
    release();
  });

  it('Add box shows the blank card without forgetting the stored box, and its Connect adds one', async () => {
    const [a, b] = [box(1), box(2)];
    const ports = portsOf(a, b);
    const serial = new FakeSerial([ports[0]]);
    const store = createBoxStore(null);
    const boxes = mount(serial, store);
    await ready();
    await pick(boxes, a.mac);
    boxes.select(NEW_BOX);
    expect(boxes.selected()).toBeNull();
    expect(boxes.scope().present()).toBe(false);
    expect(store.selected()).toBe(a.mac);
    serial.chosen = ports[1];
    await boxes.scope().connect();
    await ready();
    expect(boxes.selected()?.key).toBe(b.mac);
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
  });

  it('a selected port that answers as a box moves every view of the selection to its MAC', async () => {
    const a = box(1);
    a.alive = false;
    const boxes = mount(new FakeSerial(portsOf(a)));
    await ready();
    const anon = keys(boxes)[0];
    boxes.select(anon);
    const seen = createRoot(() => createMemo(() => boxes.selected()?.key));
    expect(seen()).toBe(anon);
    a.alive = true;
    await boxes.scope().connect();
    await ready();
    expect(seen()).toBe(a.mac);
  });
});
