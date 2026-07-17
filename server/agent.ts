// Agent-facing serving: Markdown twins (/x.md and Accept: text/markdown on /x)
// and prerendered HTML, all with Vary: Accept so caches split the variants.
// Wired into serve.ts after handleFirmwareApi; returns null to fall through.
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const DIST = resolve(process.env.PUBLIC_DIR || './dist');

export type AgentAction =
  | { kind: 'pass' }
  | { kind: 'markdown'; path: string }
  | { kind: 'html'; path: string }
  | { kind: 'notfound' };

export function acceptsMarkdown(accept: string): boolean {
  return accept.split(',').some((part) => part.trim().split(';')[0].trim() === 'text/markdown');
}

export function isCandidateRoute(pathname: string): boolean {
  if (!pathname.startsWith('/') || pathname === '/' || pathname.endsWith('/')) return false;
  if (pathname.startsWith('/api') || pathname.startsWith('/assets')) return false;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
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

const MD_HEADERS = { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' };
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', vary: 'Accept' };

export async function handleAgentDocs(req: Request): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const pathname = new URL(req.url).pathname;
  if (distFile(pathname) === null) return new Response('Bad request', { status: 400 });

  const action = planAgentResponse(pathname, req.headers.get('accept') || '', has);
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
      return new Response(Bun.file(abs), { headers: MD_HEADERS });
    }
    case 'html': {
      const abs = distFile(action.path)!;
      return new Response(Bun.file(abs), { headers: HTML_HEADERS });
    }
  }
}
