// The comparison's tables: each kind drawn as stock against Medius, the box behind dimmed, the result worked
// out, bars to scale, and a defect marked on its row.
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { PairTable, ResultSection } from '../../src/app/pages/comparison/parts';
import type { Defect, MeasureTable, Section } from '../../src/app/data/comparison/types';
import { GOOD } from './helpers/comparison-results';

afterEach(cleanup);

const sections = GOOD.categories[0].sections as unknown as Section[];
const DEFECTS = GOOD.defects as Defect[];
const show = (el: () => JSX.Element) => render(() => <Router root={el} />).container;
const section = (i: number) => show(() => <ResultSection section={sections[i]} defects={DEFECTS} />);
const rowOf = (el: Element, label: string) => [...el.querySelectorAll('tbody tr')].find((r) => r.querySelector('td')!.textContent!.startsWith(label))!;
const cells = (tr: Element) => [...tr.querySelectorAll('td')];

describe('ResultSection', () => {
  it('draws what was done, then each table under its label, a row per result', () => {
    const el = section(0);
    expect(el.querySelector('section#move-latency p')!.textContent).toBe(sections[0].about);
    expect([...el.querySelectorAll('.api-response-label')].map((l) => l.textContent)).toEqual(['Latency', 'Reports per move', 'Moves delivered']);
    expect(el.querySelectorAll('table.api-params.pair').length).toBe(3);
    expect(el.querySelectorAll('tbody tr').length).toBe(4);
  });

  it("names each box's command in its column head", () => {
    const heads = [...section(0).querySelectorAll('table')[0].querySelectorAll('thead th')].map((th) => th.textContent);
    expect(heads).toEqual(['Mouse', 'Stockkm.move', 'MediusMOVE', 'Result']);
  });
});

describe('a measure', () => {
  it('writes each value, dims the box behind and names the box ahead', () => {
    const tr = rowOf(section(0), 'At rest, 1 count');
    const [, stock, medius, res] = cells(tr);
    expect(stock.querySelector('.n')!.textContent).toBe('64.1-64.3 ms');
    expect(medius.querySelector('.n')!.textContent).toBe('1.01-1.02 ms');
    expect(stock.classList.contains('behind')).toBe(true);
    expect(medius.classList.contains('behind')).toBe(false);
    expect(res.querySelector('.status.medius')!.textContent).toBe('Medius');
  });

  it("draws bars to the table's largest value, a range's high end apart", () => {
    const [, stock, medius] = cells(rowOf(section(0), 'At rest, 1 count'));
    const widths = (td: Element) => [...td.querySelectorAll('.t i')].map((i) => parseFloat((i as HTMLElement).style.width));
    expect(widths(stock)[0]).toBeCloseTo((64.1 / 64.3) * 100, 5);
    expect(widths(stock)[1]).toBeCloseTo(((64.3 - 64.1) / 64.3) * 100, 5);
    expect(widths(medius)[0]).toBeCloseTo((1.01 / 64.3) * 100, 5);
    expect(widths(medius)[1]).toBeCloseTo(((1.02 - 1.01) / 64.3) * 100, 5);
  });

  it('counts of a total as N/M, with the result from their fractions', () => {
    const [, stock, medius, res] = cells(rowOf(section(0), 'Fresh clone'));
    expect([stock.textContent, medius.textContent]).toEqual(['0/3', '3/3']);
    expect(res.querySelector('.status')!.textContent).toBe('Medius');
  });

  it('gives no result where neither direction is better, and dims neither box', () => {
    const table = section(0).querySelectorAll('table')[1];
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Mouse', 'Stock', 'Medius']);
    expect(table.querySelectorAll('td.behind').length).toBe(0);
  });

  it('marks a row a defect names, linked to that defect', () => {
    const a = rowOf(section(0), 'Fresh clone').querySelector('a.status.bad')!;
    expect(a.getAttribute('href')).toBe('/comparison/defect-fresh-clone');
    expect(a.getAttribute('aria-label')).toBe(`Stock defect: ${DEFECTS[0].text}`);
  });

  it('marks every row a defect names, a win included, and no other', () => {
    const many = [{ ...DEFECTS[0], rows: ['move-cold', 'move-rest-1'] }];
    const el = show(() => <ResultSection section={sections[0]} defects={many} />);
    for (const label of ['Fresh clone', 'At rest, 1 count']) expect(rowOf(el, label).querySelector('a.status.bad')).not.toBeNull();
    expect(rowOf(el, 'At rest, 50 counts').querySelector('a.status.bad')).toBeNull();
  });

  it('labels each value with its box, for a phone', () => {
    const [, stock, medius] = cells(rowOf(section(0), 'At rest, 1 count'));
    expect([stock.dataset.label, medius.dataset.label]).toEqual(['Stock', 'Medius']);
  });
});

describe('an outcome', () => {
  it('ranks by the order of its words', () => {
    const [, stock, medius, res] = cells(rowOf(section(1), 'Command cut off'));
    expect([stock.textContent, medius.textContent, res.textContent]).toEqual(['Lost', 'Arrives', 'Medius']);
    expect(stock.classList.contains('behind')).toBe(true);
  });

  it('calls outcomes that differ by design Differs, and dims neither', () => {
    const tr = rowOf(section(2), 'Button');
    expect(cells(tr)[3].textContent).toBe('Differs');
    expect(tr.querySelectorAll('td.behind').length).toBe(0);
  });
});

describe('a feature', () => {
  it('shows the command, or No, and gives the row to the box that has it', () => {
    const [, stock, medius, res] = cells(rowOf(section(3), 'Absolute move'));
    expect(stock.querySelector('code')!.textContent).toBe('km.moveto');
    expect(medius.textContent).toBe('No');
    expect(res.textContent).toBe('Stock');
    expect(cells(rowOf(section(3), 'Relative move'))[3].textContent).toBe('Equal');
  });
});

describe('a feature named in words', () => {
  it('writes a tool name as text and a command as code', () => {
    const table = { kind: 'feature' as const, label: 'Tools', key: 'Tool', rows: [{ id: 'tool', label: 'Owner tool', stock: 'MAKCU Toolkit', medius: 'OPTION(NAME)' }] };
    const el = show(() => <PairTable key="Tool" items={[{ table, row: table.rows[0] }]} scale="table" defects={[]} />);
    const [, stock, medius] = cells(el.querySelector('tbody tr')!);
    expect(stock.querySelector('code')).toBeNull();
    expect(stock.textContent).toBe('MAKCU Toolkit');
    expect(medius.querySelector('code')!.textContent).toBe('OPTION(NAME)');
  });
});

describe('settings', () => {
  it('gives each setting its box, marks the default and labels each value with its column', () => {
    const tr = section(4).querySelector('tbody tr')!;
    const [box, setting, value] = cells(tr);
    expect(box.textContent).toBe('Stock');
    expect(setting.textContent).toBe('Interpolation AUTO (default)');
    expect(value.dataset.label).toBe('1 count, at rest');
    expect(value.querySelector('.n')!.textContent).toBe('64.2 ms');
  });
});

describe('PairTable gathering rows from several tables', () => {
  it('scales each row on its own', () => {
    const latency = sections[0].tables[0] as MeasureTable;
    const reports = sections[0].tables[1] as MeasureTable;
    const el = show(() => (
      <PairTable key="Test" items={[{ table: latency, row: latency.rows[0] }, { table: reports, row: reports.rows[0] }]} scale="row" defects={[]} />
    ));
    const top = (tr: Element) => Math.max(...[...tr.querySelectorAll('.t i')].map((i) => parseFloat((i as HTMLElement).style.width) + parseFloat((i as HTMLElement).style.left || '0')));
    for (const tr of el.querySelectorAll('tbody tr')) expect(top(tr)).toBeCloseTo(100, 5);
  });
});
