import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps its places for the life of the page, so each test loads it afresh.
const load = () => import('../../src/app/shell/scrollPlace');
const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};
const push = (depth: number, path: string) => history.pushState({ _depth: depth }, '', path);
const pop = (depth: number, path: string) => {
  history.replaceState({ _depth: depth }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(history, 'scrollRestoration', { value: 'auto', writable: true, configurable: true });
  vi.useFakeTimers();
  sessionStorage.clear();
  history.replaceState({ _depth: 0 }, '', '/guide');
  scrollTo(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('scrollPlace', () => {
  it('opens a new page at its top, or where its hash says', async () => {
    const m = await load();
    const off = m.keepPlaces();
    push(1, '/native');
    expect(m.decideOpening('')).toBe(0);
    push(2, '/native/frame#crc');
    expect(m.decideOpening('#crc')).toBeNull();
    off();
  });

  it('returns Back and Forward to where the reader left each page', async () => {
    const m = await load();
    const off = m.keepPlaces();
    scrollTo(600);
    push(1, '/native');
    expect(m.decideOpening('')).toBe(0);
    scrollTo(240);
    pop(0, '/guide');
    expect(m.decideOpening('')).toBe(600);
    scrollTo(600);
    pop(1, '/native');
    expect(m.decideOpening('')).toBe(240);
    off();
  });

  it('keeps each page at its entry, though the router stamps a new entry after the page is decided', async () => {
    const m = await load();
    const off = m.keepPlaces();
    scrollTo(1000);
    history.pushState(null, '', '/');
    expect(m.decideOpening('')).toBe(0);
    history.replaceState({ _depth: 1 }, '', '/');
    scrollTo(0);
    scrollTo(1500);
    pop(0, '/guide');
    expect(m.decideOpening('')).toBe(1000);
    pop(1, '/');
    expect(m.decideOpening('')).toBe(1500);
    off();
  });

  it('tells the bar where the page opens before the page has scrolled there', async () => {
    const m = await load();
    const off = m.keepPlaces();
    scrollTo(900);
    push(1, '/');
    m.decideOpening('');
    expect(m.pageY()).toBe(0);
    off();
  });

  it("opens a tab loaded at an item's address at its item", async () => {
    history.replaceState({ _depth: 0 }, '', '/guide/help/bsod');
    const m = await load();
    const off = m.keepPlaces();
    expect(m.openingAt()).toBeNull();
    off();
  });

  it("keeps the place at an item's address across a reload", async () => {
    history.replaceState({ _depth: 0 }, '', '/guide/help/bsod');
    let m = await load();
    let off = m.keepPlaces();
    scrollTo(900);
    vi.advanceTimersByTime(500);
    off();
    vi.resetModules();
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload' }] as unknown as PerformanceEntryList);
    m = await load();
    off = m.keepPlaces();
    expect(m.openingAt()).toBe(900);
    off();
  });

  it('keeps the places across a reload of the tab', async () => {
    let m = await load();
    let off = m.keepPlaces();
    scrollTo(700);
    vi.advanceTimersByTime(500);
    off();
    vi.resetModules();
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload' }] as unknown as PerformanceEntryList);
    m = await load();
    off = m.keepPlaces();
    expect(m.openingAt()).toBe(700);
    off();
  });

  it('writes the top for a page opened at it, so a discarded entry at that depth never lends its place', async () => {
    const m = await load();
    const off = m.keepPlaces();
    history.pushState({ _depth: 1 }, '', '/native');
    m.decideOpening('');
    scrollTo(1500);
    pop(0, '/guide');
    m.decideOpening('');
    scrollTo(0);
    history.pushState({ _depth: 1 }, '', '/native');
    m.decideOpening('');
    vi.advanceTimersByTime(20);
    pop(0, '/guide');
    m.decideOpening('');
    pop(1, '/native');
    expect(m.decideOpening('')).toBe(0);
    off();
  });

  it('keeps going to a place the page is too short for yet, without keeping the place it was held at', async () => {
    const m = await load();
    const off = m.keepPlaces();
    let fits = false;
    let observed: ResizeObserverCallback = () => {};
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) {
        observed = cb;
      }
      observe() {}
      disconnect() {}
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(((o: ScrollToOptions) => scrollTo(fits ? (o.top ?? 0) : 335)) as typeof window.scrollTo);
    history.replaceState({ _depth: 0 }, '', '/dashboard/stats');
    scrollTo(721);
    history.pushState({ _depth: 1 }, '', '/guide');
    m.decideOpening('');
    pop(0, '/dashboard/stats');
    expect(m.decideOpening('')).toBe(721);
    m.settleAt(721);
    expect(window.scrollY).toBe(335);
    fits = true;
    observed([], {} as ResizeObserver);
    expect(window.scrollY).toBe(721);
    pop(1, '/guide');
    m.decideOpening('');
    pop(0, '/dashboard/stats');
    expect(m.decideOpening('')).toBe(721);
    vi.unstubAllGlobals();
    off();
  });

  it('hands restoring back to the browser as the page goes, so a reload opens in place before any script', async () => {
    const m = await load();
    const off = m.keepPlaces();
    expect(history.scrollRestoration).toBe('manual');
    window.dispatchEvent(new Event('pagehide'));
    expect(history.scrollRestoration).toBe('auto');
    window.dispatchEvent(new Event('pageshow'));
    expect(history.scrollRestoration).toBe('manual');
    off();
  });

  it('says whether the page came by Back or Forward, so a link on the same page can glide', async () => {
    const m = await load();
    const off = m.keepPlaces();
    history.pushState({ _depth: 1 }, '', '/native');
    m.decideOpening('');
    expect(m.openedByHistory()).toBe(false);
    pop(0, '/guide');
    m.decideOpening('');
    expect(m.openedByHistory()).toBe(true);
    off();
  });
});

