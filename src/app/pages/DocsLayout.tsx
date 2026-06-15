import { createSignal, createEffect, onCleanup, onMount, Show, createMemo } from 'solid-js';
import { type RouteSectionProps, useNavigate, useLocation } from '@solidjs/router';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { Pane, type PaneState } from '../../components/navigation/Pane';
import { Tabs } from '../../components/navigation/Tabs';
import { Divider } from '../../components/display/Divider';
import { Titlebar } from '../../components/navigation/Titlebar';
import { Button } from '../../components/inputs/Button';
import { CommandPalette } from '../../components/navigation/CommandPalette';
import {
  BsList, BsInfoCircle, BsLightning, BsStack, BsCpu, BsPlug, BsLink45deg,
  BsFileCode, BsBroadcast, BsArrowsMove, BsCursor, BsArrowLeftRight, BsGear,
  BsJournalText, BsBoxArrowInDown, BsExclamationTriangle, BsArrowRepeat,
  BsStars, BsWrench, BsActivity, BsTerminal, BsBook, BsHouseDoor, BsSearch,
} from 'solid-icons/bs';
import type { TabOption } from '../../components/navigation/Tabs';
import { buildSearchItems } from '../searchIndex';

const sectionTabs: TabOption[] = [
  { value: 'native', label: 'Native API', icon: BsTerminal },
  { value: 'library', label: 'Rust Library', icon: BsBook },
];

const nativeOverviewTabs: TabOption[] = [
  { value: '/native', label: 'Introduction', icon: BsInfoCircle },
  { value: '/native/quickstart', label: 'Quickstart', icon: BsLightning },
  { value: '/native/architecture', label: 'Architecture', icon: BsStack },
  { value: '/native/hardware', label: 'Hardware', icon: BsCpu },
];

const nativeProtocolTabs: TabOption[] = [
  { value: '/native/transport', label: 'Transport', icon: BsPlug },
  { value: '/native/connection', label: 'Connection', icon: BsLink45deg },
  { value: '/native/frame', label: 'Frame Format', icon: BsFileCode },
  { value: '/native/injection', label: 'Injection Model', icon: BsBroadcast },
];

const nativeCommandTabs: TabOption[] = [
  { value: '/native/commands/movement', label: 'Movement', icon: BsArrowsMove },
  { value: '/native/commands/buttons', label: 'Buttons', icon: BsCursor },
  { value: '/native/commands/requests', label: 'Requests', icon: BsArrowLeftRight },
  { value: '/native/commands/admin', label: 'Admin', icon: BsGear },
];

const nativeReferenceTabs: TabOption[] = [
  { value: '/native/flashing', label: 'Flashing', icon: BsBoxArrowInDown },
  { value: '/native/troubleshooting', label: 'Troubleshooting', icon: BsExclamationTriangle },
];

const allNativeTabs = [
  ...nativeOverviewTabs, ...nativeProtocolTabs, ...nativeCommandTabs, ...nativeReferenceTabs,
];

const libraryGettingStartedTabs: TabOption[] = [
  { value: '/library', label: 'Introduction', icon: BsInfoCircle },
  { value: '/library/connection', label: 'Connection', icon: BsLink45deg },
];

const libraryApiTabs: TabOption[] = [
  { value: '/library/movement', label: 'Movement', icon: BsArrowsMove },
  { value: '/library/buttons', label: 'Buttons', icon: BsCursor },
  { value: '/library/requests', label: 'Requests', icon: BsArrowLeftRight },
  { value: '/library/admin', label: 'Admin', icon: BsGear },
  { value: '/library/lifecycle', label: 'Lifecycle', icon: BsArrowRepeat },
  { value: '/library/diagnostics', label: 'Logs & Counters', icon: BsJournalText },
];

const libraryFeatureTabs: TabOption[] = [
  { value: '/library/features/async', label: 'Async', icon: BsStars },
  { value: '/library/features/mock', label: 'Mock', icon: BsWrench },
  { value: '/library/features/flash', label: 'Flash', icon: BsBoxArrowInDown },
  { value: '/library/features/tracing', label: 'Tracing', icon: BsActivity },
];

const libraryReferenceTabs: TabOption[] = [
  { value: '/library/types', label: 'Types & Errors', icon: BsFileCode },
];

const allLibraryTabs = [
  ...libraryGettingStartedTabs, ...libraryApiTabs, ...libraryFeatureTabs, ...libraryReferenceTabs,
];

const isMobileQuery = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const DocsLayout = (props: RouteSectionProps) => {
  const [paneState, setPaneState] = createSignal<PaneState>(isMobileQuery() ? 'closed' : 'open');
  const [isMobile, setIsMobile] = createSignal(isMobileQuery());
  const [searchOpen, setSearchOpen] = createSignal(false);
  const navigate = useNavigate();
  const location = useLocation();
  let pendingHash: string | null = null;

  const scrollToTarget = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('search-highlight');
    setTimeout(() => el.classList.remove('search-highlight'), 2000);
  };

  const handleSearchNavigate = (fullPath: string) => {
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

  const activeSection = () => location.pathname.startsWith('/library') ? 'library' : 'native';

  const pageTitle = createMemo(() => {
    const all = [...allNativeTabs, ...allLibraryTabs];
    return all.find(t => t.value === location.pathname)?.label ?? '';
  });

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

  const handlePageNav = (value: string) => {
    navigate(value);
    if (isMobile()) setPaneState('closed');
  };

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
          <Tabs
            orientation="vertical"
            variant="subtle"
            value={activeSection()}
            onChange={(value: string) => {
              const prefix = value === 'library' ? '/library' : '/native';
              if (!location.pathname.startsWith(prefix)) navigate(prefix);
            }}
            options={sectionTabs}
          />
          <Show when={activeSection() === 'native'}>
            <Divider spacing="compact" label="Overview" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={nativeOverviewTabs}
            />
            <Divider spacing="compact" label="Protocol" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={nativeProtocolTabs}
            />
            <Divider spacing="compact" label="Commands" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={nativeCommandTabs}
            />
            <Divider spacing="compact" label="Reference" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={nativeReferenceTabs}
            />
          </Show>
          <Show when={activeSection() === 'library'}>
            <Divider spacing="compact" label="Getting Started" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={libraryGettingStartedTabs}
            />
            <Divider spacing="compact" label="API" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={libraryApiTabs}
            />
            <Divider spacing="compact" label="Features" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={libraryFeatureTabs}
            />
            <Divider spacing="compact" label="Reference" labelAlign="start" />
            <Tabs
              orientation="vertical"
              variant="subtle"
              value={location.pathname}
              onChange={handlePageNav}
              options={libraryReferenceTabs}
            />
          </Show>
        </Pane>

        <div ref={contentRef} style={{ flex: 1, overflow: 'auto' }}>
          <Titlebar
            title={activeSection() === 'library' ? 'Medius - Rust Library' : 'Medius - Native API'}
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
                  onClick={() => navigate('/')}
                  aria-label="Home"
                />
              </>
            }
            right={
              <Button
                variant="subtle"
                size="compact"
                icon={BsSearch}
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              />
            }
          />
          <div class="container container--wide grid">
            {props.children}
          </div>
        </div>
      </div>

      <CommandPalette
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        items={searchItems}
        keybinding
        onKeybinding={() => setSearchOpen(prev => !prev)}
        placeholder="Search documentation..."
        emptyMessage="No results found"
      />
    </>
  );
};

export default DocsLayout;
