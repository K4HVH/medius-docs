// @vitest-environment node
// Whether a box leads a measured row: each box's runs pooled with each run's own sampling error and the spread between
// runs, and a lead only where the two differ by more than 1.96 standard errors.
import { expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { generate } from '../../src/app/data/comparison/generate';
import { leadOf, pooled } from '../../src/app/data/comparison/lead';
import { resultOf } from '../../src/app/data/comparison/result';
import type { MeasureRow, MeasureTable } from '../../src/app/data/comparison/types';
import { LATENCY, input, runFile } from './helpers/comparison-runs';

// A run timing `n` samples: its p50 and their spread.
const run = (p50: number, sd: number, n = 100) => ({ y: p50, v: (1.2533 * sd) ** 2 / n });

it('pools runs with no spread between them to their weighted mean', () => {
  const p = pooled([run(10, 1), run(10, 1), run(10, 1)])!;
  expect(p.mu).toBeCloseTo(10);
  expect(p.tau2).toBe(0);
  expect(p.variance).toBeCloseTo((1.2533 ** 2) / 100 / 3);
});

it('widens the pooled error by the spread between runs', () => {
  const tight = pooled([run(10, 1), run(10.01, 1), run(9.99, 1)])!;
  const apart = pooled([run(8, 1), run(10, 1), run(12, 1)])!;
  expect(apart.tau2).toBeGreaterThan(0);
  expect(apart.variance).toBeGreaterThan(tight.variance * 10);
});

it('leads where the runs overlap but each box is steady', () => {
  // 742-760 against 755-770: overlapping, but every run of each is a tight median of 400 samples
  expect(leadOf('lower', [run(742, 20, 400), run(751, 20, 400), run(760, 20, 400)], [run(755, 20, 400), run(762, 20, 400), run(770, 20, 400)])).toBe('equal');
  expect(leadOf('lower', [run(700, 5, 400), run(701, 5, 400), run(702, 5, 400)], [run(701.5, 5, 400), run(703, 5, 400), run(704, 5, 400)])).toBe('stock');
});

it('calls a gap inside the noise level, though the ranges are apart', () => {
  // each run a median of 40 samples spread over a whole frame
  expect(leadOf('lower', [run(630, 290, 40)], [run(676, 290, 40), run(690, 290, 40), run(700, 290, 40)])).toBe('equal');
});

it('lets a box that ran once borrow the spread between the other box\'s runs', () => {
  const steady = [run(500, 10), run(501, 10), run(499, 10)];
  const spread = [run(400, 10), run(500, 10), run(600, 10)];
  expect(leadOf('lower', [run(480, 10)], steady)).toBe('stock');
  expect(leadOf('lower', [run(480, 10)], spread)).toBe('equal');
});

it('weighs runs without a recorded spread by the spread between them alone', () => {
  expect(leadOf('higher', [{ y: 999.5 }, { y: 1000.4 }, { y: 999.9 }], [{ y: 999.6 }, { y: 999.9 }, { y: 999.8 }])).toBe('equal');
  expect(leadOf('higher', [{ y: 3996 }, { y: 3990 }, { y: 4001 }], [{ y: 8441 }, { y: 8360 }, { y: 8400 }])).toBe('medius');
});

it('ranks a table ranked nearer by the gap to the reference, past the noise', () => {
  const native = { runs: [{ y: 100 }, { y: 100 }, { y: 100 }] };
  expect(leadOf('nearer', [run(101, 1), run(101, 1), run(101, 1)], [run(110, 1), run(110, 1), run(110, 1)], native)).toBe('stock');
  expect(leadOf('nearer', [run(99, 1), run(99, 1), run(99, 1)], [run(101, 1), run(101, 1), run(101, 1)], native)).toBe('equal');
  expect(leadOf('nearer', [run(90, 1), run(90, 1), run(90, 1)], [run(103, 1), run(103, 1), run(103, 1)], { target: 100 })).toBe('medius');
});

// The generator's rows carry the result, and the page reads it.
const summary = (p50: number, sd: number, n: number) => ({ lat: { n, sd, p50 }, a: { n: 50 }, b: { n: 50 } });
const entry = (runs: unknown[]) => ({ version: 2, layout: 'main', legs: ['rest'], devices: [], state: {}, integrity: {}, runs });

function withLatency(stock: unknown[], medius: unknown[]) {
  const i = input();
  const lower = { ...LATENCY, tables: LATENCY.tables.map((t, k) => (k === 0 ? { ...t, better: 'lower' as const } : t)) };
  i.tests = [lower, ...i.tests.slice(1)];
  i.defects = [];
  i.runs = i.runs.map((r) =>
    r.doc.box === 'stock' ? runFile('stock', '20261103-100000', { ...r.doc.tests, latency: entry(stock) })
    : r.doc.box === 'medius' ? runFile('medius', '20261103-110000', { ...r.doc.tests, latency: entry(medius) })
    : r,
  );
  return generate(i);
}

const rowOf = (r: ReturnType<typeof generate>['results'], id: string) =>
  r.categories.flatMap((c) => c.sections.flatMap((s) => s.tables.flatMap((t) => (t.rows as MeasureRow[]).map((row) => ({ t: t as MeasureTable, row })))))
    .find((x) => x.row.id === id)!;

it('stores each measured row\'s result, which the page reads over the ranges', () => {
  // overlapping ranges, steady boxes: a lead
  const a = withLatency([summary(700, 5, 400), summary(701, 5, 400), summary(702, 5, 400)], [summary(701.5, 5, 400), summary(703, 5, 400), summary(704, 5, 400)]);
  expect(a.faults).toEqual([]);
  const ra = rowOf(a.results, 'lat-p50');
  expect(ra.row.result).toBe('stock');
  expect(resultOf(ra.t, ra.row)).toBe('stock');
  // ranges apart, every run a median of a few samples over a whole frame: level
  const b = withLatency([summary(630, 290, 40), summary(640, 290, 40), summary(650, 290, 40)], [summary(676, 290, 40), summary(690, 290, 40), summary(700, 290, 40)]);
  const rb = rowOf(b.results, 'lat-p50');
  expect(rb.row.result).toBe('equal');
  expect(resultOf(rb.t, rb.row)).toBe('equal');
  expect(checkResults(a.results)).toEqual([]);
});

it('keeps the ranges\' rule for a count of a total', () => {
  const r = rowOf(generate(input()).results, 'lat-delivered');
  expect(r.row.result).toBeUndefined();
});
