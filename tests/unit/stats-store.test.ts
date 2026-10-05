// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../server/stats/db';
import { type Store, createStore } from '../../server/stats/store';
import type { BoxEvent, DeviceEvent, FlashEvent } from '../../server/stats/types';

const DAY = 86_400_000;
// Wednesday 2026-10-07, noon UTC.
const T0 = Date.UTC(2026, 9, 7, 12);

const MAC_A = '588c81e08244';
const MAC_B = '588c81df1e28';
const box = (o: Partial<BoxEvent> = {}): BoxEvent => ({
  type: 'box',
  mac: MAC_A,
  fw: '3.4.4',
  hostFw: '3.4.4',
  proto: 9,
  os: 'linux',
  browser: 'chrome',
  ...o,
});
const device = (o: Partial<DeviceEvent> = {}): DeviceEvent => ({
  type: 'device',
  mac: MAC_A,
  vid: 0x046d,
  pid: 0xc08b,
  kind: 2,
  product: 'G502 HERO',
  ...o,
});
const flash = (o: Partial<FlashEvent> = {}): FlashEvent => ({
  type: 'flash',
  mac: MAC_A,
  page: 'update',
  route: 'usb2',
  chips: 'both',
  source: 'release',
  kind: null,
  to: { device: '3.4.4', host: '3.4.4' },
  from: { device: '3.4.2', host: '3.4.2' },
  result: 'verified',
  ms: 40_000,
  ...o,
});

let db: Db;
let now = T0;
let store: Store;

beforeEach(async () => {
  db = await openDb(':memory:');
  now = T0;
  store = createStore(db, () => now);
});

const rows = <T,>(sql: string) => db.all<T>(sql);

describe('box identity', () => {
  it('stores a 16-digit keyed hash, stable for one MAC and different for another', () => {
    store.ingest(box(), 'AU');
    store.ingest(box(), 'AU');
    store.ingest(box({ mac: MAC_B }), 'AU');
    const ids = rows<{ id: string }>('SELECT id FROM boxes ORDER BY id').map((r) => r.id);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(ids).not.toContain(MAC_A.slice(0, 16));
  });

  it('keeps its key in the database, so a reopened file gives the same ids', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stats-'));
    const path = join(dir, 'nested', 'stats.db');
    const first = await openDb(path);
    createStore(first, () => now).ingest(box(), null);
    const id1 = first.get<{ id: string }>('SELECT id FROM boxes')!.id;
    first.close();
    const second = await openDb(path);
    createStore(second, () => now).ingest(box(), null);
    expect(second.all<{ id: string }>('SELECT id FROM boxes').map((r) => r.id)).toEqual([id1]);
    second.close();
  });

  it('never writes the raw MAC to the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stats-'));
    const path = join(dir, 'stats.db');
    const file = await openDb(path);
    const s = createStore(file, () => now);
    s.ingest(box(), 'AU');
    s.ingest(device(), 'AU');
    s.ingest(flash(), 'AU');
    file.close();
    const bytes = readFileSync(path).toString('latin1');
    for (const f of [path, `${path}-wal`]) {
      let text = '';
      try {
        text = readFileSync(f).toString('latin1');
      } catch {
        continue;
      }
      expect(text.toLowerCase()).not.toContain(MAC_A);
    }
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('ingest', () => {
  it('keeps the first sighting and a known mouse-side version, and updates the rest', () => {
    store.ingest(box({ fw: '3.4.2', hostFw: '3.4.2', os: 'windows' }), 'AU');
    now += 3 * DAY;
    store.ingest(box({ fw: '3.4.4', hostFw: null, browser: 'edge' }), 'NZ');
    const r = db.get<Record<string, unknown>>('SELECT * FROM boxes')!;
    expect(r).toMatchObject({
      first_seen: Math.floor(T0 / 1000),
      last_seen: Math.floor((T0 + 3 * DAY) / 1000),
      fw: '3.4.4',
      host_fw: '3.4.2',
      os: 'linux',
      browser: 'edge',
      country: 'NZ',
    });
  });

  it('marks one day per box per day', () => {
    store.ingest(box(), null);
    store.ingest(box(), null);
    now += DAY;
    store.ingest(box(), null);
    expect(rows<{ day: string }>('SELECT day FROM box_days ORDER BY day').map((r) => r.day)).toEqual([
      '2026-10-07',
      '2026-10-08',
    ]);
  });

  it('upserts a device per box, and leaves the days to box events', () => {
    store.ingest(device({ product: 'G502' }), null);
    now += DAY;
    store.ingest(device({ product: 'G502 HERO' }), null);
    store.ingest(device({ mac: MAC_B }), null);
    const d = rows<Record<string, unknown>>('SELECT * FROM devices ORDER BY first_seen, box');
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ product: 'G502 HERO', first_seen: Math.floor(T0 / 1000) });
    expect(rows('SELECT * FROM box_days')).toHaveLength(0);
  });

  it('stores a flash with or without a box', () => {
    store.ingest(flash(), 'AU');
    store.ingest(flash({ mac: null, route: 'rom', page: 'setup', chips: 'host', kind: 'factory', result: 'written' }), null);
    const f = rows<Record<string, unknown>>('SELECT * FROM flashes ORDER BY rowid');
    expect(f[0]).toMatchObject({ page: 'update', route: 'usb2', chips: 'both', to_device: '3.4.4', from_host: '3.4.2', result: 'verified', ms: 40_000, country: 'AU' });
    expect(f[0].box).toMatch(/^[0-9a-f]{16}$/);
    expect(f[1]).toMatchObject({ box: null, kind: 'factory', result: 'written' });
    expect(rows('SELECT * FROM box_days')).toHaveLength(0);
  });

  it('a flash or a device from a box that never connected is no active box', () => {
    store.ingest(flash({ mac: '112233445566', route: 'rom', page: 'setup', result: 'failed' }), null);
    store.ingest(device({ mac: '112233445566' }), null);
    const s = store.summary();
    expect(s.boxes).toMatchObject({ total: 0, active7: 0, active30: 0 });
  });

  it('writes a box and its day together, or neither', () => {
    db.exec("CREATE TRIGGER no_days BEFORE INSERT ON box_days BEGIN SELECT RAISE(ABORT, 'refused'); END");
    expect(() => store.ingest(box(), null)).toThrow();
    expect(rows('SELECT * FROM boxes')).toHaveLength(0);
  });
});

describe('summary', () => {
  it('reads zeros and filled, empty series with nothing stored', () => {
    const s = store.summary();
    expect(s.since).toBeNull();
    expect(s.boxes).toMatchObject({ total: 0, active7: 0, active30: 0 });
    expect(s.boxes.newPerWeek).toHaveLength(26);
    expect(s.boxes.newPerWeek.every((w) => w.n === 0)).toBe(true);
    expect(s.boxes.newPerWeek.at(-1)!.key).toBe('2026-10-05');
    expect(s.boxes.activePerDay).toHaveLength(90);
    expect(s.boxes.activePerDay.at(-1)!.key).toBe('2026-10-07');
    expect(s.devices).toEqual({ unique: 0, byKind: [], top: [] });
    expect(s.flashes.total).toBe(0);
    expect(s.flashes.perWeek).toHaveLength(26);
    expect(s.firmware).toEqual({ versions: [], split: 0 });
    expect(s.countries).toEqual([]);
  });

  it('counts boxes, activity and firmware', () => {
    // Box A first seen 40 days ago on 3.4.2, back today on 3.4.4.
    now = T0 - 40 * DAY;
    store.ingest(box({ fw: '3.4.2', hostFw: '3.4.2' }), 'AU');
    now = T0;
    store.ingest(box(), 'AU');
    // Box B seen 10 days ago only, split versions.
    now = T0 - 10 * DAY;
    store.ingest(box({ mac: MAC_B, fw: '3.4.4', hostFw: '3.4.2', os: 'windows' }), null);
    now = T0;
    const s = store.summary();
    expect(s.since).toBe('2026-08-28');
    expect(s.boxes).toMatchObject({ total: 2, active7: 1, active30: 2 });
    expect(s.boxes.newPerWeek.reduce((a, w) => a + w.n, 0)).toBe(2);
    expect(s.boxes.newPerWeek.find((w) => w.key === '2026-09-21')!.n).toBe(1);
    expect(s.boxes.activePerDay.at(-1)!.n).toBe(1);
    expect(s.boxes.activePerDay.find((d) => d.key === '2026-09-27')!.n).toBe(1);
    expect(s.firmware).toEqual({ versions: [{ key: '3.4.4', n: 2 }], split: 1 });
    // The versions cover exactly the boxes active in 30 days.
    expect(s.firmware.versions.reduce((a, v) => a + v.n, 0)).toBe(s.boxes.active30);
    expect(s.countries).toEqual([
      { key: 'AU', n: 1 },
      { key: 'unknown', n: 1 },
    ]);
    expect(s.os).toEqual([
      { key: 'linux', n: 1 },
      { key: 'windows', n: 1 },
    ]);
    expect(s.browsers).toEqual([{ key: 'chrome', n: 2 }]);
  });

  it('counts devices by kind, and names a top device by what most boxes reported', () => {
    store.ingest(device(), null);
    store.ingest(device({ mac: MAC_B }), null);
    store.ingest(device({ mac: '112233445566', product: 'Gaming Mouse' }), null);
    store.ingest(device({ vid: 0x1532, pid: 0x0084, product: 'Razer DeathAdder' }), null);
    store.ingest(device({ vid: 0x04d9, pid: 0xa0f8, kind: 1, product: null }), null);
    const s = store.summary();
    expect(s.devices.unique).toBe(3);
    expect(s.devices.byKind).toEqual([
      { kind: 2, devices: 2, boxes: 3 },
      { kind: 1, devices: 1, boxes: 1 },
    ]);
    expect(s.devices.top[0]).toEqual({ vid: 0x046d, pid: 0xc08b, kind: 2, product: 'G502 HERO', boxes: 3 });
    // The others are on one box each.
    expect(s.devices.top).toHaveLength(1);
  });

  it('lists at most 25 top devices', () => {
    for (let i = 1; i <= 30; i++) {
      store.ingest(device({ pid: i }), null);
      store.ingest(device({ mac: MAC_B, pid: i }), null);
    }
    expect(store.summary().devices.top).toHaveLength(25);
    expect(store.summary().devices.unique).toBe(30);
  });

  it('lists only devices on two boxes or more, and names one only by a name two boxes reported', () => {
    store.ingest(device({ vid: 0x1234, pid: 0x0001, product: "Sam's Custom Mouse" }), null);
    store.ingest(device({ vid: 0x046d, pid: 0xc08b, product: 'Sam renamed it' }), null);
    store.ingest(device({ mac: MAC_B, vid: 0x046d, pid: 0xc08b, product: null }), null);
    const s = store.summary();
    expect(s.devices.unique).toBe(2);
    expect(s.devices.top).toEqual([{ vid: 0x046d, pid: 0xc08b, kind: 2, product: null, boxes: 2 }]);
  });

  it('names a device and its kind by what most boxes reported, each on its own count', () => {
    // X from four boxes under two kinds, Y from three under one.
    const macs = ['000000000001', '000000000002', '000000000003', '000000000004', '000000000005', '000000000006', '000000000007'];
    macs.slice(0, 2).forEach((mac) => store.ingest(device({ mac, kind: 2, product: 'X' }), null));
    macs.slice(2, 4).forEach((mac) => store.ingest(device({ mac, kind: 0, product: 'X' }), null));
    macs.slice(4).forEach((mac) => store.ingest(device({ mac, kind: 2, product: 'Y' }), null));
    const s = store.summary();
    expect(s.devices.top).toEqual([{ vid: 0x046d, pid: 0xc08b, kind: 2, product: 'X', boxes: 7 }]);
    // One VID:PID is one device, under the kind most boxes reported.
    expect(s.devices.byKind).toEqual([{ kind: 2, devices: 1, boxes: 7 }]);
  });

  it('counts flashes by every dimension and by week', () => {
    store.ingest(flash(), null);
    store.ingest(flash({ result: 'reverted' }), null);
    store.ingest(flash({ page: 'advanced', source: 'file', chips: 'device', to: { device: null, host: null } }), null);
    store.ingest(flash({ mac: null, page: 'setup', route: 'rom', chips: 'host', kind: 'factory', result: 'written', to: { device: null, host: '3.4.4' } }), null);
    now = T0 - 7 * DAY;
    store.ingest(flash({ result: 'failed', to: { device: '3.4.2', host: '3.4.2' } }), null);
    now = T0;
    const s = store.summary();
    expect(s.flashes.total).toBe(5);
    expect(s.flashes.succeeded).toBe(3);
    expect(s.flashes.byResult).toEqual([
      { key: 'verified', n: 2 },
      { key: 'failed', n: 1 },
      { key: 'reverted', n: 1 },
      { key: 'written', n: 1 },
    ]);
    expect(s.flashes.byRoute).toEqual([
      { key: 'update usb2', n: 3 },
      { key: 'advanced usb2', n: 1 },
      { key: 'setup rom', n: 1 },
    ]);
    expect(s.flashes.byChips).toEqual([
      { key: 'both', n: 3 },
      { key: 'device', n: 1 },
      { key: 'host', n: 1 },
    ]);
    expect(s.flashes.bySource).toEqual([
      { key: 'release', n: 4 },
      { key: 'file', n: 1 },
    ]);
    // The main chip's version only: the mouse-side chip's flash to 3.4.4 is not one.
    expect(s.flashes.byVersion).toEqual([
      { key: '3.4.4', n: 2 },
      { key: '3.4.2', n: 1 },
    ]);
    const thisWeek = s.flashes.perWeek.at(-1)!;
    expect(thisWeek).toEqual({ week: '2026-10-05', verified: 2, reverted: 1, sent: 0, failed: 0, written: 1 });
    expect(s.flashes.perWeek.at(-2)!.failed).toBe(1);
  });
});
