// The public stats routes: the dashboard posts events, the stats page reads the totals.

import { openDb } from './db';
import { type Store, createStore } from './store';
import { parseEvent } from './validate';

const MAX_BODY = 2048;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const SUMMARY_TTL_MS = 60_000;
const RETRY_OPEN_MS = 60_000;

let path = process.env.STATS_DB || 'data/stats.db';
let now = () => Date.now();
let store: Promise<Store | null> | null = null;
let failedAt = 0;
let summary: { at: number; body: string } | null = null;
const seen = new Map<string, { start: number; n: number }>();

// A database that won't open is tried again a minute later, not on every request.
async function open(): Promise<Store | null> {
  if (!store && now() - failedAt >= RETRY_OPEN_MS) {
    store = openDb(path)
      .then((db) => {
        try {
          return createStore(db, now);
        } catch (e) {
          db.close();
          throw e;
        }
      })
      .catch((e: Error) => {
        console.warn(`[stats] database unavailable at ${path}: ${e.message}`);
        failedAt = now();
        store = null;
        return null;
      });
  }
  return store ?? null;
}

export function resetStatsForTests(o: { path: string; now: () => number }): void {
  path = o.path;
  now = o.now;
  store = null;
  failedAt = -RETRY_OPEN_MS;
  summary = null;
  seen.clear();
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const allowed = (ip: string): boolean => {
  const t = now();
  if (seen.size > 10_000) for (const [k, v] of seen) if (t - v.start >= RATE_WINDOW_MS) seen.delete(k);
  const s = seen.get(ip);
  if (!s || t - s.start >= RATE_WINDOW_MS) {
    seen.set(ip, { start: t, n: 1 });
    return true;
  }
  return ++s.n <= RATE_MAX;
};

// A browser on another site may post too; a proxy in front may rewrite Host, so the forwarded one
// counts as well.
const sameSite = (req: Request): boolean => {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const first = (h: string | null) => h?.split(',')[0].trim();
  return [first(req.headers.get('x-forwarded-host')), req.headers.get('host'), new URL(req.url).host].includes(host);
};

// Cloudflare's XX is unknown and T1 is Tor.
const country = (req: Request): string | null => {
  const c = req.headers.get('cf-ipcountry')?.toUpperCase();
  return c && /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
};

async function postEvent(req: Request, clientIp: string | undefined): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSite(req)) return json({ error: 'Not from this site.' }, 403);
  if (!allowed(req.headers.get('cf-connecting-ip') ?? clientIp ?? 'unknown')) {
    return json({ error: 'Too many events.' }, 429);
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'Too large.' }, 413);
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_BODY) return json({ error: 'Too large.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: 'Not JSON.' }, 400);
  }
  const event = parseEvent(body);
  if (typeof event === 'string') return json({ error: event }, 400);
  const s = await open();
  if (!s) return json({ error: 'Stats are unavailable.' }, 503);
  s.ingest(event, country(req));
  return new Response(null, { status: 204 });
}

async function getSummary(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Use GET.' }, 405);
  const s = await open();
  if (!s) return json({ error: 'Stats are unavailable.' }, 503);
  if (!summary || now() - summary.at >= SUMMARY_TTL_MS) summary = { at: now(), body: JSON.stringify(s.summary()) };
  return new Response(summary.body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}

// A /api/stats request's response, or null for any other path.
export async function handleStatsApi(req: Request, clientIp?: string): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname !== '/api/stats' && !pathname.startsWith('/api/stats/')) return null;
  try {
    if (pathname === '/api/stats/event') return await postEvent(req, clientIp);
    if (pathname === '/api/stats') return await getSummary(req);
    return json({ error: 'Unknown stats endpoint.' }, 404);
  } catch (e) {
    console.warn(`[stats] ${(e as Error).message}`);
    return json({ error: 'Stats error.' }, 500);
  }
}
