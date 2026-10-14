import { RESULTS, placeOf } from '.';
import { COMPARISON_PAGES } from './pages';

const json = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`;

// The Comparison downloads by address: every result, then each page's categories with their defects and pending
// tests, each a results file that passes the check. The prerender writes them into the build, and the dev server
// serves them.
export function comparisonFiles(): Map<string, string> {
  const files = new Map([['/comparison.json', json(RESULTS)]]);
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
        // A defect on rows across pages goes in each page's file with that page's rows, so the file checks.
        defects: RESULTS.defects
          .map((d) => ({ ...d, rows: d.rows.filter((r) => p.categories.includes(placeOf(r)?.category.id ?? '')) }))
          .filter((d) => d.rows.length),
        pending: RESULTS.pending.filter((x) => p.categories.includes(x.category)),
      }),
    );
  }
  return files;
}
