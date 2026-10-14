import type { Results } from './types';

// Which categories of the comparison each Comparison page shows, and the ids of the sections it draws by
// hand. A category in the data goes on exactly one page; one on no page fails the tests until a page shows it.
export interface ComparisonPage {
  path: string;
  categories: string[];
  own: string[];
}

const AREAS = ['devices', 'passthrough', 'injection', 'control-link', 'input', 'recovery', 'features', 'software'];

export const COMPARISON_PAGES: ComparisonPage[] = [
  { path: '/comparison', categories: [], own: [...AREAS.map((a) => `${a}-results`), 'defects'] },
  ...AREAS.map((a) => ({ path: `/comparison/${a}`, categories: [a], own: [] })),
  { path: '/comparison/method', categories: [], own: ['rig', 'rules', 'layers', 'data'] },
];

// The rows Overview leads each area with, by page: chosen, so an area's lead results include where stock
// is ahead as well as where Medius is.
export const KEY_ROWS: Record<string, string[]> = {
  '/comparison/devices': ['devices-data-wooting', 'devices-interval-mouse-10', 'devices-report-768-2047', 'devices-ep0-hid-descriptor'],
  '/comparison/passthrough': ['pass-seq-1000', 'pass-latency-p50-1000', 'pass-latency-p50-125', 'pass-inject-varying', 'pass-pc-config', 'pass-dev-stall'],
  '/comparison/injection': ['inj-lat-rest-1', 'inj-lat-now-125-1', 'inj-delivered-125-1', 'inj-emitted-counting-1000', 'inj-fresh-never'],
  '/comparison/control-link': ['link-rtt-version-p50', 'link-rtt-status-p50', 'link-bad-cut', 'link-bad-moved-corrupt'],
  '/comparison/input': ['input-held-left-release', 'input-leak-x-inject-y-1khz'],
  '/comparison/recovery': ['recovery-exit-left-button', 'recovery-replug-gone', 'recovery-restart-move-port-cycle', 'recovery-sleep-device'],
  '/comparison/features': ['feat-move-absolute', 'feat-pad-drive', 'feat-scale-motion', 'feat-dev-transfer'],
  '/comparison/software': ['software-programs-kmbox-net', 'software-pypi-every', 'software-discord-members', 'software-update-fallback'],
};

export const pageFor = (path: string): ComparisonPage | undefined => COMPARISON_PAGES.find((p) => p.path === path);
export const pageOfCategory = (id: string): ComparisonPage | undefined => COMPARISON_PAGES.find((p) => p.categories.includes(id));

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
      for (const s of known.get(c)?.sections ?? []) {
        if (ids.has(s.id)) faults.push(`${p.path}: section id ${s.id} is used twice`);
        ids.add(s.id);
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
      page.categories.flatMap(
        (c) => known.get(c)?.sections.flatMap((s) => s.tables.flatMap((t) => (t.kind === 'settings' ? [] : t.rows.map((r) => r.id)))) ?? [],
      ),
    );
    for (const id of ids) if (!rows.has(id)) faults.push(`${path}: key row ${id} is not among its rows`);
  }
  return faults;
}
