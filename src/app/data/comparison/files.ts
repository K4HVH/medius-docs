import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESULTS, placeOf } from '.';
import type { ToolData } from './generate';
import { COMPARISON_PAGES } from './pages';
import tool from './tool.json';

const COMPARISON = join(import.meta.dirname, '../../../../comparison');

const json = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`;

// The Comparison downloads, by address: all results, then one file per page with its categories, defects and
// pending tests, then each run file the generator read, as the tool wrote it. Each results file passes the check.
// The prerender writes them into the build; the dev server serves them.
export function comparisonFiles(): Map<string, string | Uint8Array> {
  const files = new Map<string, string | Uint8Array>([['/comparison.json', json(RESULTS)]]);
  for (const p of COMPARISON_PAGES) {
    if (!p.categories.length) continue;
    const { format, firmware, rig, layers } = RESULTS;
    files.set(
      `${p.path}.json`,
      json({
        format,
        firmware,
        rig,
        layers,
        categories: RESULTS.categories.filter((c) => p.categories.includes(c.id)),
        // A defect spanning pages goes in each page's file with only that page's rows, so each file passes the check.
        defects: RESULTS.defects
          .map((d) => ({ ...d, rows: d.rows.filter((r) => p.categories.includes(placeOf(r)?.category.id ?? '')) }))
          .filter((d) => d.rows.length),
        pending: RESULTS.pending.filter((x) => p.categories.includes(x.category)),
        once: RESULTS.once,
      }),
    );
  }
  for (const { file } of (tool as ToolData).runs) files.set(`/comparison/${file}`, readFileSync(join(COMPARISON, file)));
  return files;
}
