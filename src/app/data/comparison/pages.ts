import type { Results } from './types';

// Which categories of the comparison each Comparison page shows, and the ids of the sections it draws by
// hand. A category in the data goes on exactly one page; one on no page fails the tests until a page shows it.
export interface ComparisonPage {
  path: string;
  categories: string[];
  own: string[];
}

export const COMPARISON_PAGES: ComparisonPage[] = [
  {
    path: '/comparison',
    categories: [],
    own: [
      'devices-results', 'passthrough-results', 'injection-results', 'control-link-results', 'input-results',
      'controllers-results', 'recovery-results', 'capabilities-results', 'software-results', 'defects',
    ],
  },
  { path: '/comparison/devices', categories: ['devices'], own: [] },
  { path: '/comparison/passthrough', categories: ['passthrough'], own: [] },
  { path: '/comparison/injection', categories: ['injection'], own: [] },
  { path: '/comparison/control-link', categories: ['control-link'], own: [] },
  { path: '/comparison/input', categories: ['input'], own: [] },
  { path: '/comparison/controllers', categories: ['controllers'], own: [] },
  { path: '/comparison/recovery', categories: ['recovery'], own: [] },
  { path: '/comparison/capabilities', categories: ['capabilities'], own: [] },
  { path: '/comparison/software', categories: ['software'], own: [] },
  { path: '/comparison/method', categories: [], own: ['rig', 'conventions', 'layers', 'pending', 'data'] },
];

// The rows Overview leads each area with, by page. Chosen, so an area's lead results include where stock
// is ahead as well as where Medius is.
export const KEY_ROWS: Record<string, string[]> = {
  '/comparison/devices': ['shapes-cloned-of-56', 'byte-exact-21-authored-shapes', 'report-descriptor-of-1500-b', 'clone-time-new-device-8-shapes'],
  '/comparison/passthrough': ['reports-dropped-duplicated-reordered', '500-hz-2-min-intervals-outside-10', 'device-reports-taken-while-injecting-varying-mouse', 'device-stalls-its-interrupt-in'],
  '/comparison/injection': ['move-1-count-mouse-at-rest', 'stream-1000-hz', 'move-50-counts-125-hz-mouse', '400-sparse-moves-mouse-moving'],
  '/comparison/control-link': ['paced-lossless-up-to', 'moves-in-one-write', 'after-an-overload', 'version-query-round-trip-wire-p50-p95'],
  '/comparison/input': ['key-latency-down-up-p50', 'axis-lock-takes-effect-releases-p50', 'button-latency-press-release-p50'],
  '/comparison/controllers': ['xinput-gip-hid-pad-relay', 'read-and-drive-a-game-controller'],
  '/comparison/recovery': ['button-held-after-the-program-exits', 'unplug-noticed', 'pc-restart-first-injected-move', 'device-input-while-the-pc-sleeps'],
  '/comparison/capabilities': ['absolute-move-on-a-virtual-screen', 'move-with-a-receipt', 'scripted-sequences-with-triggers-loop-auto-lock', 'raw-usb-capture'],
  '/comparison/software': ['programs-for-other-boxes', 'community-discord', 'update', 'data-sent-at-every-launch'],
};

export const pageFor = (path: string): ComparisonPage | undefined => COMPARISON_PAGES.find((p) => p.path === path);

// Ids the site's shell puts on its elements: a section with one would lose its address to the shell.
const SHELL_IDS = new Set(['root', 'side', 'site-links', 'srch-list']);

// Every way the pages and the data disagree; none when each category is on one page and every key row is
// on its page.
export function pageFaults(results: Results, pages: ComparisonPage[], keyRows: Record<string, string[]>): string[] {
  const faults: string[] = [];
  const shown = new Map<string, string>();
  for (const p of pages)
    for (const c of p.categories) {
      if (shown.has(c)) faults.push(`category ${c} is on ${shown.get(c)} and ${p.path}`);
      shown.set(c, p.path);
    }
  const known = new Map(results.categories.map((c) => [c.id, c]));
  for (const c of results.categories) if (!shown.has(c.id)) faults.push(`category ${c.id} is on no page`);
  for (const [c, path] of shown) if (!known.has(c)) faults.push(`${path} shows category ${c}, which the data lacks`);

  const paths = new Set(pages.map((p) => p.path));
  for (const p of pages) {
    const ids = new Set(p.own);
    for (const c of p.categories)
      for (const g of known.get(c)?.groups ?? []) {
        if (ids.has(g.id)) faults.push(`${p.path}: section id ${g.id} is used twice`);
        ids.add(g.id);
      }
    for (const id of ids) {
      if (paths.has(`${p.path}/${id}`)) faults.push(`${p.path}: section id ${id} has the address of the page ${p.path}/${id}`);
      if (SHELL_IDS.has(id)) faults.push(`${p.path}: section id ${id} is an id the site shell uses`);
    }
  }

  for (const [path, ids] of Object.entries(keyRows)) {
    const page = pages.find((p) => p.path === path);
    if (!page) {
      faults.push(`key rows for ${path}, which is not a page`);
      continue;
    }
    const rows = new Set(
      page.categories.flatMap((c) => known.get(c)?.groups.flatMap((g) => (g.kind === 'rows' ? g.rows.map((r) => r.id) : [])) ?? []),
    );
    for (const id of ids) if (!rows.has(id)) faults.push(`${path}: key row ${id} is not among its rows`);
  }
  return faults;
}
