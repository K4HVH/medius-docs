import { createSignal, createEffect, createMemo, on, onCleanup, onMount } from 'solid-js';
import { type RouteSectionProps, useBeforeLeave, useIsRouting, useLocation, useNavigate, usePreloadRoute } from '@solidjs/router';
import { Search } from '../shell/Search';
import { highlighter, loadHighlighter } from '../highlight';
import { openedByHistory, openingAt, settleAt } from '../shell/scrollPlace';
import { DocsSidebar } from '../shell/DocsSidebar';
import { OnThisPage } from '../shell/OnThisPage';
import { SiteFooter } from '../shell/SiteFooter';
import { arrive, armReveals, blocksOf, fontsReady, pageArrival, retime, watchChanges } from '../shell/motion';
import { landingId, pagePath, routeFor } from '../routes';
import { shareAddress } from '../shell/share';
import { useBoxes, useNativeFlash } from './dashboard/context';
import { BoxList } from './dashboard/BoxList';

const BOX_ROUTES = new Set([
  '/dashboard',
  '/dashboard/control',
  '/dashboard/update',
]);
const SETUP = '/dashboard/setup';
const FLASH = '/dashboard/flash';


const DocsLayout = (props: RouteSectionProps) => {
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [closeKey, setCloseKey] = createSignal(0);
  const navigate = useNavigate();
  const location = useLocation();
  const routing = useIsRouting();
  const native = useNativeFlash();
  const boxes = useBoxes();
  const flashing = native.running;
  // Block in-app navigation (back/forward, links, programmatic) during a flash.
  useBeforeLeave((e) => {
    if (flashing()) e.preventDefault();
  });
  let main: HTMLElement | undefined;
  let footer: HTMLElement | undefined;

  // 'auto' glides via the page's CSS (reduced motion turns the glide off); a new page lands with 'instant'.
  // The highlight ring marks a search result, a deep link or an in-page link, never a section picked from the
  // rail.
  let highlightNext: string | null = null;
  // A target may come with fetched content (a device the stats add, a release), or be redrawn when more
  // arrives. Each time it appears anew the page lands on it again, until 10 s pass or the reader scrolls,
  // types or presses anywhere (the scrollbar too).
  let awaited = () => {};
  onCleanup(() => awaited());
  const scrollToTarget = (id: string, behavior: ScrollBehavior, highlight: boolean, until = Date.now() + 10000) => {
    awaited();
    const el = document.getElementById(id);
    if (main && Date.now() < until) {
      const watch = new MutationObserver(() => {
        const now = document.getElementById(id);
        if (now && now !== el) scrollToTarget(id, behavior, highlight, until);
      });
      const stop = () => awaited();
      const timer = setTimeout(stop, until - Date.now());
      const intent = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
      for (const k of intent) window.addEventListener(k, stop, { passive: true });
      awaited = () => {
        watch.disconnect();
        clearTimeout(timer);
        for (const k of intent) window.removeEventListener(k, stop);
        awaited = () => {};
      };
      watch.observe(main, { childList: true, subtree: true });
    }
    if (!el) return;
    showAddress(id, el);
    // Show the place at once, settled. If its block were still arriving (a table rising with its rows), the
    // scroll would stop short of the bar once the block came to rest.
    for (let p: HTMLElement | null = el; p && p !== main; p = p.parentElement) p.classList.remove('moving');
    el.scrollIntoView({ behavior, block: 'start' });
    if (!highlight) return;
    el.classList.add('search-highlight');
    setTimeout(() => el.classList.remove('search-highlight'), 3000);
  };
  const has = (id: string) => !!document.getElementById(id);
  // When a hash lands on a place or an item, the address bar shows that place's address instead
  // (shell/share.ts), in the same history entry, so the address the reader copies has a card naming the place.
  // A section that opens the page (its share address is the page) keeps the hash.
  // The address is written once the router finishes the navigation under way. A navigate() inside it is merged
  // with it and takes its options, which turned a link's scroll to its hash into a scroll to the top of an
  // address with no hash.
  const showAddress = (id: string, el: HTMLElement) => {
    if (landingId('', location.hash) !== id) return;
    const to = shareAddress(el, id, location.pathname);
    if (to.includes('#') || to === pagePath(location.pathname)) return;
    const write = () => {
      if (routing()) return void setTimeout(write, 16);
      if (landingId('', location.hash) === id) navigate(to + location.search, { replace: true, scroll: false });
    };
    queueMicrotask(write);
  };

  const handleSearchNavigate = (fullPath: string) => {
    if (flashing()) return;
    setSearchOpen(false);
    setCloseKey((k) => k + 1);
    const [path, hash] = fullPath.split('#');
    highlightNext = hash ?? null;
    const same = pagePath(path) === pagePath(location.pathname);
    if (same && hash && hash === landingId(location.pathname, location.hash, has)) scrollToTarget(hash, 'auto', true);
    else navigate(fullPath, { scroll: !same });
  };

  // A link to a place on the current page goes there without the router. The router scrolls to the top after
  // any address with no hash (after the page has already moved to the place), and ignores the address already
  // shown. The router follows a hash link; its place is ringed, like one a path names.
  onMount(() => {
    const toPlace = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!a || a.target || a.hasAttribute('download') || a.origin !== window.location.origin) return;
      if (pagePath(a.pathname) !== pagePath(location.pathname)) return;
      if (a.hash) {
        const id = landingId('', a.hash);
        if (!id) return;
        if (a.hash !== location.hash || a.pathname !== location.pathname) {
          highlightNext = id;
          return;
        }
        e.preventDefault();
        scrollToTarget(id, 'auto', true);
        return;
      }
      const target = landingId(a.pathname, '', has);
      if (a.pathname !== location.pathname) {
        e.preventDefault();
        highlightNext = target || null;
        navigate(a.pathname + a.search, { scroll: false });
        return;
      }
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target, 'auto', true);
    };
    main?.addEventListener('click', toPlace);
    onCleanup(() => main?.removeEventListener('click', toPlace));
  });

  // Ctrl+K or Cmd+K opens and closes search; / opens it from anywhere except a field.
  onMount(() => {
    // During a flash the keys open nothing, and the browser's Ctrl+K stays blocked as usual.
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!flashing()) setSearchOpen((v) => !v);
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !flashing()) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  // An address inside a page shows that page.
  const page = () => pagePath(location.pathname);
  const section = () => routeFor(page())?.section;

  const barTitle = createMemo(() => {
    const label = routeFor(page())?.nav ?? '';
    const box = BOX_ROUTES.has(page()) ? boxes.selected()?.session.name() : null;
    return box ? `${label} - ${box}` : label;
  });

  // A new page arrives block by block. It starts at the top, or at its place (routes.ts landingId) once the
  // fonts have set the layout. The reveals are armed after that jump, so the section it lands on is never held
  // back. A change of place on the same page scrolls there. A change of spelling alone (#id written as
  // /page/id) leaves the page where it is. The arrival is stamped at once, so a prerendered snapshot's arrival
  // carries on into the app's (takeover.ts).
  let shownPage = '';
  let shownTarget = '';
  let settled = 0;
  let disposeReveals = () => {};
  createEffect(
    on(
      () => [location.pathname, location.hash] as const,
      ([path, hash]) => {
        const at = openingAt();
        const shows = pagePath(path);
        if (shows === shownPage) {
          const target = landingId(path, hash, has);
          const moved = target !== shownTarget;
          shownTarget = target;
          // Only the spelling changed: the landing under way (a target still to arrive) carries on.
          if (!moved && at === null) {
            highlightNext = null;
            return;
          }
          awaited();
          // Back or Forward between places returns to where the reader was; a link on the page glides to its
          // place or the top.
          if (at !== null && openedByHistory()) settleAt(at);
          else if (at !== null) window.scrollTo({ top: at, left: 0, behavior: 'auto' });
          else if (target && moved) scrollToTarget(target, 'auto', target === highlightNext);
          highlightNext = null;
          return;
        }
        awaited();
        shownPage = shows;
        shownTarget = '';
        const run = ++settled;
        disposeReveals();
        disposeReveals = () => {};
        // Scroll to where the page opens before it arrives, so the arrival plays on what is in view.
        if (at !== null) settleAt(at);
        if (main) {
          arrive(main, pageArrival(main));
          highlight(main, shows, run);
        }
        requestAnimationFrame(() => {
          if (run !== settled || !main) return;
          nextPages(run);
          void fontsReady().then(() => {
            if (run !== settled || !main) return;
            const aim = landingId(path, hash, has);
            shownTarget = aim;
            if (at === null && aim) {
              scrollToTarget(aim, 'instant', true);
              retime(main);
            }
            highlightNext = null;
            const page = armReveals(main, () => blocksOf(main!));
            const foot = footer ? armReveals(footer, () => [...footer!.children] as HTMLElement[]) : () => {};
            disposeReveals = () => {
              page();
              foot();
            };
          });
        });
      },
    ),
  );
  onCleanup(() => disposeReveals());
  onMount(() => {
    if (main) onCleanup(watchChanges(main));
  });

  // `data-highlighted` names the page whose code is highlighted; the prerender and the search pass wait for
  // it. Every navigation fetches the page's code before the page shows (shell/leave.ts), and a page that shows
  // code brings the highlighter (lazyPages.ts), so its code is highlighted from the first paint.
  const highlight = (el: HTMLElement, path: string, run: number) => {
    const done = (Prism?: ReturnType<typeof highlighter>) => {
      Prism?.highlightAllUnder(el);
      el.dataset.highlighted = path;
    };
    if (!el.querySelector('code[class*="language-"]')) return done();
    const now = highlighter();
    if (now) return done(now);
    loadHighlighter().then(
      (Prism) => run === settled && done(Prism),
      () => {},
    );
  };

  // Once the page is in and the browser is idle, fetch the code of the pages before and after it in its
  // sidebar section, where a reader most often goes next (a browser without idle callbacks waits 1 s). Skip
  // this when the browser asks to save data, or when the sidebar doesn't list the page. Any other link's page
  // is fetched when the link is hovered, focused or touched.
  const preloadRoute = usePreloadRoute();
  let stopIdle = () => {};
  const whenIdle = (f: () => void) => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(f, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(f, 1000);
    return () => clearTimeout(id);
  };
  const nextPages = (run: number) => {
    stopIdle();
    if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    stopIdle = whenIdle(() => {
      if (run !== settled) return;
      const links = [...document.querySelectorAll<HTMLAnchorElement>('.side nav.group a[href^="/"]')]
        .map((a) => a.getAttribute('href')!)
        .filter((href) => routeFor(href)?.section === section());
      const at = links.indexOf(page());
      for (const href of [links[at - 1], links[at + 1]]) if (at >= 0 && href) preloadRoute(href, { preloadData: false });
    });
  };
  onCleanup(() => stopIdle());

  const handleBoxPick = () => {
    setCloseKey((k) => k + 1);
    const p = page();
    if (!BOX_ROUTES.has(p) && p !== SETUP && p !== FLASH && !flashing()) navigate('/dashboard');
  };

  // The selected box decides the dashboard's pages: a Medius box gets Device, Control and Update, anything else
  // gets Set up; Flash stays for both. A page the selection doesn't get leaves the list, and its address
  // redirects to one it does get (never mid-flash). While the selection's kind is unknown (a port still being
  // checked), every page stays.
  const hidden = (path: string) => {
    // The search pass (dev) reads every page, with a box connected.
    if (import.meta.env.DEV && (globalThis as { __mediusSearchPass?: boolean }).__mediusSearchPass) return false;
    const kind = boxes.selectedKind();
    return kind === 'medius' ? path === SETUP : kind === 'other' ? BOX_ROUTES.has(path) : false;
  };
  createEffect(() => {
    if (section() !== 'dashboard' || flashing() || boxes.anyUpdating() || !hidden(page())) return;
    navigate((boxes.selectedKind() === 'medius' ? '/dashboard' : SETUP) + location.search, { replace: true });
  });

  createEffect(() => {
    if (section() === 'dashboard') boxes.start();
  });

  return (
    <>
      <div class="docs" classList={{ tool: section() === 'dashboard' }}>
        <DocsSidebar
          pathname={page()}
          closeKey={closeKey()}
          title={barTitle()}
          disabled={flashing()}
          onSearch={() => {
            if (!flashing()) setSearchOpen(true);
          }}
          boxes={boxes.supported && boxes.secure ? <BoxList onPick={handleBoxPick} disabled={flashing()} /> : undefined}
          hide={section() === 'dashboard' ? hidden : undefined}
        />
        <main ref={main} class="docs-page doc">
          {props.children}
        </main>
        <OnThisPage pathname={page()} />
      </div>
      <SiteFooter ref={(el) => (footer = el)} />

      <Search open={searchOpen()} onClose={() => setSearchOpen(false)} onPick={handleSearchNavigate} />
    </>
  );
};

export default DocsLayout;
