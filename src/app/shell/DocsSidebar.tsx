import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
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
  const setPanel = (next: boolean) => {
    setOpen(next);
    document.documentElement.classList.toggle('locked', next);
  };
  onCleanup(() => document.documentElement.classList.remove('locked'));

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
        class="docbar caps"
        type="button"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls="side"
        onClick={() => setPanel(!open())}
      >
        <span>
          {barLabel()}
          <b>{route()?.nav ?? ''}</b>
        </span>
        <span>{open() ? 'Close' : 'Pages'}</span>
      </button>
      <aside class="side" id="side" classList={{ open: open() }} aria-label={SECTION_LABEL[section()]}>
        <Show when={isCode(section())}>
          <nav class="sections" aria-label="Sections">
            <For each={SECTIONS}>
              {(s) => <Link href={s.href} label={s.label} current={section() === s.section ? 'true' : undefined} />}
            </For>
          </nav>
        </Show>
        <Show when={section() === 'bindings'}>
          <nav class="sections langs" aria-label="Languages">
            <For each={LANGS}>
              {(l) => <Link href={l.href} label={l.label} current={lang() === l.lang ? 'true' : undefined} />}
            </For>
          </nav>
        </Show>
        <button class="search caps" type="button" onClick={() => props.onSearch()}>
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <Show when={section() === 'dashboard' && props.boxes}>
          <div class="group">
            <p class="label">Boxes</p>
            {props.boxes}
          </div>
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
