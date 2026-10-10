import { createSignal, createEffect, createMemo, on, onCleanup, onMount } from 'solid-js';
import { type RouteSectionProps, useBeforeLeave, useLocation, useNavigate } from '@solidjs/router';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { CommandPalette } from '../../components/navigation/CommandPalette';
import { buildSearchItems } from '../searchIndex';
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
  const scrollToTarget = (id: string, behavior: ScrollBehavior, highlight: boolean) => {
    const el = document.getElementById(id);
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

  const searchItems = buildSearchItems(handleSearchNavigate);

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

      <CommandPalette
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        items={searchItems}
        keybinding
        onKeybinding={() => {
          if (!flashing()) setSearchOpen((prev) => !prev);
        }}
        placeholder="Search docs..."
        emptyMessage="No results"
      />
    </>
  );
};

export default DocsLayout;
