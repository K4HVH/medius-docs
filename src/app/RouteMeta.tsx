import { createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';

const SITE = 'https://medius.k4tech.net';
const DEFAULT_TITLE = 'Medius Documentation';
const DEFAULT_DESC =
  "Medius documentation: the mouse-passthrough firmware's binary control protocol and device behaviour, and the medius Rust library.";

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Per-route <head> from the page's header card, for the SPA and prerendered snapshots.
// Tags update in place over index.html's defaults, so none is duplicated.
export default function RouteMeta() {
  const location = useLocation();
  createEffect(() => {
    location.pathname; // re-read on every navigation
    requestAnimationFrame(() => {
      const h = document.querySelector('.docs-page .card__header h3');
      const sub = document.querySelector('.docs-page .card__header small');
      const title = (h?.textContent || '').trim();
      const desc = (sub?.textContent || '').trim() || DEFAULT_DESC;
      const full = title ? `${title} · Medius` : DEFAULT_TITLE;
      const url = SITE + location.pathname;
      document.title = full;
      upsertMeta('name', 'description', desc);
      upsertCanonical(url);
      upsertMeta('property', 'og:title', full);
      upsertMeta('property', 'og:description', desc);
      upsertMeta('property', 'og:url', url);
      upsertMeta('name', 'twitter:title', full);
      upsertMeta('name', 'twitter:description', desc);
    });
  });
  return null;
}
