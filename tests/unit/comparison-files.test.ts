// The Comparison downloads: the whole file, and each page's categories with their defects.
import { describe, expect, it } from 'vitest';
import { RESULTS } from '../../src/app/data/comparison';
import { COMPARISON_PAGES } from '../../src/app/data/comparison/pages';
import { comparisonFiles } from '../../src/app/data/comparison/files';

describe('comparisonFiles', () => {
  const files = comparisonFiles();

  it('holds the whole file and one per page with categories', () => {
    expect([...files.keys()]).toEqual(['/comparison.json', ...COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => `${p.path}.json`)]);
    expect(JSON.parse(files.get('/comparison.json')!)).toEqual(RESULTS);
  });

  it("gives a page its categories, their defects, the versions, the rig and the layers, and nothing else", () => {
    const page = JSON.parse(files.get('/comparison/control-link.json')!);
    expect(page.categories.map((c: { id: string }) => c.id)).toEqual(['control-link']);
    expect(page.defects).toEqual(RESULTS.defects.filter((d) => d.category === 'control-link'));
    expect(page.firmware).toEqual(RESULTS.firmware);
    expect(page.rig).toBe(RESULTS.rig);
    expect(page.layers).toEqual(RESULTS.layers);
    expect(page.pending).toBeUndefined();
  });

  it('writes two-space JSON ending in a newline', () => {
    expect(files.get('/comparison.json')!.endsWith('}\n')).toBe(true);
    expect(files.get('/comparison.json')!.split('\n')[1].startsWith('  "')).toBe(true);
  });
});
