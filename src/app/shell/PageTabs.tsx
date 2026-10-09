import { createContext, createEffect, createSignal, For, on, onCleanup, onMount, useContext, type JSX } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { fontsReady } from './motion';
import { openPanels } from './panelMotion';

export interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface TabsContext {
  active: () => string;
  id: string;
}

const Ctx = createContext<TabsContext>();

// The tab holding an element, from its id.
const paneOf = (id: string): string | null =>
  document.getElementById(id)?.closest<HTMLElement>('[data-pane]')?.dataset.pane ?? null;

// A page's tabs: a sticky strip with a sliding mark and one tab stop (arrows, Home and End move along
// it). The hash names the open tab (#options); an id inside a closed tab opens that tab (#o-emit), and
// one that names a tab still disabled opens it once it is enabled.
export function PageTabs(props: { id: string; tabs: Tab[]; children: JSX.Element }) {
  const location = useLocation();
  const enabled = (key: string) => props.tabs.some((t) => t.key === key && !t.disabled);
  const first = () => props.tabs.find((t) => !t.disabled)?.key ?? props.tabs[0].key;
  const [active, setActive] = createSignal(first());
  const [pending, setPending] = createSignal<string | null>(null);
  let strip: HTMLDivElement | undefined;
  let mark: HTMLSpanElement | undefined;

  const open = (key: string, write = false): boolean => {
    if (!enabled(key)) return false;
    setActive(key);
    setPending(null);
    if (write) history.replaceState(history.state, '', `${location.pathname}#${key}`);
    return true;
  };

  const fromHash = (hash: string) => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) return;
    const key = props.tabs.some((t) => t.key === id) ? id : paneOf(id);
    if (key && !open(key)) setPending(key);
  };

  createEffect(on(() => location.hash, (h) => queueMicrotask(() => fromHash(h))));
  // A tab named before it was enabled opens when it is; a tab disabled while open gives way to the first.
  createEffect(() => {
    const p = pending();
    if (p && enabled(p)) open(p);
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
      <div class="ptabs" role="tablist" ref={strip} onScroll={atEnd} onKeyDown={onKey}>
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
                // From further down the page, the open tab starts at the strip.
                const top = strip!.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(strip!).top || '0');
                if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
              }}
            >
              {t.label}
            </button>
          )}
        </For>
      </div>
      <Ctx.Provider value={{ active, id: props.id }}>{props.children}</Ctx.Provider>
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
  createEffect(on(shown, (s) => s && requestAnimationFrame(() => el && openPanels(el))));
  onMount(() => {
    if (typeof MutationObserver === 'undefined' || !el) return;
    const mo = new MutationObserver((records) => {
      if (!shown() || !el) return;
      const added = records.flatMap((r) => [...r.addedNodes]).filter((n): n is HTMLElement => n instanceof HTMLElement);
      const panels = added.flatMap((n) => (n.matches('.pn') ? [n] : [...n.querySelectorAll<HTMLElement>('.pn')]));
      if (panels.length) requestAnimationFrame(() => el && openPanels(el, panels));
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
