import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  NOT_FOUND,
  routeFor,
  documentTitle,
  breadcrumbTrail,
  sidebarGroups,
} from '../../src/app/routes';

const appPaths = () => {
  const src = readFileSync(join(__dirname, '../../src/app/App.tsx'), 'utf8');
  return new Set([...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '/' && p !== '*'));
};

const at = (path: string) => {
  const r = routeFor(path);
  if (!r) throw new Error(`no route ${path}`);
  return r;
};

describe('route registry', () => {
  it('lists exactly the routes App.tsx renders, plus Home', () => {
    const registry = new Set(ROUTES.map((r) => r.path));
    expect(registry.has('/')).toBe(true);
    registry.delete('/');
    expect([...registry].sort()).toEqual([...appPaths()].sort());
  });

  it('gives every page a title no other page has', () => {
    const titles = [...ROUTES, NOT_FOUND].map(documentTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('builds titles from the page and its section', () => {
    expect(documentTitle(at('/native/commands/inject'))).toBe('Inject · Native API · Medius');
    expect(documentTitle(at('/library/inject'))).toBe('Inject · Rust Library · Medius');
    expect(documentTitle(at('/bindings/python/streams'))).toBe('Streams · Python bindings · Medius');
    expect(documentTitle(at('/'))).toBe('Medius: replacement firmware for the MAKCU box');
    expect(documentTitle(NOT_FOUND)).toBe('Page not found · Medius');
  });

  it('gives every page a unique ASCII description of 50 to 155 characters', () => {
    const seen = new Set<string>();
    for (const r of [...ROUTES, NOT_FOUND]) {
      expect(r.description.length, r.path).toBeGreaterThanOrEqual(50);
      expect(r.description.length, r.path).toBeLessThanOrEqual(155);
      expect(r.description, r.path).toMatch(/^[\x20-\x7E]+$/);
      expect(seen.has(r.description), r.path).toBe(false);
      seen.add(r.description);
    }
  });

  it('indexes every page', () => {
    expect(ROUTES.filter((r) => !r.index).map((r) => r.path)).toEqual([]);
  });

  it('keeps sidebar labels within the 200 px pane', () => {
    for (const r of ROUTES) expect(r.nav.length, r.path).toBeLessThanOrEqual(18);
  });

  it('resolves paths exactly, and nothing else', () => {
    expect(routeFor('/native')?.path).toBe('/native');
    expect(routeFor('/native/')).toBeUndefined();
    expect(routeFor('/Native')).toBeUndefined();
    expect(routeFor('/404')).toBeUndefined();
  });

  it('trails a nested binding page through its language root', () => {
    expect(breadcrumbTrail(at('/bindings/python/streams'))).toEqual([
      { label: 'Medius', href: '/' },
      { label: 'Bindings', href: '/bindings' },
      { label: 'Python', href: '/bindings/python' },
      { label: 'Streams', href: '/bindings/python/streams' },
    ]);
  });

  it('trails a section root as Medius then itself, and Home as nothing', () => {
    expect(breadcrumbTrail(at('/native'))).toEqual([
      { label: 'Medius', href: '/' },
      { label: 'Native API', href: '/native' },
    ]);
    expect(breadcrumbTrail(at('/'))).toEqual([]);
  });

  it('trails a page through its section root', () => {
    expect(breadcrumbTrail(at('/dashboard/setup'))).toEqual([
      { label: 'Medius', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Set up', href: '/dashboard/setup' },
    ]);
  });

  it('groups the native sidebar in its current order', () => {
    const groups = sidebarGroups('native');
    expect(groups.map((g) => g.label)).toEqual(['Overview', 'Protocol', 'Commands', 'Advanced control', 'Reference']);
    expect(groups[2].routes.map((r) => r.path)).toEqual([
      '/native/commands/inject',
      '/native/commands/move',
      '/native/commands/lock',
      '/native/commands/catch',
      '/native/commands/transform',
      '/native/commands/option',
      '/native/commands/clip',
      '/native/commands/requests',
      '/native/commands/led',
      '/native/commands/admin',
      '/native/commands/update',
      '/native/commands/usage',
    ]);
  });

  it('groups each binding language the same way', () => {
    const c = sidebarGroups('bindings', 'c');
    const py = sidebarGroups('bindings', 'python');
    expect(c.map((g) => g.label)).toEqual(['Getting Started', 'Usage', 'Reference', 'Build']);
    expect(py.map((g) => g.label)).toEqual(c.map((g) => g.label));
    expect(c[0].routes.map((r) => r.path)).toEqual(['/bindings/c', '/bindings/c/quickstart']);
  });

  it('lists the dashboard in its current order', () => {
    expect(sidebarGroups('dashboard').flatMap((g) => g.routes.map((r) => r.path))).toEqual([
      '/dashboard/setup',
      '/dashboard',
      '/dashboard/control',
      '/dashboard/update',
      '/dashboard/changelog',
      '/dashboard/stats',
    ]);
  });

  it('lists the guide in reading order, as one group', () => {
    const groups = sidebarGroups('guide');
    expect(groups.map((g) => g.label)).toEqual(['Guide']);
    expect(groups[0].routes.map((r) => r.path)).toEqual([
      '/guide',
      '/guide/update',
      '/guide/compatibility',
      '/guide/faq',
      '/guide/troubleshooting',
      '/guide/device-fixes',
    ]);
  });

  it('gives the guide the titles written for a search, and the dashboard tools plain ones', () => {
    expect(documentTitle(at('/guide'))).toBe('Install Medius on a MAKCU box');
    expect(documentTitle(at('/guide/update'))).toBe('Update Medius on a MAKCU box');
    expect(documentTitle(at('/guide/compatibility'))).toBe('MAKCU compatibility: mice and keyboards · Medius');
    expect(documentTitle(at('/dashboard/setup'))).toBe('Set up · Dashboard · Medius');
    expect(documentTitle(at('/dashboard/update'))).toBe('Update · Dashboard · Medius');
  });

  it('trails a guide page through the guide root', () => {
    expect(breadcrumbTrail(at('/guide/faq'))).toEqual([
      { label: 'Medius', href: '/' },
      { label: 'Guide', href: '/guide' },
      { label: 'FAQ', href: '/guide/faq' },
    ]);
  });
});
