import { createContext, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, useContext, type JSX } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { landingId, pagePath, placeAddress, routeFor } from '../routes';
import { fontsReady } from './motion';
import { openedByHistory } from './scrollPlace';
import { closePanels, openPanels } from './panelMotion';
import { CopyLink } from './CopyLink';

export interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface TabsContext {
  active: () => string;
  id: string;
  // Content arrived: an element the address named before it existed may be here now.
  arrived: () => void;
}

const Ctx = createContext<TabsContext>();

// The tab holding an element, from its id.
const paneOf = (id: string): string | null =>
  document.getElementById(id)?.closest<HTMLElement>('[data-pane]')?.dataset.pane ?? null;

// A page's tabs: a sticky bar holding the strip, with a sliding mark and one tab stop (arrows, Home and End
// move along it), and a link icon at its right end that copies the open tab's address. The address names the
// open tab (/dashboard/options, or #options). An address naming a place inside a closed tab opens that tab
// (/dashboard/emit-rate); one naming a disabled tab opens it once it is enabled.
export function PageTabs(props: { id: string; tabs: Tab[]; children: JSX.Element }) {
  const location = useLocation();
  const navigate = useNavigate();
  const enabled = (key: string) => props.tabs.some((t) => t.key === key && !t.disabled);
  const first = () => props.tabs.find((t) => !t.disabled)?.key ?? props.tabs[0].key;
  const [active, setActive] = createSignal(first());
  const [pending, setPending] = createSignal<string | null>(null);
  let bar: HTMLDivElement | undefined;
  let strip: HTMLDivElement | undefined;
  let mark: HTMLSpanElement | undefined;

  let writePending = false;
  // An element the address named, scrolled into view once its tab is open. The layout's jump finds it hidden,
  // or not there yet on a page that fetches its content.
  let target: string | null = null;
  // An id not on the page yet (a tab whose content waits for a box or a fetch) is looked for again as
  // content arrives, until the reader picks a tab.
  let unfound: string | null = null;
  let jump = 0;
  onCleanup(() => cancelAnimationFrame(jump));
  const open = (key: string, write = false): boolean => {
    if (!enabled(key)) return false;
    setActive(key);
    setPending(null);
    // Through the router, so a remount (a box change) and a later link to the same tab both see it.
    if (write) {
      const page = pagePath(location.pathname);
      const at = placeAddress(page, key);
      const search = location.search ?? '';
      navigate(at ? at + search : `${page}${search}#${key}`, { replace: true, scroll: false });
      unfound = null;
    }
    const id = target;
    target = null;
    if (id) jump = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    return true;
  };

  const fromId = (id: string) => {
    if (!id) return;
    const named = props.tabs.some((t) => t.key === id);
    const key = named ? id : paneOf(id);
    target = named ? null : id;
    unfound = key ? null : id;
    // A hash naming a tab is rewritten as the tab's address (as a click would write it), now or once the tab opens.
    writePending = named && location.hash.length > 1;
    if (key && !open(key, writePending)) setPending(key);
  };
  const arrived = () => {
    if (unfound && document.getElementById(unfound)) fromId(unfound);
  };

  // The address's place, kept while only its spelling changes (#id written as /page/id).
  const wanted = createMemo(() => landingId(location.pathname, location.hash));
  createEffect(on(wanted, (id) => queueMicrotask(() => fromId(id))));
  // A tab named before it was enabled opens once enabled; a tab disabled while open gives way to the first.
  createEffect(() => {
    const p = pending();
    // Not on Back or Forward: the write would cut short the return to where the reader was.
    if (p && enabled(p)) open(p, writePending && !openedByHistory());
    else if (!enabled(active())) setActive(first());
  });

  const place = (instant = false) => {
    const b = strip?.querySelector<HTMLButtonElement>('button[aria-selected="true"]');
    if (!b || !mark || !strip?.offsetParent) return;
    const cs = getComputedStyle(b);
    if (instant) mark.style.transition = 'none';
    mark.style.left = `${b.offsetLeft + parseFloat(cs.paddingLeft)}px`;
    mark.style.width = `${b.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)}px`;
    if (instant) {
      void mark.offsetWidth;
      mark.style.transition = '';
    }
    if (strip.scrollWidth > strip.clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    atEnd();
  };
  // A strip wider than the screen fades its last tabs until it is scrolled to the end.
  const atEnd = () => {
    if (strip) strip.classList.toggle('end', strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2);
  };

  let placed = false;
  createEffect(
    on(active, () =>
      requestAnimationFrame(() => {
        place(!placed);
        placed = true;
      }),
    ),
  );
  onMount(() => {
    void fontsReady().then(() => place(true));
    const onResize = () => place(true);
    window.addEventListener('resize', onResize);
    onCleanup(() => window.removeEventListener('resize', onResize));
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
    const bs = [...(strip?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const to = { ArrowRight: (i + 1) % bs.length, ArrowLeft: (i + bs.length - 1) % bs.length, Home: 0, End: bs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    bs[to].focus();
    open(bs[to].dataset.tab!, true);
  };

  return (
    <>
      {/* The tabs' count and letters let the stylesheet space them to fit the bar before it scrolls. */}
      <div
        class="ptabs"
        ref={bar}
        style={{ '--tab-n': props.tabs.length, '--tab-chars': props.tabs.reduce((n, t) => n + t.label.length, 0) }}
      >
        <div class="ptabs-list" role="tablist" aria-label={routeFor(pagePath(location.pathname))?.title} ref={strip} onScroll={atEnd} onKeyDown={onKey}>
          <span class="ind" ref={mark} aria-hidden="true" />
          <For each={props.tabs}>
            {(t) => (
              <button
                type="button"
                role="tab"
                id={`tab-${props.id}-${t.key}`}
                aria-controls={`pane-${props.id}-${t.key}`}
                aria-selected={active() === t.key}
                tabIndex={active() === t.key ? 0 : -1}
                disabled={t.disabled}
                data-tab={t.key}
                onClick={() => {
                  if (!open(t.key, true)) return;
                  // Clicked further down the page, the open tab starts at the top of its pane, under the stuck bar.
                  // The bar's position can't give that point: while stuck, the bar is always at the top.
                  const pane = document.getElementById(`pane-${props.id}-${t.key}`);
                  if (!pane || !bar) return;
                  const top = pane.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - parseFloat(getComputedStyle(bar).top || '0');
                  if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
                }}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>
        <CopyLink
          id={active()}
          label={props.tabs.find((t) => t.key === active())?.label ?? active()}
          to={placeAddress(pagePath(location.pathname), active()) ?? `${pagePath(location.pathname)}#${active()}`}
        />
      </div>
      <Ctx.Provider value={{ active, id: props.id, arrived }}>{props.children}</Ctx.Provider>
    </>
  );
}

// One tab's content. Opening it brings its panels in; panels added while it is open (a box connecting)
// come in as they appear.
export function Pane(props: { key: string; children: JSX.Element }) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Pane must be inside PageTabs');
  let el: HTMLElement | undefined;
  const shown = () => ctx.active() === props.key;
  createEffect(on(shown, (s) => s && el && openPanels(el)));
  onCleanup(() => el && closePanels(el));
  onMount(() => {
    if (typeof MutationObserver === 'undefined' || !el) return;
    const mo = new MutationObserver((records) => {
      const added = records.flatMap((r) => [...r.addedNodes]).filter((n): n is HTMLElement => n instanceof HTMLElement);
      if (added.length) ctx.arrived();
      if (!shown() || !el) return;
      const panels = added.flatMap((n) => (n.matches('.pn') ? [n] : [...n.querySelectorAll<HTMLElement>('.pn')]));
      if (panels.length) openPanels(el, panels);
    });
    mo.observe(el, { childList: true, subtree: true });
    onCleanup(() => mo.disconnect());
  });
  return (
    <section
      ref={el}
      class="pane"
      data-pane={props.key}
      id={`pane-${ctx.id}-${props.key}`}
      role="tabpanel"
      aria-labelledby={`tab-${ctx.id}-${props.key}`}
      hidden={!shown()}
    >
      {props.children}
    </section>
  );
}
