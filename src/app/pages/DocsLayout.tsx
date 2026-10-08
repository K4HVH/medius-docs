import { createSignal, createEffect, onCleanup, onMount, Show, For, createMemo, type Component } from 'solid-js';
import { type RouteSectionProps, useBeforeLeave, useLocation, useNavigate } from '@solidjs/router';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { Pane, type PaneState } from '../../components/navigation/Pane';
import { Divider } from '../../components/display/Divider';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { Titlebar } from '../../components/navigation/Titlebar';
import { Button } from '../../components/inputs/Button';
import { CommandPalette } from '../../components/navigation/CommandPalette';
import {
  BsList, BsInfoCircle, BsLightning, BsStack, BsCpu, BsPlug, BsLink45deg,
  BsFileCode, BsBroadcast, BsArrowsMove, BsCursor, BsArrowLeftRight, BsGear, BsDownload,
  BsJournalText, BsBoxArrowInDown, BsExclamationTriangle, BsArrowRepeat, BsBarChart,
  BsStars, BsWrench, BsActivity, BsTerminal, BsBook, BsHouseDoor, BsSearch,
  BsLightbulb, BsSliders, BsLock, BsHash, BsPuzzle, BsDiscord,
  BsBoxes, BsFiletypePy, BsUsbPlug, BsCodeSlash,
} from 'solid-icons/bs';
import { buildSearchItems } from '../searchIndex';
import AiActions from '../AiActions';
import { NavLinks, type NavItem } from '../NavLinks';
import { SiteFooter } from '../SiteFooter';
import { LANG_LABEL, LANG_ROOT, NOT_FOUND, breadcrumbTrail, routeFor, sidebarGroups, type Lang, type RouteInfo } from '../routes';
import { useBoxes, useNativeFlash } from './dashboard/context';
import { BoxList } from './dashboard/BoxList';
import Prism from '../prism';
import '../../styles/docs.css';

const ICONS: Record<string, Component> = {
  BsList, BsInfoCircle, BsLightning, BsStack, BsCpu, BsPlug, BsLink45deg, BsFileCode, BsBroadcast,
  BsArrowsMove, BsCursor, BsArrowLeftRight, BsGear, BsDownload, BsJournalText, BsBoxArrowInDown,
  BsExclamationTriangle, BsArrowRepeat, BsBarChart, BsStars, BsWrench, BsActivity, BsTerminal, BsBook,
  BsLightbulb, BsSliders, BsLock, BsHash, BsPuzzle, BsBoxes, BsFiletypePy, BsUsbPlug, BsCodeSlash,
};

const items = (routes: RouteInfo[]): NavItem[] =>
  routes.map((r) => ({ href: r.path, label: r.nav, icon: ICONS[r.icon] }));

const sectionItems: NavItem[] = [
  { href: '/native', label: 'Native API', icon: BsTerminal },
  { href: '/library', label: 'Rust Library', icon: BsBook },
  { href: '/bindings', label: 'Bindings', icon: BsBoxes },
  { href: '/dashboard', label: 'Dashboard', icon: BsBroadcast },
];

const bindingSwitcher: NavItem[] = [
  { href: '/bindings', label: 'Overview', icon: BsBoxes },
  { href: LANG_ROOT.c, label: LANG_LABEL.c, icon: BsFileCode },
  { href: LANG_ROOT.python, label: LANG_LABEL.python, icon: BsFiletypePy },
];

const BOX_ROUTES = new Set([
  '/dashboard',
  '/dashboard/control',
  '/dashboard/advanced-control',
  '/dashboard/update',
  '/dashboard/advanced',
]);

const isMobileQuery = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const DocsLayout = (props: RouteSectionProps) => {
  const [paneState, setPaneState] = createSignal<PaneState>(isMobileQuery() ? 'closed' : 'open');
  const [isMobile, setIsMobile] = createSignal(isMobileQuery());
  const [searchOpen, setSearchOpen] = createSignal(false);
  const navigate = useNavigate();
  const location = useLocation();
  const native = useNativeFlash();
  const boxes = useBoxes();
  const flashing = native.running;
  // Block in-app navigation (back/forward, links, programmatic) during a flash.
  useBeforeLeave((e) => {
    if (flashing()) e.preventDefault();
  });
  let pendingHash: string | null = null;

  const scrollToTarget = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('search-highlight');
    setTimeout(() => el.classList.remove('search-highlight'), 2000);
  };

  const handleSearchNavigate = (fullPath: string) => {
    if (flashing()) return;
    setSearchOpen(false);
    const hashIdx = fullPath.indexOf('#');
    const path = hashIdx >= 0 ? fullPath.slice(0, hashIdx) : fullPath;
    const hash = hashIdx >= 0 ? fullPath.slice(hashIdx + 1) : null;
    const samePage = location.pathname === path;

    if (hash) pendingHash = hash;

    if (!samePage) navigate(path);

    if (hash) {
      setTimeout(() => {
        scrollToTarget(hash);
        pendingHash = null;
      }, samePage ? 50 : 200);
    }

    if (isMobile()) setPaneState('closed');
  };

  const searchItems = buildSearchItems(handleSearchNavigate);

  onMount(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setPaneState('closed');
      else setPaneState('open');
    };
    mql.addEventListener('change', handler);
    onCleanup(() => mql.removeEventListener('change', handler));
  });

  const rawSection = () =>
    location.pathname.startsWith('/dashboard')
      ? 'dashboard'
      : location.pathname.startsWith('/bindings')
        ? 'bindings'
        : location.pathname.startsWith('/library')
          ? 'library'
          : location.pathname === '/ai' || location.pathname.startsWith('/ai/')
            ? 'ai'
            : 'native';

  const [lastCodeSection, setLastCodeSection] = createSignal<'native' | 'library' | 'bindings'>('native');
  createEffect(() => {
    const s = rawSection();
    if (s === 'native' || s === 'library' || s === 'bindings') setLastCodeSection(s);
  });
  // The AI page keeps the sidebar of the section it was opened from.
  const activeSection = () => {
    const s = rawSection();
    return s === 'ai' ? lastCodeSection() : s;
  };

  const bindingRoot = () => {
    const p = location.pathname;
    if (p.startsWith('/bindings/python')) return '/bindings/python';
    if (p.startsWith('/bindings/c')) return '/bindings/c';
    return '/bindings';
  };

  const pageTitle = createMemo(() => {
    const label = routeFor(location.pathname)?.nav ?? '';
    const box = BOX_ROUTES.has(location.pathname) ? boxes.selected()?.session.name() : null;
    return box ? `${label} - ${box}` : label;
  });

  const trail = createMemo(() => breadcrumbTrail(routeFor(location.pathname) ?? NOT_FOUND));

  let contentRef: HTMLDivElement | undefined;

  createEffect(() => {
    location.pathname;
    if (pendingHash) return;
    contentRef?.scrollTo(0, 0);
  });

  createEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (!hash || pendingHash) return;
    setTimeout(() => scrollToTarget(hash), 50);
  });

  // Highlight code blocks after each route renders.
  createEffect(() => {
    location.pathname;
    requestAnimationFrame(() => {
      if (contentRef) Prism.highlightAllUnder(contentRef);
    });
  });

  const closeOnMobile = () => {
    if (isMobile()) setPaneState('closed');
  };

  const bindingLang = (): Lang | undefined => {
    const root = bindingRoot();
    return root === LANG_ROOT.c ? 'c' : root === LANG_ROOT.python ? 'python' : undefined;
  };

  const Groups = (p: { groups: { label: string; routes: RouteInfo[] }[]; disabled?: boolean }) => (
    <For each={p.groups}>
      {(group) => (
        <>
          <Divider spacing="compact" label={group.label} labelAlign="start" />
          <NavLinks items={items(group.routes)} active={location.pathname} disabled={p.disabled} onNavigate={closeOnMobile} />
        </>
      )}
    </For>
  );

  const handleBoxPick = () => {
    const p = location.pathname;
    if (!BOX_ROUTES.has(p) && p !== '/dashboard/setup' && !flashing()) navigate('/dashboard');
    if (isMobile()) setPaneState('closed');
  };

  createEffect(() => {
    if (activeSection() === 'dashboard') boxes.start();
  });

  return (
    <>
      <GridBackground gridSize={10} />

      <div class="content" style={{ display: 'flex', height: '100%', width: '100%' }}>
        <Pane
          position="left"
          mode={isMobile() ? 'temporary' : 'permanent'}
          fixed={isMobile()}
          openSize="200px"
          state={paneState()}
          onStateChange={setPaneState}
        >
          <Divider spacing="compact" label="Section" labelAlign="start" />
          <NavLinks
            items={sectionItems}
            active={`/${activeSection()}`}
            disabled={flashing()}
            onNavigate={closeOnMobile}
          />
          <Show when={activeSection() === 'native'}>
            <Groups groups={sidebarGroups('native')} />
            <Groups groups={sidebarGroups('ai')} />
          </Show>
          <Show when={activeSection() === 'library'}>
            <Groups groups={sidebarGroups('library')} />
            <Groups groups={sidebarGroups('ai')} />
          </Show>
          <Show when={activeSection() === 'bindings'}>
            <Divider spacing="compact" label="Bindings" labelAlign="start" />
            <NavLinks items={bindingSwitcher} active={bindingRoot()} onNavigate={closeOnMobile} />
            <Show when={bindingLang()} keyed>
              {(lang) => <Groups groups={sidebarGroups('bindings', lang)} />}
            </Show>
            <Groups groups={sidebarGroups('ai')} />
          </Show>
          <Show when={activeSection() === 'dashboard'}>
            <Show when={boxes.supported && boxes.secure}>
              <Divider spacing="compact" label="Boxes" labelAlign="start" />
              <BoxList onPick={handleBoxPick} disabled={flashing()} />
            </Show>
            <Groups groups={sidebarGroups('dashboard')} disabled={flashing()} />
          </Show>
        </Pane>

        <div ref={contentRef} style={{ flex: 1, overflow: 'auto' }}>
          <Titlebar
            title={
              activeSection() === 'dashboard'
                ? 'Medius - Dashboard'
                : activeSection() === 'bindings'
                  ? 'Medius - Bindings'
                  : activeSection() === 'library'
                    ? 'Medius - Rust Library'
                    : 'Medius - Native API'
            }
            subtitle={pageTitle()}
            sticky
            style={{ margin: 'var(--g-spacing-sm)', top: 'var(--g-spacing-sm)' }}
            left={
              <>
                <Show when={isMobile()}>
                  <Button
                    variant="subtle"
                    size="compact"
                    icon={BsList}
                    onClick={() => setPaneState(s => s === 'open' ? 'closed' : 'open')}
                    aria-label="Toggle navigation"
                  />
                </Show>
                <Button
                  variant="subtle"
                  size="compact"
                  icon={BsHouseDoor}
                  disabled={flashing()}
                  onClick={() => navigate('/')}
                  aria-label="Home"
                />
              </>
            }
            right={
              <>
                <AiActions />
                <Button
                  variant="subtle"
                  size="compact"
                  icon={BsDiscord}
                  onClick={() =>
                    window.open('https://discord.gg/ArRqcA84pB', '_blank', 'noopener,noreferrer')
                  }
                  aria-label="Discord (opens in a new tab)"
                />
                <Button
                  variant="subtle"
                  size="compact"
                  icon={BsSearch}
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                />
              </>
            }
          />
          <Show when={trail().length > 1}>
            <Breadcrumbs items={trail()} variant="subtle" size="compact" class="docs-breadcrumbs" />
          </Show>
          <div class="docs-page">
            {props.children}
          </div>
          <SiteFooter />
        </div>
      </div>

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
