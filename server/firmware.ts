// Server-side firmware proxy. Holds the GitHub token and fetches releases and
// release assets from the private firmware repo; the browser only ever sees the
// proxied results, never the token.

const GITHUB_API = 'https://api.github.com';
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const RELEASES_TTL_MS = 60_000;

const repo = () => {
  const r = process.env.GITHUB_REPO || 'K4HVH/medius-fw';
  return REPO_RE.test(r) ? r : 'K4HVH/medius-fw';
};
const token = () => process.env.GITHUB_TOKEN;

// Short cache for the releases list so a refresh loop can't burn the GitHub quota.
let releasesCache: { at: number; body: string } | null = null;

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
      const now = Date.now();
      if (releasesCache && now - releasesCache.at < RELEASES_TTL_MS) {
        return new Response(releasesCache.body, {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
        });
      }
      const res = await fetch(`${GITHUB_API}/repos/${repo()}/releases?per_page=20`, {
        headers: ghHeaders('application/vnd.github+json'),
      });
      if (!res.ok) {
        console.warn(`[firmware] releases request failed: ${res.status}`);
        return json({ error: `GitHub releases request failed (${res.status}).` }, 502);
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
      const body = JSON.stringify({ repo: repo(), releases });
      releasesCache = { at: now, body };
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
      });
    }

    const match = url.pathname.match(/^\/api\/firmware\/asset\/(\d+)$/);
    if (match) {
      const res = await fetch(`${GITHUB_API}/repos/${repo()}/releases/assets/${match[1]}`, {
        headers: ghHeaders('application/octet-stream'),
      });
      if (!res.ok) {
        console.warn(`[firmware] asset ${match[1]} failed: ${res.status}`);
        return json({ error: `Asset download failed (${res.status}).` }, res.status === 404 ? 404 : 502);
      }
      return new Response(res.body, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=300' },
      });
    }

    return json({ error: 'Unknown firmware endpoint.' }, 404);
  } catch (e) {
    return json({ error: `Firmware proxy error: ${(e as Error).message}` }, 502);
  }
}
