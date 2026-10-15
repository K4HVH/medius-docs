import { createComputed, createSignal, on } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { landingId } from '../routes';

// Where the reader was on each page of this tab's history. Back, Forward and a reload return there; a new
// page opens at its top, or at its hash (the page lands on that itself). Within the app, the app restores
// the place, because the browser would restore it before the app had drawn the page. Across a reload or a
// return from another site, the browser restores it, before any script runs. Places are kept per history
// entry (the router's depth and the path) for the life of the tab.

const KEY = 'medius.scroll';
const read = (): Record<string, number> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

let places: Record<string, number> = {};
let fromHistory = false;
// The first page's opening, decided at boot (keepPlaces), before the app draws over the snapshot.
let booted = false;
// While a place is being restored, the scroll positions passed on the way aren't saved as the page's place.
let settling = false;
let stopSettling = () => {};
let saving: ReturnType<typeof setTimeout> | undefined;

// The history entry shown. Read when needed: a page change is decided before the router has stamped the
// new entry, and a scroll comes after it.
const entry = () => `${(history.state as { _depth?: number } | null)?._depth ?? history.length - 1}:${location.pathname}`;
const keep = () => {
  if (settling) return;
  places[entry()] = Math.round(window.scrollY);
  clearTimeout(saving);
  saving = setTimeout(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(places));
    } catch {
      // Kept only for this page's life.
    }
  }, 200);
};

const [opening, setOpening] = createSignal<number | null>(0);
const [back, setBack] = createSignal(false);
const [y, setY] = createSignal(typeof window === 'undefined' ? 0 : window.scrollY);
if (typeof window !== 'undefined') window.addEventListener('scroll', () => setY(window.scrollY), { passive: true });

// Where the page shown opens: a place to scroll to at once, or null when its hash says where.
export const openingAt = opening;
// Whether the page shown came by Back or Forward (a link on the same page glides instead).
export const openedByHistory = back;
// How far the page shown is scrolled, known as the page changes and before it has scrolled there.
export const pageY = y;

// Decides where a page opens, before it draws: Back or Forward returns to the kept place; otherwise the top,
// the hash, or the item or place an address inside a page names.
export function decideOpening(hash: string): number | null {
  stopSettling();
  const traversed = fromHistory;
  fromHistory = false;
  // Back and Forward have moved the history to the entry shown by now, so its place is read from it.
  const kept = traversed ? places[entry()] : undefined;
  const at = kept !== undefined ? kept : hash ? null : 0;
  setBack(traversed);
  setOpening(at);
  if (at !== null) setY(at);
  // A page opened by a link saves its place once the router has named its entry, even if it never scrolls.
  // Otherwise an entry an earlier visit left at that depth would lend it a stale place.
  if (!traversed) setTimeout(keep, 0);
  return at;
}

// Scrolls the page shown to `top`, and again as late content (a table a fetch fills) makes room for it,
// until it is there, the reader takes over, or 10 s pass.
export function settleAt(top: number): void {
  stopSettling();
  settling = true;
  window.scrollTo({ top, left: 0, behavior: 'instant' });
  if (top <= 0 || Math.abs(window.scrollY - top) < 2 || typeof ResizeObserver === 'undefined') {
    settling = false;
    return;
  }
  const intent = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const ro = new ResizeObserver(() => {
    window.scrollTo({ top, left: 0, behavior: 'instant' });
    if (Math.abs(window.scrollY - top) < 2) stopSettling();
  });
  const timer = setTimeout(() => stopSettling(), 10_000);
  stopSettling = () => {
    ro.disconnect();
    clearTimeout(timer);
    for (const k of intent) window.removeEventListener(k, stopSettling);
    settling = false;
    stopSettling = () => {};
    keep();
  };
  ro.observe(document.body);
  for (const k of intent) window.addEventListener(k, stopSettling, { passive: true });
}

export function keepPlaces(): () => void {
  places = read();
  const manual = () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  };
  const handBack = () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  };
  manual();
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  fromHistory = nav?.type === 'reload' || nav?.type === 'back_forward';
  decideOpening(landingId(location.pathname, location.hash));
  booted = true;
  const onPop = () => {
    fromHistory = true;
  };
  window.addEventListener('scroll', keep, { passive: true });
  window.addEventListener('popstate', onPop);
  window.addEventListener('pagehide', handBack);
  window.addEventListener('pageshow', manual);
  return () => {
    clearTimeout(saving);
    stopSettling();
    window.removeEventListener('scroll', keep);
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('pagehide', handBack);
    window.removeEventListener('pageshow', manual);
  };
}

// Decides each page change before the page draws (in the app's root), so the page and the bar over it agree
// from the first frame.
export function useScrollPlace(): void {
  const location = useLocation();
  createComputed(
    on(
      () => [location.pathname, location.hash] as const,
      ([path, hash], before) => {
        if (before || !booted) decideOpening(landingId(path, hash));
      },
    ),
  );
}
