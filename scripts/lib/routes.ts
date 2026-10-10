import { ROUTES, SECTION_LABEL } from '../../src/app/routes';

export interface DocRoute {
  path: string;
  section: string;
}

// Every page the prerender snapshots: the registry minus Home, which it renders separately.
export function getDocRoutes(): DocRoute[] {
  return ROUTES.filter((r) => r.path !== '/').map((r) => ({ path: r.path, section: SECTION_LABEL[r.section] }));
}
