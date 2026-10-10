import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { A, MemoryRouter, Route, createMemoryHistory, useBeforeLeave, useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { holdHistory, useLeaveFade } from '../../src/app/shell/leave';

const [flashing, setFlashing] = createSignal(false);

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

let go: (to: string | number, replace?: boolean) => void = () => {};
// As DocsLayout does: a flash in progress holds the reader on the page.
// Pages whose code is in; a test fetches another page's code by resolving `arrive`.
let pages: { loaded: (path: string) => boolean; load: (path: string) => Promise<unknown>; whole: (href: string) => void } | undefined;
const Root = (props: { children?: unknown }) => {
  useLeaveFade(flashing, pages);
  useBeforeLeave((e) => {
    if (flashing()) e.preventDefault();
  });
  const navigate = useNavigate();
  go = (to, replace) => (typeof to === 'number' ? navigate(to) : navigate(to, { replace }));
  return <>{props.children}</>;
};

const mount = (path = '/a') => {
  const history = createMemoryHistory();
  history.set({ value: path });
  const r = render(() => (
    <MemoryRouter history={history} root={Root}>
      <Route path="/a" component={() => <p>page a <A href="/b">to b</A></p>} />
      <Route path="/b" component={() => <p>page b</p>} />
      <Route path="/c" component={() => <p>page c</p>} />
    </MemoryRouter>
  ));
  return { ...r, history };
};

const leaving = () => document.documentElement.classList.contains('leaving');
const waiting = () => document.documentElement.classList.contains('waiting');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  pages = undefined;
  vi.useFakeTimers();
  setMotion(false);
  setFlashing(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('leaving', 'waiting');
});

describe('useLeaveFade', () => {
  it('fades the page out before a link takes the reader to another page', async () => {
    const r = mount();
    go('/b');
    expect(leaving()).toBe(true);
    expect(r.container.textContent).toContain('page a');
    await vi.advanceTimersByTimeAsync(120);
    expect(r.container.textContent).toContain('page b');
    expect(leaving()).toBe(false);
  });

  it('goes at once to a section of the same page', async () => {
    const r = mount();
    go('/a#later');
    expect(leaving()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.history.get()).toBe('/a#later');
  });

  it('goes at once under reduced motion', async () => {
    setMotion(true);
    const r = mount();
    go('/b');
    expect(leaving()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.textContent).toContain('page b');
  });

  it('leaves a navigation a flash is blocking to the block', async () => {
    setFlashing(true);
    const r = mount();
    go('/b');
    expect(leaving()).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(r.container.textContent).toContain('page a');
  });

  it('goes where the second click asked when the reader clicks again during the fade', async () => {
    const r = mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(40);
    go('/c');
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/c');
  });

  it('takes a double-click as one navigation, and still fades and guards the next', async () => {
    const r = mount();
    go('/b');
    go('/b');
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/b');
    setFlashing(true);
    go('/c');
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/b');
  });

  it('lets a flash that began during the fade hold the reader on the page', async () => {
    const r = mount();
    go('/b');
    setFlashing(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/a');
  });

  it('goes at once on a redirect, which replaces the page rather than leaving it', async () => {
    const r = mount();
    go('/b', true);
    expect(leaving()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.textContent).toContain('page b');
  });

  it('holds a navigation until the code of the page is in, and after the fade when it comes sooner', async () => {
    let arrive = () => {};
    const have = new Set(['/a']);
    pages = { loaded: (p) => have.has(p), load: (p) => new Promise<void>((r) => (arrive = () => (have.add(p), r()))), whole: vi.fn() };
    const r = mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(500);
    expect(r.container.textContent).toContain('page a');
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.textContent).toContain('page b');
  });

  it('waits for the code under reduced motion too, without the fade', async () => {
    setMotion(true);
    let arrive = () => {};
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), whole: vi.fn() };
    const r = mount();
    go('/b');
    expect(leaving()).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(r.container.textContent).toContain('page a');
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.textContent).toContain('page b');
  });

  it('goes to the last page asked for when two wait on their code', async () => {
    const waits: (() => void)[] = [];
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => waits.push(r)), whole: vi.fn() };
    const r = mount();
    go('/b');
    go('/c');
    waits[1]();
    await vi.advanceTimersByTimeAsync(200);
    waits[0]();
    await vi.advanceTimersByTimeAsync(200);
    expect(r.container.textContent).toContain('page c');
  });

  it('keeps the page faded while its code comes, and shows the new page once it is in', async () => {
    let arrive = () => {};
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), whole: vi.fn() };
    const r = mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(2000);
    expect(leaving()).toBe(true);
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(r.container.textContent).toContain('page b');
    expect(leaving()).toBe(false);
  });

  it('shows the page again when a flash that began while its code came holds the reader there', async () => {
    let arrive = () => {};
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), whole: vi.fn() };
    const r = mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(300);
    setFlashing(true);
    arrive();
    await vi.advanceTimersByTimeAsync(1000);
    expect(r.history.get()).toBe('/a');
    expect(leaving()).toBe(false);
  });

  it('loads the page whole, at the address asked for, when its code will not come', async () => {
    const whole = vi.fn();
    pages = { loaded: (p) => p === '/a', load: () => Promise.reject(new Error('gone')), whole };
    const r = mount();
    go('/b?x=1#later');
    await vi.advanceTimersByTimeAsync(200);
    expect(whole).toHaveBeenCalledTimes(1);
    expect(whole.mock.calls[0][0]).toMatch(/\/b\?x=1#later$/);
    expect(r.history.get()).toBe('/a');
  });

  it('waits on slow code, and loads the page whole only when it has not come in a minute', async () => {
    const whole = vi.fn();
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>(() => {}), whole };
    mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(59_000);
    expect(whole).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(whole).toHaveBeenCalledTimes(1);
  });

  it('shows the page again before loading the next one whole, so a refused leave leaves it readable', async () => {
    const seen: boolean[] = [];
    const whole = vi.fn(() => seen.push(leaving() || waiting()));
    pages = { loaded: (p) => p === '/a', load: () => Promise.reject(new Error('gone')), whole };
    mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(200);
    expect(seen).toEqual([false]);
  });

  it('stays on the page, readable, when the code cannot come because the line is down', async () => {
    const whole = vi.fn();
    pages = { loaded: (p) => p === '/a', load: () => Promise.reject(new Error('offline')), whole };
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const r = mount();
    go('/b');
    await vi.advanceTimersByTimeAsync(200);
    expect(whole).not.toHaveBeenCalled();
    expect(r.history.get()).toBe('/a');
    expect(leaving() || waiting()).toBe(false);
  });

  it('leaves a navigation asked for during a flash to the flash, even when the flash ends while its code comes', async () => {
    let arrive = () => {};
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), whole: vi.fn() };
    setFlashing(true);
    const r = mount();
    go('/b');
    setFlashing(false);
    arrive();
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/a');
  });
});

describe('holdHistory', () => {
  let saw: string[] = [];
  let off = () => {};
  const router = () => saw.push(location.pathname);
  const step = (path: string) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  };

  beforeEach(() => {
    history.replaceState(null, '', '/a');
    saw = [];
  });
  afterEach(() => {
    off();
    window.removeEventListener('popstate', router);
  });

  it('hands back and forward on at once to a page whose code is in', () => {
    off = holdHistory({ loaded: () => true, load: () => Promise.resolve(), reload: vi.fn(), live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    expect(saw).toEqual(['/b']);
  });

  it('holds back and forward until the code of the page is in, then hands them on once', async () => {
    let arrive = () => {};
    off = holdHistory({ loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), reload: vi.fn(), live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    expect(saw).toEqual([]);
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(saw).toEqual(['/b']);
  });

  it('hands on only the last of two that wait on their code', async () => {
    const waits: (() => void)[] = [];
    off = holdHistory({ loaded: (p) => p === '/a', load: () => new Promise<void>((r) => waits.push(r)), reload: vi.fn(), live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    step('/c');
    waits[1]();
    await vi.advanceTimersByTimeAsync(0);
    waits[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(saw).toEqual(['/c']);
  });

  it('loads the page afresh when its code will not come', async () => {
    const reload = vi.fn();
    off = holdHistory({ loaded: (p) => p === '/a', load: () => Promise.reject(new Error('gone')), reload, live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(saw).toEqual([]);
  });

  it('leaves history to the browser while the app is not up, as on a snapshot whose code never came', () => {
    const load = vi.fn(() => Promise.resolve());
    off = holdHistory({ loaded: () => false, load, reload: vi.fn(), live: () => false });
    window.addEventListener('popstate', router);
    step('/a#later');
    expect(saw).toEqual(['/a']);
    expect(load).not.toHaveBeenCalled();
  });

  it('hands history straight to the block of a flash in progress', () => {
    const load = vi.fn(() => new Promise<void>(() => {}));
    setFlashing(true);
    mount();
    off = holdHistory({ loaded: (p) => p === '/a', load, reload: vi.fn(), live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    expect(saw).toEqual(['/b']);
    expect(load).not.toHaveBeenCalled();
  });

  it('waits for the line to come back when the code cannot come offline, then goes on', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let tries = 0;
    const reload = vi.fn();
    off = holdHistory({ loaded: (p) => p === '/a', load: () => (++tries === 1 ? Promise.reject(new Error('offline')) : Promise.resolve()), reload, live: () => true });
    window.addEventListener('popstate', router);
    step('/b');
    await vi.advanceTimersByTimeAsync(100);
    expect(reload).not.toHaveBeenCalled();
    expect(saw).toEqual([]);
    online.mockReturnValue(true);
    dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saw).toEqual(['/b']);
  });

  it('takes a Back held for its code over a link that was waiting on its code', async () => {
    let arrive = () => {};
    pages = { loaded: (p) => p === '/a', load: () => new Promise<void>((r) => (arrive = r)), whole: vi.fn() };
    const r = mount();
    go('/b');
    off = holdHistory({ loaded: (p) => p === '/a', load: () => new Promise<void>(() => {}), reload: vi.fn(), live: () => true });
    window.addEventListener('popstate', router);
    step('/c');
    arrive();
    await vi.advanceTimersByTimeAsync(300);
    expect(r.history.get()).toBe('/a');
  });
});

