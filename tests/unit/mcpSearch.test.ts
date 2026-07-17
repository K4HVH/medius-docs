import { describe, it, expect } from 'vitest';
import {
  normalizePagePath,
  listPages,
  getPage,
  searchDocs,
  isOriginAllowed,
  type IndexPage,
} from '../../server/mcpSearch';

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

describe('searchDocs', () => {
  it('ranks the page whose content best matches the query first', () => {
    const hits = searchDocs(PAGES, 'ClipBuilder');
    expect(hits[0].path).toBe('/library/clip');
    expect(hits[0].snippet.toLowerCase()).toContain('clipbuilder');
  });
  it('matches on description/title words too', () => {
    const hits = searchDocs(PAGES, 'cursor motion');
    expect(hits[0].path).toBe('/library/move');
  });
  it('returns nothing for a query that matches no page', () => {
    expect(searchDocs(PAGES, 'zzzznomatch')).toEqual([]);
  });
  it('respects the limit', () => {
    expect(searchDocs(PAGES, 'clip', 1)).toHaveLength(1);
  });
  it('is deterministic for equal scores (path tiebreak)', () => {
    const a = searchDocs(PAGES, 'clip').map((h) => h.path);
    const b = searchDocs(PAGES, 'clip').map((h) => h.path);
    expect(a).toEqual(b);
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
