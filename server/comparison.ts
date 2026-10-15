// The comparison in brief, for the Discord bot's summary: how many results each box is ahead in, for
// each area and overall, and how many defects each has, with the pages that show them.

import { RESULTS } from '../src/app/data/comparison';
import { COMPARISON_PAGES } from '../src/app/data/comparison/pages';
import { resultOf } from '../src/app/data/comparison/result';
import { routeFor } from '../src/app/routes';
import { SITE } from '../src/app/site';

// Rows the counts leave out: the Discord members row tells its readers nothing, being on Discord.
const NOT_ON_DISCORD = new Set(['software-discord-members']);

interface Count {
  medius: number;
  stock: number;
  same: number;
}

function summary() {
  const total: Count = { medius: 0, stock: 0, same: 0 };
  const areas = COMPARISON_PAGES.filter((p) => p.categories.length > 0).map(({ path, categories }) => {
    const n: Count = { medius: 0, stock: 0, same: 0 };
    for (const c of RESULTS.categories.filter((x) => categories.includes(x.id)))
      for (const s of c.sections)
        for (const t of s.tables)
          if (t.kind !== 'settings')
            for (const r of t.rows) {
              if (NOT_ON_DISCORD.has(r.id)) continue;
              const result = resultOf(t, r);
              const key = result === 'equal' ? 'same' : result;
              if (key === 'medius' || key === 'stock' || key === 'same') {
                n[key]++;
                total[key]++;
              }
            }
    return { title: routeFor(path)!.title, url: `${SITE}${path}`, ...n };
  });
  const defects = { stock: RESULTS.defects.filter((d) => d.box === 'stock').length, medius: RESULTS.defects.filter((d) => d.box === 'medius').length };
  return { firmware: RESULTS.firmware, url: `${SITE}/comparison`, total, areas, defects: { ...defects, url: `${SITE}/comparison/defects` } };
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
