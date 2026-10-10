import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { lockPage, panelKeys } from './panel';
import { arrive, inOrder } from './motion';
import { LANG_LABEL, LANG_ROOT, SECTION_LABEL, routeFor, sectionLabel, sidebarGroups, type Lang, type Section } from '../routes';

type CodeSection = 'native' | 'library' | 'bindings';

const SECTIONS: { label: string; href: string; section: CodeSection }[] = [
  { label: 'Native', href: '/native', section: 'native' },
  { label: 'Rust', href: '/library', section: 'library' },
  { label: 'Bindings', href: '/bindings', section: 'bindings' },
];

const LANGS: { label: string; href: string; lang?: Lang }[] = [
  { label: 'Overview', href: '/bindings' },
  { label: LANG_LABEL.c, href: LANG_ROOT.c, lang: 'c' },
  { label: LANG_LABEL.python, href: LANG_ROOT.python, lang: 'python' },
];

const isCode = (s: Section | undefined): s is CodeSection => s === 'native' || s === 'library' || s === 'bindings';

// The ruled sidebar of every page but the landing page. On a phone it opens from the bar under the nav.
export function DocsSidebar(props: {
  pathname: string;
  disabled?: boolean;
  onSearch: () => void;
  onNavigate?: () => void;
  /** Any change closes the phone panel: a box picked, a search result chosen. */
  closeKey?: unknown;
  title?: string;
  boxes?: JSX.Element;
}) {
  const route = createMemo(() => routeFor(props.pathname));
  // The AI page keeps the sidebar of the code section it was opened from.
  const [lastCode, setLastCode] = createSignal<CodeSection>('native');
  createEffect(() => {
    const s = route()?.section;
    if (isCode(s)) setLastCode(s);
  });
  const section = (): Section => {
    const s = route()?.section;
    if (!s || s === 'notfound' || s === 'home') return 'native';
    return s === 'ai' ? lastCode() : s;
  };
  const lang = () => route()?.lang;

  const [open, setOpen] = createSignal(false);
  let side: HTMLElement | undefined;
  let mark: HTMLSpanElement | undefined;
  let bar: HTMLButtonElement | undefined;
  // On a phone the pages open over the page, their links cascading in as on a wide screen's first load.
  const setPanel = (next: boolean) => {
    setOpen(next);
    lockPage('side', next);
    if (next && side) arrive(side, inOrder(side.querySelectorAll<HTMLElement>('.sections, .search, .group > *'), 40, 18, 24));
  };
  onCleanup(() => lockPage('side', false));
  panelKeys({ open, panel: () => side, toggle: () => bar, close: () => setPanel(false) });
  createEffect(on([() => props.pathname, () => props.closeKey], () => open() && setPanel(false), { defer: true }));

  const go = (e: MouseEvent) => {
    if (props.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    setPanel(false);
    props.onNavigate?.();
  };
  const off = () => (props.disabled ? 'true' : undefined);

  // The page's edge travels to the page picked, and the section's fill to the section; a list that
  // changed whole takes the edge without travel. The links cascade in when the sidebar first shows and
  // when a section brings a new list.
  const place = (ind: HTMLElement | null | undefined, at: HTMLElement | null | undefined, instant: boolean) => {
    if (!ind) return;
    if (!at) {
      ind.style.opacity = '0';
      return;
    }
    if (instant) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.top = `${at.offsetTop}px`;
    ind.style.left = `${at.offsetLeft}px`;
    ind.style.width = `${at.offsetWidth}px`;
    ind.style.height = `${at.offsetHeight}px`;
    if (instant) {
      void ind.offsetWidth;
      ind.style.transition = '';
    }
  };
  let shownList = '';
  const placeAll = (first: boolean) => {
    if (!side) return;
    const list = groups().map((g) => g.label).join('|');
    place(mark, side.querySelector<HTMLElement>('.group a[aria-current="page"]'), first || list !== shownList);
    side.querySelectorAll<HTMLElement>('.sections').forEach((n) =>
      place(n.querySelector<HTMLElement>(':scope > .ind'), n.querySelector<HTMLElement>('a[aria-current]'), first),
    );
    if (!first && list !== shownList) arrive(side, inOrder(side.querySelectorAll<HTMLElement>('.group > *'), 0, 22, 24));
    shownList = list;
  };
  onMount(() => {
    if (side) arrive(side, inOrder(side.querySelectorAll<HTMLElement>('.sections, .search, .group > *'), 80, 22, 24));
    placeAll(true);
    const again = () => placeAll(true);
    window.addEventListener('resize', again);
    onCleanup(() => window.removeEventListener('resize', again));
  });
  createEffect(on([() => props.pathname, section, lang], () => placeAll(false), { defer: true }));

  const groups = createMemo(() => {
    const s = section();
    const own = s === 'bindings' ? (lang() ? sidebarGroups('bindings', lang()) : []) : sidebarGroups(s);
    return isCode(s) ? [...own, ...sidebarGroups('ai')] : own;
  });

  const barLabel = () => {
    const r = route();
    if (!r || r.section === 'home' || r.section === 'notfound') return SECTION_LABEL.native;
    return `${sectionLabel(r)} / `;
  };

  const Link = (p: { href: string; label: string; current?: 'page' | 'true' }) => (
    <A
      href={p.href}
      end
      activeClass=""
      inactiveClass=""
      aria-current={p.current}
      aria-disabled={off()}
      on:click={go}
    >
      {p.label}
    </A>
  );

  return (
    <>
      <button
        ref={bar}
        class="docbar caps"
        type="button"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls="side"
        onClick={() => setPanel(!open())}
      >
        <span>
          {barLabel()}
          <b>{props.title ?? route()?.nav ?? ''}</b>
        </span>
        <span>{open() ? 'Close' : 'Pages'}</span>
      </button>
      <aside ref={side} class="side" id="side" classList={{ open: open() }} aria-label={SECTION_LABEL[section()]}>
        <span class="mark" ref={mark} aria-hidden="true" />
        <Show when={isCode(section())}>
          <nav class="sections" aria-label="Sections">
            <span class="ind" aria-hidden="true" />
            <For each={SECTIONS}>
              {(s) => <Link href={s.href} label={s.label} current={section() === s.section ? 'true' : undefined} />}
            </For>
          </nav>
        </Show>
        <Show when={section() === 'bindings'}>
          <nav class="sections langs" aria-label="Languages">
            <span class="ind" aria-hidden="true" />
            <For each={LANGS}>
              {(l) => <Link href={l.href} label={l.label} current={lang() === l.lang ? 'true' : undefined} />}
            </For>
          </nav>
        </Show>
        <button class="search caps" type="button" onClick={() => props.onSearch()}>
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <Show when={section() === 'dashboard'}>
          {(() => {
            const list = props.boxes;
            return list ? (
              <div class="group">
                <p class="label">Boxes</p>
                {list}
              </div>
            ) : null;
          })()}
        </Show>
        <For each={groups()}>
          {(g) => (
            <nav class="group" aria-label={g.label}>
              <p class="label">{g.label}</p>
              <For each={g.routes}>
                {(r) => <Link href={r.path} label={r.nav} current={r.path === props.pathname ? 'page' : undefined} />}
              </For>
            </nav>
          )}
        </For>
      </aside>
    </>
  );
}
