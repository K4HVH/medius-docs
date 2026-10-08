import { describe, it, expect } from 'vitest';
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
