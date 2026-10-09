import { describe, it, expect, vi, beforeEach, afterEach, onTestFinished } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { Hero } from '../../src/app/pages/home/Hero';
import { Vitals } from '../../src/app/pages/home/Vitals';
import { IndexRows } from '../../src/app/pages/home/IndexRows';
import { DescriptorPanel } from '../../src/app/pages/home/DescriptorPanel';
import { ReportFeed } from '../../src/app/pages/home/ReportFeed';
import type { DescriptorSample, FeedFrame } from '../../src/app/data/sampleTypes';

const f = (field: string, hex: string) => ({ field, mouse: hex, clone: hex });
const SAMPLE: DescriptorSample = {
  device: 'Test Mouse',
  vidpid: '1234:5678',
  firmware: '3.4.5',
  descriptors: {
    device: [f('bLength', '12'), f('bDescriptorType', '01'), f('bcdUSB', '00 02'), f('idVendor', '34 12')],
    configuration: [f('bLength', '09'), f('wTotalLength', '22 00')],
    interface: [f('bLength', '09')],
    hid: [f('bLength', '09'), f('bcdHID', '11 01'), f('wDescriptorLength', '43 00')],
    endpoint: [f('bLength', '07'), f('wMaxPacketSize', '08 00'), f('bInterval', '01')],
  },
};

const FRAMES: FeedFrame[] = [
  { frame: 0, ep: '81', report: '0001000200', mouse: true, api: [false, true, true, false, false] },
  { frame: 1, ep: null, report: null, mouse: false, api: [] },
  { frame: 2, ep: '81', report: '0003000000', mouse: true, api: [false, false, false, false, false] },
];

const inRouter = (view: () => JSX.Element) => {
  const history = createMemoryHistory();
  history.set({ value: '/' });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={view} />
    </MemoryRouter>
  ));
};

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Hero', () => {
  it('has the one h1 of the page, read as a sentence', () => {
    const r = inRouter(() => <Hero frames={FRAMES} figures={null} />);
    const h1 = r.container.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Replacement firmware for the MAKCU box.');
    expect([...r.container.querySelectorAll('.actions a')].map((a) => a.getAttribute('href'))).toEqual(['/guide', '/native']);
  });
});

describe('Vitals', () => {
  it('shows every figure it has', () => {
    const r = render(() => <Vitals figures={{ firmware: 'v3.4.5', devices: 70, boxes: 1201 }} />);
    expect([...r.container.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['v3.4.5', 'MAKCU, 2× ESP32-S3', '70', '1,201']);
  });

  it('leaves a cell empty, never "undefined", when its source is down', () => {
    const r = render(() => <Vitals figures={null} />);
    expect([...r.container.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['', 'MAKCU, 2× ESP32-S3', '', '']);
    expect(r.container.textContent).not.toMatch(/undefined|NaN|null/);
  });
});

describe('IndexRows', () => {
  it('links the four places, with the Discord count only when it is known', () => {
    const r = inRouter(() => <IndexRows />);
    expect([...r.container.querySelectorAll('a.go')].map((a) => a.getAttribute('href'))).toEqual([
      '/guide',
      '/dashboard',
      '/native',
      'https://discord.gg/ArRqcA84pB',
    ]);
    expect(r.container.querySelector('[data-fill="vital-discord"]')!.textContent).toBe('');
    cleanup();
    const k = inRouter(() => <IndexRows discord={596} />);
    expect(k.container.querySelector('[data-fill="vital-discord"]')!.textContent).toBe('596 members');
  });
});

describe('ReportFeed', () => {
  it('shows a screen of frames, the injected bytes marked, and a frame with nothing as NAK', () => {
    const r = render(() => <ReportFeed frames={FRAMES} />);
    const rows = [...r.container.querySelectorAll('.row')];
    expect(rows).toHaveLength(44);
    const last = rows[rows.length - 1];
    expect(last.classList.contains('now')).toBe(true);
    const withApi = rows.find((x) => x.querySelector('.b.api'))!;
    expect([...withApi.querySelectorAll('.b.api')].map((s) => s.textContent)).toEqual(['01', '00']);
    expect(withApi.textContent).not.toContain('+API');
    expect(rows.some((x) => x.children[1].textContent === 'NAK')).toBe(true);
  });

  it('gives the report every byte, set apart by a gap, not a space, beside its frame alone', () => {
    const r = render(() => <ReportFeed frames={FRAMES} />);
    const row = [...r.container.querySelectorAll('.row')].find((x) => x.querySelector('.b'))!;
    expect(row.children).toHaveLength(2);
    expect([...row.children[1].querySelectorAll('.b')].map((s) => s.textContent).join('')).toMatch(/^[0-9A-F]{10}$/);
    expect(row.children[1].textContent).not.toContain(' ');
    expect([...r.container.querySelectorAll('.tape-head > span')].map((s) => s.textContent)).toEqual(['Frame', 'Report', 'MouseAPI']);
  });

  // jsdom lays nothing out. A byte is two 0.6em characters at the rows' type size (12.5px from a
  // stylesheet), set apart by --byte-gap, in a column of the given width.
  const layout = (column: number) => {
    const sheet = document.createElement('style');
    sheet.textContent = '.rows { font-size: 12.5px; }';
    document.head.appendChild(sheet);
    onTestFinished(() => sheet.remove());
    const metrics = (el: Element) => {
      const rows = el.closest('.rows') as HTMLElement;
      const size = parseFloat(getComputedStyle(rows).fontSize);
      const gap = rows.style.getPropertyValue('--byte-gap') || '1ch';
      return { w: size * 1.2, g: gap.endsWith('ch') ? parseFloat(gap) * size * 0.6 : parseFloat(gap) };
    };
    const rect = (left: number, width: number) => ({ left, right: left + width, width }) as DOMRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.querySelector(':scope > .b')) return rect(0, column);
      if (this.matches('.b')) {
        const { w, g } = metrics(this);
        return rect([...this.parentElement!.children].indexOf(this) * (w + g), w);
      }
      return rect(0, 0);
    });
  };
  const fitted = async (column: number) => {
    layout(column);
    const r = render(() => <ReportFeed frames={FRAMES} />);
    await new Promise((ok) => setTimeout(ok, 0));
    const rows = r.container.querySelector('.rows') as HTMLElement;
    vi.restoreAllMocks();
    return { size: rows.style.fontSize, gap: rows.style.getPropertyValue('--byte-gap') };
  };

  it('keeps a full space between bytes where the report has room', async () => {
    expect(await fitted(200)).toEqual({ size: '', gap: '7.5px' });
  });

  it('narrows the gap before it touches the type', async () => {
    const { size, gap } = await fitted(100);
    expect(size).toBe('');
    expect(parseFloat(gap)).toBeCloseTo(6.25, 1);
  });

  it('steps the type down only once the gap is down to 0.3ch', async () => {
    const { size, gap } = await fitted(60);
    expect(parseFloat(size)).toBeLessThanOrEqual(60 / 6.72);
    expect(parseFloat(size)).toBeGreaterThan(60 / 6.72 - 0.1);
    expect(parseFloat(gap)).toBeGreaterThanOrEqual(0.3 * parseFloat(size) * 0.6 - 0.01);
    expect(parseFloat(gap)).toBeLessThan(0.35 * parseFloat(size) * 0.6);
  });
});

describe('DescriptorPanel', () => {
  const panel = () => render(() => <DescriptorPanel sample={SAMPLE} />);
  const score = (c: HTMLElement) => c.querySelector('.score b')!.textContent;
  const tab = (c: HTMLElement, name: string) => [...c.querySelectorAll('[role="tab"]')].find((b) => b.textContent === name) as HTMLElement;

  it('settles on the last tab clicked, counting only that descriptor', () => {
    vi.useFakeTimers();
    const r = panel();
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += 20) {
        vi.advanceTimersByTime(20);
        const [n, total] = score(r.container).split('/');
        if (n !== '--') expect(Number(n)).toBeLessThanOrEqual(Number(total));
      }
    };
    fireEvent.click(tab(r.container, 'Config'));
    run(200);
    fireEvent.click(tab(r.container, 'HID'));
    run(300);
    fireEvent.click(tab(r.container, 'Endpoint'));
    run(3000);
    expect(r.container.querySelector('#desc-label')!.textContent).toBe('Endpoint descriptor');
    expect(score(r.container)).toBe('4/4');
    expect(tab(r.container, 'Endpoint').getAttribute('aria-selected')).toBe('true');
    expect(r.container.querySelectorAll('tbody tr:not(.pad)')).toHaveLength(3);
    expect(r.container.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('never shows a count above the descriptor it stands beside, mid-switch', () => {
    vi.useFakeTimers();
    const r = panel();
    fireEvent.click(tab(r.container, 'Interface'));
    for (let t = 0; t < 1500; t += 20) {
      vi.advanceTimersByTime(20);
      const [n, total] = score(r.container).split('/');
      if (n !== '--') expect(Number(n)).toBeLessThanOrEqual(Number(total));
    }
    expect(score(r.container)).toBe('1/1');
  });

  it('lights a row as one: the classes sit on the row, never on one cell', () => {
    vi.useFakeTimers();
    const r = panel();
    fireEvent.click(tab(r.container, 'Device'));
    vi.advanceTimersByTime(160 + 280 + 130);
    const lit = r.container.querySelector('tbody tr.hit')!;
    expect(lit).not.toBeNull();
    expect(lit.classList.contains('in')).toBe(true);
    for (const td of r.container.querySelectorAll('tbody td')) {
      expect(td.classList.contains('hit')).toBe(false);
      expect(td.classList.contains('in')).toBe(false);
    }
  });

  it('names the captured device under the panel', () => {
    const r = panel();
    expect(r.container.querySelector('.desc-src')!.textContent).toBe('Test Mouse · 1234:5678 · v3.4.5');
  });

  // jsdom has no IntersectionObserver: these hold each observer so a test can say when something is on screen.
  const observed: { cb: IntersectionObserverCallback; el?: Element }[] = [];
  const watch = () => {
    observed.length = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private cb: IntersectionObserverCallback) {}
        observe(el: Element) {
          observed.push({ cb: this.cb, el });
        }
        disconnect() {}
        unobserve() {}
      },
    );
  };
  const show = () =>
    observed.forEach((o) => o.cb([{ isIntersecting: true, target: o.el } as IntersectionObserverEntry], {} as IntersectionObserver));

  it('drops the first count when a tab was picked before the panel came on screen', () => {
    vi.useFakeTimers();
    watch();
    const r = panel();
    fireEvent.click(tab(r.container, 'Device'));
    const counts: number[] = [];
    for (let t = 0; t < 200; t += 20) vi.advanceTimersByTime(20);
    show();
    for (let t = 0; t < 3000; t += 20) {
      vi.advanceTimersByTime(20);
      const n = score(r.container).split('/')[0];
      if (n !== '--') counts.push(Number(n));
    }
    expect(counts.length).toBeGreaterThan(0);
    counts.forEach((n, i) => i && expect(n).toBeGreaterThanOrEqual(counts[i - 1]));
    expect(score(r.container)).toBe('6/6');
    vi.unstubAllGlobals();
  });

  it('holds the panel on its tab while keyboard focus is inside it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    watch();
    const r = panel();
    show();
    vi.advanceTimersByTime(3000);
    tab(r.container, 'Config').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(8000);
    expect(r.container.querySelector('#desc-label')!.textContent).toBe('Device descriptor');
    tab(r.container, 'Config').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(8000);
    expect(r.container.querySelector('#desc-label')!.textContent).not.toBe('Device descriptor');
    vi.unstubAllGlobals();
  });
});
