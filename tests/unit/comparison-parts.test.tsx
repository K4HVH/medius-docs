// The parts a Comparison page is drawn from: a group of rows with its chart and defect marks, and a grid.
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { GroupSection, PairBars, VERDICT } from '../../src/app/pages/comparison/parts';
import type { Defect, GridGroup, RowsGroup } from '../../src/app/data/comparison/types';

afterEach(cleanup);

const inRouter = (ui: () => JSX.Element) => render(() => <Router root={() => ui()} />);

const STREAMS: RowsGroup = {
  id: 'streams',
  title: 'Command streams',
  about: 'A move every period.',
  kind: 'rows',
  label: 'Rate',
  rows: [
    { id: 'stream-1000', test: '1,000 Hz', stock: { text: '10.8 ms', value: 10.8, unit: 'ms' }, medius: '1.85 ms', verdict: 'medius', n: '2,000 moves', layer: 'wire', note: 'One run' },
    { id: 'clone', test: 'Clone time', stock: '0.8 s', medius: '1.1 s', verdict: 'unranked', reason: "The rigs' hubs differ" },
  ],
  chart: { label: 'Lag per count', unit: 'ms', points: [{ x: '1,000 Hz', stock: 10.8, medius: 1.85 }, { x: '30 Hz', stock: 33.6, medius: 16.7 }] },
};
const GRID: GridGroup = {
  id: 'smoothing',
  title: 'Smoothing settings',
  about: 'Each setting.',
  kind: 'grid',
  columns: ['Setting', 'At rest'],
  rows: [{ id: 's-auto', cells: ['Stock, AUTO', { text: '64.2 ms', value: 64.2, unit: 'ms' }] }],
};
const DEFECT: Defect = { id: 'stuck', box: 'stock', text: 'Parser stuck', category: 'injection', group: 'streams', row: 'stream-1000' };

const rowsOf = (el: HTMLElement) => [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()));

describe('GroupSection', () => {
  it('draws a section with the group id, its about and a row per result, Stock before Medius', () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[]} layers={{ wire: 'USB packets' }} />);
    const sec = r.container.querySelector('section#streams')!;
    expect(sec.querySelector('h2')?.textContent).toContain('Command streams');
    expect(sec.textContent).toContain('A move every period.');
    expect([...sec.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Rate', 'Stock', 'Medius', 'Result']);
    const [first] = rowsOf(sec as HTMLElement);
    expect(first[1]).toBe('10.8 ms');
    expect(first[2]).toBe('1.85 ms');
    expect(first[3]).toBe(VERDICT.medius);
  });

  it('shows a row note, its sample size and timing layer under the test', () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[]} layers={{ wire: 'USB packets' }} />);
    const cell = r.container.querySelector('tbody tr td')!;
    expect(cell.textContent).toContain('One run');
    expect(cell.textContent).toContain('2,000 moves');
    expect(cell.textContent).toContain('wire');
  });

  it('gives an unranked row its reason', () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[]} layers={{}} />);
    expect(rowsOf(r.container)[1][3]).toContain("The rigs' hubs differ");
  });

  it("marks a row a defect names, linked to Overview's list", () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[DEFECT]} layers={{}} />);
    const link = r.container.querySelector('tbody tr td:last-child a') as HTMLAnchorElement;
    expect(link.textContent).toBe('Stock defect');
    expect(link.getAttribute('href')).toBe('/comparison#defect-stuck');
    expect(link.getAttribute('aria-label')).toBe('Stock defect: Parser stuck');
    expect(rowsOf(r.container)[1][3]).not.toContain('defect');
  });

  it('states a defect that names no row under the table', () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[{ ...DEFECT, row: undefined }]} layers={{}} />);
    expect(r.container.textContent).toContain('Stock defect: Parser stuck');
  });

  it('draws the chart before the table', () => {
    const r = inRouter(() => <GroupSection group={STREAMS} defects={[]} layers={{}} />);
    const sec = r.container.querySelector('section')!;
    const chart = sec.querySelector('.pairs')!;
    expect(chart.compareDocumentPosition(sec.querySelector('table')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws a grid with its own columns, each cell after the first labelled with its column for a phone', () => {
    const r = inRouter(() => <GroupSection group={GRID} defects={[]} layers={{}} />);
    expect([...r.container.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Setting', 'At rest']);
    expect(rowsOf(r.container)[0]).toEqual(['Stock, AUTO', '64.2 ms']);
    expect([...r.container.querySelectorAll('tbody td')].map((td) => td.getAttribute('data-label'))).toEqual([null, 'At rest']);
  });

  it('breaks long values between their parts, never inside a word or a range', () => {
    const group: RowsGroup = { ...STREAMS, rows: [{ ...STREAMS.rows[0], stock: 'Render OFF/STOCK/RAW_PASSTHROUGH', medius: 'QUERY(VERSION): 0.93-0.98 s' }] };
    const r = inRouter(() => <GroupSection group={group} defects={[]} layers={{}} />);
    const [, stock, medius] = [...r.container.querySelectorAll('tbody tr td')];
    expect(stock.textContent).toBe('Render OFF/STOCK/RAW_PASSTHROUGH');
    expect(stock.querySelectorAll('wbr').length).toBe(3);
    expect(medius.querySelector('wbr')!.nextSibling!.textContent).toMatch(/^\(VERSION/);
    expect(medius.querySelector('.nw')!.textContent).toBe('0.93-0.98');
  });

  it('puts what the page draws by hand after the about', () => {
    const r = inRouter(() => <GroupSection group={GRID} defects={[]} layers={{}} before={<pre class="diagram">DRAWN</pre>} />);
    const sec = r.container.querySelector('section')!;
    expect(sec.querySelector('pre.diagram')!.compareDocumentPosition(sec.querySelector('table')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('PairBars and row facts', () => {
  it('draws a box that was not measured as Not measured, with no bar', () => {
    const chart = { label: 'Lag', unit: 'ms', points: [{ x: '1,000 Hz', stock: null, medius: 1.85 }] };
    const r = render(() => <PairBars chart={chart} />);
    expect([...r.container.querySelectorAll('.pairs b')].map((b) => b.textContent)).toEqual(['Not measured', '1.85 ms']);
    expect((r.container.querySelector('.pairs .t.stock i') as HTMLElement | null)?.style.width ?? '0%').toBe('0%');
  });

  it('names the hubs a row was measured behind', () => {
    const group = { ...STREAMS, rows: [{ ...STREAMS.rows[0], hubs: 'both' }] };
    const r = inRouter(() => <GroupSection group={group} defects={[]} layers={{}} />);
    expect(r.container.querySelector('tbody tr td')!.textContent).toContain('both hubs');
  });
});

describe('PairBars', () => {
  it('draws stock and Medius for each point, to the scale of the largest value, with each value and its unit', () => {
    const r = render(() => <PairBars chart={STREAMS.chart!} />);
    const bars = [...r.container.querySelectorAll('.pairs i')] as HTMLElement[];
    const widths = bars.map((b) => parseFloat(b.style.width));
    [32.143, 5.506, 100, 49.702].forEach((w, i) => expect(widths[i]).toBeCloseTo(w, 2));
    expect([...r.container.querySelectorAll('.pairs b')].map((b) => b.textContent)).toEqual(['10.8 ms', '1.85 ms', '33.6 ms', '16.7 ms']);
    expect(r.container.textContent).toContain('Lag per count');
  });
});
