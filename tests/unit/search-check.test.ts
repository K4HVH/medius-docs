import { describe, expect, it } from 'vitest';
import { checkIndex, type CheckContext } from '../../scripts/lib/searchCheck';
import type { IndexEntry, SearchIndex } from '../../src/app/search/types';

const e = (path: string, title: string, o: Partial<IndexEntry> = {}): IndexEntry => ({
  path,
  title,
  kind: path.includes('#') ? 'section' : 'page',
  section: 'Native API',
  crumb: '',
  text: '',
  ...o,
});
const index = (entries: IndexEntry[]): SearchIndex => ({ version: 1, built: 'now', entries });

const ctx: CheckContext = {
  routes: ['/native/commands/lock', '/guide/help'],
  sectionIds: ['bearing', 'lock'],
  helpIds: ['bsod'],
  golden: [{ q: 'lock', first: '/native/commands/lock' }],
  expect: [{ q: 'bearing', path: '/native/commands/lock#bearing', within: 1 }],
  keywordPaths: [],
};
const good = [
  e('/native/commands/lock', 'LOCK', { text: 'Weighs input.' }),
  e('/native/commands/lock#bearing', 'Bearing', { text: 'The injected direction.' }),
  e('/guide/help', 'Help', { section: 'Guide' }),
  e('/guide/help#bsod', 'My PC blue-screens', { kind: 'anchor', section: 'Guide' }),
];

describe('checkIndex', () => {
  it('passes an index that holds every page, section and answer and answers its queries', () => {
    expect(checkIndex(index(good), ctx)).toEqual([]);
  });

  it('accepts a section that became its page entry', () => {
    expect(checkIndex(index(good), { ...ctx, sectionIds: ['lock'] })).toEqual([]);
  });

  it('names a page, section or answer the index lost', () => {
    const lost = checkIndex(index(good.filter((x) => !x.path.endsWith('#bearing') && x.path !== '/guide/help#bsod')), { ...ctx, expect: [] });
    expect(lost).toEqual(['section #bearing is in no entry', 'help answer bsod is in no entry']);
    expect(checkIndex(index(good.slice(1)), { ...ctx, golden: [] })).toContain('page /native/commands/lock has no entry');
  });

  it('names an entry with no title, two at one address, and text a page shows only while loading', () => {
    const bad = checkIndex(
      index([...good, e('/native/x', ''), e('/native/commands/lock#bearing', 'Again'), e('/native/y', 'Y', { text: 'Loading releases...' })]),
      { ...ctx, golden: [], expect: [] },
    );
    expect(bad).toEqual([
      '/native/x has no title',
      '/native/commands/lock#bearing is in the index twice',
      '/native/y holds loading or failure text',
    ]);
  });

  it('names the values of the fake box wherever they leaked', () => {
    const bad = checkIndex(index([...good, e('/dashboard#x', 'X', { section: 'Dashboard', text: 'Connected to Desk, 58:8C:81:DF:1E:28' })]), { ...ctx, golden: [], expect: [] });
    expect(bad).toEqual(['/dashboard#x holds the fake box\'s name or address']);
  });

  it('names a hand-kept keyword whose address is gone', () => {
    expect(checkIndex(index(good), { ...ctx, keywordPaths: ['/native/gone'] })).toEqual(['keywords for /native/gone, which is in no entry']);
  });

  it('holds a golden query to its first result in the top three, on the same page where a section folded in', () => {
    expect(checkIndex(index(good), { ...ctx, golden: [{ q: 'bearing', first: '/native/commands/lock' }] })).toEqual([]);
    expect(checkIndex(index(good), { ...ctx, golden: [{ q: 'blue screens', first: '/native/commands/lock#bearing' }] })).toEqual([
      'golden "blue screens": wanted /native/commands/lock#bearing in the first 3, got /guide/help#bsod',
    ]);
    expect(checkIndex(index(good), { ...ctx, golden: [{ q: 'blue screens', first: '/native/commands/lock#bearing', why: 'reason' }] })).toEqual([]);
  });

  it('holds each page to the elements it rendered for search, where the pass says what it saw', () => {
    const rendered = {
      '/native/commands/lock': [
        { id: 'lock', fate: 'folded' as const, panel: false, link: false },
        { id: 'bearing', fate: 'entry' as const, panel: false, link: true },
        { id: 'wire-rate', fate: 'untitled' as const, panel: false, link: false },
        { id: 'stats', fate: 'untitled' as const, panel: true, link: false },
      ],
      '/guide/help': [{ id: 'bsod', fate: 'entry' as const, panel: false, link: true }],
    };
    expect(checkIndex(index(good), { ...ctx, rendered })).toEqual(['/native/commands/lock#wire-rate is marked for search but has no title']);
    expect(checkIndex(index(good), { ...ctx, rendered, sectionIds: ['bearing', 'lost'] })).toContain('section #lost was never rendered');
  });

  it('names a place with an entry and no link icon to copy its address', () => {
    const rendered = {
      '/native/commands/lock': [
        { id: 'lock', fate: 'folded' as const, panel: false, link: false },
        { id: 'bearing', fate: 'entry' as const, panel: false, link: false },
      ],
      '/guide/help': [{ id: 'bsod', fate: 'entry' as const, panel: false, link: true }],
    };
    expect(checkIndex(index(good), { ...ctx, rendered })).toEqual(['/native/commands/lock#bearing has no link icon']);
  });

  it('holds an expected query to its place', () => {
    expect(checkIndex(index(good), { ...ctx, expect: [{ q: 'weighs', path: '/native/commands/lock#bearing', within: 1 }] })).toEqual([
      'query "weighs": wanted /native/commands/lock#bearing in the first 1, got /native/commands/lock',
    ]);
  });
});
