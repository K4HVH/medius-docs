// @vitest-environment node
import { expect, it } from 'vitest';
import { HIGHLIGHTS, handleComparisonApi } from '../../server/comparison';
import { RESULTS, placeOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES } from '../../src/app/data/comparison/pages';
import { resultOf, showValue } from '../../src/app/data/comparison/result';
import type { FeatureRow, MeasureRow, OutcomeRow } from '../../src/app/data/comparison/types';
import { addressFor, routeFor } from '../../src/app/routes';

const SITE = 'https://medius.k4tech.net';

interface Cell {
  text: string;
  code?: boolean;
}
interface Body {
  firmware: { stock: string; medius: string };
  url: string;
  highlights: { name: string; stock: Cell; medius: Cell; result: string | null }[];
  areas: { title: string; url: string }[];
  defects: { stock: number; medius: number; url: string };
}

const read = async () => {
  const r = await handleComparisonApi(new Request(`${SITE}/api/comparison`));
  expect(r!.status).toBe(200);
  expect(r!.headers.get('content-type')).toBe('application/json');
  return (await r!.json()) as Body;
};

it('carries the firmware each box ran and the address of Overview', async () => {
  const body = await read();
  expect(body.firmware).toEqual(RESULTS.firmware);
  expect(body.url).toBe(`${SITE}/comparison`);
});

it('gives each benchmark both values as the site writes them, and which box is ahead', async () => {
  const { highlights } = await read();
  expect(highlights.map((h) => h.name)).toEqual(HIGHLIGHTS.map((h) => h.name));
  for (const [i, { row }] of HIGHLIGHTS.entries()) {
    const { table, row: r } = placeOf(row)!;
    expect(highlights[i]!.result).toBe(resultOf(table, r));
    for (const box of ['stock', 'medius'] as const) {
      const shown =
        table.kind === 'measure' ? showValue((r as MeasureRow)[box], table.unit) : table.kind === 'outcome' ? (r as OutcomeRow)[box].is : ((r as FeatureRow)[box] ?? 'No');
      expect(highlights[i]![box].text).toBe(shown);
    }
  }
  expect(highlights[0]).toMatchObject({ medius: { text: '1.02-1.04 ms' }, result: 'medius' });
});

it('shows a benchmark where stock is ahead beside those where Medius is', async () => {
  const results = (await read()).highlights.map((h) => h.result);
  expect(results).toContain('stock');
  expect(results).toContain('medius');
});

it("links every area's page, in Overview's order", async () => {
  const { areas } = await read();
  const pages = COMPARISON_PAGES.filter((p) => p.categories.length > 0);
  expect(areas).toEqual(pages.map((p) => ({ title: routeFor(p.path)!.title, url: `${SITE}${p.path}` })));
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
