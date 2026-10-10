import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { A, MemoryRouter, Route, createMemoryHistory, useBeforeLeave, useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { useLeaveFade } from '../../src/app/shell/leave';

const [flashing, setFlashing] = createSignal(false);

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

let go: (to: string | number, replace?: boolean) => void = () => {};
// As DocsLayout does: a flash in progress holds the reader on the page.
const Root = (props: { children?: unknown }) => {
  useLeaveFade(flashing);
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

beforeEach(() => {
  vi.useFakeTimers();
  setMotion(false);
  setFlashing(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.classList.remove('leaving');
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
});
