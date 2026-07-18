export interface DocRoute {
  path: string;
  section: string;
}

const SECTIONS: Array<[string, string]> = [
  ['/native', 'Native API'],
  ['/library', 'Rust Library'],
  ['/bindings', 'Bindings'],
];

export function parseRoutes(appTsxSource: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  const re = /path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appTsxSource))) {
    const p = m[1];
    if (!seen.has(p)) {
      seen.add(p);
      paths.push(p);
    }
  }
  return paths;
}

export function sectionForPath(path: string): string {
  for (const [prefix, name] of SECTIONS) {
    if (path === prefix || path.startsWith(prefix + '/')) return name;
  }
  return 'Docs';
}

export function getDocRoutes(appTsxSource: string): DocRoute[] {
  return parseRoutes(appTsxSource)
    .filter((p) => p.startsWith('/') && p !== '/' && !p.startsWith('/dashboard'))
    .map((p) => ({ path: p, section: sectionForPath(p) }));
}
