import { describe, it, expect } from 'vitest';
import { getDocRoutes, sectionForPath, parseRoutes } from '../../scripts/lib/routes';

const APP = `
  <Route path="/" component={Home} />
  <Route path="/" component={DocsLayout}>
    <Route path="/native" component={NativeIntroduction} />
    <Route path="/native/commands/clip" component={CmdClip} />
    <Route path="/library" component={LibIntroduction} />
    <Route path="/library/clip" component={LibClip} />
    <Route path="/bindings" component={BindingsOverview} />
    <Route path="/bindings/python" component={PyInstall} />
    <Route path="/dashboard" component={DashboardDevice} />
    <Route path="/dashboard/control" component={DashboardControl} />
  </Route>
  <Route path="*" component={() => <Navigate href="/" />} />
`;

describe('parseRoutes', () => {
  it('extracts every path attribute in source order, de-duplicated', () => {
    expect(parseRoutes(APP)).toEqual([
      '/',
      '/native',
      '/native/commands/clip',
      '/library',
      '/library/clip',
      '/bindings',
      '/bindings/python',
      '/dashboard',
      '/dashboard/control',
      '*',
    ]);
  });
});

describe('getDocRoutes', () => {
  it('keeps doc routes and drops home, catch-all, and dashboard', () => {
    expect(getDocRoutes(APP).map((r) => r.path)).toEqual([
      '/native',
      '/native/commands/clip',
      '/library',
      '/library/clip',
      '/bindings',
      '/bindings/python',
    ]);
  });

  it('tags each route with its top-level section', () => {
    const bySection = Object.fromEntries(getDocRoutes(APP).map((r) => [r.path, r.section]));
    expect(bySection['/native/commands/clip']).toBe('Native API');
    expect(bySection['/library/clip']).toBe('Rust Library');
    expect(bySection['/bindings/python']).toBe('Bindings');
  });
});

describe('sectionForPath', () => {
  it('maps a path prefix to its section, and section roots to themselves', () => {
    expect(sectionForPath('/native')).toBe('Native API');
    expect(sectionForPath('/library/types/enums')).toBe('Rust Library');
    expect(sectionForPath('/bindings/c/api')).toBe('Bindings');
  });
});
