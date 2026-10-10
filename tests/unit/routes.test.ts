import { describe, it, expect, vi } from 'vitest';
import { getDocRoutes } from '../../scripts/lib/routes';

describe('getDocRoutes', () => {
  const routes = getDocRoutes();
  const paths = routes.map((r) => r.path);

  it('prerenders every page but Home, the dashboard included', () => {
    expect(paths).toContain('/native');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/dashboard/setup');
    expect(paths).toContain('/dashboard/changelog');
    expect(paths).not.toContain('/');
    expect(paths).not.toContain('/404');
  });

  it('tags each route with its section label', () => {
    const bySection = Object.fromEntries(routes.map((r) => [r.path, r.section]));
    expect(bySection['/native/commands/clip']).toBe('Native API');
    expect(bySection['/library/clip']).toBe('Rust Library');
    expect(bySection['/bindings/python']).toBe('Bindings');
    expect(bySection['/dashboard/setup']).toBe('Dashboard');
    expect(bySection['/ai']).toBe('AI access');
  });
});

describe('pagePath', () => {
  it("shows an item's address as its parent page", async () => {
    const { pagePath } = await import('../../src/app/routes');
    expect(pagePath('/guide/help/bsod')).toBe('/guide/help');
    expect(pagePath('/native')).toBe('/native');
  });

  it('leaves alone an item the server answered with the 404 page', async () => {
    vi.resetModules();
    document.documentElement.setAttribute('data-not-found', '');
    window.history.replaceState(null, '', '/guide/help/nope');
    try {
      const { pagePath } = await import('../../src/app/routes');
      expect(pagePath('/guide/help/nope')).toBe('/guide/help/nope');
      expect(pagePath('/guide/help/bsod')).toBe('/guide/help');
    } finally {
      document.documentElement.removeAttribute('data-not-found');
      window.history.replaceState(null, '', '/');
    }
  });
});
