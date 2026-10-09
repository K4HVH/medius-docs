import { MOVED } from '../src/app/site';

// Where a request for a page under a non-canonical spelling should go (a trailing slash, a .html
// suffix, the wrong letter case), or for a page that moved. Returns the Location for a 301, or null to
// serve as is.
const SKIP = ['/api', '/assets', '/mcp', '/.well-known'];

export function planRedirect(pathname: string, search: string, routes: ReadonlySet<string>): string | null {
  if (SKIP.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  if (pathname.endsWith('.md')) return null;
  let stem = pathname;
  if (stem.length > 1 && stem.endsWith('/')) stem = stem.slice(0, -1);
  if (stem.toLowerCase().endsWith('.html')) stem = stem.slice(0, -'.html'.length);
  if (stem.toLowerCase() === '/index') stem = '/';
  const lower = stem.toLowerCase();
  // A page that moved goes to its new place, with the anchor of the part it became.
  const moved = Object.entries(MOVED).find(([from]) => from.toLowerCase() === lower)?.[1];
  if (moved) {
    const [path, hash] = moved.split('#');
    return path + search + (hash ? `#${hash}` : '');
  }
  for (const route of routes) {
    if (route.toLowerCase() === lower) return route === pathname ? null : route + search;
  }
  return null;
}
