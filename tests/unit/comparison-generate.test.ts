// @vitest-environment node
import { expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { generate, toolTests } from '../../src/app/data/comparison/generate';
import type { MeasureRow, OutcomeRow } from '../../src/app/data/comparison/types';
import { DATA, LATENCY, input } from './helpers/comparison-runs';

const entry3 = (runs: unknown[]) => ({ version: 1, layout: 'native', legs: ['start'], devices: [], state: {}, integrity: {}, runs });

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

it('lists the tests a run without the emulator takes, in id order: those with a still leg, and those with no legs', () => {
  const i = input();
  i.tests = [
    { ...LATENCY, legs: [{ id: 'moving', device: 'sim:moving' }, { id: 'rest', device: 'still-mouse' }, { id: 'keys', device: 'still-keyboard' }] },
    { ...DATA, legs: [{ id: 'mouse', device: 'sim:mouse' }] },
    { id: 'adoption', version: 1, category: 'devices', layout: 'main', boxes: ['stock', 'medius'], jams_stock: true, tables: [] },
  ];
  expect(toolTests(i.tests, generate(i).results)).toEqual([
    { id: 'adoption', devices: [], sections: [], jamsStock: true },
    { id: 'latency', devices: ['still-mouse', 'still-keyboard'], sections: ['timing'], jamsStock: false },
  ]);
});

it("places a test in every section its rows appear in, another test's tables included, in the results' order", () => {
  const i = input();
  const borrowed = { section: 'reach', order: 2, kind: 'measure' as const, label: 'Move', key: 'Moves', unit: 'ms', rows: [{ id: 'reach-lat', label: 'p50', test: 'latency', ptr: '/lat/p50', unit: 'us' }] };
  i.tests = [
    { ...DATA, legs: [{ id: 'mouse', device: 'sim:mouse' }], tables: [...DATA.tables, borrowed] },
    { ...LATENCY, legs: [{ id: 'rest', device: 'still-composite' }] },
  ];
  const { results, faults } = generate(i);
  expect(faults).toEqual([]);
  expect(toolTests(i.tests, results)).toEqual([{ id: 'latency', devices: ['still-composite'], sections: ['timing', 'reach'], jamsStock: false }]);
});

// The input with every test jamming stock, and one box's runs of each test cut to one.
const oneRun = (box: 'stock' | 'medius') => {
  const i = input();
  i.tests = i.tests.map((t) => ({ ...t, jams_stock: true }));
  for (const r of i.runs) if (r.doc.box === box) for (const e of Object.values(r.doc.tests)) e.runs = e.runs.slice(0, 1);
  return i;
};

it('accepts one stock run of a test that jams stock', () => {
  const { results, faults } = generate(oneRun('stock'));
  expect(faults).toEqual([]);
  expect((rowOf(results, 'lat-p50') as MeasureRow).stock).toMatchObject({ value: 0.76 });
});

it('still rejects one medius run of a test that jams stock', () => {
  expect(generate(oneRun('medius')).faults).toContainEqual(expect.stringMatching(/latency on medius has 1 runs; it needs 3/));
});

it("reads native beside each box's own runs where the test has no native runs", () => {
  const i = input();
  i.tests.push({
    id: 'bulk',
    version: 1,
    category: 'devices',
    layout: 'native',
    boxes: ['stock', 'medius'],
    tables: [{ section: 'reach', order: 2, kind: 'measure', label: 'Bulk', key: 'Endpoint', unit: '/s', better: 'higher', resolution: 1,
      rows: [{ id: 'bulk-in', label: 'Bulk IN', ptr: '/box', native_ptr: '/native' }] }],
  });
  const runs = (box: number[], native: number[]) => entry3(box.map((b, k) => ({ box: b, native: native[k] })));
  i.runs[0].doc.tests.bulk = runs([3996, 3996, 3997], [13104, 13101, 13093]);
  i.runs[1].doc.tests.bulk = runs([8758, 8760, 8757], [13110, 13098, 13105]);
  const { results, faults } = generate(i);
  expect(faults).toEqual([]);
  const row = rowOf(results, 'bulk-in') as MeasureRow;
  expect(row.native).toMatchObject({ lo: 13093, hi: 13110 });
  expect(row.native!.src).toHaveLength(6);
  expect(checkResults(results)).toEqual([]);
});
