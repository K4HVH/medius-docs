// @vitest-environment node
import { beforeEach, expect, it } from 'vitest';
import { type Db, openDb } from '../../server/stats/db';
import { copyBox, forgetBox } from '../../server/stats/requests';
import { createStore, type Store } from '../../server/stats/store';
import type { StatsEvent } from '../../server/stats/types';

const T0 = Date.UTC(2026, 9, 7, 12);
const MAC_A = '588c81e08244';
const MAC_B = '588c81df1e28';

const events = (mac: string): StatsEvent[] => [
  { type: 'box', mac, fw: '3.4.4', hostFw: '3.4.4', proto: 9, os: 'linux', browser: 'chrome' },
  { type: 'device', mac, vid: 0x046d, pid: 0xc08b, kind: 2, product: 'G502 HERO' },
  {
    type: 'flash', mac, page: 'update', route: 'usb2', chips: 'both', source: 'release', kind: null,
    to: { device: '3.4.4', host: '3.4.4' }, from: { device: '3.4.2', host: '3.4.2' }, result: 'verified', ms: 40_000,
  },
];

let db: Db;
let now = T0;
let store: Store;

beforeEach(async () => {
  db = await openDb(':memory:');
  now = T0;
  store = createStore(db, () => now);
  for (const mac of [MAC_A, MAC_B]) for (const e of events(mac)) store.ingest(e, 'AU');
  now = T0 + 86_400_000;
  store.ingest(events(MAC_A)[0]!, 'AU');
});

const count = (table: string) => db.get<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)!.n;

it("deletes one box's records and leaves another's", () => {
  expect(forgetBox(db, MAC_A)).toEqual({ boxes: 1, days: 2, devices: 1, flashes: 1 });
  expect([count('boxes'), count('box_days'), count('devices'), count('flashes')]).toEqual([1, 1, 1, 1]);
  expect(store.summary().boxes.total).toBe(1);
});

it('takes the Box ID as the dashboard shows it, or with separators and capitals', () => {
  expect(forgetBox(db, '58:8C:81:E0:82:44').boxes).toBe(1);
  expect(forgetBox(db, MAC_A)).toEqual({ boxes: 0, days: 0, devices: 0, flashes: 0 });
});

it('refuses something that is not a Box ID', () => {
  expect(() => forgetBox(db, '588c81e0824')).toThrow('not a Box ID');
});

it("copies one box's records and none of another's", () => {
  const copy = copyBox(db, '58:8C:81:E0:82:44');
  expect(copy.box).toMatchObject({ firmware: '3.4.4', hostFirmware: '3.4.4', protocol: 9, os: 'linux', browser: 'chrome', country: 'AU' });
  expect(copy.box?.firstSeen).toBe(new Date(T0).toISOString());
  expect(copy.daysConnected).toEqual(['2026-10-07', '2026-10-08']);
  expect(copy.devices).toEqual([{ vid: '046d', pid: 'c08b', kind: 2, product: 'G502 HERO', firstSeen: new Date(T0).toISOString(), lastSeen: new Date(T0).toISOString() }]);
  expect(copy.flashes).toHaveLength(1);
  expect(JSON.stringify(copy)).not.toContain(MAC_B);
  expect(copyBox(db, MAC_B).flashes).toHaveLength(1);
});

it('copies nothing for a box it never saw', () => {
  expect(copyBox(db, '000000000001')).toEqual({ box: null, daysConnected: [], devices: [], flashes: [] });
});
