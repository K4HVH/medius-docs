import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { routeFor, type Section } from '../routes';
import { Arrow } from './Arrow';
import { lockPage, panelKeys } from './panel';

export const NAV_LINKS: { label: string; href: string; sections: Section[] }[] = [
  { label: 'Guide', href: '/guide', sections: ['guide'] },
  { label: 'Docs', href: '/native', sections: ['native', 'library', 'bindings', 'ai'] },
  { label: 'Dashboard', href: '/dashboard', sections: ['dashboard'] },
  { label: 'Changelog', href: '/dashboard/changelog', sections: [] },
];

const CHANGELOG = '/dashboard/changelog';

// The bar across the top of every page. Over the landing hero it stays clear until the page moves.
export function SiteNav(props: { overHero?: boolean; disabled?: boolean }) {
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  const [solid, setSolid] = createSignal(!props.overHero);
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
    setSolid(!props.overHero || window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar?.style.setProperty('--prog', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
    bar?.style.setProperty('--prog-o', window.scrollY > 8 ? '1' : '0');
  };

  onMount(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });
  onCleanup(() => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(closeTimer);
    lockPage('nav', false);
  });

  const off = () => (props.disabled ? 'true' : undefined);

  return (
    <header
      ref={bar}
      class="nav"
      classList={{ solid: solid() || open(), open: open(), closing: closing() }}
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
