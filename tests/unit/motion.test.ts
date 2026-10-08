import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armReveals } from '../../src/app/shell/motion';

let observed: Element[] = [];
let callback: IntersectionObserverCallback;

class StubObserver {
  constructor(cb: IntersectionObserverCallback) {
    callback = cb;
  }
  observe(el: Element) {
    observed.push(el);
  }
  unobserve(el: Element) {
    observed = observed.filter((o) => o !== el);
  }
  disconnect() {
    observed = [];
  }
  takeRecords() {
    return [];
  }
}

const fire = (el: Element) =>
  callback([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);

const rect = (el: Element, top: number) => {
  el.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) });
};

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

const page = () => {
  document.body.innerHTML = '<div id="s"><p id="a"></p><p id="b"></p><p id="c"></p></div>';
  const [a, b, c] = ['a', 'b', 'c'].map((id) => document.getElementById(id)!);
  return { scope: document.getElementById('s')!, a, b, c };
};

beforeEach(() => {
  observed = [];
  vi.useFakeTimers();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = StubObserver;
  setMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('armReveals', () => {
  it('hides only what starts below the screen', () => {
    const { scope, a, b } = page();
    rect(a, 100);
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    expect(a.classList.contains('rv')).toBe(true);
    expect(a.classList.contains('pre')).toBe(false);
    expect(b.classList.contains('pre')).toBe(true);
    expect(observed).toEqual([b]);
  });

  it('reveals an element when it comes into view', () => {
    const { scope, a, b } = page();
    rect(a, 10);
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    fire(b);
    vi.runAllTimers();
    expect(b.classList.contains('pre')).toBe(false);
    expect(observed).toEqual([]);
  });

  it('staggers siblings that come into view together', () => {
    const { scope, a, b, c } = page();
    [a, b, c].forEach((el) => rect(el, window.innerHeight + 50));
    armReveals(scope, 'p');
    fire(a);
    fire(b);
    vi.advanceTimersByTime(1);
    expect(a.classList.contains('pre')).toBe(false);
    expect(b.classList.contains('pre')).toBe(true);
    vi.advanceTimersByTime(70);
    expect(b.classList.contains('pre')).toBe(false);
  });

  it('reveals what is on screen once the page is scrolled to the bottom', () => {
    const { scope, a, b } = page();
    rect(a, window.innerHeight + 10);
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    rect(a, window.innerHeight - 40);
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: window.innerHeight + 100, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    vi.runAllTimers();
    expect(a.classList.contains('pre')).toBe(false);
    expect(b.classList.contains('pre')).toBe(true);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('never hides a section a hash jump has already brought on screen', () => {
    const { scope, a, b } = page();
    rect(a, -300);
    rect(b, 40);
    armReveals(scope, 'p');
    expect(a.classList.contains('pre')).toBe(false);
    expect(b.classList.contains('pre')).toBe(false);
  });

  it('does nothing under reduced motion', () => {
    setMotion(true);
    const { scope, a, b } = page();
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    expect(a.className).toBe('');
    expect(b.className).toBe('');
  });

  it('shows everything again when disposed', () => {
    const { scope, a, b } = page();
    rect(a, 10);
    rect(b, window.innerHeight + 10);
    const dispose = armReveals(scope, 'p');
    dispose();
    expect(b.classList.contains('pre')).toBe(false);
  });
});
