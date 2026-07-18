import { createEffect, createSignal } from 'solid-js';
import { Link, Meta, Title } from '@solidjs/meta';
import { useLocation } from '@solidjs/router';

const SITE = 'https://medius.k4tech.net';
const DEFAULT_TITLE = 'Medius Documentation';
const DEFAULT_DESC =
  'Documentation for Medius: the binary control protocol of the mouse-passthrough firmware, the device behavior, and the medius Rust library.';

// Per-route <head> for the SPA and the prerendered snapshots. The page title and
// description come from the page's own header card, so there is no second source
// of truth to keep in sync.
export default function RouteMeta() {
  const location = useLocation();
  const [title, setTitle] = createSignal('');
  const [desc, setDesc] = createSignal('');

  createEffect(() => {
    location.pathname; // re-read on every navigation
    requestAnimationFrame(() => {
      const h = document.querySelector('.docs-page .card__header h3');
      const sub = document.querySelector('.docs-page .card__header small');
      setTitle((h?.textContent || '').trim());
      setDesc((sub?.textContent || '').trim());
    });
  });

  const fullTitle = () => (title() ? `${title()} · Medius` : DEFAULT_TITLE);
  const description = () => desc() || DEFAULT_DESC;
  const canonical = () => SITE + location.pathname;

  return (
    <>
      <Title>{fullTitle()}</Title>
      <Meta name="description" content={description()} />
      <Link rel="canonical" href={canonical()} />
      <Meta property="og:title" content={fullTitle()} />
      <Meta property="og:description" content={description()} />
      <Meta property="og:url" content={canonical()} />
      <Meta name="twitter:title" content={fullTitle()} />
      <Meta name="twitter:description" content={description()} />
    </>
  );
}
