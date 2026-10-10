import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Button } from '../../components/inputs/Button';
import { indexLoaded as index, loadIndex, type Loaded } from '../search/load';
import { marks, snippet } from '../search/text';
import type { IndexEntry } from '../search/types';
import { routeFor, sectionLabel, type RouteInfo } from '../routes';
import { lockPage, modKey } from './panel';
import { prefersReducedMotion } from './motion';

// The site search: every page, section and panel of the site, each release and device report, best match
// first, by section. Empty, it offers what was opened last and the main pages, which need no index; the
// index comes when the search first opens. The arrows move a blue edge through the list, as the sidebar's
// moves through the pages; Enter opens the result, Ctrl or Cmd with Enter opens it in a new tab.

const RECENT = 'medius.search.recent';
const PAGES = ['/guide', '/guide/compatibility', '/guide/help', '/dashboard', '/dashboard/control', '/dashboard/update', '/native', '/library', '/bindings', '/dashboard/changelog'];
const CLOSE_MS = 150;
// Results the list shows: more than a screen, and few enough to redraw on every keystroke.
const SHOWN = 24;

// What the list shows: its sections in order, each one's entries, the words each was found by, and for a
// page offered when the box is empty, what it is. Entries are the objects the index holds, so a row that stays
// from one keystroke to the next keeps its place on the page.
interface List {
  sections: string[];
  rows: Map<string, IndexEntry[]>;
  terms: Map<IndexEntry, string[]>;
  about: Map<IndexEntry, string>;
}

// One entry per page offered, made once, so the list keeps its rows while the index arrives.
const offered = new Map<string, IndexEntry>();
const pageOf = (r: RouteInfo): IndexEntry => {
  let e = offered.get(r.path);
  if (!e)
    offered.set(
      r.path,
      (e = { path: r.path, title: r.title, kind: 'page', section: sectionLabel(r), crumb: r.group && r.group !== sectionLabel(r) ? r.group : '', text: '' }),
    );
  return e;
};

// A pick is kept whole, so it is offered before the index comes, and dropped once the index lacks it. A
// pick kept by the search before this one is its address and title in one string: it is offered once the
// index can name it, and kept anew then.
const save = (picks: IndexEntry[]) =>
  localStorage.setItem(RECENT, JSON.stringify(picks.slice(0, 5).map(({ path, title, kind, section, crumb, caption }) => ({ path, title, kind, section, crumb, caption }))));
const readRecent = (index: Loaded | null): IndexEntry[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    if (!Array.isArray(v)) return [];
    const older = v.some((e) => typeof e === 'string');
    const kept = v.flatMap((e): IndexEntry[] => {
      if (typeof e === 'string') {
        const found = index?.byPath.get(e.slice(0, e.indexOf(' ')));
        return found ? [found] : [];
      }
      if (!e || typeof e !== 'object' || typeof e.path !== 'string' || typeof e.title !== 'string') return [];
      if (!index) return [e as IndexEntry];
      const found = index.byPath.get(e.path);
      return found ? [found] : [];
    });
    if (index && older) save(kept);
    return kept;
  } catch {
    return [];
  }
};
const keepRecent = (e: IndexEntry) => {
  try {
    save([e, ...readRecent(null).filter((r) => r.path !== e.path)]);
  } catch {
    // A browser that keeps nothing simply offers no recent results.
  }
};

// Where a result lives; a release or device report adds its date or verdict, and an empty box's list the
// section too.
const place = (e: IndexEntry, withSection: boolean): string => {
  const where = [withSection ? e.section : '', e.crumb].filter(Boolean).join(' / ');
  return e.kind === 'release' || e.kind === 'device' ? [where, e.caption].filter(Boolean).join(' · ') : where;
};

const Marked = (p: { text: string; terms: string[] }) => (
  <For each={marks(p.text, p.terms)}>{(m) => (m.hit ? <mark>{m.text}</mark> : m.text)}</For>
);

export function Search(props: { open: boolean; onClose: () => void; onPick: (path: string) => void }) {
  const [query, setQuery] = createSignal('');
  const [at, setAt] = createSignal(0);
  // Shut until the open effect runs, which notes where focus goes back to: the panel may mount opened.
  const [shown, setShown] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  const [opening, setOpening] = createSignal(false);
  const [fetchFailed, setFailed] = createSignal(false);
  const failed = () => fetchFailed() && !index();
  // Counts the openings, so the empty list is read afresh each time.
  const [round, setRound] = createSignal(0);
  let input: HTMLInputElement | undefined;
  let panel: HTMLDivElement | undefined;
  let list: HTMLDivElement | undefined;
  let mark: HTMLSpanElement | undefined;
  let back: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  onCleanup(() => (alive = false));

  const load = () => {
    setFailed(false);
    loadIndex().catch(() => alive && setFailed(true));
  };

  const view = createMemo((): List => {
    const out: List = { sections: [], rows: new Map(), terms: new Map(), about: new Map() };
    const add = (section: string, e: IndexEntry) => {
      const rows = out.rows.get(section);
      if (rows) rows.push(e);
      else {
        out.sections.push(section);
        out.rows.set(section, [e]);
      }
    };
    const q = query().trim();
    const ix = index();
    if (q) {
      if (!ix) return out;
      // The query as typed: a space after the last word says the word is finished.
      for (const h of ix.searcher.search(query(), SHOWN)) {
        add(h.entry.section, h.entry);
        out.terms.set(h.entry, h.terms);
      }
      return out;
    }
    round();
    const recent = readRecent(ix);
    for (const e of recent) add('Recent', e);
    for (const p of PAGES) {
      const r = routeFor(p);
      if (!r || recent.some((e) => e.path === p)) continue;
      const e = pageOf(r);
      add('Pages', e);
      out.about.set(e, r.description);
    }
    return out;
  });
  const flat = createMemo(() => view().sections.flatMap((g) => view().rows.get(g)!));
  // Where each section's results start in the list the arrows walk.
  const starts = createMemo(() => {
    const at: number[] = [];
    let n = 0;
    for (const g of view().sections) {
      at.push(n);
      n += view().rows.get(g)!.length;
    }
    return at;
  });

  // The edge goes to the result in focus: straight there when the list itself changed.
  const placeEdge = (instant: boolean) => {
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
  // A new query starts at its best result; the same query's list redrawn (the index arriving under the
  // pages offered) keeps the result in focus.
  let listed: string | null = null;
  createEffect(
    on(flat, (rows, before) => {
      const kept = query() === listed ? before?.[at()]?.path : undefined;
      listed = query();
      const i = kept ? rows.findIndex((e) => e.path === kept) : -1;
      setAt(i >= 0 ? i : 0);
      queueMicrotask(() => placeEdge(true));
    }),
  );
  createEffect(on(at, () => placeEdge(false), { defer: true }));

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
          listed = null;
          setQuery('');
          setRound((r) => r + 1);
          lockPage('search', true);
          if (!index()) load();
          if (again) {
            input?.focus();
            queueMicrotask(() => placeEdge(true));
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

  const pick = (e: IndexEntry | undefined, tab = false) => {
    if (!e) return;
    if (e.kind === 'external' || tab) {
      window.open(e.path, '_blank', 'noopener,noreferrer');
      if (e.kind === 'external') props.onClose();
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
    else if (e.key === 'Tab') {
      // Tab keeps to the panel: the box, and whichever buttons show (Close on a phone, Retry).
      const stops = [...(panel?.querySelectorAll<HTMLElement>('input, button') ?? [])].filter(
        (b) => !(b as HTMLButtonElement).disabled && getComputedStyle(b).display !== 'none',
      );
      const i = stops.indexOf(document.activeElement as HTMLElement);
      stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Once the panel is on the page: focus in the box, the edge on the first result.
  const Focus = () => {
    onMount(() => {
      input?.focus();
      placeEdge(true);
    });
    return null;
  };

  const status = () => {
    const q = query().trim();
    if (!q) return '';
    if (failed()) return "Search couldn't load.";
    if (!index()) return 'Loading';
    return `${flat().length} ${flat().length === 1 ? 'result' : 'results'}`;
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
            ref={panel}
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
                fallback={
                  <Show
                    when={!failed()}
                    fallback={
                      <div class="srch-none srch-fail">
                        <p>Search couldn't load.</p>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            load();
                            input?.focus();
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    }
                  >
                    <p class="srch-none">
                      {index() ? `Nothing matches "${query().trim()}". Try fewer or shorter words.` : 'Loading...'}
                    </p>
                  </Show>
                }
              >
                <For each={view().sections}>
                  {(section, k) => (
                    <div role="group" aria-label={section}>
                      <p class="caps srch-g" aria-hidden="true">{section}</p>
                      <For each={view().rows.get(section) ?? []}>
                        {(entry, j) => {
                          const i = () => starts()[k()] + j();
                          const terms = () => view().terms.get(entry) ?? [];
                          const said = () => view().about.get(entry) ?? (query().trim() ? snippet(entry, terms()) : '');
                          return (
                            <div
                              id={`srch-o-${i()}`}
                              role="option"
                              class="srch-o"
                              aria-selected={at() === i() ? 'true' : 'false'}
                              style={{ '--i': Math.min(i(), 12) }}
                              onMouseMove={() => at() !== i() && setAt(i())}
                              onClick={(ev) => pick(entry, ev.ctrlKey || ev.metaKey)}
                            >
                              <span class="t"><Marked text={entry.title} terms={terms()} /></span>
                              <span class="c caps">{place(entry, !query().trim())}</span>
                              <Show when={said()}>
                                <span class="d"><Marked text={said()} terms={terms()} /></span>
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
            <p class="sr" role="status">{status()}</p>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
