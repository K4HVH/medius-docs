// The comparison data the site holds, and what its pages show of it: a category on no page, a page or key row
// the data lacks, or a section id used twice on a page fails here, and so the build.
import { describe, expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { RESULTS } from '../../src/app/data/comparison';
import { COMPARISON_PAGES, KEY_ROWS, pageFaults, type ComparisonPage } from '../../src/app/data/comparison/pages';
import type { Results } from '../../src/app/data/comparison/types';
import { ROUTES } from '../../src/app/routes';

const DATA: Results = {
  format: 1,
  firmware: { stock: 'V4.094', medius: '3.4.6' },
  rig: 'Two boxes',
  layers: {},
  categories: [
    {
      id: 'injection',
      title: 'Injected motion',
      groups: [
        { id: 'streams', title: 'Streams', about: 'A stream.', kind: 'rows', rows: [{ id: 'stream-1000', test: '1,000 Hz', stock: '10.8 ms', medius: '1.85 ms', verdict: 'medius' }] },
      ],
    },
    {
      id: 'devices',
      title: 'Devices',
      groups: [{ id: 'shapes', title: 'Shapes', about: 'Shapes.', kind: 'rows', rows: [{ id: 'byte-exact', test: 'Byte-exact', stock: '20', medius: '21', verdict: 'medius' }] }],
    },
  ],
  defects: [],
  pending: [],
};
const PAGES: ComparisonPage[] = [
  { path: '/comparison', categories: [], own: ['injection-results', 'devices-results', 'defects'] },
  { path: '/comparison/injection', categories: ['injection'], own: [] },
  { path: '/comparison/devices', categories: ['devices'], own: ['shape-map'] },
];
const KEYS = { '/comparison/injection': ['stream-1000'], '/comparison/devices': ['byte-exact'] };

describe('the comparison guard', () => {
  it('passes data every page shows', () => {
    expect(pageFaults(DATA, PAGES, KEYS)).toEqual([]);
  });

  it('fails a category no page shows', () => {
    const pages = PAGES.filter((p) => p.path !== '/comparison/devices');
    const keys = { '/comparison/injection': ['stream-1000'] };
    expect(pageFaults(DATA, pages, keys).join()).toContain('devices');
  });

  it('fails a category two pages show', () => {
    const pages = [...PAGES, { path: '/comparison/more', categories: ['devices'], own: [] }];
    expect(pageFaults(DATA, pages, KEYS).join()).toContain('devices');
  });

  it('fails a page naming a category the data lacks', () => {
    const pages = [...PAGES, { path: '/comparison/controllers', categories: ['controllers'], own: [] }];
    expect(pageFaults(DATA, pages, KEYS).join()).toContain('controllers');
  });

  it("fails a key row the data lacks, or one from another page's categories", () => {
    expect(pageFaults(DATA, PAGES, { ...KEYS, '/comparison/injection': ['stream-30'] }).join()).toContain('stream-30');
    expect(pageFaults(DATA, PAGES, { ...KEYS, '/comparison/injection': ['byte-exact'] }).join()).toContain('byte-exact');
  });

  it('fails a key row list for a page that is not there', () => {
    expect(pageFaults(DATA, PAGES, { ...KEYS, '/comparison/gone': ['stream-1000'] }).join()).toContain('/comparison/gone');
  });

  it("fails a section id whose address is another page's", () => {
    const pages = PAGES.map((p) => (p.path === '/comparison' ? { ...p, own: ['devices', 'defects'] } : p));
    expect(pageFaults(DATA, pages, KEYS).join()).toContain('/comparison/devices');
  });

  it('fails a section id the site shell already uses', () => {
    const data = structuredClone(DATA);
    data.categories[1].groups[0].id = 'side';
    expect(pageFaults(data, PAGES, KEYS).join()).toContain('side');
  });

  it("fails a page's own section id that a group of its data also uses", () => {
    const pages = PAGES.map((p) => (p.path === '/comparison/devices' ? { ...p, own: ['shapes'] } : p));
    expect(pageFaults(DATA, pages, KEYS).join()).toContain('shapes');
  });
});

describe('the comparison the site holds', () => {
  it('passes the check', () => {
    expect(checkResults(RESULTS)).toEqual([]);
  });

  it('is on its pages: every category once, every key row there', () => {
    expect(pageFaults(RESULTS, COMPARISON_PAGES, KEY_ROWS)).toEqual([]);
  });

  it('has a page for every Comparison route, and a route for every page', () => {
    const routes = ROUTES.filter((r) => r.section === 'comparison').map((r) => r.path);
    expect(COMPARISON_PAGES.map((p) => p.path).sort()).toEqual(routes.sort());
  });
});
