// @vitest-environment node
import { expect, it } from 'vitest';
import { handleComparisonApi } from '../../server/comparison';
import { RESULTS } from '../../src/app/data/comparison';
import { COMPARISON_PAGES } from '../../src/app/data/comparison/pages';
import { resultOf } from '../../src/app/data/comparison/result';
import { addressFor, routeFor } from '../../src/app/routes';

const SITE = 'https://medius.k4tech.net';

interface Count {
  medius: number;
  stock: number;
  same: number;
}
interface Body {
  firmware: { stock: string; medius: string };
  url: string;
  total: Count;
  areas: (Count & { title: string; url: string })[];
  defects: { stock: number; medius: number; url: string };
}

const read = async () => {
  const r = await handleComparisonApi(new Request(`${SITE}/api/comparison`));
  expect(r!.status).toBe(200);
  expect(r!.headers.get('content-type')).toBe('application/json');
  return (await r!.json()) as Body;
};

// Every stock-against-Medius row of a page's categories, with which box is ahead.
const results = (categories: string[]) =>
  RESULTS.categories
    .filter((c) => categories.includes(c.id))
    .flatMap((c) => c.sections.flatMap((s) => s.tables.flatMap((t) => (t.kind === 'settings' ? [] : t.rows.map((r) => ({ id: r.id, result: resultOf(t, r) }))))));

it('carries the firmware each box ran and the address of Overview', async () => {
  const body = await read();
  expect(body.firmware).toEqual(RESULTS.firmware);
  expect(body.url).toBe(`${SITE}/comparison`);
});

it('counts, for each area page in order, the results each box is ahead in and those that are the same', async () => {
  const { areas } = await read();
  const pages = COMPARISON_PAGES.filter((p) => p.categories.length > 0);
  expect(areas.map((a) => a.url)).toEqual(pages.map((p) => `${SITE}${p.path}`));
  for (const [i, p] of pages.entries()) {
    const rows = results(p.categories).filter((r) => r.id !== 'software-discord-members');
    expect(areas[i]).toEqual({
      title: routeFor(p.path)!.title,
      url: `${SITE}${p.path}`,
      medius: rows.filter((r) => r.result === 'medius').length,
      stock: rows.filter((r) => r.result === 'stock').length,
      same: rows.filter((r) => r.result === 'equal').length,
    });
  }
});

it('totals the areas', async () => {
  const { areas, total } = await read();
  for (const k of ['medius', 'stock', 'same'] as const) expect(total[k]).toBe(areas.reduce((n, a) => n + a[k], 0));
  expect(total.medius + total.stock).toBeGreaterThan(0);
});

it("leaves the Discord members row out: whoever reads it there is on Discord already", async () => {
  const software = (await read()).areas.find((a) => a.url.endsWith('/software'))!;
  const rows = results(['software']);
  const members = rows.find((r) => r.id === 'software-discord-members')!;
  expect(members.result).toBe('stock');
  expect(software.stock).toBe(rows.filter((r) => r.result === 'stock').length - 1);
});

it("counts each box's defects, with the address of the list", async () => {
  const { defects } = await read();
  expect(defects).toEqual({
    stock: RESULTS.defects.filter((d) => d.box === 'stock').length,
    medius: RESULTS.defects.filter((d) => d.box === 'medius').length,
    url: `${SITE}/comparison/defects`,
  });
  expect(addressFor('/comparison/defects')).toMatchObject({ kind: 'place', parent: '/comparison', target: 'defects' });
});

it('answers only /api/comparison, and only GET', async () => {
  expect(await handleComparisonApi(new Request(`${SITE}/api/other`))).toBeNull();
  expect((await handleComparisonApi(new Request(`${SITE}/api/comparison`, { method: 'POST' })))!.status).toBe(405);
});
