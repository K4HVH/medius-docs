import { RESULTS } from '.';
import { COMPARISON_PAGES } from './pages';

const json = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`;

// The Comparison downloads by address: every result, then each page's categories with their defects. The
// prerender writes them into the build, and the dev server serves them.
export function comparisonFiles(): Map<string, string> {
  const files = new Map([['/comparison.json', json(RESULTS)]]);
  for (const p of COMPARISON_PAGES) {
    if (!p.categories.length) continue;
    const { firmware, rig, layers } = RESULTS;
    files.set(
      `${p.path}.json`,
      json({
        format: RESULTS.format,
        firmware,
        rig,
        layers,
        categories: RESULTS.categories.filter((c) => p.categories.includes(c.id)),
        defects: RESULTS.defects.filter((d) => p.categories.includes(d.category)),
      }),
    );
  }
  return files;
}
