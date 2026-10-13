// Each row's result, worked out from its values, and each value as the site writes it.
import { describe, expect, it } from 'vitest';
import { resultOf, showValue, span } from '../../src/app/data/comparison/result';
import type { FeatureTable, MeasureTable, OutcomeTable, Value } from '../../src/app/data/comparison/types';

const src = [{ file: 'a.json', ptr: '/a' }];
const v = (value: number): Value => ({ value, src });
const r = (lo: number, hi: number): Value => ({ lo, hi, src });
const of = (value: number, total: number): Value => ({ value, of: total, src });

const measure = (better: 'lower' | 'higher' | undefined, stock: Value, medius: Value): [MeasureTable, MeasureTable['rows'][0]] => {
  const row = { id: 'r', label: 'Row', stock, medius };
  return [{ kind: 'measure', label: 'Latency', key: 'Test', unit: 'ms', ...(better ? { better } : {}), rows: [row] }, row];
};

describe('resultOf', () => {
  it('ranks measures by their better side', () => {
    expect(resultOf(...measure('lower', v(64.3), v(1.02)))).toBe('medius');
    expect(resultOf(...measure('lower', v(1.5), v(2)))).toBe('stock');
    expect(resultOf(...measure('higher', v(1000), v(400)))).toBe('stock');
  });

  it('calls overlapping ranges equal, and touching ones too', () => {
    expect(resultOf(...measure('lower', r(1.7, 7.7), r(4.8, 7.2)))).toBe('equal');
    expect(resultOf(...measure('lower', r(0.87, 0.93), v(0.93)))).toBe('equal');
    expect(resultOf(...measure('lower', r(0.46, 0.82), r(0.12, 0.43)))).toBe('medius');
    expect(resultOf(...measure('lower', v(2), v(2)))).toBe('equal');
  });

  it('compares counts of a total as fractions', () => {
    expect(resultOf(...measure('higher', of(0, 3), of(3, 3)))).toBe('medius');
    expect(resultOf(...measure('lower', of(118, 12871), of(0, 20000)))).toBe('medius');
    expect(resultOf(...measure('higher', of(1, 2), of(2, 4)))).toBe('equal');
  });

  it('gives no result where neither direction is better', () => {
    expect(resultOf(...measure(undefined, v(43), v(1)))).toBeNull();
  });

  it('ranks outcomes by their order, or calls them different', () => {
    const row = { id: 'r', label: 'Row', stock: { is: 'Lost', src }, medius: { is: 'Arrives', src } };
    const t: OutcomeTable = { kind: 'outcome', label: 'Next move', key: 'Input', outcomes: ['Arrives', 'Lost'], rows: [row] };
    expect(resultOf(t, row)).toBe('medius');
    expect(resultOf({ ...t, ranked: false }, row)).toBe('differs');
    const same = { ...row, medius: { is: 'Lost', src } };
    expect(resultOf(t, same)).toBe('equal');
    expect(resultOf({ ...t, ranked: false }, same)).toBe('equal');
  });

  it('gives a feature to the box that has it', () => {
    const t: FeatureTable = { kind: 'feature', label: 'Commands', key: 'Feature', rows: [] };
    expect(resultOf(t, { id: 'a', label: 'A', stock: 'km.moveto', medius: null })).toBe('stock');
    expect(resultOf(t, { id: 'a', label: 'A', stock: null, medius: 'CATCH' })).toBe('medius');
    expect(resultOf(t, { id: 'a', label: 'A', stock: 'km.move', medius: 'MOVE' })).toBe('equal');
  });

  it('calls a feature only one box has Differs where neither having it is better', () => {
    const t: FeatureTable = { kind: 'feature', label: 'Data sent', key: 'Data', ranked: false, rows: [] };
    expect(resultOf(t, { id: 'a', label: 'A', stock: 'Toolkit', medius: null })).toBe('differs');
    expect(resultOf(t, { id: 'a', label: 'A', stock: 'Update check', medius: 'Usage report' })).toBe('differs');
    expect(resultOf(t, { id: 'a', label: 'A', stock: 'Usage report', medius: 'Usage report' })).toBe('equal');
  });
});

describe('showValue', () => {
  it('writes thousands, ranges and symbol units', () => {
    expect(showValue(v(64.3), 'ms')).toBe('64.3 ms');
    expect(showValue(v(34870), '/s')).toBe('34,870/s');
    expect(showValue(r(0.12, 0.43), 'ms')).toBe('0.12-0.43 ms');
    expect(showValue(v(12), '%')).toBe('12%');
    expect(showValue(v(1500), 'B')).toBe('1,500 B');
  });

  it('leaves a word unit to the table label, singular or plural', () => {
    expect(showValue(v(43), 'reports')).toBe('43');
    expect(showValue(v(1), 'reports')).toBe('1');
    expect(showValue(of(0, 3), 'tries')).toBe('0 of 3');
    expect(showValue(of(118, 12871), 'moves')).toBe('118 of 12,871');
  });

  it('writes both ends of a range to the same decimals', () => {
    expect(showValue(r(8.6, 8.66), 'ms')).toBe('8.60-8.66 ms');
    expect(showValue(r(0.12, 0.4), 'ms')).toBe('0.12-0.40 ms');
    expect(showValue(r(6144, 6212), 'reports')).toBe('6,144-6,212');
  });

  it('writes a range whose ends match as one number', () => {
    expect(showValue(r(43, 43), 'reports')).toBe('43');
    expect(showValue(r(0.9, 0.9), 'ms')).toBe('0.9 ms');
  });

  it('writes a range of negative values with to, not a run of minus signs', () => {
    expect(showValue(r(-2, -1), 'ms')).toBe('-2 to -1 ms');
    expect(showValue(r(-1, 1), 'counts')).toBe('-1 to 1');
  });

  it('keeps every digit of a very small number', () => {
    expect(showValue(v(0.0000005), 's')).toBe('0.0000005 s');
  });

  it('keeps the decimals measured', () => {
    expect(showValue(v(0.000125), 's')).toBe('0.000125 s');
    expect(showValue(v(1234.5), 'µs')).toBe('1,234.5 µs');
  });
});

describe('span', () => {
  it('gives the low and high ends a bar is drawn between', () => {
    expect(span(v(3))).toEqual([3, 3]);
    expect(span(r(1, 2))).toEqual([1, 2]);
    expect(span(of(1, 4))).toEqual([0.25, 0.25]);
  });
});
