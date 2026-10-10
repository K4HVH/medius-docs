import { createComputed, createEffect, createMemo, createSignal, For, on, onCleanup, onMount } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { routeFor, type Section } from '../routes';
import { Arrow } from './Arrow';
import { lockPage, panelKeys } from './panel';
import { leavingFor } from './leave';
import { pageY } from './scrollPlace';

export const NAV_LINKS: { label: string; href: string; sections: Section[] }[] = [
  { label: 'Guide', href: '/guide', sections: ['guide'] },
  { label: 'Docs', href: '/native', sections: ['native', 'library', 'bindings', 'ai'] },
  { label: 'Dashboard', href: '/dashboard', sections: ['dashboard'] },
  { label: 'Changelog', href: '/dashboard/changelog', sections: [] },
];

const CHANGELOG = '/dashboard/changelog';

// The bar across the top of every page, one for the whole site so a page change never redraws it. Over the
// landing hero it stays clear until the page moves. It takes the look of the page a link is going to as
// the page fades out, at the pace of that fade; a scroll on the landing changes it at a slower one.
export function SiteNav(props: { disabled?: boolean }) {
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  const hero = createMemo(() => (leavingFor() ?? location.pathname) === '/');
  // The page a link is going to opens at its top, so the scroll of the one leaving has no say; the page
  // shown is scrolled where scrollPlace knows it to be, even before it has scrolled there.
  const solid = () => open() || !hero() || (pageY() > 8 && leavingFor() === null);
  let bar: HTMLElement | undefined;
  let links: HTMLElement | undefined;
  let menuButton: HTMLButtonElement | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const section = createMemo(() => routeFor(location.pathname)?.section);
  const current = (l: (typeof NAV_LINKS)[number]) =>
    l.href === CHANGELOG ? location.pathname === CHANGELOG : location.pathname !== CHANGELOG && l.sections.includes(section()!);

  const setMenu = (next: boolean) => {
    if (!next && open()) {
      setClosing(true);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setClosing(false), 220);
    }
    setOpen(next);
    lockPage('nav', next);
  };
  panelKeys({ open, panel: () => links, toggle: () => menuButton, close: () => setMenu(false) });
  createEffect(on(() => location.pathname, () => open() && setMenu(false), { defer: true }));

  const guard = (e: MouseEvent) => {
    if (props.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    setMenu(false);
  };

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar?.style.setProperty('--prog', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
    bar?.style.setProperty('--prog-o', window.scrollY > 8 ? '1' : '0');
  };

  // Set in the same update as the look it paces, so the transition starts with the right duration.
  const [routed, setRouted] = createSignal(false);
  let routedTimer: ReturnType<typeof setTimeout> | undefined;
  createComputed(
    on(
      hero,
      () => {
        setRouted(true);
        clearTimeout(routedTimer);
        routedTimer = setTimeout(() => setRouted(false), 300);
      },
      { defer: true },
    ),
  );

  onMount(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });
  onCleanup(() => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(closeTimer);
    clearTimeout(routedTimer);
    lockPage('nav', false);
  });

  const off = () => (props.disabled ? 'true' : undefined);

  return (
    <header
      ref={bar}
      class="nav"
      classList={{ solid: solid(), routed: routed(), open: open(), closing: closing() }}
    >
      <A href="/" class="brand" end activeClass="" inactiveClass="" aria-disabled={off()} on:click={guard}>
        Medius
      </A>
      <button
        ref={menuButton}
        class="menu-btn"
        type="button"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls="site-links"
        onClick={() => setMenu(!open())}
      >
        {open() ? 'Close' : 'Menu'}
      </button>
      <nav class="links" id="site-links" aria-label="Site" ref={links}>
        <For each={NAV_LINKS}>
          {(l) => (
            <A
              href={l.href}
              end
              activeClass=""
              inactiveClass=""
              aria-current={current(l) ? 'page' : undefined}
              aria-disabled={off()}
              on:click={guard}
            >
              {l.label}
            </A>
          )}
        </For>
      </nav>
      <A href="/guide" class="btn primary sm" end activeClass="" inactiveClass="" aria-disabled={off()} on:click={guard}>
        Install <Arrow />
      </A>
    </header>
  );
}
