import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { type SearchEntry, entries } from '../searchIndex';
import { groupHits, marks, rank } from '../searchRank';
import { routeFor, sectionLabel } from '../routes';
import { lockPage, modKey } from './panel';
import { prefersReducedMotion } from './motion';

// The site search: the docs, the Guide and the dashboard, best match first, by section. Empty, it offers
// what was opened last and the main pages. The arrows move a blue edge through the list, as the sidebar's
// moves through the pages; Enter opens the result, Ctrl or Cmd with Enter opens it in a new tab.

const RECENT = 'medius.search.recent';
const PAGES = ['/guide', '/guide/compatibility', '/guide/help', '/dashboard', '/dashboard/control', '/dashboard/update', '/native', '/library', '/bindings', '/dashboard/changelog'];
const CLOSE_MS = 150;

// An entry is known by its address and title together: several share a page.
const keyOf = (e: SearchEntry) => `${e.path} ${e.label}`;
const byKey = new Map(entries.map((e) => [keyOf(e), e]));
const byPath = new Map(entries.map((e) => [e.path, e]));

const readRecent = (): SearchEntry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(v) ? v.map((k) => byKey.get(k)).filter((e): e is SearchEntry => !!e) : [];
  } catch {
    return [];
  }
};
const keepRecent = (e: SearchEntry) => {
  try {
    const keys = [e, ...readRecent().filter((r) => r !== e)].slice(0, 5).map(keyOf);
    localStorage.setItem(RECENT, JSON.stringify(keys));
  } catch {
    // A browser that keeps nothing simply offers no recent results.
  }
};

// Results sit under the site's sections, as in the sidebar; each says where in its section it lives: the
// sidebar's group, and for a part of a page the page too.
const section = (e: SearchEntry): string => {
  if (e.external) return 'Elsewhere';
  const r = routeFor(e.path.split('#')[0]);
  return r ? sectionLabel(r) : e.group;
};
const crumb = (e: SearchEntry, withSection: boolean): string => {
  if (e.external) return new URL(e.path).host;
  const [path, hash] = e.path.split('#');
  const r = routeFor(path);
  if (!r) return '';
  return [withSection ? sectionLabel(r) : r.group, hash ? r.nav : null].filter((x) => x && x !== e.label).join(' / ');
};

const Marked = (p: { text: string; query: string }) => (
  <For each={marks(p.text, p.query)}>{(m) => (m.hit ? <mark>{m.text}</mark> : m.text)}</For>
);

export function Search(props: { open: boolean; onClose: () => void; onPick: (path: string) => void }) {
  const [query, setQuery] = createSignal('');
  const [at, setAt] = createSignal(0);
  const [shown, setShown] = createSignal(props.open);
  const [closing, setClosing] = createSignal(false);
  const [opening, setOpening] = createSignal(false);
  // Counts the openings, so the empty list is read afresh each time.
  const [round, setRound] = createSignal(0);
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;
  let mark: HTMLSpanElement | undefined;
  let back: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const groups = createMemo(() => {
    const q = query().trim();
    if (q) return groupHits(rank(entries, q), section).map((g) => ({ group: g.group, items: g.hits.map((h) => h.entry) }));
    round();
    const recent = readRecent();
    const pages = PAGES.map((p) => byPath.get(p)).filter((e): e is SearchEntry => !!e && !recent.includes(e));
    return [
      ...(recent.length ? [{ group: 'Recent', items: recent }] : []),
      { group: 'Pages', items: pages },
    ];
  });
  const flat = createMemo(() => groups().flatMap((g) => g.items));
  // Where each section's results start in the list the arrows walk.
  const starts = createMemo(() => groups().reduce<number[]>((a, g, k) => [...a, k ? a[k - 1] + groups()[k - 1].items.length : 0], []));

  // The edge goes to the result in focus: straight there when the list itself changed.
  const place = (instant: boolean) => {
    const o = list?.querySelector<HTMLElement>(`#srch-o-${at()}`);
    if (!mark || !o) {
      if (mark) mark.style.opacity = '0';
      return;
    }
    if (instant) mark.style.transition = 'none';
    mark.style.opacity = '1';
    mark.style.top = `${o.offsetTop}px`;
    mark.style.height = `${o.offsetHeight}px`;
    if (instant) {
      void mark.offsetWidth;
      mark.style.transition = '';
    }
    o.scrollIntoView({ block: 'nearest' });
  };
  createEffect(on(flat, () => {
    setAt(0);
    queueMicrotask(() => place(true));
  }));
  createEffect(on(at, () => place(false), { defer: true }));

  createEffect(
    on(
      () => props.open,
      (open) => {
        clearTimeout(timer);
        if (open) {
          // Opened again while still closing, the panel never left the page: focus goes back by hand.
          const again = shown();
          if (!again) back = document.activeElement;
          setClosing(false);
          setOpening(true);
          timer = setTimeout(() => setOpening(false), 700);
          setShown(true);
          setQuery('');
          setRound((r) => r + 1);
          lockPage('search', true);
          if (again) {
            input?.focus();
            queueMicrotask(() => place(true));
          }
        } else if (shown()) {
          lockPage('search', false);
          setClosing(true);
          timer = setTimeout(() => setShown(false), prefersReducedMotion() ? 0 : CLOSE_MS);
          (back as HTMLElement | null)?.focus?.();
        }
      },
    ),
  );
  onCleanup(() => {
    clearTimeout(timer);
    lockPage('search', false);
  });

  const pick = (e: SearchEntry | undefined, tab = false) => {
    if (!e) return;
    if (e.external || tab) {
      window.open(e.path, '_blank', 'noopener,noreferrer');
      if (e.external) props.onClose();
      return;
    }
    keepRecent(e);
    props.onPick(e.path);
  };

  // The keys it handles stop here, so a panel underneath (the phone's pages) never takes them too.
  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const n = flat().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (n) setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter' && e.target === input) pick(flat()[at()], e.ctrlKey || e.metaKey);
    else if (e.key === 'Escape') props.onClose();
    else if (e.key === 'Tab') input?.focus();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Once the panel is on the page: focus in the box, the edge on the first result.
  const Focus = () => {
    onMount(() => {
      input?.focus();
      place(true);
    });
    return null;
  };

  return (
    <Show when={shown()}>
      <Portal>
        <div
          class="srch"
          classList={{ closing: closing(), opening: opening() }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) props.onClose();
          }}
        >
          <div
            class="srch-p"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            on:keydown={onKey}
            onPointerDown={(e) => {
              // A press anywhere but the box or a button keeps the focus in the box.
              if (!(e.target as Element).closest('input, button')) e.preventDefault();
            }}
          >
            <Focus />
            <div class="srch-q">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.4" />
              </svg>
              <input
                ref={input}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="srch-list"
                aria-autocomplete="list"
                aria-activedescendant={flat().length ? `srch-o-${at()}` : undefined}
                aria-label="Search"
                placeholder="Search the Guide, the docs and the dashboard"
                autocomplete="off"
                spellcheck={false}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              <kbd class="caps srch-esc" aria-hidden="true">Esc</kbd>
              <button type="button" class="caps srch-x" onClick={() => props.onClose()}>
                Close
              </button>
            </div>
            <div class="srch-l" id="srch-list" role="listbox" aria-label="Results" ref={list}>
              <span class="mark" ref={mark} aria-hidden="true" />
              <Show
                when={flat().length}
                fallback={<p class="srch-none">Nothing matches "{query().trim()}". Try fewer or shorter words.</p>}
              >
                <For each={groups()}>
                      {(g, k) => (
                        <div role="group" aria-label={g.group}>
                          <p class="caps srch-g" aria-hidden="true">{g.group}</p>
                          <For each={g.items}>
                            {(e, j) => {
                              const i = () => starts()[k()] + j();
                              return (
                                <div
                                  id={`srch-o-${i()}`}
                                  role="option"
                                  class="srch-o"
                                  aria-selected={at() === i() ? 'true' : 'false'}
                                  style={{ '--i': Math.min(i(), 12) }}
                                  onMouseMove={() => at() !== i() && setAt(i())}
                                  onClick={(ev) => pick(e, ev.ctrlKey || ev.metaKey)}
                                >
                                  <span class="t"><Marked text={e.label} query={query()} /></span>
                                  <span class="c caps">{crumb(e, !query().trim())}</span>
                                  <Show when={e.description}>
                                    <span class="d"><Marked text={e.description!} query={query()} /></span>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      )}
                    </For>
              </Show>
            </div>
            <div class="srch-f caps" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> Move</span>
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>{modKey()} ↵</kbd> New tab</span>
              <span><kbd>Esc</kbd> Close</span>
            </div>
            <p class="sr" role="status">
              {query().trim() ? `${flat().length} ${flat().length === 1 ? 'result' : 'results'}` : ''}
            </p>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
