import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { ByteStrip } from '../../src/app/shell/ByteStrip';
import { htmlToMarkdown } from '../../scripts/lib/htmlToMarkdown';

const INJECT = [
  { value: 'A5', name: 'SOF' },
  { value: '03', name: 'TYPE' },
  { value: '00', name: 'SEQ' },
  { value: '04 00', name: 'LEN' },
  { value: '00', name: 'class' },
  { value: '00 00', name: 'id' },
  { value: '01', name: 'action' },
  { value: 'lo hi', name: 'CRC16' },
];

const setMotion = (reduce: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

let enter: (() => void) | null;

beforeEach(() => {
  enter = null;
  setMotion(false);
  vi.useFakeTimers();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(el: Element) {
        enter = () => this.cb([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
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

const cells = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.bytes > div')];
const lit = (c: HTMLElement) => cells(c).map((d) => d.classList.contains('hit'));

describe('ByteStrip', () => {
  it('shows each value over its name and marks the payload, not the framing', () => {
    const { container } = render(() => <ByteStrip fields={INJECT} />);
    expect(cells(container).map((d) => [d.querySelector('b')!.textContent, d.querySelector('span')!.textContent])).toEqual(
      INJECT.map((f) => [f.value, f.name]),
    );
    expect(cells(container).filter((d) => d.classList.contains('pl')).map((d) => d.querySelector('span')!.textContent)).toEqual([
      'class',
      'id',
      'action',
    ]);
  });

  it('treats the framing names in any case as framing', () => {
    const { container } = render(() => <ByteStrip fields={[{ value: 'A5', name: 'sof' }, { value: '01', name: 'Crc16' }, { value: '07', name: 'n' }]} />);
    expect(cells(container).map((d) => d.classList.contains('pl'))).toEqual([false, false, true]);
  });

  it('sizes each cell by the bytes its value holds', () => {
    const { container } = render(() => (
      <ByteStrip fields={[{ value: 'A5', name: 'SOF' }, { value: '04 00', name: 'LEN' }, { value: '40 42 0F 00', name: 'ts_us' }]} />
    ));
    expect(cells(container).map((d) => d.style.getPropertyValue('--w'))).toEqual(['1', '2', '4']);
  });

  it('marks a value too long for a phone so it can take its own row', () => {
    const { container } = render(() => (
      <ByteStrip fields={[{ value: '12 01 00 02 00 00 00 40 ... (18 bytes)', name: 'data' }, { value: '12 34 56 78 9A BC', name: 'mac' }]} />
    ));
    expect(cells(container).map((d) => d.classList.contains('long'))).toEqual([true, false]);
  });

  it('lights the cells in wire order once it is on screen, then again on hover, never twice at once', () => {
    const { container } = render(() => <ByteStrip fields={INJECT} />);
    enter!();
    vi.advanceTimersByTime(649);
    expect(lit(container).some(Boolean)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(lit(container)).toEqual([true, false, false, false, false, false, false, false]);
    vi.advanceTimersByTime(90);
    expect(lit(container).slice(0, 2)).toEqual([true, true]);
    vi.advanceTimersByTime(70);
    expect(lit(container).slice(0, 2)).toEqual([false, true]);
    fireEvent.pointerEnter(container.querySelector('.bytes')!);
    vi.advanceTimersByTime(0);
    expect(lit(container)[0]).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(lit(container).some(Boolean)).toBe(false);
    fireEvent.pointerEnter(container.querySelector('.bytes')!);
    vi.advanceTimersByTime(0);
    expect(lit(container)[0]).toBe(true);
  });

  it('stays still under reduced motion', () => {
    setMotion(true);
    const { container } = render(() => <ByteStrip fields={INJECT} />);
    enter?.();
    fireEvent.pointerEnter(container.querySelector('.bytes')!);
    vi.advanceTimersByTime(2000);
    expect(lit(container).some(Boolean)).toBe(false);
  });

  it('reads to an agent as a two-row table, values over names', () => {
    const { container } = render(() => <ByteStrip fields={INJECT} />);
    expect(htmlToMarkdown(container.innerHTML)).toBe(
      ['| A5 | 03 | 00 | 04 00 | 00 | 00 00 | 01 | lo hi |', '| --- | --- | --- | --- | --- | --- | --- | --- |', '| SOF | TYPE | SEQ | LEN | class | id | action | CRC16 |'].join('\n'),
    );
  });
});
