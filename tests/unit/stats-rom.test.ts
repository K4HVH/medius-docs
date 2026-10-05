import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import type { StatsReport } from '../../src/dashboard/stats';
import { romMac } from '../../src/dashboard/flash';

const mock = vi.hoisted(() => ({
  // What esptool reads once connected; null when it never gets that far.
  mac: '58:8c:81:e0:82:44' as string | null,
  fails: null as Error | null,
  hold: null as Promise<void> | null,
}));

vi.mock('../../src/dashboard/flash/flasher', () => ({
  flashNativePort: async (p: { onMac?: (mac: string | null) => void }) => {
    if (mock.mac !== null) p.onMac?.(romMac(mock.mac));
    if (mock.hold) await mock.hold;
    if (mock.fails) throw mock.fails;
  },
}));

import { createNativeFlash } from '../../src/app/pages/dashboard/nativeFlash';

const image = (project: string, version: string, at = 0) => {
  const b = new Uint8Array(at + 4096);
  const dv = new DataView(b.buffer);
  b[at] = 0xe9;
  dv.setUint16(at + 12, 9, true);
  dv.setUint32(at + 32, 0xabcd5432, true);
  new TextEncoder().encodeInto(version, b.subarray(at + 48, at + 80));
  new TextEncoder().encodeInto(project, b.subarray(at + 80, at + 112));
  return b;
};
const port = {} as SerialPort;

let reports: StatsReport[];
const make = (sink: ((r: StatsReport) => void) | null = (r) => reports.push(r)) =>
  createRoot(() => createNativeFlash(sink ?? undefined));

beforeEach(() => {
  reports = [];
  mock.mac = '58:8c:81:e0:82:44';
  mock.fails = null;
  mock.hold = null;
});

describe('romMac', () => {
  it("normalises esptool's MAC to 12 lowercase hex digits", () => {
    expect(romMac('58:8C:81:E0:82:44')).toBe('588c81e08244');
    expect(romMac('nonsense')).toBeNull();
    expect(romMac('00:00:00:00:00:00')).toBeNull();
  });
});

describe('ROM download reports', () => {
  it('a main-chip flash is written, with the MAC esptool read and the image version', async () => {
    const f = make();
    expect(await f.flash(port, image('medius_device', '3.4.4', 0x10000), 'factory', { page: 'setup', chip: 'device', source: 'release' })).toBe(true);
    expect(reports).toEqual([
      {
        type: 'flash',
        mac: '588c81e08244',
        page: 'setup',
        route: 'rom',
        chips: 'device',
        source: 'release',
        kind: 'factory',
        to: { device: '3.4.4', host: null },
        from: { device: null, host: null },
        result: 'written',
        ms: expect.any(Number),
      },
    ]);
  });

  it("a mouse-side chip flash carries no MAC: its own isn't the box's", async () => {
    const f = make();
    await f.flash(port, image('medius_host', '3.4.4'), 'app', { page: 'advanced', chip: 'host', source: 'file' });
    expect(reports[0]).toMatchObject({ mac: null, chips: 'host', kind: 'app', source: 'file', to: { device: null, host: '3.4.4' } });
  });

  it('a failure is failed, and keeps the MAC when esptool got that far', async () => {
    mock.fails = new Error('Failed to connect');
    const f = make();
    expect(await f.flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' })).toBe(false);
    expect(reports[0]).toMatchObject({ mac: '588c81e08244', result: 'failed' });
    mock.mac = null;
    await f.flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' });
    expect(reports[1]).toMatchObject({ mac: null, result: 'failed' });
  });

  it('an image that is not medius carries no version', async () => {
    const f = make();
    await f.flash(port, image('stock_fw', '5.1.2'), 'app', { page: 'advanced', chip: 'device', source: 'file' });
    expect(reports[0]).toMatchObject({ to: { device: null, host: null }, result: 'written' });
  });

  it('nothing is reported without page details, without a sink, or for a call refused while one runs', async () => {
    const f = make();
    await f.flash(port, image('medius_device', '3.4.4'), 'app');
    expect(reports).toEqual([]);
    await make(null).flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' });
    expect(reports).toEqual([]);
    let release = () => {};
    mock.hold = new Promise<void>((r) => (release = r));
    const first = f.flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' });
    expect(await f.flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' })).toBe(false);
    release();
    await first;
    expect(reports).toHaveLength(1);
  });

  it('a sink that throws leaves the result alone', async () => {
    const f = make(() => {
      throw new Error('the sink broke');
    });
    expect(await f.flash(port, image('medius_device', '3.4.4'), 'app', { page: 'advanced', chip: 'device', source: 'release' })).toBe(true);
  });
});
