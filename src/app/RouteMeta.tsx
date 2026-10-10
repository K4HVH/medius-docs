import { createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { NOT_FOUND, documentTitle, routeFor } from './routes';
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

// Per-route <head> from the route registry, for the SPA and the prerendered snapshots alike.
export default function RouteMeta() {
  const location = useLocation();
  createEffect(() => {
    const route = routeFor(location.pathname) ?? NOT_FOUND;
    const title = documentTitle(route);
    const url = route.index ? SITE + (route.path === '/' ? '/' : route.path) : null;
    document.title = title;
    upsertMeta('name', 'description', route.description);
    setLink('canonical', url);
    setRobots(route.index ? null : 'noindex');
    upsertMeta('property', 'og:type', route.kind === 'article' && route.index ? 'article' : 'website');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', route.description);
    if (url) upsertMeta('property', 'og:url', url);
    else document.head.querySelector('meta[property="og:url"]')?.remove();
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', route.description);
    setJsonLd(buildJsonLd(route, LASTMOD[route.path]));
    // Help marks its answers up; their text comes with the Help page, so it is fetched only there. Without
    // them the page keeps the graph above.
    if (route.path === '/guide/help')
      void import('./data/help').then(
        ({ HELP_ITEMS }) => {
          if (location.pathname === route.path) setJsonLd(buildJsonLd(route, LASTMOD[route.path], HELP_ITEMS));
        },
        () => {},
      );
  });
  return null;
}
