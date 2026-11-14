// @vitest-environment node
// Whether a box leads a measured row: each box's runs pooled with each run's own sampling error and the spread between
// runs, and a lead only where the two differ by more than 1.96 standard errors.
import { expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { generate } from '../../src/app/data/comparison/generate';
import { critical, leadOf, pooled } from '../../src/app/data/comparison/lead';
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

it('leads only past the noise of both boxes\' runs', () => {
  // 742-760 against 755-770: overlapping, each run a median of 400 samples
  expect(leadOf('lower', [run(742, 20, 400), run(751, 20, 400), run(760, 20, 400)], [run(755, 20, 400), run(762, 20, 400), run(770, 20, 400)])).toBe('equal');
  // 700-702 against 706-708, steady: a lead
  expect(leadOf('lower', [run(700, 5, 400), run(701, 5, 400), run(702, 5, 400)], [run(706, 5, 400), run(707, 5, 400), run(708, 5, 400)])).toBe('stock');
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
  // steady boxes 5 us apart: a lead
  const a = withLatency([summary(700, 5, 400), summary(701, 5, 400), summary(702, 5, 400)], [summary(706, 5, 400), summary(707, 5, 400), summary(708, 5, 400)]);
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

it('needs Student\'s t for the runs\' degrees of freedom, not 1.96', () => {
  expect(critical(4)).toBeCloseTo(2.776, 3);
  expect(critical(2)).toBeCloseTo(4.303, 3);
  expect(critical(1000)).toBeCloseTo(1.96, 2);
  // three runs a box, a gap of 2.3 standard errors: past 1.96, short of t(4)
  const s3 = [{ y: 10 }, { y: 11 }, { y: 12 }];
  const m3 = [{ y: 11.9 }, { y: 12.9 }, { y: 13.9 }];
  expect(leadOf('lower', s3, m3)).toBe('equal');
});

it('weighs a box that ran once by the other\'s spread, at t for the other\'s runs', () => {
  // one stock run 3 standard errors from three steady Medius runs: past t(4), short of t(2)
  const m3 = [{ y: 100 }, { y: 101 }, { y: 102 }];
  expect(leadOf('lower', [{ y: 97.8 }], m3)).toBe('equal');
  expect(leadOf('lower', [{ y: 90 }], m3)).toBe('stock');
});

it('ranks against the native runs when neither box says how it spreads', () => {
  expect(leadOf('nearer', [{ y: 99 }], [{ y: 105 }], { runs: [{ y: 104 }] })).toBe('medius');
});

it('counts the reference\'s own noise where the boxes sit either side of it', () => {
  const runs = (y: number) => [run(y, 1), run(y + 0.01, 1), run(y - 0.01, 1)];
  // 99 and 102 either side of a reference spread over 90-110: nearer by 1, inside the reference's noise
  const wide = { runs: [{ y: 90 }, { y: 100 }, { y: 110 }] };
  expect(leadOf('nearer', runs(99), runs(102), wide)).toBe('equal');
  const tight = { runs: [{ y: 99.9 }, { y: 100 }, { y: 100.1 }] };
  expect(leadOf('nearer', runs(99), runs(102), tight)).toBe('stock');
});
