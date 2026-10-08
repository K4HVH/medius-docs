import { SITE, LINKS } from './site';
import { breadcrumbTrail, routeFor, type RouteInfo } from './routes';

const WEBSITE_ID = `${SITE}/#website`;
const SOFTWARE_ID = `${SITE}/#software`;
const DASHBOARD_ID = `${SITE}/#dashboard`;

const abs = (path: string) => SITE + (path === '/' ? '/' : path);
const FREE = { '@type': 'Offer', price: '0', priceCurrency: 'USD' };

// schema.org graph for one page. Only facts the site states: no ratings, counts or version.
export function buildJsonLd(route: RouteInfo, lastmod?: string): object {
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
      '@type': 'SoftwareApplication',
      '@id': SOFTWARE_ID,
      name: 'Medius',
      description: routeFor('/')?.description,
      applicationCategory: 'DriverApplication',
      operatingSystem: 'MAKCU box (ESP32-S3)',
      url: abs('/'),
      downloadUrl: abs('/dashboard/setup'),
      isAccessibleForFree: true,
      offers: FREE,
      sameAs: Object.values(LINKS),
    },
  ];

  if (route.kind === 'article' && route.index) {
    graph.push({
      '@type': 'TechArticle',
      headline: route.title,
      description: route.description,
      url,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': SOFTWARE_ID },
      ...(lastmod ? { dateModified: lastmod } : {}),
    });
  } else if (route.kind === 'app') {
    graph.push(
      {
        '@type': 'WebApplication',
        '@id': DASHBOARD_ID,
        name: 'Medius dashboard',
        url: abs('/dashboard'),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Windows, macOS, Linux, ChromeOS',
        browserRequirements: 'Requires Web Serial: Chrome or Edge',
        isAccessibleForFree: true,
        offers: FREE,
      },
      {
        '@type': 'WebPage',
        url,
        name: route.title,
        description: route.description,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': DASHBOARD_ID },
      },
    );
  } else if (route.kind === 'home') {
    graph.push({
      '@type': 'WebPage',
      url,
      name: route.fullTitle ?? route.title,
      description: route.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': SOFTWARE_ID },
    });
  }

  const trail = breadcrumbTrail(route);
  if (trail.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: abs(c.href) })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
