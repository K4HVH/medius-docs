import { describe, it, expect } from 'vitest';
import { buildJsonLd } from '../../src/app/structuredData';
import { routeFor, NOT_FOUND, breadcrumbTrail, type RouteInfo } from '../../src/app/routes';
import { SITE, LINKS } from '../../src/app/site';

type Node = Record<string, unknown> & { '@type': string | string[] };
const graph = (r: RouteInfo, lastmod?: string) => (buildJsonLd(r, lastmod) as { '@graph': Node[] })['@graph'];
const node = (g: Node[], type: string) => g.find((n) => n['@type'] === type);
const at = (p: string) => routeFor(p)!;

describe('buildJsonLd', () => {
  it('describes the site and the firmware on every page', () => {
    for (const r of [at('/'), at('/native/commands/move'), at('/dashboard/setup'), NOT_FOUND]) {
      const g = graph(r);
      expect(node(g, 'WebSite')?.['@id']).toBe(`${SITE}/#website`);
      const app = node(g, 'SoftwareApplication')!;
      expect(app.applicationCategory).toBe('DriverApplication');
      expect((app.offers as Record<string, string>).price).toBe('0');
      expect(app.sameAs).toEqual(Object.values(LINKS));
      expect(app).not.toHaveProperty('aggregateRating');
      expect(app).not.toHaveProperty('softwareVersion');
    }
  });

  it('makes a docs page a TechArticle named after its title, dated only when a date is known', () => {
    const undated = node(graph(at('/library/inject')), 'TechArticle')!;
    expect(undated.headline).toBe('Inject');
    expect(undated.url).toBe(`${SITE}/library/inject`);
    expect(undated).not.toHaveProperty('dateModified');
    expect(node(graph(at('/library/inject'), '2026-10-01'), 'TechArticle')!.dateModified).toBe('2026-10-01');
  });

  it('makes a dashboard page a WebApplication that names its browser requirement', () => {
    const app = node(graph(at('/dashboard/setup')), 'WebApplication')!;
    expect(String(app.browserRequirements)).toMatch(/Chrome or Edge/);
    expect(node(graph(at('/dashboard/setup')), 'TechArticle')).toBeUndefined();
  });

  it('carries the breadcrumb trail as absolute URLs, and none on Home', () => {
    const r = at('/bindings/python/streams');
    const list = node(graph(r), 'BreadcrumbList')!;
    const items = list.itemListElement as { position: number; name: string; item: string }[];
    expect(items.map((i) => i.item)).toEqual(breadcrumbTrail(r).map((c) => SITE + (c.href === '/' ? '/' : c.href)));
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
    expect(node(graph(at('/')), 'BreadcrumbList')).toBeUndefined();
  });

  it('round-trips through JSON', () => {
    const r = at('/native');
    expect(JSON.parse(JSON.stringify(buildJsonLd(r)))).toEqual(buildJsonLd(r));
  });
});
