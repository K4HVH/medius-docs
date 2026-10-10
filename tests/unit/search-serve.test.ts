import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleSearchIndex, liveSearcher, type SearchSources } from '../../server/searchIndex';
import type { SearchIndex } from '../../src/app/search/types';
import type { FirmwareRelease } from '../../src/dashboard/firmware/client';
import type { StatsSummary } from '../../server/stats/types';

let dir: string;
const built: SearchIndex = {
  version: 1,
  built: '2026-10-10',
  entries: [{ path: '/guide', title: 'Start here', kind: 'page', section: 'Guide', crumb: '', text: 'Ports first.' }],
};
const release: FirmwareRelease = { tag: 'v3.4.4', name: 'v3.4.4', publishedAt: '2026-10-02T00:00:00Z', prerelease: false, notes: '- Fixed it', assets: [] };
const stats = { devices: { top: [{ vid: 0x1234, pid: 0x5678, kind: 2, product: 'Test Mouse', boxes: 3 }] } } as unknown as StatsSummary;
const sources = (o: Partial<SearchSources> = {}): SearchSources => ({
  releases: async () => [release],
  stats: async () => stats,
  ...o,
});
const get = (headers: Record<string, string> = {}) => new Request('http://x/search-index.json', { headers });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'search-'));
  writeFileSync(join(dir, 'search-index.json'), JSON.stringify(built));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('handleSearchIndex', () => {
  it('answers at /search-index.json alone', async () => {
    expect(await handleSearchIndex(new Request('http://x/guide'), dir, sources())).toBeNull();
  });

  it('serves the built index with each release and device the server knows', async () => {
    const res = (await handleSearchIndex(get(), dir, sources()))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    const index = (await res.json()) as SearchIndex;
    const paths = index.entries.map((e) => e.path);
    expect(paths).toContain('/guide');
    expect(paths).toContain('/dashboard/changelog#v3.4.4');
    expect(paths).toContain('/guide/compatibility#device-test-mouse');
    expect(paths.filter((p) => p.startsWith('/guide/compatibility#device-')).length).toBeGreaterThan(10);
  });

  it('answers a request holding the same version with no body', async () => {
    const first = (await handleSearchIndex(get(), dir, sources()))!;
    const again = (await handleSearchIndex(get({ 'if-none-match': first.headers.get('etag')! }), dir, sources()))!;
    expect(again.status).toBe(304);
  });

  it('answers a weak tag, a list of tags, or any tag with no body', async () => {
    const tag = (await handleSearchIndex(get(), dir, sources()))!.headers.get('etag')!;
    for (const held of [`W/${tag}`, `"x", ${tag}`, '*'])
      expect((await handleSearchIndex(get({ 'if-none-match': held }), dir, sources()))!.status, held).toBe(304);
    expect((await handleSearchIndex(get({ 'if-none-match': '"x"' }), dir, sources()))!.status).toBe(200);
  });

  it('is kept a short while only, when a live source had nothing to give', async () => {
    const res = (await handleSearchIndex(get(), dir, sources({ releases: async () => null })))!;
    expect(res.headers.get('cache-control')).toBe('public, max-age=30');
  });

  it('serves the built index alone when a live source fails or has nothing yet', async () => {
    const res = (await handleSearchIndex(get(), dir, sources({ releases: async () => null, stats: async () => { throw new Error('down'); } })))!;
    const index = (await res.json()) as SearchIndex;
    expect(index.entries.some((e) => e.kind === 'release')).toBe(false);
    expect(index.entries.some((e) => e.kind === 'device')).toBe(true);
  });

  it('says the index is not built yet, rather than serving a page', async () => {
    rmSync(join(dir, 'search-index.json'));
    const res = (await handleSearchIndex(get(), dir, sources()))!;
    expect(res.status).toBe(503);
  });
});

describe('liveSearcher', () => {
  it('searches the built index and the live entries, and keeps one searcher while nothing changes', async () => {
    const releases = [release];
    const same = sources({ releases: async () => releases, stats: async () => stats });
    const s = (await liveSearcher(dir, same))!;
    expect(s.search('fixed it')[0].entry.path).toBe('/dashboard/changelog#v3.4.4');
    expect(await liveSearcher(dir, same)).toBe(s);
    // The sources answer anew each minute; the same content keeps the same searcher.
    const fresh = sources({ releases: async () => [{ ...release }], stats: async () => structuredClone(stats) });
    expect(await liveSearcher(dir, fresh)).toBe(s);
  });

  it('has nothing to search before the site is built', async () => {
    rmSync(join(dir, 'search-index.json'));
    expect(await liveSearcher(dir, sources())).toBeNull();
  });
});
