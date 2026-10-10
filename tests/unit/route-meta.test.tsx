import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import RouteMeta from '../../src/app/RouteMeta';
import { SITE } from '../../src/app/site';
import { HELP_ITEMS } from '../../src/app/data/help';
import { BLUE, cardUrl, pageCard } from '../../src/app/card/content';
import { routeFor } from '../../src/app/routes';

const mountAt = (path: string) => {
  const history = createMemoryHistory();
  history.set({ value: path });
  render(() => (
    <MemoryRouter history={history} root={(p) => <><RouteMeta />{p.children}</>}>
      <Route path="*" component={() => <p>page</p>} />
    </MemoryRouter>
  ));
  return history;
};
const mount = (path: string) => void mountAt(path);

const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content') ?? null;
const faq = () => {
  const ld = JSON.parse(document.head.querySelector('script#ld-json')?.textContent ?? '{}');
  return (ld['@graph'] ?? []).find((n: { '@type': string }) => n['@type'] === 'FAQPage') ?? null;
};

afterEach(() => {
  cleanup();
  document.head.querySelector('meta[name="medius-item"]')?.remove();
});

describe('RouteMeta', () => {
  it('writes the head of a known page from the registry', async () => {
    mount('/library/inject');
    await waitFor(() => expect(document.title).toBe('Inject · Rust Library · Medius'));
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/library/inject`);
    expect(meta('meta[name="description"]')).toMatch(/^inject, press, release/);
    expect(meta('meta[property="og:type"]')).toBe('article');
    expect(meta('meta[property="og:url"]')).toBe(`${SITE}/library/inject`);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('marks an unknown path as not found, noindex, with no canonical', async () => {
    mount('/zzz');
    await waitFor(() => expect(document.title).toBe('Page not found · Medius'));
    expect(meta('meta[name="robots"]')).toBe('noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(meta('meta[property="og:type"]')).toBe('website');
  });

  it('marks the Help answers up on Help, as a FAQPage holding every question', async () => {
    mount('/guide/help');
    await waitFor(() => expect(faq()).not.toBeNull());
    expect(faq()!.mainEntity.map((q: { name: string }) => q.name)).toEqual(HELP_ITEMS.map((h) => h.q));
  });

  it('leaves the Help answers off a page the reader reached before they arrived', async () => {
    const history = mountAt('/guide/help');
    history.set({ value: '/native' });
    await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/native`));
    await import('../../src/app/data/help');
    await new Promise((r) => setTimeout(r, 20));
    expect(faq()).toBeNull();
  });

  it('keeps the JSON-LD of Help without its answers when they fail to load', async () => {
    vi.resetModules();
    vi.doMock('../../src/app/data/help', () => {
      throw new Error('chunk gone');
    });
    try {
      const { MemoryRouter: Router, Route: R, createMemoryHistory: memory } = await import('@solidjs/router');
      const { default: Meta } = await import('../../src/app/RouteMeta');
      const history = memory();
      history.set({ value: '/guide/help' });
      render(() => (
        <Router history={history} root={(p) => <><Meta />{p.children}</>}>
          <R path="*" component={() => <p>page</p>} />
        </Router>
      ));
      await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/guide/help`));
      await new Promise((r) => setTimeout(r, 20));
      expect(document.head.querySelector('script#ld-json')?.textContent).toContain('TechArticle');
      expect(faq()).toBeNull();
    } finally {
      vi.doUnmock('../../src/app/data/help');
    }
  });

  it('gives Home the site title and a website og:type', async () => {
    mount('/');
    await waitFor(() => expect(document.title).toBe('Medius: replacement firmware for the MAKCU box'));
    expect(meta('meta[property="og:type"]')).toBe('website');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/`);
  });
  it('points the link card at the card drawn for the page', async () => {
    mount('/native/commands/lock');
    const card = pageCard(routeFor('/native/commands/lock')!);
    await waitFor(() => expect(meta('meta[property="og:image"]')).toBe(cardUrl('/native/commands/lock', card)));
    expect(meta('meta[name="twitter:image"]')).toBe(cardUrl('/native/commands/lock', card));
    expect(meta('meta[property="og:image:width"]')).toBe('1200');
    expect(meta('meta[property="og:image:height"]')).toBe('630');
    expect(meta('meta[property="og:image:type"]')).toBe('image/png');
    expect(meta('meta[property="og:image:alt"]')).toBe('Lock');
    expect(meta('meta[name="twitter:image:alt"]')).toBe('Lock');
  });

  it("gives the 404 page home's card", async () => {
    mount('/zzz');
    await waitFor(() => expect(meta('meta[property="og:image"]')).toBe(cardUrl('/', pageCard(routeFor('/')!))));
  });

  it('keeps the address bar black, with the stripe colour beside it for the snapshot', async () => {
    mount('/guide/help');
    await waitFor(() => expect(meta('meta[name="theme-color"]')).toBe('#000000'));
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('data-embed')).toBe(BLUE);
  });

  it("opens an item's address with its parent's head, out of search, at the item's address", async () => {
    mount('/guide/help/bsod');
    await waitFor(() => expect(document.title).toBe(routeFor('/guide/help')!.fullTitle));
    expect(meta('meta[name="robots"]')).toBe('noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(meta('meta[property="og:url"]')).toBe(`${SITE}/guide/help/bsod`);
  });

  it("keeps the 404 page's head for an item the server knew nothing of", async () => {
    vi.resetModules();
    document.documentElement.setAttribute('data-not-found', '');
    window.history.replaceState(null, '', '/guide/help/nope');
    try {
      const { MemoryRouter: Router, Route: R, createMemoryHistory: memory } = await import('@solidjs/router');
      const { default: Meta } = await import('../../src/app/RouteMeta');
      const history = memory();
      history.set({ value: '/guide/help/nope' });
      render(() => (
        <Router history={history} root={(p) => <><Meta />{p.children}</>}>
          <R path="*" component={() => <p>page</p>} />
        </Router>
      ));
      await waitFor(() => expect(document.title).toBe('Page not found · Medius'));
      expect(meta('meta[name="robots"]')).toBe('noindex');
      expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    } finally {
      document.documentElement.removeAttribute('data-not-found');
      window.history.replaceState(null, '', '/');
    }
  });

  it('leaves the head the server wrote for an item, and brings it back on return', async () => {
    document.title = 'My PC blue-screens · Help · Medius';
    for (const [k, v] of [['medius-item', '/guide/help/bsod'], ['description', 'Served description']] as const) {
      const el = document.head.querySelector(`meta[name="${k}"]`) ?? document.head.appendChild(document.createElement('meta'));
      el.setAttribute('name', k);
      el.setAttribute('content', v);
    }
    const history = mountAt('/guide/help/bsod');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.title).toBe('My PC blue-screens · Help · Medius');
    expect(meta('meta[name="description"]')).toBe('Served description');
    history.set({ value: '/native' });
    await waitFor(() => expect(document.title).toBe('Native API: the MAKCU box control protocol · Medius'));
    expect(document.head.querySelector('meta[name="medius-item"]')).toBeNull();
    history.back();
    await waitFor(() => expect(document.title).toBe('My PC blue-screens · Help · Medius'));
    expect(meta('meta[name="description"]')).toBe('Served description');
    expect(meta('meta[name="robots"]')).toBe('noindex');
  });
});
