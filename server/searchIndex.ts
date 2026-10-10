import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FirmwareRelease } from '../src/dashboard/firmware/client';
import { COMPAT } from '../src/app/data/compatibility';
import { mergeCompat } from '../src/app/data/compatMerge';
import { SYNONYMS } from '../src/app/search/extra';
import { liveEntries, mergeLive } from '../src/app/search/live';
import { createSearcher, type Searcher } from '../src/app/search/rank';
import type { SearchIndex } from '../src/app/search/types';
import { cached } from './cached';
import { liveReleases } from './home';
import { getStatsSummary } from './stats';
import type { StatsSummary } from './stats/types';

// /search-index.json: the index the site build wrote, with each firmware release and each device report
// the server knows added, so a release published today is found today. Neither source is waited on: one
// that has never answered leaves its entries out until it does.

export interface SearchSources {
  releases: () => Promise<FirmwareRelease[] | null>;
  stats: () => Promise<StatsSummary | null>;
}

const stats = cached(getStatsSummary, { freshMs: 60_000, budgetMs: 1_000 });
const LIVE: SearchSources = { releases: () => liveReleases(0), stats: () => stats() };

// The built index, read again when its file changes.
let built: { file: string; mtime: number; index: SearchIndex } | null = null;
function builtIndex(dir: string): SearchIndex | null {
  const file = join(dir, 'search-index.json');
  if (!existsSync(file)) return null;
  const mtime = statSync(file).mtimeMs;
  if (built?.file !== file || built.mtime !== mtime) built = { file, mtime, index: JSON.parse(readFileSync(file, 'utf8')) as SearchIndex };
  return built.index;
}

// What the live sources hold now, and a key that changes only when that does: each source answers with a
// new object every minute, whatever it holds.
interface Live {
  releases: FirmwareRelease[] | null;
  summary: StatsSummary | null;
  key: string;
}
async function read(sources: SearchSources): Promise<Live> {
  const [releases, summary] = await Promise.all([sources.releases().catch(() => null), sources.stats().catch(() => null)]);
  return { releases, summary, key: JSON.stringify([releases, summary?.devices.top ?? null]) };
}
const merged = (base: SearchIndex, live: Live) =>
  mergeLive(base, liveEntries({ releases: live.releases, devices: mergeCompat(COMPAT, live.summary?.devices.top ?? null) }));

// The built index with the live entries merged in.
export async function liveIndex(base: SearchIndex, sources: SearchSources = LIVE): Promise<SearchIndex> {
  return merged(base, await read(sources));
}

// The site search over the live index, for the agent search; one searcher is kept while the index and
// what the sources hold stay the same.
let searching: { base: SearchIndex; key: string; searcher: Searcher } | null = null;
export async function liveSearcher(dir: string, sources: SearchSources = LIVE): Promise<Searcher | null> {
  const base = builtIndex(dir);
  if (!base) return null;
  const live = await read(sources);
  if (searching?.base !== base || searching.key !== live.key)
    searching = { base, key: live.key, searcher: createSearcher(merged(base, live).entries, { synonyms: SYNONYMS }) };
  return searching.searcher;
}

// The last answer, kept while its index and what the sources hold stay the same.
let last: { base: SearchIndex; key: string; body: string; etag: string } | null = null;

// A browser keeps the index five minutes; half a minute when a source had nothing to give, so the
// releases or devices it lacks come soon. `cache` sets the rule instead (the dev server keeps nothing).
export async function serveIndex(req: Request, base: SearchIndex, sources: SearchSources = LIVE, opts: { cache?: string } = {}): Promise<Response> {
  const live = await read(sources);
  if (last?.base !== base || last.key !== live.key) {
    const body = JSON.stringify(merged(base, live));
    last = { base, key: live.key, body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` };
  }
  const cache = opts.cache ?? (live.releases && live.summary ? 'public, max-age=300' : 'public, max-age=30');
  const headers = { 'cache-control': cache, etag: last.etag, 'x-robots-tag': 'noindex' };
  // Any tag the browser holds, weak (a proxy that compresses marks it so) or one of several, or any at all.
  const held = req.headers.get('if-none-match');
  const etag = last.etag;
  if (held && (held.trim() === '*' || held.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)))
    return new Response(null, { status: 304, headers });
  return new Response(last.body, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
}

export async function handleSearchIndex(req: Request, dir: string, sources: SearchSources = LIVE): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/search-index.json') return null;
  const base = builtIndex(dir);
  if (!base)
    return new Response(JSON.stringify({ error: 'The search index is built with the site: run bun run build:full.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  return serveIndex(req, base, sources);
}
