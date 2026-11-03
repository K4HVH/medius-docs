// @vitest-environment node
import { expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { generate } from '../../src/app/data/comparison/generate';
import type { MeasureRow, OutcomeRow } from '../../src/app/data/comparison/types';
import { input } from './helpers/comparison-runs';

const rowOf = (r: ReturnType<typeof generate>['results'], id: string): unknown =>
  r.categories.flatMap((c) => c.sections.flatMap((s) => s.tables.flatMap((t) => t.rows as { id?: string }[]))).find((x) => x.id === id);

it('ranges a measure over three runs and rounds to resolution', () => {
  const { results, faults } = generate(input());
  expect(faults).toEqual([]);
  const row = rowOf(results, 'lat-p50') as MeasureRow;
  expect(row.stock).toMatchObject({ lo: 0.76, hi: 0.81 });
  expect(row.medius).toMatchObject({ value: 0.53 });
  expect(row.native).toMatchObject({ value: 0.5 });
  expect(row.stock.src).toEqual([0, 1, 2].map((k) => ({ file: 'runs/stock/20261103-100000.json', ptr: `/tests/latency/runs/${k}/lat/p50`, unit: 'us' })));
});

it('sums a count of a total', () => {
  const row = rowOf(generate(input()).results, 'lat-delivered') as MeasureRow;
  expect(row.stock).toMatchObject({ value: 298, of: 300 });
  expect(row.medius).toMatchObject({ value: 300, of: 300 });
  expect(row.stock.src).toHaveLength(6);
});

it('takes the worst outcome and lists the varied row', () => {
  const { results, varied, faults } = generate(input({ stockData: ['All data arrives', 'Some data lost', 'All data arrives'] }));
  expect((rowOf(results, 'data-mouse') as OutcomeRow).stock.is).toBe('Some data lost');
  expect(varied).toEqual(['data-mouse:stock']);
  expect(faults).toEqual([]);
});

it('rejects mismatched test versions', () => {
  expect(generate(input({ latencyVersion: 1 })).faults).toContainEqual(expect.stringMatching(/latency.*stock.*version 1.*2/));
});

it('rejects a medius run off the current release', () => {
  expect(generate(input({ medius: '3.4.7' })).faults).toContainEqual(expect.stringMatching(/medius.*3\.4\.7.*3\.5\.0/));
});

it('rejects fewer than three runs', () => {
  expect(generate(input({ runs: 2 })).faults).toContainEqual(expect.stringMatching(/latency.*2 runs/));
});

it('fails a defect whose rows no longer show it', () => {
  const i = input();
  i.defects = [{ id: 'medius-slow', box: 'medius', text: 'Medius is slow.', rows: ['lat-p50'] }];
  expect(generate(i).faults).toContainEqual(expect.stringMatching(/medius-slow.*lat-p50/));
});

it('fails a reference to a missing row', () => {
  const i = input();
  i.defects = [{ id: 'gone', box: 'stock', text: 'See {row:no-such-row:stock}.', rows: ['lat-p50'] }];
  expect(generate(i).faults).toContainEqual(expect.stringMatching(/gone.*no-such-row/));
});

it("fills a defect's row reference", () => {
  expect(generate(input()).results.defects[0].text).toBe('Stock takes 0.76-0.81 ms to move.');
});

it('the output passes checkResults', () => {
  expect(checkResults(generate(input()).results)).toEqual([]);
});

it('a defect shows on a count short of its total, or an outcome short of the best', () => {
  const i = input({ stockData: ['Some data lost', 'Some data lost', 'Some data lost'] });
  i.defects = [
    { id: 'drops', box: 'stock', text: 'Stock drops moves.', rows: ['lat-delivered'] },
    { id: 'loses', box: 'stock', text: 'Stock loses data.', rows: ['data-mouse'] },
    { id: 'medius-drops', box: 'medius', text: 'Medius drops moves.', rows: ['lat-delivered'] },
  ];
  expect(generate(i).faults).toEqual(['defect medius-drops: row lat-delivered no longer shows medius short of the best']);
});

it("uses the table's label for runs that disagree, where it has one", () => {
  const i = input({ stockData: ['All data arrives', 'Some data lost', 'All data arrives'] });
  const data = i.tests.find((t) => t.id === 'data')!;
  data.tables[0] = { ...data.tables[0], outcomes: ['All data arrives', 'Sometimes lost', 'Some data lost', 'Nothing arrives'], varies: 'Sometimes lost' };
  const { results, varied, faults } = generate(i);
  expect(faults).toEqual([]);
  expect((rowOf(results, 'data-mouse') as OutcomeRow).stock.is).toBe('Sometimes lost');
  expect(varied).toEqual(['data-mouse:stock']);
});
