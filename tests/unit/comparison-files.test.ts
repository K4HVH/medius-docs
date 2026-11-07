// @vitest-environment node
// The Comparison downloads: the whole file, each page's categories with their defects and pending tests, each a
// results file in its own right, and every run file the generator built the results from, as the tool wrote it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESULTS, placeOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES } from '../../src/app/data/comparison/pages';
import { comparisonFiles } from '../../src/app/data/comparison/files';
import { checkResults } from '../../src/app/data/comparison/check';
import type { ToolData } from '../../src/app/data/comparison/generate';
import tool from '../../src/app/data/comparison/tool.json';

// The run files the generator built the results from, as their paths under comparison/.
const COMPARISON = join(import.meta.dirname, '../../comparison');
const RUN_FILES = (tool as ToolData).runs.map((r) => r.file);

describe('comparisonFiles', () => {
  const files = comparisonFiles();
  const results = [...files].filter(([path]) => !path.startsWith('/comparison/runs/')) as [string, string][];

  it('holds the whole file, one per page with categories, then every run file', () => {
    expect([...files.keys()]).toEqual([
      '/comparison.json',
      ...COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => `${p.path}.json`),
      ...RUN_FILES.map((f) => `/comparison/${f}`),
    ]);
    expect(JSON.parse(files.get('/comparison.json') as string)).toEqual(RESULTS);
  });

  it('writes results files that pass the check', () => {
    for (const [path, body] of results) expect(checkResults(JSON.parse(body)), path).toEqual([]);
  });

  it('serves each run file byte for byte', () => {
    expect(RUN_FILES.length).toBeGreaterThan(0);
    for (const f of RUN_FILES) {
      expect(f, f).toMatch(/^runs\/(stock|medius|native)\/[^/]+\.json$/);
      const body = files.get(`/comparison/${f}`);
      expect(body, f).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(body as Uint8Array).equals(readFileSync(join(COMPARISON, f))), f).toBe(true);
    }
  });

  it('serves every run file the results cite', () => {
    const cited = new Set<string>();
    JSON.stringify(RESULTS, (k, v) => (k === 'file' && typeof v === 'string' && cited.add(v), v));
    expect(cited.size).toBeGreaterThan(0);
    for (const file of cited) expect(files.has(`/comparison/${file}`), file).toBe(true);
  });

  it("gives a page its categories, their defects and pending tests, the versions, the rig and the layers", () => {
    for (const page of COMPARISON_PAGES.filter((p) => p.categories.length)) {
      const file = JSON.parse(files.get(`${page.path}.json`) as string);
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
    const whole = files.get('/comparison.json') as string;
    expect(whole.endsWith('}\n')).toBe(true);
    expect(whole.split('\n')[1].startsWith('  "')).toBe(true);
  });
});
