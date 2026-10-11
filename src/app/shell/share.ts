import { addressFor, pagePath, placeAddress, routeFor } from '../routes';
import { TARGET, sortMarked } from '../search/places';

// The address a link to an element on the page shares, read as search reads the page (search/places.ts):
// a place's address when search lists it as one; the page's when it opens the page (its header, or the
// section folded into it); a device row's or release's item address; otherwise the page and the hash.
export function shareAddress(el: Element | null, id: string, pathname: string): string {
  const page = pagePath(pathname);
  const route = routeFor(page);
  const hash = `${page}#${id}`;
  const at = placeAddress(page, id);
  if (el?.matches(TARGET) && route) {
    if (el.matches('.page-header')) return page;
    const fate = sortMarked(el.closest('main') ?? document.body, route.title).fate(el);
    return fate === 'entry' ? (at ?? hash) : fate === 'folded' ? page : hash;
  }
  const kind = at ? addressFor(at)?.kind : undefined;
  return el && at && (kind === 'device' || kind === 'release') ? at : hash;
}
