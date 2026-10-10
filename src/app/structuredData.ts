import { SITE, LINKS } from './site';
import { breadcrumbTrail, documentTitle, routeFor, type RouteInfo } from './routes';
import type { HelpItem } from './data/help';

const WEBSITE_ID = `${SITE}/#website`;
const MEDIUS_ID = `${SITE}/#medius`;

const abs = (path: string) => SITE + (path === '/' ? '/' : path);

// schema.org graph for one page. Medius is a plain Thing: a SoftwareApplication item is a rich-result
// candidate Google wants a rating for, and Medius has none to give.
// `faq`: the Help answers, which the Help page lists in its markup and fetches only there.
export function buildJsonLd(route: RouteInfo, lastmod?: string, faq?: readonly HelpItem[]): object {
  const url = abs(route.path);
  const graph: object[] = [
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: abs('/'),
      name: 'Medius',
      inLanguage: 'en',
      publisher: { '@type': 'Organization', name: 'K4HVH', url: 'https://github.com/K4HVH' },
    },
    {
      '@type': 'Thing',
      '@id': MEDIUS_ID,
      name: 'Medius',
      alternateName: 'Medius for MAKCU',
      description: routeFor('/')?.description,
      url: abs('/'),
      sameAs: Object.values(LINKS),
    },
  ];

  if (route.kind === 'article' && route.index) {
    graph.push({
      '@type': 'TechArticle',
      headline: documentTitle(route),
      description: route.description,
      url,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': MEDIUS_ID },
      ...(lastmod ? { dateModified: lastmod } : {}),
    });
  } else if (route.kind !== 'article') {
    graph.push({
      '@type': 'WebPage',
      url,
      name: documentTitle(route),
      description: route.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': MEDIUS_ID },
    });
  }

  if (route.path === '/guide/help' && faq) {
    graph.push({
      '@type': 'FAQPage',
      url,
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  const trail = breadcrumbTrail(route);
  if (trail.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: abs(c.href) })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
