import { afterEach, describe, it, expect, vi } from 'vitest';
import { carryArrival, introElapsed, resumeIntro } from '../../src/app/shell/takeover';

// As an Animation is: setting where it started moves where it is now.
const anim = (name: string | null, currentTime: number, iterations = 1, target: Element = document.createElement('div')) => ({
  ...(name === null ? { transitionProperty: 'color' } : { animationName: name }),
  currentTime,
  set startTime(at: number) {
    this.currentTime = performance.now() - at;
  },
  effect: { getTiming: () => ({ iterations }), target },
});
const doc = (list: ReturnType<typeof anim>[]) => ({ getAnimations: () => list }) as unknown as Document;

describe('takeover', () => {
  it('reads how far the snapshot intro has run, from its finite animations', () => {
    expect(introElapsed(doc([anim('up', 640), anim('pulse', 9000, Infinity), anim(null, 5000)]))).toBe(640);
    expect(introElapsed(doc([]))).toBe(0);
  });

  it('moves the app copy of the intro to where the snapshot was, never back, and leaves the rest', () => {
    const list = [anim('up', 0), anim('rise', 900), anim('pulse', 0, Infinity), anim(null, 0), anim('fade', 0, 1, document.createElement('canvas'))];
    resumeIntro(640, doc(list));
    expect(list.map((a) => a.currentTime)).toEqual([640, 900, 0, 0, 0]);
  });
});

describe('carryArrival', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const page = (arriving: boolean) => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    const main = document.createElement('main');
    if (arriving) main.classList.add('arriving');
    main.innerHTML = '<header class="page-header"><h1>Device</h1></header><section class="doc-section"><p>a</p><p>b</p></section>';
    let list = [anim('up', 300), anim('rise', 240)];
    main.getAnimations = (() => list) as unknown as typeof main.getAnimations;
    const redraw = () => {
      main.innerHTML = '<header class="page-header"><h1>Device</h1></header><section class="doc-section"><p>a</p><p>b</p></section>';
      list = [anim('up', 0), anim('rise', 0), anim('pulse', 0, Infinity)];
    };
    return { main, redraw, now: () => list };
  };

  it('takes a page drawn again while it arrives up where the arrival was, its blocks stamped in reading order', async () => {
    vi.useFakeTimers();
    const { main, redraw, now } = page(true);
    const carry = carryArrival(main);
    redraw();
    carry();
    const blocks = [...main.querySelectorAll<HTMLElement>('.doc-section p')];
    expect(blocks.map((b) => b.classList.contains('moving'))).toEqual([true, true]);
    expect(blocks.map((b) => b.style.getPropertyValue('--d'))).toEqual(['255ms', '310ms']);
    await Promise.resolve();
    expect(now().map((a) => a.currentTime >= 300)).toEqual([true, true, false]);
  });

  it('leaves a page drawn again once its arrival is over to the motion of a change', async () => {
    vi.useFakeTimers();
    const { main, redraw, now } = page(false);
    const carry = carryArrival(main);
    redraw();
    carry();
    await Promise.resolve();
    expect(main.querySelector('.moving')).toBeNull();
    expect(now().map((a) => a.currentTime)).toEqual([0, 0, 0]);
  });

  it('holds a panel drawn again after the arrival still where it says the same, and its frame where only its contents changed', async () => {
    const main = document.createElement('main');
    const panels = (body: string) =>
      `<div class="pn"><div class="ph">Your box</div><div class="pb">${body}</div></div><div class="pn"><div class="ph">Status</div><div class="pb">Linked</div></div>`;
    main.innerHTML = panels('Connect');
    main.getAnimations = (() => []) as unknown as typeof main.getAnimations;
    const carry = carryArrival(main);
    main.innerHTML = panels('Desk, connected') + '<div class="pn"><div class="ph">Performance</div><div class="pb">1000 Hz</div></div>';
    carry();
    const marks = [...main.querySelectorAll<HTMLElement>('.pn')].map((p) => p.dataset.still ?? null);
    expect(marks).toEqual(['frame', 'all', null]);
  });
});

