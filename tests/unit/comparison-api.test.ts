// @vitest-environment node
import { expect, it } from 'vitest';
import { handleComparisonApi } from '../../server/comparison';
import { RESULTS, defectAddress, placeOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES, KEY_ROWS, pageOfCategory } from '../../src/app/data/comparison/pages';
import { resultOf, showValue } from '../../src/app/data/comparison/result';
import type { Box, FeatureRow, MeasureRow, OutcomeRow } from '../../src/app/data/comparison/types';
import { addressFor, routeFor } from '../../src/app/routes';

const SITE = 'https://medius.k4tech.net';

interface Cell {
  text: string;
  code?: boolean;
}
interface Body {
  firmware: { stock: string; medius: string };
  url: string;
  areas: {
    title: string;
    url: string;
    rows: { id: string; test: string; case: string; note?: string; stock: Cell; medius: Cell; result: string | null; defects: { box: string; url: string }[] }[];
  }[];
  defects: { box: string; text: string; url: string; where: { title: string; url: string } }[];
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

it("gives each area of Overview its title, its page's address and its key rows in order", async () => {
  const { areas } = await read();
  expect(areas.map((a) => a.url)).toEqual(COMPARISON_PAGES.filter((p) => KEY_ROWS[p.path]).map((p) => `${SITE}${p.path}`));
  for (const a of areas) {
    const path = a.url.slice(SITE.length);
    expect(a.title).toBe(routeFor(path)!.title);
    expect(a.rows.map((r) => r.id)).toEqual(KEY_ROWS[path]!.filter((id) => id !== 'software-discord-members'));
  }
});

it("leaves out the Discord members row: whoever reads it there is on Discord already", async () => {
  const { areas } = await read();
  expect(areas.flatMap((a) => a.rows).some((r) => r.id === 'software-discord-members')).toBe(false);
  expect(areas.find((a) => a.url.endsWith('/software'))!.rows.length).toBeGreaterThan(0);
});

it('names what a row compares as Overview does: the table, then the row, or a feature, then its table', async () => {
  const rows = (await read()).areas.flatMap((a) => a.rows);
  const latency = rows.find((r) => r.id === 'pass-latency-p50-1000')!;
  expect(latency).toMatchObject({ test: 'Report latency, p50', case: '1 kHz mouse' });
  const feature = rows.find((r) => r.id === 'feat-move-absolute')!;
  expect(feature).toMatchObject({ test: 'Absolute move on a virtual screen', case: 'Moves' });
  expect(rows.find((r) => r.id === 'pass-latency-p50-125')!.note).toBe(placeOf('pass-latency-p50-125')!.row.note);
});

it("writes each value as the site does, and which box is ahead", async () => {
  const rows = (await read()).areas.flatMap((a) => a.rows);
  const kinds = new Set<string>();
  for (const r of rows) {
    const { table, row } = placeOf(r.id)!;
    kinds.add(table.kind);
    expect(r.result).toBe(resultOf(table, row));
    for (const box of ['stock', 'medius'] as Box[]) {
      const shown =
        table.kind === 'measure'
          ? showValue((row as MeasureRow)[box], table.unit)
          : table.kind === 'outcome'
            ? (row as OutcomeRow)[box].is
            : ((row as FeatureRow)[box] ?? 'No');
      expect(r[box].text).toBe(shown);
    }
  }
  expect(kinds).toEqual(new Set(['measure', 'outcome', 'feature']));
  expect(rows.find((r) => r.id === 'pass-latency-p50-1000')).toMatchObject({ medius: { text: '1.07 ms' }, result: 'medius' });
});

it('marks a command as code, and a missing feature as No', async () => {
  const rows = (await read()).areas.flatMap((a) => a.rows);
  expect(rows.find((r) => r.id === 'feat-move-absolute')).toMatchObject({ stock: { text: 'km.moveto', code: true }, medius: { text: 'No' } });
  expect(rows.find((r) => r.id === 'feat-move-absolute')!.medius.code).toBeUndefined();
});

it("links each row's defects, and lists every defect with its place and the section it was found in", async () => {
  const body = await read();
  const rows = body.areas.flatMap((a) => a.rows);
  for (const r of rows)
    expect(r.defects).toEqual(RESULTS.defects.filter((d) => d.rows.includes(r.id)).map((d) => ({ box: d.box, url: `${SITE}${defectAddress(d)}` })));
  expect(rows.some((r) => r.defects.length > 0)).toBe(true);
  expect(body.defects.map(({ box, text, url }) => ({ box, text, url }))).toEqual(
    RESULTS.defects.map((d) => ({ box: d.box, text: d.text, url: `${SITE}${defectAddress(d)}` })),
  );
  for (const [i, d] of body.defects.entries()) {
    expect(addressFor(d.url.slice(SITE.length))).toMatchObject({ kind: 'place', parent: '/comparison' });
    const at = placeOf(RESULTS.defects[i]!.rows[0]!)!;
    expect(d.where).toEqual({ title: at.section.title, url: `${SITE}${pageOfCategory(at.category.id)!.path}/${at.section.id}` });
    expect(addressFor(d.where.url.slice(SITE.length))).toMatchObject({ kind: 'place', target: at.section.id });
  }
});

it('answers only /api/comparison, and only GET', async () => {
  expect(await handleComparisonApi(new Request(`${SITE}/api/other`))).toBeNull();
  expect((await handleComparisonApi(new Request(`${SITE}/api/comparison`, { method: 'POST' })))!.status).toBe(405);
});
