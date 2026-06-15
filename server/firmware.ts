// Server-side firmware proxy. Holds the GitHub token and fetches releases and
// release assets from the private firmware repo; the browser only ever sees the
// proxied results, never the token.
//
// GitHub release asset ids are immutable (a re-uploaded file gets a new id), so
// asset bytes are cached by id with no invalidation: a new version is new ids,
// which miss the cache and get fetched once. The asset endpoint only serves ids
// that appear as .bin assets in the releases list.

const GITHUB_API = 'https://api.github.com';
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const RELEASES_TTL_MS = 60_000;
const ASSET_CACHE_MAX_BYTES = 64 * 1024 * 1024;

const repo = () => {
  const r = process.env.GITHUB_REPO || 'K4HVH/medius-fw';
  return REPO_RE.test(r) ? r : 'K4HVH/medius-fw';
};
const token = () => process.env.GITHUB_TOKEN;

// Short cache for the releases list so a refresh loop can't burn the GitHub quota.
let releasesCache: { at: number; body: string } | null = null;
// Asset ids known to be .bin downloads, learned from the releases list. Immutable,
// so this only grows; it gates which ids the asset endpoint will fetch.
const allowedAssetIds = new Set<number>();
// LRU cache of asset bytes by id. Entries never go stale (ids are immutable);
// evict the least-recently-used once over the size cap.
const assetCache = new Map<number, Uint8Array<ArrayBuffer>>();
let assetCacheBytes = 0;

function ghHeaders(accept: string): Record<string, string> {
  const t = token();
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'medius-dashboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface GhAsset {
  id: number;
  name: string;
  size: number;
}
interface GhRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  prerelease: boolean;
  body: string | null;
  assets: GhAsset[];
}

// Fetch (or serve cached) the releases list, recording the .bin asset ids it
// references. Returns the projected JSON body, or null on an upstream failure.
async function loadReleases(): Promise<string | null> {
  const now = Date.now();
  if (releasesCache && now - releasesCache.at < RELEASES_TTL_MS) return releasesCache.body;
  const res = await fetch(`${GITHUB_API}/repos/${repo()}/releases?per_page=20`, {
    headers: ghHeaders('application/vnd.github+json'),
  });
  if (!res.ok) {
    console.warn(`[firmware] releases request failed: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as GhRelease[];
  const releases = data.map((r) => ({
    tag: r.tag_name,
    name: r.name ?? r.tag_name,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
    notes: r.body ?? '',
    assets: (r.assets ?? [])
      .filter((a) => a.name.endsWith('.bin'))
      .map((a) => ({ id: a.id, name: a.name, size: a.size })),
  }));
  for (const r of releases) for (const a of r.assets) allowedAssetIds.add(a.id);
  const body = JSON.stringify({ repo: repo(), releases });
  releasesCache = { at: now, body };
  return body;
}

function cacheGetAsset(id: number): Uint8Array<ArrayBuffer> | undefined {
  const hit = assetCache.get(id);
  if (hit) {
    // Move to the most-recently-used end.
    assetCache.delete(id);
    assetCache.set(id, hit);
  }
  return hit;
}

function cachePutAsset(id: number, bytes: Uint8Array<ArrayBuffer>): void {
  if (bytes.length > ASSET_CACHE_MAX_BYTES) return;
  const existing = assetCache.get(id);
  if (existing) {
    assetCacheBytes -= existing.length;
    assetCache.delete(id);
  }
  while (assetCacheBytes + bytes.length > ASSET_CACHE_MAX_BYTES && assetCache.size > 0) {
    const oldest = assetCache.keys().next().value as number;
    assetCacheBytes -= assetCache.get(oldest)?.length ?? 0;
    assetCache.delete(oldest);
  }
  assetCache.set(id, bytes);
  assetCacheBytes += bytes.length;
}

const assetResponse = (bytes: Uint8Array<ArrayBuffer>): Response =>
  new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream',
      // ids are immutable, so the browser can hold it indefinitely; private keeps
      // the closed firmware out of shared caches.
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });

// Handle a /api/firmware/* request. Returns a Response, or null if the path is
// not a firmware route (so the caller falls through to static serving).
export async function handleFirmwareApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/firmware')) return null;

  if (!token()) {
    return json({ error: 'Firmware fetch is not configured on this server.' }, 503);
  }

  try {
    if (url.pathname === '/api/firmware/releases') {
      const body = await loadReleases();
      if (body === null) return json({ error: 'GitHub releases request failed.' }, 502);
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
      });
    }

    const match = url.pathname.match(/^\/api\/firmware\/asset\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);

      // A cached asset was already allowlist-checked when it was stored, so serve
      // it without re-validating (also keeps downloads working if GitHub is down).
      const cached = cacheGetAsset(id);
      if (cached) return assetResponse(cached);

      // Only fetch ids that are .bin release assets. Populate the allowlist if we
      // have not seen this id yet (respects the 60s releases cache).
      if (!allowedAssetIds.has(id)) await loadReleases();
      if (!allowedAssetIds.has(id)) return json({ error: 'Unknown firmware asset.' }, 404);

      const res = await fetch(`${GITHUB_API}/repos/${repo()}/releases/assets/${id}`, {
        headers: ghHeaders('application/octet-stream'),
      });
      if (!res.ok) {
        console.warn(`[firmware] asset ${id} failed: ${res.status}`);
        return json({ error: 'Asset download failed.' }, res.status === 404 ? 404 : 502);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      cachePutAsset(id, bytes);
      return assetResponse(bytes);
    }

    return json({ error: 'Unknown firmware endpoint.' }, 404);
  } catch (e) {
    console.warn(`[firmware] proxy error: ${(e as Error).message}`);
    return json({ error: 'Firmware proxy error.' }, 502);
  }
}
