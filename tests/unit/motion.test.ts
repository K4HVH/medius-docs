import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARRIVAL_MS, arrive, armReveals, inOrder, pageArrival, watchChanges } from '../../src/app/shell/motion';

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

const fire = (...els: Element[]) =>
  callback(els.map((el) => ({ target: el, isIntersecting: true }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver);

const rect = (el: Element, top: number) => {
  el.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) });
};

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

const page = () => {
  document.body.innerHTML =
    '<div id="s"><p id="a"></p><p id="b"></p><div class="table-scroll" id="c"><table><tbody><tr></tr><tr></tr></tbody></table></div></div>';
  const [a, b, c] = ['a', 'b', 'c'].map((id) => document.getElementById(id)!);
  return { scope: document.getElementById('s')!, a, b, c };
};

const delay = (el: Element) => (el as HTMLElement).style.getPropertyValue('--d');

beforeEach(() => {
  observed = [];
  vi.useFakeTimers();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = StubObserver;
  setMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('arrive', () => {
  it('starts each block after the one before it, in reading order', () => {
    const { scope, a, b, c } = page();
    arrive(scope, inOrder([a, b, c], 200, 55));
    expect([a, b, c].map(delay)).toEqual(['200ms', '255ms', '310ms']);
    expect(scope.classList.contains('arriving')).toBe(true);
  });

  it('brings a table in row by row instead of as one block', () => {
    const { scope, a, c } = page();
    arrive(scope, inOrder([a, c], 0, 50));
    expect(a.classList.contains('rb')).toBe(true);
    expect(c.classList.contains('rt')).toBe(true);
    expect(c.classList.contains('rb')).toBe(false);
    expect([...c.querySelectorAll('tr')].map((tr) => tr.style.getPropertyValue('--r'))).toEqual(['0', '1']);
  });

  it('stops counting after the cap, so a long page does not keep its last blocks waiting', () => {
    const els = Array.from({ length: 20 }, () => document.createElement('p'));
    const scope = document.createElement('div');
    scope.append(...els);
    arrive(scope, inOrder(els, 100, 10, 5));
    expect(delay(els[19])).toBe('150ms');
  });

  it('ends the arrival once every block has risen', () => {
    const { scope, a } = page();
    arrive(scope, inOrder([a], 0, 0));
    vi.advanceTimersByTime(ARRIVAL_MS);
    expect(scope.classList.contains('arriving')).toBe(false);
  });

  it('moves a block only during the arrival that stamped it, so a later arrival in the same scope leaves it still', () => {
    const { scope, a, b } = page();
    arrive(scope, inOrder([a], 0, 0));
    expect(a.classList.contains('moving')).toBe(true);
    vi.advanceTimersByTime(ARRIVAL_MS);
    expect(a.classList.contains('moving')).toBe(false);
    arrive(scope, inOrder([b], 0, 0));
    expect(b.classList.contains('moving')).toBe(true);
    expect(a.classList.contains('moving')).toBe(false);
  });

  it('leaves a block mid-arrival alone when asked again, so its rise never restarts', () => {
    const { scope, a, b } = page();
    arrive(scope, inOrder([a, b], 200, 55));
    arrive(scope, inOrder([b], 0, 0));
    expect(delay(b)).toBe('255ms');
  });

  it('stamps blocks under reduced motion too: the stylesheet stills them, and the snapshot keeps them', () => {
    setMotion(true);
    const { scope, a } = page();
    arrive(scope, inOrder([a], 0, 0));
    expect(a.classList.contains('rb')).toBe(true);
  });
});

describe('pageArrival', () => {
  it('starts a page opened deep at the first block in view, not at the top', () => {
    document.body.innerHTML =
      '<main id="m"><header class="page-header" id="hd"><p id="a"></p></header><p id="b"></p><p id="c"></p><p id="d"></p></main>';
    const tops: Record<string, number> = { hd: -1000, a: -900, b: -300, c: 120, d: 400 };
    for (const id of Object.keys(tops)) {
      const el = document.getElementById(id)!;
      el.getClientRects = (() => [{}]) as unknown as typeof el.getClientRects;
      rect(el, tops[id]);
    }
    const items = pageArrival(document.getElementById('m')!);
    expect(items.map(([el, d]) => [el.id, d])).toEqual([
      ['c', 0],
      ['d', 55],
    ]);
  });

  it('waits for the header first when the header is in view', () => {
    document.body.innerHTML = '<main id="m"><header class="page-header"><p id="h"></p></header><p id="a"></p></main>';
    const header = document.querySelector<HTMLElement>('.page-header')!;
    header.getClientRects = (() => [{}]) as unknown as typeof header.getClientRects;
    rect(header, 80);
    for (const id of ['h', 'a']) {
      const el = document.getElementById(id)!;
      el.getClientRects = (() => [{}]) as unknown as typeof el.getClientRects;
      rect(el, id === 'h' ? 80 : 300);
    }
    expect(pageArrival(document.getElementById('m')!).map(([el, d]) => [el.id, d])).toEqual([
      ['h', 200],
      ['a', 255],
    ]);
  });
});

describe('armReveals', () => {
  it('lets a block revealed during its arrival finish its rise', () => {
    const { scope, b } = page();
    arrive(scope, inOrder([b], 0, 0));
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    vi.advanceTimersByTime(ARRIVAL_MS - 300);
    fire(b);
    vi.advanceTimersByTime(300);
    expect(b.classList.contains('moving')).toBe(true);
    vi.advanceTimersByTime(ARRIVAL_MS);
    expect(b.classList.contains('moving')).toBe(false);
  });

  it('holds back only what starts below the screen', () => {
    const { scope, a, b } = page();
    rect(a, 100);
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    expect(a.classList.contains('rv-wait')).toBe(false);
    expect(b.classList.contains('rv-wait')).toBe(true);
    expect(observed).toEqual([b]);
  });

  it('brings a block in when it comes into view', () => {
    const { scope, b } = page();
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    fire(b);
    expect(b.classList.contains('rv-wait')).toBe(false);
    expect(b.classList.contains('moving')).toBe(true);
    expect(b.classList.contains('rb')).toBe(true);
    expect(observed).toEqual([]);
  });

  it('staggers blocks that come into view together', () => {
    const { scope, a, b } = page();
    [a, b].forEach((el) => rect(el, window.innerHeight + 50));
    armReveals(scope, 'p');
    fire(a);
    fire(b);
    expect([a, b].map(delay)).toEqual(['0ms', '70ms']);
  });

  it('brings a table in row by row', () => {
    const { scope, c } = page();
    rect(c, window.innerHeight + 10);
    armReveals(scope, '.table-scroll');
    fire(c);
    expect(c.classList.contains('rt')).toBe(true);
  });

  it('shows a held block on screen once the page is scrolled to the bottom', () => {
    const { scope, a, b } = page();
    rect(a, window.innerHeight + 10);
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    rect(a, window.innerHeight - 40);
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: window.innerHeight + 100, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(a.classList.contains('rv-wait')).toBe(false);
    expect(b.classList.contains('rv-wait')).toBe(true);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('never holds back a section a hash jump has already brought on screen', () => {
    const { scope, a, b } = page();
    rect(a, -300);
    rect(b, 40);
    armReveals(scope, 'p');
    expect(a.classList.contains('rv-wait')).toBe(false);
    expect(b.classList.contains('rv-wait')).toBe(false);
  });

  it('holds nothing back under reduced motion', () => {
    setMotion(true);
    const { scope, b } = page();
    rect(b, window.innerHeight + 10);
    armReveals(scope, 'p');
    expect(b.classList.contains('rv-wait')).toBe(false);
  });

  it('shows everything again when disposed', () => {
    const { scope, a, b } = page();
    rect(a, 10);
    rect(b, window.innerHeight + 10);
    const dispose = armReveals(scope, 'p');
    dispose();
    expect(b.classList.contains('rv-wait')).toBe(false);
  });

  it('brings a group in by its parts when given them', () => {
    document.body.innerHTML = '<div id="s"><section id="p"><h2 id="h"></h2><p id="x"></p></section></div>';
    const p = document.getElementById('p')!;
    rect(p, window.innerHeight + 10);
    armReveals(document.getElementById('s')!, 'section', (el) => [...el.children] as HTMLElement[]);
    fire(p);
    expect(p.classList.contains('rv-wait')).toBe(false);
    expect(p.classList.contains('rb')).toBe(false);
    const [h, x] = ['h', 'x'].map((id) => document.getElementById(id)!);
    expect([h, x].map((el) => el.classList.contains('moving'))).toEqual([true, true]);
    expect([h, x].map(delay)).toEqual(['0ms', '45ms']);
  });
});

describe('watchChanges', () => {
  const tick = () => Promise.resolve();

  it('brings in a message that appears after the page arrived, once', async () => {
    document.body.innerHTML = '<main id="m"><div class="pb"></div></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const msg = document.createElement('div');
    msg.className = 'callout callout--danger';
    m.querySelector('.pb')!.append(msg);
    await tick();
    expect(msg.classList.contains('st-in')).toBe(true);
    vi.advanceTimersByTime(ARRIVAL_MS);
    expect(msg.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('leaves alone what a page or tab is bringing in already', async () => {
    document.body.innerHTML = '<main id="m"><section class="pane arriving"><div class="pb"></div></section></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const block = document.createElement('p');
    m.querySelector('.pb')!.append(block);
    await tick();
    expect(block.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('brings content swapped into a panel during its arrival in with that panel, never ahead of its heading', async () => {
    document.body.innerHTML =
      '<main id="m"><section class="pane arriving"><div class="pn"><div class="ph rb moving" style="--d: 290ms"></div><div class="pb"></div></div></section></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const pad = document.createElement('div');
    m.querySelector('.pb')!.append(pad);
    await tick();
    expect(pad.classList.contains('moving')).toBe(true);
    expect(pad.style.getPropertyValue('--d')).toBe('335ms');
    expect(pad.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('leaves the start of content joining a heading that has not started yet to the frame they start on together', async () => {
    document.body.innerHTML =
      '<main id="m"><section class="pane arriving"><div class="pn"><div class="ph rb moving" style="--d: 290ms"></div><div class="pb"></div></div></section></main>';
    const m = document.getElementById('m')!;
    const lead = m.querySelector<HTMLElement>('.ph')!;
    lead.getAnimations = (() => [{ playState: 'running', startTime: null }]) as unknown as typeof lead.getAnimations;
    const stop = watchChanges(m);
    const pad = document.createElement('div');
    const seen = { startTime: 'untouched' as unknown };
    pad.getAnimations = (() => [seen]) as unknown as typeof pad.getAnimations;
    m.querySelector('.pb')!.append(pad);
    await tick();
    await tick();
    expect(pad.classList.contains('moving')).toBe(true);
    expect(seen.startTime).toBe('untouched');
    stop();
  });

  it('brings in content changed inside a panel that kept its frame, as news, once the panel holds still', async () => {
    document.body.innerHTML =
      '<main id="m"><section class="pane arriving"><div class="pn"><div class="ph"></div><div class="pb"></div></div></section></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const state = document.createElement('div');
    m.querySelector('.pb')!.append(state);
    await tick();
    expect(state.classList.contains('st-in')).toBe(true);
    stop();
  });

  it('brings a page block that comes late in at once, its turn in the arrival being past', async () => {
    document.body.innerHTML = '<main id="m"><header class="page-header"></header></main>';
    const m = document.getElementById('m')!;
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    arrive(m, []);
    const stop = watchChanges(m);
    now.mockReturnValue(1900);
    const late = document.createElement('dl');
    m.append(late);
    await tick();
    expect(late.style.getPropertyValue('--d')).toBe('0ms');
    now.mockRestore();
    stop();
  });

  it('moves the block that appeared, not each part inside it', async () => {
    document.body.innerHTML = '<main id="m"><div class="pb"></div></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const row = document.createElement('div');
    row.className = 'chips';
    row.innerHTML = '<span class="callout"></span>';
    m.querySelector('.pb')!.append(row);
    await tick();
    expect(row.classList.contains('st-in')).toBe(true);
    expect(row.querySelector('.callout')!.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('leaves alone a part replaced inside a block, such as a chip a poll redrew', async () => {
    document.body.innerHTML = '<main id="m"><div class="pb"><div class="chips"></div></div></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const chip = document.createElement('span');
    chip.className = 'chip';
    m.querySelector('.chips')!.append(chip);
    await tick();
    expect(chip.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('brings a page block a fetch delivered during the arrival in with the arrival', async () => {
    document.body.innerHTML = '<main id="m" class="arriving"><header class="page-header"></header></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const strip = document.createElement('dl');
    m.append(strip);
    await tick();
    expect(strip.classList.contains('rb')).toBe(true);
    expect(strip.classList.contains('st-in')).toBe(false);
    stop();
  });

  it('brings a page block a fetch delivered later in as a change', async () => {
    document.body.innerHTML = '<main id="m"><header class="page-header"></header></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const strip = document.createElement('dl');
    m.append(strip);
    await tick();
    expect(strip.classList.contains('st-in')).toBe(true);
    stop();
  });

  it('leaves the panels inside a tab to the tab', async () => {
    document.body.innerHTML = '<main id="m" class="arriving"><section class="pane"><div class="panels"></div></section></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const pn = document.createElement('div');
    pn.className = 'pn';
    m.querySelector('.panels')!.append(pn);
    await tick();
    expect(pn.className).toBe('pn');
    stop();
  });

  it('brings in a refusal inside a tab once the tab has arrived', async () => {
    document.body.innerHTML = '<main id="m"><section class="pane"><div class="panels"><div class="pn"><div class="pb"></div></div></div></section></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const msg = document.createElement('div');
    msg.className = 'callout';
    m.querySelector('.pb')!.append(msg);
    await tick();
    expect(msg.classList.contains('st-in')).toBe(true);
    stop();
  });

  it('holds a header drawn again still, and brings in only its state', async () => {
    document.body.innerHTML = '<main id="m"></main>';
    const m = document.getElementById('m')!;
    const stop = watchChanges(m);
    const head = document.createElement('header');
    head.className = 'page-header';
    head.innerHTML = '<div class="page-header__row"><h1>Device</h1><div class="page-header__aside">Connected</div></div>';
    m.append(head);
    await tick();
    expect(head.classList.contains('st-in')).toBe(false);
    expect(head.querySelector('.page-header__aside')!.classList.contains('st-in')).toBe(true);
    stop();
  });
});
