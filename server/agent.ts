// Agent-facing serving: Markdown twins (/x.md and Accept: text/markdown on /x) and prerendered
// HTML, all with Vary: Accept so caches split the variants.
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { LIVE_PATHS, SITE, SOFT_FILL_PATHS } from '../src/app/site';
import { fillMarkdown, fillPage } from './fill';

const DIST = resolve(process.env.PUBLIC_DIR || './dist');

export type AgentAction =
  | { kind: 'pass' }
  | { kind: 'markdown'; path: string }
  | { kind: 'html'; path: string }
  | { kind: 'notfound' };

// Markdown only when it's asked for by name, with a quality above zero and no lower than HTML's.
export function acceptsMarkdown(accept: string): boolean {
  let md = -1;
  let html = -1;
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().split(';').map((x) => x.trim());
    const qParam = params.find((p) => p.startsWith('q='));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (Number.isNaN(q)) continue;
    if (type === 'text/markdown') md = Math.max(md, q);
    else if (type === 'text/html') html = Math.max(html, q);
  }
  return md > 0 && md >= html;
}

export function isCandidateRoute(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/') || decoded === '/' || decoded.endsWith('/')) return false;
  if (decoded.startsWith('/api') || decoded.startsWith('/assets')) return false;
  const last = decoded.slice(decoded.lastIndexOf('/') + 1);
  if (/\.[A-Za-z0-9]+$/.test(last)) return false; // has a file extension
  return true;
}

// Pure routing decision. `has(p)` reports whether dist has the file at p (a
// dist-relative path beginning with '/'), e.g. '/library/clip.md'.
export function planAgentResponse(
  pathname: string,
  accept: string,
  has: (distRelPath: string) => boolean,
): AgentAction {
  if (pathname.endsWith('.md')) {
    return has(pathname) ? { kind: 'markdown', path: pathname } : { kind: 'notfound' };
  }
  if (isCandidateRoute(pathname) && has(pathname + '.html')) {
    if (acceptsMarkdown(accept) && has(pathname + '.md')) {
      return { kind: 'markdown', path: pathname + '.md' };
    }
    return { kind: 'html', path: pathname + '.html' };
  }
  return { kind: 'pass' };
}

// Resolve a dist-relative request path to an absolute path inside DIST, or null
// if it escapes (path traversal) or cannot be decoded.
function distFile(distRelPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(distRelPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const full = resolve(DIST, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  if (full !== DIST && !full.startsWith(DIST + sep)) return null;
  return full;
}

function has(distRelPath: string): boolean {
  const abs = distFile(distRelPath);
  return abs ? existsSync(abs) : false;
}

// Advertise the llms.txt indexes from every doc response (RFC 8288 Link header),
// and let CDNs/agents cache briefly while revalidating in the background.
export const LLMS_LINK = '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"';

// A Markdown twin names its HTML page as the canonical copy, so search engines index the page, not both.
export function markdownLink(mdPath: string): string {
  return `<${SITE}${mdPath.replace(/\.md$/, '')}>; rel="canonical", ${LLMS_LINK}`;
}

// Agent files that are not pages for a search result.
export const NOINDEX_ARTIFACTS = /^\/(llms\.txt|llms-full\.txt|agent-index\.json|routes\.json)$/;
export const DOC_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
// The changelog and stats change without a deploy: cache them as briefly as their sources.
export const LIVE_CACHE = 'public, max-age=60';
const MD_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  vary: 'Accept',
  link: LLMS_LINK,
  'cache-control': DOC_CACHE,
};
const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  vary: 'Accept',
  link: LLMS_LINK,
  'cache-control': DOC_CACHE,
};

const LIVE_DOWN = { 'retry-after': '120', 'cache-control': 'no-store' };

// A page the server fills: a live page never filled answers 503 with its snapshot, so crawlers retry
// rather than index "Loading..."; a soft page always answers 200, filled as far as its sources allow.
// Null for any other page.
export async function livePage(
  path: string,
  snapshot: string,
  fill: (path: string, html: string) => Promise<string | null> = fillPage,
): Promise<{ status: number; html: string } | null> {
  if (SOFT_FILL_PATHS.has(path)) return { status: 200, html: (await fill(path, snapshot)) ?? snapshot };
  if (!LIVE_PATHS.has(path)) return null;
  const html = await fill(path, snapshot);
  return html ? { status: 200, html } : { status: 503, html: snapshot };
}

// `routes` (the registry paths) limits pages to real addresses: //native or /%6Eative decode to a file
// on disk but are not pages.
export async function handleAgentDocs(req: Request, routes?: ReadonlySet<string>): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const pathname = new URL(req.url).pathname;
  if (distFile(pathname) === null) return new Response('Bad request', { status: 400 });

  const action = planAgentResponse(pathname, req.headers.get('accept') || '', has);
  const route = pathname.replace(/\.md$/, '');
  if (routes && action.kind !== 'pass' && !routes.has(route)) {
    return action.kind === 'html' ? null : new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  switch (action.kind) {
    case 'pass':
      return null;
    case 'notfound':
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    case 'markdown': {
      const abs = distFile(action.path)!;
      const headers = { ...MD_HEADERS, link: markdownLink(action.path) };
      const live = action.path.replace(/\.md$/, '');
      if (LIVE_PATHS.has(live)) {
        const md = await fillMarkdown(live);
        if (!md) return new Response('Try again shortly.\n', { status: 503, headers: { ...headers, ...LIVE_DOWN } });
        return new Response(md, { headers: { ...headers, 'cache-control': LIVE_CACHE } });
      }
      return new Response(Bun.file(abs), { headers });
    }
    case 'html': {
      const abs = distFile(action.path)!;
      const live = action.path.replace(/\.html$/, '');
      const page = LIVE_PATHS.has(live) || SOFT_FILL_PATHS.has(live) ? await livePage(live, await Bun.file(abs).text()) : null;
      if (page) {
        const headers = page.status === 503 ? { ...HTML_HEADERS, ...LIVE_DOWN } : { ...HTML_HEADERS, 'cache-control': LIVE_CACHE };
        return new Response(page.html, { status: page.status, headers });
      }
      return new Response(Bun.file(abs), { headers: HTML_HEADERS });
    }
  }
}
