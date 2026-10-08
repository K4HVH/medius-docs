import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import RouteMeta from '../../src/app/RouteMeta';
import { SITE } from '../../src/app/site';

const mount = (path: string) => {
  const history = createMemoryHistory();
  history.set({ value: path });
  return render(() => (
    <MemoryRouter history={history} root={(p) => <><RouteMeta />{p.children}</>}>
      <Route path="*" component={() => <p>page</p>} />
    </MemoryRouter>
  ));
};

const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content') ?? null;

afterEach(cleanup);

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
  });

  it('gives Home the site title and a website og:type', async () => {
    mount('/');
    await waitFor(() => expect(document.title).toBe('Medius: replacement firmware for the MAKCU box'));
    expect(meta('meta[property="og:type"]')).toBe('website');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/`);
  });
});
