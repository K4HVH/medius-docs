import { type Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js';
import { useBeforeLeave, useLocation } from '@solidjs/router';
import { prefersReducedMotion } from './motion';
import { pagePath } from '../routes';

const FADE_MS = 120;
// Page code not in after a minute (a stalled request) isn't coming: load the page in full instead.
const CODE_MS = 60_000;

export interface PageCode {
  loaded: (path: string) => boolean;
  load: (path: string) => Promise<unknown>;
}

const within = (code: Promise<unknown>, ms: number) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no page code after ${ms} ms`)), ms);
    code.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e: unknown) => (clearTimeout(timer), reject(e)),
    );
  });

// Every navigation asked for, by link or by history, takes the next number; only the latest goes on.
let latest = 0;
// A flash in progress, which blocks navigation elsewhere (useLeaveFade is told of it).
let blocked: Accessor<boolean> = () => false;
// Offline, a navigation whose code didn't arrive leaves the reader on the current page: a full load would
// replace a readable page with the browser's error page.
const offline = () => navigator.onLine === false;
// Where the page fading out is going, so the chrome over every page (the site bar) changes with it.
const [heading, setHeading] = createSignal<string | null>(null);
export const leavingFor: Accessor<string | null> = heading;
const showAgain = () => {
  document.documentElement.classList.remove('leaving', 'waiting', 'away');
  setHeading(null);
};
const lost = (path: string, e: unknown) => console.warn(`medius: the code of ${path} did not come (${String(e)})`);

// A link to another page fades the current page out first; the new page then arrives. A navigation to a page
// whose code isn't in yet also waits for that code, with the page faded meanwhile, so the new page arrives
// complete. If the code fails (the site was deployed since), the page shows again before a full page load,
// so it stays readable if the reader refuses to leave. Back and Forward go at once here (holdHistory waits
// for their code), as does a redirect. A navigation asked for during a flash is left to the flash's block.
// The held navigation goes on through the other listeners, so a flash that began during the wait still
// holds the reader on the page, which then shows again.
export function useLeaveFade(isBlocked: Accessor<boolean>, pages?: PageCode & { whole: (href: string) => void }): void {
  blocked = isBlocked;
  const location = useLocation();
  const root = document.documentElement;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let passing = false;
  const settle = () => {
    clearTimeout(fallback);
    fallback = setTimeout(showAgain, FADE_MS * 5);
  };

  useBeforeLeave((e) => {
    if (passing) {
      passing = false;
      return;
    }
    const ticket = ++latest;
    root.classList.remove('waiting');
    const to = typeof e.to === 'string' ? new URL(e.to, window.location.href) : null;
    if (blocked() || !to) {
      root.classList.remove('leaving');
      setHeading(null);
      return;
    }
    const fades = !e.options?.replace && !prefersReducedMotion() && pagePath(to.pathname) !== pagePath(location.pathname);
    const code = pages && !pages.loaded(to.pathname) ? within(pages.load(to.pathname), CODE_MS) : null;
    if (!fades) root.classList.remove('leaving');
    if (!fades && !code) {
      setHeading(null);
      return;
    }
    e.preventDefault();
    clearTimeout(fallback);
    setHeading(to.pathname);
    if (fades) root.classList.add('leaving');
    // Between the landing and the rest, the layout around the page goes too.
    root.classList.toggle('away', fades && (to.pathname === '/') !== (location.pathname === '/'));
    if (code) root.classList.add('waiting');
    else settle();
    void Promise.all([fades ? new Promise((r) => setTimeout(r, FADE_MS)) : null, code]).then(
      () => {
        if (ticket !== latest) return;
        passing = true;
        e.retry();
        passing = false;
        settle();
      },
      (err: unknown) => {
        if (ticket !== latest) return;
        showAgain();
        if (offline()) return;
        lost(to.pathname, err);
        pages!.whole(to.href);
      },
    );
  });

  createEffect(on(() => location.pathname, showAgain, { defer: true }));
  onCleanup(() => {
    clearTimeout(fallback);
    showAgain();
  });
}

// Back and Forward: the router shows the page at once, so a page whose code isn't in waits for it here,
// ahead of the router's listener (registered before it), and is handed on once the code arrives. This acts
// only once the app is up (`live`), and leaves refusing history during a flash to the flash's block.
// Offline, it waits for the connection to come back. Otherwise a page whose code fails is reloaded, since
// the address already names it.
export function holdHistory(pages: PageCode & { reload: () => void; live: () => boolean }): () => void {
  const root = document.documentElement;
  let passing = false;
  const hold = (e: PopStateEvent) => {
    if (passing || !pages.live() || blocked()) return;
    const ticket = ++latest;
    const path = window.location.pathname;
    if (pages.loaded(path)) return;
    e.stopImmediatePropagation();
    root.classList.remove('leaving');
    const go = (): void => {
      root.classList.add('waiting');
      within(pages.load(path), CODE_MS).then(
        () => {
          if (ticket !== latest) return;
          passing = true;
          dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
          passing = false;
        },
        (err: unknown) => {
          if (ticket !== latest) return;
          showAgain();
          if (offline()) {
            window.addEventListener('online', () => ticket === latest && go(), { once: true });
            return;
          }
          lost(path, err);
          pages.reload();
        },
      );
    };
    go();
  };
  window.addEventListener('popstate', hold);
  return () => window.removeEventListener('popstate', hold);
}
