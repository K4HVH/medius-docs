import { createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { NOT_FOUND, type RouteInfo, documentTitle, routeFor } from './routes';
import { cardUrl, pageCard } from './card/content';
import { itemFor } from './items';
import { lostPath } from './served';
import { SITE } from './site';
import { buildJsonLd } from './structuredData';

// Written by scripts/lastmod.mjs in CI; absent in a local build.
const LASTMOD: Record<string, string> =
  Object.values(import.meta.glob<Record<string, string>>('../generated/lastmod.json', { eager: true, import: 'default' }))[0] ?? {};

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string | null): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setRobots(content: string | null): void {
  const el = document.head.querySelector('meta[name="robots"]');
  if (content === null) el?.remove();
  else upsertMeta('name', 'robots', content);
}

function setJsonLd(data: object): void {
  let el = document.head.querySelector('script#ld-json');
  if (!el) {
    el = document.createElement('script');
    el.id = 'ld-json';
    el.setAttribute('type', 'application/ld+json');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// The address bar stays black; the stripe colour an unfurler reads waits in data-embed, and the prerender
// puts it in content for the snapshot (src/index.html sets it back before the page paints).
function setThemeColor(colour: string): void {
  upsertMeta('name', 'theme-color', '#000000');
  document.head.querySelector('meta[name="theme-color"]')!.setAttribute('data-embed', colour);
}

// The parts of the head written per page, so the head the server wrote for an item's address can be kept
// and put back.
const WRITTEN = [
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[name="robots"]',
  'meta[property="og:type"]',
  'meta[property="og:url"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:image"]',
  'meta[property="og:image:alt"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
  'meta[name="theme-color"]',
  'script#ld-json',
];

interface Kept {
  title: string;
  nodes: [string, Node | null][];
}

const keep = (): Kept => ({
  title: document.title,
  nodes: WRITTEN.map((sel) => [sel, document.head.querySelector(sel)?.cloneNode(true) ?? null]),
});

function putBack(kept: Kept): void {
  document.title = kept.title;
  for (const [sel, node] of kept.nodes) {
    document.head.querySelector(sel)?.remove();
    if (node) document.head.appendChild(node.cloneNode(true));
  }
}

// An item's address with no head from the server (reached in the app) takes its parent's, out of search.
function write(route: RouteInfo, item: string | null): void {
  const title = documentTitle(route);
  const indexed = route.index && !item;
  const url = item ? SITE + item : indexed ? SITE + (route.path === '/' ? '/' : route.path) : null;
  const card = pageCard(route);
  const image = cardUrl(route.section === 'notfound' ? '/' : route.path, card);
  document.title = title;
  upsertMeta('name', 'description', route.description);
  setLink('canonical', indexed ? url : null);
  setRobots(indexed ? null : 'noindex');
  upsertMeta('property', 'og:type', route.kind === 'article' && indexed ? 'article' : 'website');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', route.description);
  if (url) upsertMeta('property', 'og:url', url);
  else document.head.querySelector('meta[property="og:url"]')?.remove();
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:type', 'image/png');
  upsertMeta('property', 'og:image:width', '1200');
  upsertMeta('property', 'og:image:height', '630');
  upsertMeta('property', 'og:image:alt', card.title);
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', route.description);
  upsertMeta('name', 'twitter:image', image);
  upsertMeta('name', 'twitter:image:alt', card.title);
  setThemeColor(card.colour);
  setJsonLd(buildJsonLd(route, LASTMOD[route.path]));
}

// Per-route <head> from the route registry, for the SPA and the prerendered snapshots alike. The head the
// server wrote for an item's address (meta medius-item names it) is left as it is, and put back when the
// reader returns to that address.
export default function RouteMeta() {
  const location = useLocation();
  const served = new Map<string, Kept>();
  createEffect(() => {
    const path = location.pathname;
    const item = path === lostPath ? null : itemFor(path);
    const mark = document.head.querySelector('meta[name="medius-item"]');
    if (item && mark?.getAttribute('content') === path) served.set(path, keep());
    mark?.remove();
    const kept = item && served.get(path);
    if (kept) return putBack(kept);
    const route = routeFor(item ? item.parent : path) ?? NOT_FOUND;
    write(route, item ? path : null);
    // Help marks its answers up; their text comes with the Help page, so it is fetched only there. Without
    // them the page keeps the graph above.
    if (route.path === '/guide/help' && !item)
      void import('./data/help').then(
        ({ HELP_ITEMS }) => {
          if (location.pathname === route.path) setJsonLd(buildJsonLd(route, LASTMOD[route.path], HELP_ITEMS));
        },
        () => {},
      );
  });
  return null;
}
