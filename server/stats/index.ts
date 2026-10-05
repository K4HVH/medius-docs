// The public stats routes: the dashboard posts events, the stats page reads the totals.

import { openDb } from './db';
import { type Store, createStore } from './store';
import { parseEvent } from './validate';

export const MAX_BODY = 2048;
const RATE_WINDOW_MS = 60_000;
const SUMMARY_TTL_MS = 60_000;
const RETRY_OPEN_MS = 60_000;
// Per client address, for every address together, and how many addresses are remembered at once: the
// table is swept once a window, and a new address waits while it is full.
const LIMITS = { perAddress: 60, total: 1200, addresses: 10_000 };

let path = process.env.STATS_DB || 'data/stats.db';
let now = () => Date.now();
let limits = LIMITS;
let store: Promise<Store | null> | null = null;
let failedAt = 0;
let summary: { at: number; body: string } | null = null;
const seen = new Map<string, { start: number; n: number }>();
let swept = 0;
let all = { start: 0, n: 0 };

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

export function resetStatsForTests(o: { path: string; now: () => number; limits?: Partial<typeof LIMITS> }): void {
  path = o.path;
  now = o.now;
  limits = { ...LIMITS, ...o.limits };
  store = null;
  failedAt = -RETRY_OPEN_MS;
  summary = null;
  seen.clear();
  swept = o.now();
  all = { start: o.now(), n: 0 };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// One home network hands out a whole IPv6 /64, so that is one client.
const clientOf = (ip: string): string => {
  const a = ip.split('%')[0].toLowerCase();
  if (!a.includes(':')) return a;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (v4) return v4[1];
  const [head, tail] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
};

const allowed = (ip: string): boolean => {
  const t = now();
  if (t - all.start >= RATE_WINDOW_MS) all = { start: t, n: 0 };
  if (t - swept >= RATE_WINDOW_MS) {
    for (const [k, v] of seen) if (t - v.start >= RATE_WINDOW_MS) seen.delete(k);
    swept = t;
  }
  const key = clientOf(ip);
  const s = seen.get(key);
  if (s && t - s.start < RATE_WINDOW_MS) {
    if (s.n >= limits.perAddress) return false;
  } else if (!s && seen.size >= limits.addresses) {
    return false;
  }
  if (all.n >= limits.total) return false;
  all.n++;
  if (s && t - s.start < RATE_WINDOW_MS) s.n++;
  else seen.set(key, { start: t, n: 1 });
  return true;
};

const hostname = (h: string | null | undefined): string | undefined => {
  if (!h) return undefined;
  try {
    return new URL(`http://${h.split(',')[0].trim()}`).hostname;
  } catch {
    return undefined;
  }
};

// A browser on another site may post too. A proxy in front may rewrite Host, so the forwarded one counts,
// and so does Sec-Fetch-Site: same-origin.
const sameSite = (req: Request): boolean => {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  if (req.headers.get('sec-fetch-site') === 'same-origin') return true;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return [req.headers.get('x-forwarded-host'), req.headers.get('host'), new URL(req.url).host].some((h) => hostname(h) === host);
};

// The body, or null past the cap: read only that far, whatever the length header says.
async function readCapped(req: Request): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

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
  const bytes = await readCapped(req);
  if (!bytes) return json({ error: 'Too large.' }, 413);
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
