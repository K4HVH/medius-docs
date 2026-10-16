import { describe, it, expect } from 'vitest';
import {
  normalizePagePath,
  listPages,
  getPage,
  searchHits,
  isOriginAllowed,
  toSearchResults,
  toFetchDoc,
  type IndexPage,
} from '../../server/mcpSearch';
import { createSearcher } from '../../src/app/search/rank';
import type { IndexEntry } from '../../src/app/search/types';

const PAGES: IndexPage[] = [
  {
    path: '/library/clip',
    title: 'Clip',
    section: 'Rust Library',
    description: 'Preload input',
    text: '# Clip\n\nBuild a sequence of per-frame input with a ClipBuilder. Playback is box-clocked.',
  },
  {
    path: '/library/move',
    title: 'Move',
    section: 'Rust Library',
    description: 'Cursor motion and scroll',
    text: '# Move\n\nmove_axis and move_rel drive cursor motion and the wheel.',
  },
  {
    path: '/native/commands/clip',
    title: 'Clip',
    section: 'Native API',
    description: 'CLIP commands',
    text: '# Clip\n\nThe CLIP opcodes preload input for box-clocked playback.',
  },
];

describe('normalizePagePath', () => {
  it('adds a leading slash, strips .md and trailing slash', () => {
    expect(normalizePagePath('/library/clip')).toBe('/library/clip');
    expect(normalizePagePath('library/clip')).toBe('/library/clip');
    expect(normalizePagePath('/library/clip.md')).toBe('/library/clip');
    expect(normalizePagePath('/library/clip/')).toBe('/library/clip');
    expect(normalizePagePath('  /library/clip  ')).toBe('/library/clip');
    expect(normalizePagePath('/library/clip#builder')).toBe('/library/clip');
  });
});

describe('listPages', () => {
  it('returns path/title/section for every page and no body text', () => {
    const out = listPages(PAGES);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ path: '/library/clip', title: 'Clip', section: 'Rust Library' });
    expect((out[0] as Record<string, unknown>).text).toBeUndefined();
  });
});

describe('getPage', () => {
  it('finds a page by path, tolerating .md and missing leading slash', () => {
    expect(getPage(PAGES, '/library/clip.md')?.text).toContain('ClipBuilder');
    expect(getPage(PAGES, 'library/move')?.title).toBe('Move');
  });
  it('returns null for an unknown path', () => {
    expect(getPage(PAGES, '/nope')).toBeNull();
  });
});

const ENTRIES: IndexEntry[] = [
  { path: '/library/clip', title: 'Clip', kind: 'page', section: 'Rust Library', crumb: 'API', text: 'Build a sequence of per-frame input with a ClipBuilder. Playback is box-clocked.' },
  { path: '/library/clip#builder', title: 'ClipBuilder', kind: 'section', section: 'Rust Library', crumb: 'API / Clip', text: 'Adds one entry per frame.' },
  { path: '/library/move', title: 'Move', kind: 'page', section: 'Rust Library', crumb: 'API', text: 'move_axis and move_rel drive cursor motion and the wheel.' },
  { path: '/native/commands/clip', title: 'Clip', kind: 'page', section: 'Native API', crumb: 'Commands', text: 'The CLIP opcodes preload input for box-clocked playback.' },
];
const searcher = createSearcher(ENTRIES);

describe('searchHits', () => {
  it('ranks the part of a page whose words match best first, with the sentence they matched in', () => {
    const hits = searchHits(searcher, 'entry per frame');
    expect(hits[0].path).toBe('/library/clip#builder');
    expect(hits[0]).toMatchObject({ title: 'ClipBuilder', section: 'Rust Library', snippet: 'Adds one entry per frame.' });
  });
  it('returns nothing for a query that matches nothing, and respects the limit', () => {
    expect(searchHits(searcher, 'zzzznomatch')).toEqual([]);
    expect(searchHits(searcher, 'clip', 1)).toHaveLength(1);
  });
  it('stays quick and correct on a huge query', () => {
    const started = performance.now();
    const hits = searchHits(searcher, Array(5000).fill('clip').join(' '));
    expect(performance.now() - started).toBeLessThan(200);
    expect(hits.map((h) => h.path)).toContain('/library/clip');
  });

  it('lists every release and device that matches, leaves other sites out, and takes a whole number as the limit', () => {
    const many = createSearcher([
      ...Array.from({ length: 6 }, (_, i): IndexEntry => ({ path: `/dashboard/changelog#v1.${i}`, title: `v1.${i}`, kind: 'release', section: 'Dashboard', crumb: 'Changelog', text: 'Fixed a thing.' })),
      { path: 'https://pypi.org/project/medius/', title: 'PyPI', kind: 'external', section: 'Elsewhere', crumb: 'pypi.org', text: 'Fixed nothing.' },
    ]);
    const hits = searchHits(many, 'fixed', 50);
    expect(hits).toHaveLength(6);
    expect(hits.every((h) => h.path.startsWith('/'))).toBe(true);
    expect(searchHits(many, 'fixed', 2.7)).toHaveLength(2);
  });

  it('reads an agent query as finished, never as a word still being typed', () => {
    expect(searcher.search('playbac').length).toBeGreaterThan(0);
    expect(searchHits(searcher, 'playbac')).toEqual([]);
  });

  it('gives a release its date and a device its verdict ahead of the sentence', () => {
    const s2 = createSearcher([
      { path: '/dashboard/changelog#v3.4.4', title: 'v3.4.4', kind: 'release', section: 'Dashboard', crumb: 'Changelog', caption: '2 October 2026', text: 'Fixed the delay.' },
    ]);
    expect(searchHits(s2, 'v3.4.4')[0].snippet).toBe('2 October 2026 · Fixed the delay.');
  });
});

describe('toSearchResults (OpenAI search shape)', () => {
  it('returns {id,title,url,text} with id=address and absolute url', () => {
    const r = toSearchResults(searchHits(searcher, 'ClipBuilder'), 'https://s');
    expect(r[0]).toMatchObject({ id: '/library/clip#builder', title: 'ClipBuilder', url: 'https://s/library/clip#builder' });
    expect(typeof r[0].text).toBe('string');
  });
});

describe('toFetchDoc (OpenAI fetch shape)', () => {
  it('returns the page a section id is on', () => {
    expect(toFetchDoc(PAGES, '/library/clip#builder', 'https://s')!.id).toBe('/library/clip');
  });
  it('returns the full document by id, tolerating .md and missing slash', () => {
    const d = toFetchDoc(PAGES, 'library/clip.md', 'https://s')!;
    expect(d.id).toBe('/library/clip');
    expect(d.url).toBe('https://s/library/clip');
    expect(d.text).toContain('ClipBuilder');
    expect(d.metadata.section).toBe('Rust Library');
  });
  it('returns null for an unknown id', () => {
    expect(toFetchDoc(PAGES, '/nope', 'https://s')).toBeNull();
  });
});

describe('isOriginAllowed', () => {
  it('allows requests with no Origin (CLI clients)', () => {
    expect(isOriginAllowed(null, ['https://s'])).toBe(true);
    expect(isOriginAllowed('', ['https://s'])).toBe(true);
  });
  it('allows an Origin in the allowlist and rejects one that is not', () => {
    expect(isOriginAllowed('https://s', ['https://s'])).toBe(true);
    expect(isOriginAllowed('https://evil.example', ['https://s'])).toBe(false);
  });
});
