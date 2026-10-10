import { chromium } from 'playwright';
import type { SearchIndex } from '../../src/app/search/types';
import type { Pass } from '../../src/dev/searchPass';
import { withExtra } from '../../src/app/search/extra';
import type { StatsSummary } from '../../server/stats/types';

// The stats every reader sees, empty: the Stats page shows each panel's headings and labels, no figures.
const weeks = Array.from({ length: 26 }, (_, i) => ({ key: `w${i}`, n: 0 }));
const NO_STATS: StatsSummary = {
  boxes: { total: 0, active7: 0, active30: 0, newPerWeek: weeks, activePerDay: Array.from({ length: 90 }, (_, i) => ({ key: `d${i}`, n: 0 })) },
  firmware: { versions: [] },
  devices: { unique: 0, byKind: [], top: [] },
  flashes: {
    total: 0,
    succeeded: 0,
    byResult: [],
    byRoute: [],
    byChips: [],
    bySource: [],
    byVersion: [],
    perWeek: weeks.map((w) => ({ week: w.key, verified: 0, reverted: 0, sent: 0, failed: 0, written: 0 })),
  },
  countries: [],
  os: [],
  browsers: [],
};

// The search index of the site a dev server at `base` serves: its search pass run in headless Chromium,
// the server's API kept from GitHub and the stats store, then the hand-kept words and links. With it, what
// the pass saw on each page, for the checks.
export async function buildSearchIndex(base: string): Promise<{ index: SearchIndex; rendered: Pass['rendered'] }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // The stats answer empty; the rest go unanswered, as in the prerender, so a page holds its loading
    // state, which it marks as not for search.
    await page.route('**/api/**', (route) =>
      new URL(route.request().url()).pathname === '/api/stats'
        ? route.fulfill({ json: NO_STATS })
        : undefined,
    );
    let pass: Pass;
    try {
      await page.goto(`${base}/guide?fakebox=imperfect&searchindex`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => '__searchEntries' in globalThis, null, { timeout: 60000 });
      pass = (await page.evaluate(() => (globalThis as { __searchEntries?: Promise<Pass> }).__searchEntries)) as Pass;
    } catch (e) {
      // What the page threw is the likelier cause of a pass that stopped.
      throw new Error(`${(e as Error).message}${errors.length ? `\nthe page threw:\n${errors.join('\n')}` : ''}`);
    }
    if (errors.length) throw new Error(`search pass: the page threw:\n${errors.join('\n')}`);
    return { index: { version: 1, built: new Date().toISOString(), entries: withExtra(pass.entries) }, rendered: pass.rendered };
  } finally {
    await browser.close();
  }
}
