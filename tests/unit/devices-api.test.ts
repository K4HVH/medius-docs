// @vitest-environment node
import { beforeEach, expect, it } from 'vitest';
import { handleDevicesApi } from '../../server/devices';
import { handleStatsApi, resetStatsForTests } from '../../server/stats';
import { COMPAT } from '../../src/app/data/compatibility';
import { addressFor } from '../../src/app/routes';
import { type CompatRow, withIds } from '../../src/app/data/compatMerge';

const SITE = 'https://medius.k4tech.net';

const device = (mac: string) =>
  handleStatsApi(
    new Request(`${SITE}/api/stats/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'device', mac, vid: 0x1234, pid: 0xabcd, kind: 2, product: 'Probe Mouse' }),
    }),
    '10.0.0.1',
  );

const read = async () => {
  const r = await handleDevicesApi(new Request(`${SITE}/api/devices`));
  expect(r!.status).toBe(200);
  return (await r!.json()) as { devices: { name: string; verdict: string; vidpid?: string; boxes?: number; reported?: string; url: string }[] };
};

beforeEach(() => resetStatsForTests({ path: ':memory:', now: () => Date.UTC(2026, 9, 7, 12) }));

it('lists every reported device as the Devices page does', async () => {
  const { devices } = await read();
  expect(devices.length).toBe(COMPAT.length);
  expect(devices.find((d) => d.name === COMPAT[0]!.name)).toMatchObject({ verdict: COMPAT[0]!.verdict });
});

it('adds a device the usage stats saw on two boxes, as working', async () => {
  await device('588c81e08244');
  await device('588c81df1e28');
  expect((await read()).devices.find((d) => d.vidpid === '1234:abcd')).toMatchObject({ name: 'Probe Mouse', verdict: 'works', boxes: 2 });
});

it('leaves out a device only one box has', async () => {
  await device('588c81e08244');
  expect((await read()).devices.some((d) => d.vidpid === '1234:abcd')).toBe(false);
});

it('answers only its own path', async () => {
  expect(await handleDevicesApi(new Request(`${SITE}/api/other`))).toBeNull();
});

it("gives each device the address of its card on the Devices page", async () => {
  const { devices } = await read();
  const first = devices.find((d) => d.name === COMPAT[0]!.name)!;
  expect(first.url.startsWith('https://medius.k4tech.net/guide/compatibility/')).toBe(true);
  // Each address is its own row's card, not some section of the page.
  const rows = withIds(devices.map(({ url: _, ...d }) => d as CompatRow));
  devices.forEach((d, i) => expect(addressFor(new URL(d.url).pathname)).toMatchObject({ kind: 'device', target: rows[i]!.id }));
  expect(new Set(devices.map((d) => d.url)).size).toBe(devices.length);
});
