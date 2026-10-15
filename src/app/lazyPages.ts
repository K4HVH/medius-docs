import { lazy, type Component } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';
import { loadRuntime } from './pages/dashboard/context';
import { loadHighlighter } from './highlight';
import { latestReleases } from '../dashboard/firmware/client';
import { addressFor } from './routes';
import { lostPath } from './served';

// Each page's code is fetched when the page is first wanted, so a reader of one page downloads that page and
// the shell, not the whole site. The router fetches a page's code when a link to it is hovered, focused or
// touched. A navigation waits for the code (shell/leave.ts), so a page always shows complete.

export type LazyPage = Component<RouteSectionProps> & { preload: () => Promise<unknown> };

type PageModule = { default: Component<RouteSectionProps> };

// Pages whose code has arrived. A navigation to any other page waits for its code (see shell/leave.ts).
const loaded = new Set<LazyPage>();
// Solid's `lazy` keeps a failed fetch for good. So the page's code is fetched here (again after a failure)
// and handed to `lazy` once it arrives; `lazy` then renders the page at once. A fetch nothing waits on (a
// hover, the idle fetch of the next pages) fails quietly.
export const lazyPage = (load: () => Promise<PageModule>): LazyPage => {
  let fetching: Promise<PageModule> | undefined;
  const fetch = () =>
    (fetching ??= load().catch((e: unknown) => {
      fetching = undefined;
      throw e;
    }));
  const p: LazyPage = lazy(fetch);
  const take = p.preload;
  p.preload = () => {
    const ready = fetch()
      .then(() => take())
      .then((m) => (loaded.add(p), m));
    ready.catch(() => {});
    return ready;
  };
  return p;
};
const page = lazyPage;
// A page that shows code comes with the highlighter, so its code is highlighted from the first paint.
const codePage = (load: () => Promise<PageModule>): LazyPage =>
  page(() => Promise.all([load(), loadHighlighter()]).then(([m]) => m));
// A dashboard page comes with the box runtime, so it renders with the box list in place.
const dashboard = (load: () => Promise<PageModule>): LazyPage =>
  page(() => Promise.all([load(), loadRuntime()]).then(([m]) => m));
// The changelog waits briefly for its release list, so it usually arrives with the releases in place. A
// slower list arrives after the page.
const withReleases = (load: () => Promise<PageModule>): LazyPage =>
  dashboard(() => Promise.all([load(), Promise.race([latestReleases().catch(() => {}), new Promise((r) => setTimeout(r, 800))])]).then(([m]) => m));

export const PAGES: Record<string, LazyPage> = {
  '/': page(() => import('./pages/Home')),
  '/guide': page(() => import('./pages/guide/Start')),
  '/guide/compatibility': page(() => import('./pages/guide/Devices')),
  '/guide/options': page(() => import('./pages/guide/Options')),
  '/guide/privacy': page(() => import('./pages/guide/Privacy')),
  '/guide/help': page(() => import('./pages/guide/Help')),
  '/comparison': page(() => import('./pages/comparison/Overview')),
  '/comparison/devices': page(() => import('./pages/comparison/Devices')),
  '/comparison/passthrough': page(() => import('./pages/comparison/Passthrough')),
  '/comparison/injection': page(() => import('./pages/comparison/Injection')),
  '/comparison/control-link': page(() => import('./pages/comparison/ControlLink')),
  '/comparison/input': page(() => import('./pages/comparison/Input')),
  '/comparison/recovery': page(() => import('./pages/comparison/Recovery')),
  '/comparison/features': page(() => import('./pages/comparison/Features')),
  '/comparison/software': page(() => import('./pages/comparison/Software')),
  '/comparison/method': page(() => import('./pages/comparison/Method')),
  '/native': page(() => import('./pages/native/Introduction')),
  '/native/quickstart': codePage(() => import('./pages/native/Quickstart')),
  '/native/architecture': page(() => import('./pages/native/Architecture')),
  '/native/hardware': page(() => import('./pages/native/Hardware')),
  '/native/transport': page(() => import('./pages/native/Transport')),
  '/native/connection': page(() => import('./pages/native/Connection')),
  '/native/frame': codePage(() => import('./pages/native/Frame')),
  '/native/injection': page(() => import('./pages/native/Injection')),
  '/native/commands/inject': page(() => import('./pages/native/commands/Inject')),
  '/native/commands/move': page(() => import('./pages/native/commands/Move')),
  '/native/commands/requests': page(() => import('./pages/native/commands/Requests')),
  '/native/commands/admin': page(() => import('./pages/native/commands/Admin')),
  '/native/commands/update': page(() => import('./pages/native/commands/Update')),
  '/native/commands/led': page(() => import('./pages/native/commands/Led')),
  '/native/commands/lock': page(() => import('./pages/native/commands/Lock')),
  '/native/commands/catch': page(() => import('./pages/native/commands/Catch')),
  '/native/commands/transform': page(() => import('./pages/native/commands/Transform')),
  '/native/commands/option': page(() => import('./pages/native/commands/Option')),
  '/native/commands/clip': page(() => import('./pages/native/commands/Clip')),
  '/native/commands/raw': page(() => import('./pages/native/commands/Raw')),
  '/native/commands/transfer': page(() => import('./pages/native/commands/Transfer')),
  '/native/commands/rewrite': page(() => import('./pages/native/commands/Rewrite')),
  '/native/commands/patch': page(() => import('./pages/native/commands/Patch')),
  '/native/commands/usage': page(() => import('./pages/native/commands/Usage')),
  '/native/flashing': page(() => import('./pages/native/Flashing')),
  '/native/troubleshooting': page(() => import('./pages/native/Troubleshooting')),
  '/ai': codePage(() => import('./pages/AiAccess')),
  '/library': codePage(() => import('./pages/library/Introduction')),
  '/library/connection': codePage(() => import('./pages/library/Connection')),
  '/library/discovery': codePage(() => import('./pages/library/Discovery')),
  '/library/inject': codePage(() => import('./pages/library/Inject')),
  '/library/move': codePage(() => import('./pages/library/Move')),
  '/library/requests': codePage(() => import('./pages/library/Requests')),
  '/library/admin': codePage(() => import('./pages/library/Admin')),
  '/library/update': codePage(() => import('./pages/library/Update')),
  '/library/led': codePage(() => import('./pages/library/Led')),
  '/library/lock': codePage(() => import('./pages/library/Lock')),
  '/library/catch': codePage(() => import('./pages/library/Catch')),
  '/library/transform': codePage(() => import('./pages/library/Transform')),
  '/library/options': codePage(() => import('./pages/library/Options')),
  '/library/clip': codePage(() => import('./pages/library/Clip')),
  '/library/lifecycle': codePage(() => import('./pages/library/Lifecycle')),
  '/library/diagnostics': codePage(() => import('./pages/library/Diagnostics')),
  '/library/features/async': codePage(() => import('./pages/library/features/Async')),
  '/library/features/mock': codePage(() => import('./pages/library/features/Mock')),
  '/library/features/tracing': codePage(() => import('./pages/library/features/Tracing')),
  '/library/advanced/raw': codePage(() => import('./pages/library/advanced/Raw')),
  '/library/advanced/transfer': codePage(() => import('./pages/library/advanced/Transfer')),
  '/library/advanced/rewrite': codePage(() => import('./pages/library/advanced/Rewrite')),
  '/library/advanced/patch': codePage(() => import('./pages/library/advanced/Patch')),
  '/library/guides/calls': codePage(() => import('./pages/library/GuideCalls')),
  '/library/guides/connection': codePage(() => import('./pages/library/GuideConnection')),
  '/library/guides/testing': codePage(() => import('./pages/library/GuideTesting')),
  '/library/types': codePage(() => import('./pages/library/TypesAndErrors')),
  '/library/types/enums': codePage(() => import('./pages/library/types/Enums')),
  '/library/types/structs': codePage(() => import('./pages/library/types/Structs')),
  '/library/types/frames': codePage(() => import('./pages/library/types/Frames')),
  '/library/types/errors': page(() => import('./pages/library/types/Errors')),
  '/bindings': page(() => import('./pages/bindings/Overview')),
  '/bindings/c': codePage(() => import('./pages/bindings/c/Install')),
  '/bindings/c/quickstart': codePage(() => import('./pages/bindings/c/Quickstart')),
  '/bindings/c/usage': codePage(() => import('./pages/bindings/c/Usage')),
  '/bindings/c/streams': codePage(() => import('./pages/bindings/c/Streams')),
  '/bindings/c/api': codePage(() => import('./pages/bindings/c/Api')),
  '/bindings/c/types': codePage(() => import('./pages/bindings/c/Types')),
  '/bindings/c/build': codePage(() => import('./pages/bindings/c/Build')),
  '/bindings/python': codePage(() => import('./pages/bindings/python/Install')),
  '/bindings/python/quickstart': codePage(() => import('./pages/bindings/python/Quickstart')),
  '/bindings/python/usage': codePage(() => import('./pages/bindings/python/Usage')),
  '/bindings/python/streams': codePage(() => import('./pages/bindings/python/Streams')),
  '/bindings/python/api': codePage(() => import('./pages/bindings/python/Api')),
  '/bindings/python/types': codePage(() => import('./pages/bindings/python/Types')),
  '/bindings/python/build': codePage(() => import('./pages/bindings/python/Build')),
  '/dashboard': dashboard(() => import('./pages/dashboard/Device')),
  '/dashboard/control': dashboard(() => import('./pages/dashboard/Control')),
  '/dashboard/setup': dashboard(() => import('./pages/dashboard/Setup')),
  '/dashboard/update': dashboard(() => import('./pages/dashboard/Update')),
  '/dashboard/flash': dashboard(() => import('./pages/dashboard/Flash')),
  '/dashboard/changelog': withReleases(() => import('./pages/dashboard/Changelog')),
  '/dashboard/stats': dashboard(() => import('./pages/dashboard/Stats')),
};

export const NotFoundPage = page(() => import('./pages/NotFound'));

// A path's key in PAGES, normalised the way the router matches: any case, no repeated or trailing slash.
export const pageKey = (path: string): string => path.toLowerCase().replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');

// The page at `path`. An address inside a page shows that page, or the 404 page if the server knew no such
// item or place.
export const pageAt = (path: string): LazyPage => {
  const key = pageKey(path);
  const at = addressFor(key);
  if (at) return path === lostPath ? NotFoundPage : PAGES[at.parent];
  return PAGES[key] ?? NotFoundPage;
};

// Fetches the code of the page at `path`. The app's first render waits for it, so the app replaces the
// prerendered snapshot in one step, never showing an empty page.
export const preloadPage = (path: string): Promise<unknown> => pageAt(path).preload();

export const pageLoaded = (path: string): boolean => loaded.has(pageAt(path));
