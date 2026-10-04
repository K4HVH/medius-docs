import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import { type Boxes, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { REATTACH_MS } from '../../src/app/pages/dashboard/session';
import { createBoxStore } from '../../src/app/pages/dashboard/store';
import { probePort } from '../../src/dashboard/serial';
import { FakeBox, FakePort, FakeSerial, asPort, makeFakeLink, settle } from './fake-boxes';

const probes: SerialPort[] = [];
const fakeProbe = (p: SerialPort) => {
  probes.push(p);
  return probePort(p, (pp) => makeFakeLink(pp, {}));
};

const roots: (() => void)[] = [];
const mount = (serial: FakeSerial, store = createBoxStore(null)): Boxes =>
  createRoot((dispose) => {
    roots.push(dispose);
    return createBoxes({
      serial,
      store,
      supported: true,
      secure: true,
      nativeFlashing: () => false,
      probe: fakeProbe,
      makeLink: makeFakeLink,
      choose: () => serial.choose(),
    });
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

beforeEach(() => {
  vi.useFakeTimers();
  probes.length = 0;
});
afterEach(() => {
  while (roots.length) roots.pop()!();
  vi.useRealTimers();
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
    boxes.select(anon);
    await ready();
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
    boxes.select(anon);
    await ready();
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

  it('selecting an answering box connects it; selection on load does not', async () => {
    const [a, b] = [box(1), box(2)];
    const boxes = mount(new FakeSerial(portsOf(a, b)));
    await ready();
    expect(boxes.selected()?.key).toBe(a.mac);
    expect(a.isOpen || b.isOpen).toBe(false);
    boxes.select(b.mac);
    await ready();
    expect(entry(boxes, b.mac).session.status()).toBe('connected');
    expect(entry(boxes, a.mac).session.status()).toBe('disconnected');
    expect(boxes.scope()).toBe(entry(boxes, b.mac).session);
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
    boxes.select(b.mac);
    await ready();
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
    boxes.select(b.mac);
    await ready();
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
    boxes.select(a.mac);
    await ready();
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
    first.select(a.mac);
    await ready();
    first.select(b.mac);
    await ready();
    const second = mount(new FakeSerial(ports));
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
    boxes.select(a.mac);
    await ready();
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
    const before = boxes.answeringKeys();
    expect([...before]).toEqual([a.mac]);
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
    boxes.select(first.mac);
    await ready();
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
});
