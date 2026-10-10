import { createSignal, createEffect, createMemo, on, onCleanup, onMount } from 'solid-js';
import { type RouteSectionProps, useBeforeLeave, useLocation, useNavigate } from '@solidjs/router';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { Search } from '../shell/Search';
import { prefetchIndex } from '../search/load';
import { SiteNav } from '../shell/SiteNav';
import { DocsSidebar } from '../shell/DocsSidebar';
import { OnThisPage } from '../shell/OnThisPage';
import { SiteFooter } from '../shell/SiteFooter';
import { arrive, armReveals, blocksOf, fontsReady, inOrder, watchChanges } from '../shell/motion';
import { routeFor } from '../routes';
import { useBoxes, useNativeFlash } from './dashboard/context';
import { BoxList } from './dashboard/BoxList';
import Prism from '../prism';

const BOX_ROUTES = new Set([
  '/dashboard',
  '/dashboard/control',
  '/dashboard/update',
]);


const DocsLayout = (props: RouteSectionProps) => {
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [closeKey, setCloseKey] = createSignal(0);
  const navigate = useNavigate();
  const location = useLocation();
  const native = useNativeFlash();
  const boxes = useBoxes();
  const flashing = native.running;
  // Block in-app navigation (back/forward, links, programmatic) during a flash.
  useBeforeLeave((e) => {
    if (flashing()) e.preventDefault();
  });
  let main: HTMLElement | undefined;
  let footer: HTMLElement | undefined;

  // 'auto' glides by the page's CSS, which reduced motion turns off; a new page lands with 'instant'.
  // The outline marks a search result or a deep link, not a section the reader moved to themselves.
  let highlightNext: string | null = null;
  // A target that comes with fetched content (a device the stats add, a release), or is drawn anew when
  // more arrives, is landed on again, for up to 10 s and until the reader scrolls, types or presses
  // anywhere (the scrollbar too).
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
    el.scrollIntoView({ behavior, block: 'start' });
    if (!highlight) return;
    // The block the reader asked for shows at once, with its ring rather than an arrival.
    el.classList.remove('moving');
    el.classList.add('search-highlight');
    setTimeout(() => el.classList.remove('search-highlight'), 2000);
  };
  const hashId = () => decodeURIComponent(location.hash.replace('#', ''));

  const handleSearchNavigate = (fullPath: string) => {
    if (flashing()) return;
    setSearchOpen(false);
    setCloseKey((k) => k + 1);
    const [path, hash] = fullPath.split('#');
    highlightNext = hash ?? null;
    if (path === location.pathname && hash && hash === hashId()) scrollToTarget(hash, 'auto', true);
    else navigate(fullPath, { scroll: path !== location.pathname });
  };

  // Ctrl or Cmd with K opens and closes the search; / opens it from anywhere but a field.
  onMount(() => {
    // During a flash the keys open nothing, and the browser's Ctrl K stays blocked as ever.
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
    // The index is fetched once the page is idle, so the first search rarely waits for it.
    const idle = window.requestIdleCallback?.(prefetchIndex, { timeout: 5000 });
    const late = idle === undefined ? setTimeout(prefetchIndex, 3000) : undefined;
    onCleanup(() => (idle === undefined ? clearTimeout(late) : window.cancelIdleCallback(idle)));
  });

  const section = () => routeFor(location.pathname)?.section;

  const barTitle = createMemo(() => {
    const label = routeFor(location.pathname)?.nav ?? '';
    const box = BOX_ROUTES.has(location.pathname) ? boxes.selected()?.session.name() : null;
    return box ? `${label} - ${box}` : label;
  });

  // A new page arrives block by block, and starts at the top, or at its hash once the fonts have set the
  // layout; the reveals are armed after that jump, so the section it lands on is never held back. A hash
  // change on the same page scrolls there. The arrival is stamped at once, so a prerendered snapshot's
  // arrival carries on into the app's (takeover.ts).
  let shownPath = '';
  let settled = 0;
  let disposeReveals = () => {};
  createEffect(
    on(
      () => [location.pathname, location.hash] as const,
      ([path, hash]) => {
        awaited();
        if (path === shownPath) {
          if (hash) scrollToTarget(hashId(), 'auto', hashId() === highlightNext);
          highlightNext = null;
          return;
        }
        shownPath = path;
        const run = ++settled;
        disposeReveals();
        disposeReveals = () => {};
        if (main) arrive(main, inOrder(blocksOf(main), 200, 55));
        if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        requestAnimationFrame(() => {
          if (run !== settled || !main) return;
          Prism.highlightAllUnder(main);
          void fontsReady().then(() => {
            if (run !== settled || !main) return;
            if (hash) scrollToTarget(hashId(), 'instant', true);
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

  const handleBoxPick = () => {
    setCloseKey((k) => k + 1);
    const p = location.pathname;
    if (!BOX_ROUTES.has(p) && p !== '/dashboard/setup' && !flashing()) navigate('/dashboard');
  };

  createEffect(() => {
    if (section() === 'dashboard') boxes.start();
  });

  return (
    <>
      <GridBackground gridSize={10} />
      <SiteNav disabled={flashing()} />
      <div class="docs" classList={{ tool: section() === 'dashboard' }}>
        <DocsSidebar
          pathname={location.pathname}
          closeKey={closeKey()}
          title={barTitle()}
          disabled={flashing()}
          onSearch={() => {
            if (!flashing()) setSearchOpen(true);
          }}
          boxes={boxes.supported && boxes.secure ? <BoxList onPick={handleBoxPick} disabled={flashing()} /> : undefined}
        />
        <main ref={main} class="docs-page doc">
          {props.children}
        </main>
        <OnThisPage pathname={location.pathname} />
      </div>
      <SiteFooter ref={(el) => (footer = el)} />

      <Search open={searchOpen()} onClose={() => setSearchOpen(false)} onPick={handleSearchNavigate} />
    </>
  );
};

export default DocsLayout;
