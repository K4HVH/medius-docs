// The comparison in brief, for the Discord bot's summary: a few benchmarks with both boxes' values as the
// site writes them, each box's defects, and every area's page for the rest.

import { RESULTS, placeOf } from '../src/app/data/comparison';
import { COMPARISON_PAGES } from '../src/app/data/comparison/pages';
import { isCommand, resultOf, showValue } from '../src/app/data/comparison/result';
import type { Box, FeatureRow, MeasureRow, OutcomeRow } from '../src/app/data/comparison/types';
import { routeFor } from '../src/app/routes';
import { SITE } from '../src/app/site';

// The benchmarks the summary shows, by row, named for readers who haven't seen the site. One is where
// stock is ahead, as the comparison shows stock's wins beside Medius's.
export const HIGHLIGHTS: { row: string; name: string }[] = [
  { row: 'pass-latency-p50-1000', name: 'Report latency, 1 kHz mouse' },
  { row: 'inj-lat-rest-1', name: 'Injected move latency, still mouse' },
  { row: 'pass-inject-varying', name: 'Mouse reports read in 15.5 s while injecting' },
  { row: 'software-programs-kmbox-net', name: 'KMBox Net programs' },
];

type Place = NonNullable<ReturnType<typeof placeOf>>;

const cell = ({ table, row }: Place, box: Box): { text: string; code?: true } => {
  if (table.kind === 'measure') return { text: showValue((row as MeasureRow)[box], table.unit) };
  if (table.kind === 'outcome') return { text: (row as OutcomeRow)[box].is };
  const feature = (row as FeatureRow)[box];
  if (!feature) return { text: 'No' };
  return isCommand(feature) ? { text: feature, code: true } : { text: feature };
};

function summary() {
  const highlights = HIGHLIGHTS.map(({ row, name }) => {
    const at = placeOf(row)!;
    return { name, stock: cell(at, 'stock'), medius: cell(at, 'medius'), result: resultOf(at.table, at.row) };
  });
  const areas = COMPARISON_PAGES.filter((p) => p.categories.length > 0).map(({ path }) => ({ title: routeFor(path)!.title, url: `${SITE}${path}` }));
  const defects = { stock: RESULTS.defects.filter((d) => d.box === 'stock').length, medius: RESULTS.defects.filter((d) => d.box === 'medius').length };
  return { firmware: RESULTS.firmware, url: `${SITE}/comparison`, highlights, areas, defects: { ...defects, url: `${SITE}/comparison/defects` } };
}

// The results are fixed for a deploy, so the summary is built once, on its first request.
let body: string | undefined;

export async function handleComparisonApi(req: Request): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/api/comparison') return null;
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Use GET.' }), { status: 405, headers: { 'content-type': 'application/json' } });
  body ??= JSON.stringify(summary());
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}
