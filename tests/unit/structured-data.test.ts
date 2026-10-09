import { describe, it, expect } from 'vitest';
import { buildJsonLd } from '../../src/app/structuredData';
import { routeFor, NOT_FOUND, breadcrumbTrail, documentTitle, type RouteInfo } from '../../src/app/routes';
import { SITE, LINKS } from '../../src/app/site';
import { HELP_ITEMS } from '../../src/app/data/help';

type Node = Record<string, unknown> & { '@type': string | string[] };
const graph = (r: RouteInfo, lastmod?: string) => (buildJsonLd(r, lastmod) as { '@graph': Node[] })['@graph'];
const node = (g: Node[], type: string) => g.find((n) => n['@type'] === type);
const at = (p: string) => routeFor(p)!;

describe('buildJsonLd', () => {
  it('describes the site and Medius on every page, without a software-app item Google would want rated', () => {
    for (const r of [at('/'), at('/native/commands/move'), at('/dashboard/setup'), NOT_FOUND]) {
      const g = graph(r);
      expect(node(g, 'WebSite')?.['@id']).toBe(`${SITE}/#website`);
      const medius = g.find((n) => n['@id'] === `${SITE}/#medius`)!;
      expect(medius.name).toBe('Medius');
      expect(medius.sameAs).toEqual(Object.values(LINKS));
      for (const n of g) expect(['SoftwareApplication', 'WebApplication', 'MobileApplication']).not.toContain(n['@type']);
    }
  });

  it('makes a docs page a TechArticle named by its full title, dated only when a date is known', () => {
    const undated = node(graph(at('/library/inject')), 'TechArticle')!;
    expect(undated.headline).toBe(documentTitle(at('/library/inject')));
    expect(undated.url).toBe(`${SITE}/library/inject`);
    expect(undated).not.toHaveProperty('dateModified');
    expect(node(graph(at('/library/inject'), '2026-10-01'), 'TechArticle')!.dateModified).toBe('2026-10-01');
  });

  it('makes a dashboard page a WebPage about Medius', () => {
    const page = node(graph(at('/dashboard/setup')), 'WebPage')!;
    expect(page.about).toEqual({ '@id': `${SITE}/#medius` });
    expect(node(graph(at('/dashboard/setup')), 'TechArticle')).toBeUndefined();
  });

  it('carries the breadcrumb trail as absolute URLs, and none on Home', () => {
    const r = at('/bindings/python/streams');
    const list = node(graph(r), 'BreadcrumbList')!;
    const items = list.itemListElement as { position: number; name: string; item: string }[];
    expect(items.map((i) => i.item)).toEqual(breadcrumbTrail(r).map((c) => SITE + (c.href === '/' ? '/' : c.href)));
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
    expect(node(graph(at('/')), 'BreadcrumbList')).toBeUndefined();
    expect(node(graph(NOT_FOUND), 'BreadcrumbList')).toBeUndefined();
  });

  it('round-trips through JSON', () => {
    const r = at('/native');
    expect(JSON.parse(JSON.stringify(buildJsonLd(r)))).toEqual(buildJsonLd(r));
  });
  it('marks up Help as questions and answers, on the Help page alone', () => {
    const faq = node(graph(at('/guide/help')), 'FAQPage')!;
    const qs = faq.mainEntity as { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[];
    expect(qs.map((q) => q.name)).toEqual(HELP_ITEMS.map((f) => f.q));
    expect(qs.map((q) => q.acceptedAnswer.text)).toEqual(HELP_ITEMS.map((f) => f.a));
    for (const q of qs) expect([q['@type'], q.acceptedAnswer['@type']]).toEqual(['Question', 'Answer']);
    for (const p of ['/guide', '/guide/compatibility', '/native', '/']) expect(node(graph(at(p)), 'FAQPage')).toBeUndefined();
  });
});
