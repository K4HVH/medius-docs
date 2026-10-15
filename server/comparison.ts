// The comparison's Overview, for the Discord bot to keep a summary of it in a channel: each area's key rows
// with both boxes' values as the site writes them, and every defect with its place.

import { RESULTS, defectAddress, placeOf } from '../src/app/data/comparison';
import { COMPARISON_PAGES, KEY_ROWS, pageOfCategory } from '../src/app/data/comparison/pages';
import { isCommand, resultOf, showValue } from '../src/app/data/comparison/result';
import type { Box, FeatureRow, MeasureRow, OutcomeRow } from '../src/app/data/comparison/types';
import { routeFor } from '../src/app/routes';
import { SITE } from '../src/app/site';

// Overview rows the summary leaves out: the Discord members row tells its readers nothing, being on Discord.
const NOT_ON_DISCORD = new Set(['software-discord-members']);

type Place = NonNullable<ReturnType<typeof placeOf>>;

const cell = ({ table, row }: Place, box: Box): { text: string; code?: true } => {
  if (table.kind === 'measure') return { text: showValue((row as MeasureRow)[box], table.unit) };
  if (table.kind === 'outcome') return { text: (row as OutcomeRow)[box].is };
  const feature = (row as FeatureRow)[box];
  if (!feature) return { text: 'No' };
  return isCommand(feature) ? { text: feature, code: true } : { text: feature };
};

function summary() {
  // In Overview's order: the pages that have key rows.
  const areas = COMPARISON_PAGES.filter((p) => KEY_ROWS[p.path]).map(({ path }) => ({
    title: routeFor(path)!.title,
    url: `${SITE}${path}`,
    rows: KEY_ROWS[path]!
      .filter((id) => !NOT_ON_DISCORD.has(id))
      .map((id) => {
        const at = placeOf(id)!;
        // A feature's row names it; any other row's table names what it compares.
        const [test, kase] = at.table.kind === 'feature' ? [at.row.label, at.table.label] : [at.table.label, at.row.label];
        return {
          id,
          test,
          case: kase,
          ...(at.row.note ? { note: at.row.note } : {}),
          stock: cell(at, 'stock'),
          medius: cell(at, 'medius'),
          result: resultOf(at.table, at.row),
          defects: RESULTS.defects.filter((d) => d.rows.includes(id)).map((d) => ({ box: d.box, url: `${SITE}${defectAddress(d)}` })),
        };
      }),
  }));
  // Each defect with its place in Overview's list, and the section of the row it was found on.
  const defects = RESULTS.defects.map((d) => {
    const at = placeOf(d.rows[0]!)!;
    return {
      box: d.box,
      text: d.text,
      url: `${SITE}${defectAddress(d)}`,
      where: { title: at.section.title, url: `${SITE}${pageOfCategory(at.category.id)!.path}/${at.section.id}` },
    };
  });
  return { firmware: RESULTS.firmware, url: `${SITE}/comparison`, areas, defects };
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
