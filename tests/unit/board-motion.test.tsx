import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { ClearPort } from '../../src/app/pages/dashboard/PortDiagram';

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

let seen: ((...on: boolean[]) => void) | null;

beforeEach(() => {
  seen = null;
  setMotion(false);
  vi.useFakeTimers();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(el: Element) {
        seen = (...on) => this.cb(on.map((o) => ({ target: el, isIntersecting: o }) as unknown as IntersectionObserverEntry), this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const board = (c: HTMLElement) => c.querySelector('svg.boxd')!;
const out = (c: HTMLElement) => board(c).classList.contains('unplug');

describe('the unplug step', () => {
  it('draws the cable to pull as the cable to this computer, and the cross an empty socket gets', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    expect(container.querySelector('[data-cable]')?.classList.contains('pc')).toBe(true);
    expect(container.querySelector('text.to')?.classList.contains('unp')).toBe(true);
    expect(container.querySelectorAll('path.x.unp')).toHaveLength(1);
  });

  it('pulls the cable out again and again while on screen', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    seen!(true);
    expect(out(container)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(out(container)).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(out(container)).toBe(false);
    expect(board(container).classList.contains('fading')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(out(container)).toBe(true);
  });

  it('stops off screen with the cable back in', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    seen!(true);
    vi.advanceTimersByTime(1000);
    seen!(false);
    expect(out(container)).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(out(container)).toBe(false);
  });

  it('goes by the latest of entries that come together', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    seen!(false, true);
    vi.advanceTimersByTime(1000);
    expect(out(container)).toBe(true);
    seen!(true, false);
    vi.advanceTimersByTime(10000);
    expect(out(container)).toBe(false);
  });

  it('shows the cable out and still under reduced motion', () => {
    setMotion(true);
    const { container } = render(() => <ClearPort socket="usb1" />);
    expect(out(container)).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(out(container)).toBe(true);
  });
});
