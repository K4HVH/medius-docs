// The Comparison downloads: the whole file, and each page's categories with their defects and pending tests,
// each a results file in its own right.
import { describe, expect, it } from 'vitest';
import { RESULTS, placeOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES } from '../../src/app/data/comparison/pages';
import { comparisonFiles } from '../../src/app/data/comparison/files';
import { checkResults } from '../../src/app/data/comparison/check';

describe('comparisonFiles', () => {
  const files = comparisonFiles();

  it('holds the whole file and one per page with categories', () => {
    expect([...files.keys()]).toEqual(['/comparison.json', ...COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => `${p.path}.json`)]);
    expect(JSON.parse(files.get('/comparison.json')!)).toEqual(RESULTS);
  });

  it('writes files that pass the check', () => {
    for (const [path, body] of files) expect(checkResults(JSON.parse(body)), path).toEqual([]);
  });

  it("gives a page its categories, their defects and pending tests, the versions, the rig and the layers", () => {
    for (const page of COMPARISON_PAGES.filter((p) => p.categories.length)) {
      const file = JSON.parse(files.get(`${page.path}.json`)!);
      expect(file.categories.map((c: { id: string }) => c.id)).toEqual(page.categories);
      const mine = (r: string) => page.categories.includes(placeOf(r)!.category.id);
      expect(file.defects).toEqual(
        RESULTS.defects.filter((d) => d.rows.some(mine)).map((d) => ({ ...d, rows: d.rows.filter(mine) })),
      );
      expect(file.pending).toEqual(RESULTS.pending.filter((p) => page.categories.includes(p.category)));
      expect(file.firmware).toEqual(RESULTS.firmware);
      expect(file.rig).toBe(RESULTS.rig);
      expect(file.layers).toEqual(RESULTS.layers);
    }
  });

  it('writes two-space JSON ending in a newline', () => {
    expect(files.get('/comparison.json')!.endsWith('}\n')).toBe(true);
    expect(files.get('/comparison.json')!.split('\n')[1].startsWith('  "')).toBe(true);
  });
});
