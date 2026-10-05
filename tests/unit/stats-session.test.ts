import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { type Boxes, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { createBoxStore } from '../../src/app/pages/dashboard/store';
import { probePort } from '../../src/dashboard/serial';
import { DeviceKind, PROTO_VER } from '../../src/dashboard/protocol';
import type { StatsReport } from '../../src/dashboard/stats';
import { FakeBox, FakePort, FakeSerial, makeFakeLink, settle } from './fake-boxes';

const roots: (() => void)[] = [];
let reports: StatsReport[];
let sinkThrows = false;
const sink = (r: StatsReport) => {
  reports.push(r);
  if (sinkThrows) throw new Error('the sink broke');
};

const mount = (serial: FakeSerial, stats: ((r: StatsReport) => void) | null = sink): Boxes =>
  createRoot((dispose) => {
    roots.push(dispose);
    const [flashing] = createSignal(false);
    const b = createBoxes({
      serial,
      store: createBoxStore(null),
      supported: true,
      secure: true,
      nativeFlashing: flashing,
      probe: (p) => probePort(p, (pp) => makeFakeLink(pp, {})),
      makeLink: makeFakeLink,
      choose: () => serial.choose(),
      stats: stats ?? undefined,
    });
    b.start();
    return b;
  });

const MAC = [0x58, 0x8c, 0x81, 0xe0, 0x82, 0x44];
const MAC_HEX = '588c81e08244';
const ready = async () => {
  await settle();
  await vi.advanceTimersByTimeAsync(0);
  await settle();
};

const connected = async (b: FakeBox, stats: ((r: StatsReport) => void) | null = sink) => {
  const boxes = mount(new FakeSerial([new FakePort(b)]), stats);
  await ready();
  const s = boxes.entries()[0].session;
  await s.connect();
  await ready();
  expect(s.status()).toBe('connected');
  return s;
};

// A medius app image: the header and app descriptor the dashboard reads, then padding.
const image = (project: string, version: string) => {
  const b = new Uint8Array(4096);
  const dv = new DataView(b.buffer);
  b[0] = 0xe9;
  dv.setUint16(12, 9, true);
  dv.setUint32(32, 0xabcd5432, true);
  new TextEncoder().encodeInto(version, b.subarray(48, 80));
  new TextEncoder().encodeInto(project, b.subarray(80, 112));
  return b;
};
const DEVICE_IMG = image('medius_device', '3.4.5');
const HOST_IMG = image('medius_host', '3.4.5');

// Runs an update to its end, moving the fake clock through the reconnect and the verdict.
const run = async (p: Promise<unknown>) => {
  let done = false;
  void p.finally(() => (done = true));
  for (let i = 0; i < 200 && !done; i++) await vi.advanceTimersByTimeAsync(500);
  return p;
};

const of = <T extends StatsReport['type']>(type: T) =>
  reports.filter((r): r is Extract<StatsReport, { type: T }> => r.type === type);

beforeEach(() => {
  vi.useFakeTimers();
  reports = [];
  sinkThrows = false;
});

afterEach(() => {
  roots.splice(0).forEach((d) => d());
  vi.useRealTimers();
});

describe('box reports', () => {
  it('a connect sends one, with both chips and the protocol', async () => {
    const b = new FakeBox({ mac: MAC });
    b.firmware.host = { major: 3, minor: 4, patch: 2, slot: 0, state: 2 };
    await connected(b);
    expect(of('box')).toEqual([{ type: 'box', mac: MAC_HEX, fw: '3.4.4', hostFw: '3.4.2', proto: PROTO_VER }]);
  });

  it('says nothing of the mouse-side chip when the FIRMWARE read goes unanswered', async () => {
    const b = new FakeBox({ mac: MAC });
    b.firmwareSilent = true;
    await connected(b);
    await vi.advanceTimersByTimeAsync(5000);
    expect(of('box')).toEqual([{ type: 'box', mac: MAC_HEX, fw: '3.4.4', hostFw: null, proto: PROTO_VER }]);
  });

  it('a box whose MAC reads all zero sends nothing', async () => {
    await connected(new FakeBox({ mac: [0, 0, 0, 0, 0, 0] }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reports).toEqual([]);
  });

  it('no sink, no reports and no FIRMWARE read', async () => {
    const b = new FakeBox({ mac: MAC });
    await connected(b, null);
    // The port probe reads DEVICE_INFO once, before any connect.
    const probed = b.deviceQueries;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(b.firmwareQueries).toBe(0);
    expect(b.deviceQueries).toBe(probed);
  });
});

describe('device reports', () => {
  it('the cloned device goes once per connect, and again after a swap', async () => {
    const b = new FakeBox({ mac: MAC });
    const s = await connected(b);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(of('device')).toEqual([
      { type: 'device', mac: MAC_HEX, vid: 0x046d, pid: 0xc08b, kind: DeviceKind.Mouse, product: 'G502' },
    ]);
    b.device = { ...b.device!, vid: 0x04d9, pid: 0xa0f8, kind: DeviceKind.Keyboard, product: '' };
    await vi.advanceTimersByTimeAsync(10_000);
    expect(of('device').at(-1)).toEqual({ type: 'device', mac: MAC_HEX, vid: 0x04d9, pid: 0xa0f8, kind: DeviceKind.Keyboard, product: null });
    expect(of('device')).toHaveLength(2);
    await s.disconnect();
    await s.connect();
    await ready();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(of('device')).toHaveLength(3);
  });

  it('nothing cloned sends none', async () => {
    const b = new FakeBox({ mac: MAC });
    b.device = { ...b.device!, vid: 0, pid: 0, product: '' };
    await connected(b);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(of('device')).toEqual([]);
  });

  it('a box on an older protocol, connected only to be updated, never reads DEVICE_INFO', async () => {
    const b = new FakeBox({ mac: MAC, protoVer: 5 });
    const s = await connected(b);
    expect(s.updateOnly()).toBe(true);
    const before = b.deviceQueries;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(b.deviceQueries).toBe(before);
    expect(of('box')).toHaveLength(1);
    expect(of('box')[0].proto).toBe(5);
  });
});

describe('flash reports over USB2', () => {
  const flash = {
    type: 'flash',
    mac: MAC_HEX,
    page: 'update',
    route: 'usb2',
    chips: 'both',
    source: 'release',
    kind: null,
    to: { device: '3.4.5', host: '3.4.5' },
    from: { device: '3.4.4', host: '3.4.4' },
  };

  it('a verified run sends verified, then the box on its new versions', async () => {
    const b = new FakeBox({ mac: MAC });
    b.next = { device: [3, 4, 5], host: [3, 4, 5] };
    const s = await connected(b);
    reports = [];
    expect(await run(s.updateOverControl({ device: DEVICE_IMG, host: HOST_IMG }, 'update'))).toBe('verified');
    expect(of('flash')).toEqual([{ ...flash, result: 'verified', ms: expect.any(Number) }]);
    expect(of('box')).toEqual([{ type: 'box', mac: MAC_HEX, fw: '3.4.5', hostFw: '3.4.5', proto: PROTO_VER }]);
  });

  it('a chip back on the slot it ran is reverted', async () => {
    const b = new FakeBox({ mac: MAC });
    b.onActivate = 'reverts';
    const s = await connected(b);
    reports = [];
    expect(await run(s.updateOverControl({ device: DEVICE_IMG }, 'advanced', 'file'))).toBe('verified');
    expect(of('flash')).toEqual([
      { ...flash, page: 'advanced', chips: 'device', source: 'file', to: { device: '3.4.5', host: null }, result: 'reverted', ms: expect.any(Number) },
    ]);
  });

  it('a box that never comes back is sent', async () => {
    const b = new FakeBox({ mac: MAC });
    b.onActivate = 'gone';
    const s = await connected(b);
    reports = [];
    expect(await run(s.updateOverControl({ host: HOST_IMG }, 'update'))).toBe('sent');
    expect(of('flash')).toEqual([{ ...flash, chips: 'host', to: { device: null, host: '3.4.5' }, result: 'sent', ms: expect.any(Number) }]);
    expect(of('box')).toEqual([]);
  });

  it('a refused activate is failed', async () => {
    const b = new FakeBox({ mac: MAC });
    b.onActivate = 'throws';
    const s = await connected(b);
    reports = [];
    expect(await run(s.updateOverControl({ device: DEVICE_IMG, host: HOST_IMG }, 'update'))).toBe('failed');
    expect(of('flash')).toEqual([{ ...flash, result: 'failed', ms: expect.any(Number) }]);
  });

  it('a box that does not answer before anything is sent is failed, with no versions before', async () => {
    const b = new FakeBox({ mac: MAC });
    const s = await connected(b);
    reports = [];
    b.firmwareSilent = true;
    expect(await run(s.updateOverControl({ device: DEVICE_IMG }, 'update'))).toBe('failed');
    expect(of('flash')).toEqual([
      { ...flash, chips: 'device', to: { device: '3.4.5', host: null }, from: { device: null, host: null }, result: 'failed', ms: expect.any(Number) },
    ]);
  });

  it('a second run refused while one is in flight sends nothing of its own', async () => {
    const b = new FakeBox({ mac: MAC });
    const s = await connected(b);
    reports = [];
    let release = () => {};
    b.stageGate = new Promise<void>((r) => (release = r));
    const first = s.updateOverControl({ device: DEVICE_IMG }, 'update');
    await ready();
    expect(await s.updateOverControl({ host: HOST_IMG }, 'advanced')).toBe('failed');
    release();
    await run(first);
    expect(of('flash')).toHaveLength(1);
  });
});

describe('a sink that throws', () => {
  it('breaks neither a connect nor an update', async () => {
    sinkThrows = true;
    const b = new FakeBox({ mac: MAC });
    b.next = { device: [3, 4, 5] };
    const s = await connected(b);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await run(s.updateOverControl({ device: DEVICE_IMG }, 'update'))).toBe('verified');
    expect(s.status()).toBe('connected');
    expect(reports.length).toBeGreaterThan(2);
  });
});
