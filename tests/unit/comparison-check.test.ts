// The site's check of the comparison results: the faults medius-fw's tools/compare/results_check.py reports.
import { describe, expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';

const GOOD = {
  format: 1,
  firmware: { stock: 'V4.094', medius: '3.4.6' },
  rig: 'Two boxes side by side, each fed by a USB device emulator',
  layers: { wire: 'USB packets on the bus, read with usbmon', evdev: "The kernel's input event times" },
  categories: [
    {
      id: 'injection',
      title: 'Injected motion',
      groups: [
        {
          id: 'streams',
          title: 'Command streams',
          about: 'A move every period, timed from command to report.',
          kind: 'rows',
          label: 'Rate',
          rows: [
            {
              id: 'stream-1000', test: '1,000 Hz', stock: { text: '10.8 ms', value: 10.8, unit: 'ms' }, medius: '1.85 ms',
              verdict: 'medius', n: '2,000 moves', layer: 'wire', hubs: 'both', evidence: ['stream_lag_stock_default.json'],
              note: 'p50', date: '2026-10-12', conditions: { rate_hz: 1000 },
            },
            { id: 'stream-hub', test: 'Clone time', stock: '0.8 s', medius: '1.1 s', verdict: 'unranked', reason: "The rigs' hubs differ" },
          ],
          chart: { label: 'Lag per count, p50', unit: 'ms', points: [{ x: '1,000 Hz', stock: 10.8, medius: 1.85 }] },
        },
        {
          id: 'smoothing',
          title: 'Smoothing settings',
          about: 'Each setting on its own.',
          kind: 'grid',
          columns: ['Setting', '1 count, at rest'],
          rows: [{ id: 'smoothing-stock-auto', cells: ['Stock, AUTO', '64.2 ms'] }],
        },
      ],
    },
  ],
  defects: [
    { id: 'parser-stuck', box: 'stock', text: 'The parser stays one command behind', category: 'injection', group: 'streams', row: 'stream-1000' },
  ],
  pending: [{ id: 'raw-move', test: 'Stock RAW_MOVE', needs: 'A run on the stock box' }],
};

type Json = Record<string, any>;
const broken = (change: (d: Json) => void) => {
  const d = structuredClone(GOOD) as Json;
  change(d);
  return checkResults(d);
};
const group = (d: Json, i = 0) => d.categories[0].groups[i];
const row = (d: Json, i = 0) => group(d).rows[i];
const names = (faults: string[], text: string) => expect(faults.some((f) => f.includes(text)), `${text} in ${faults.join(' | ')}`).toBe(true);

describe('checkResults', () => {
  it('passes a good file', () => {
    expect(checkResults(GOOD)).toEqual([]);
  });

  it('wants format 1, both versions and the rig', () => {
    names(broken((d) => (d.format = 2)), 'format');
    names(broken((d) => delete d.firmware.medius), 'firmware.medius');
    names(broken((d) => (d.rig = '')), 'rig');
  });

  it('wants place ids, each used once in the file', () => {
    names(broken((d) => (row(d).id = 'Stream_1000')), 'Stream_1000');
    names(broken((d) => (group(d).id = '-streams')), '-streams');
    names(broken((d) => (row(d, 1).id = 'stream-1000')), 'stream-1000');
    names(broken((d) => (group(d, 1).id = 'streams')), 'streams');
    names(broken((d) => d.categories.push(structuredClone(d.categories[0]))), 'injection');
  });

  it('checks groups', () => {
    names(broken((d) => (group(d).kind = 'table')), 'kind');
    names(broken((d) => delete group(d).about), 'about');
    names(broken((d) => (group(d).rows = [])), 'rows');
  });

  it('checks rows', () => {
    names(broken((d) => delete row(d).medius), 'medius');
    names(broken((d) => (row(d).verdict = 'win')), 'verdict');
    names(broken((d) => delete row(d, 1).reason), 'reason');
    names(broken((d) => (row(d).layer = 'radio')), 'radio');
    names(broken((d) => (row(d).stock = '')), 'stock');
  });

  it('checks cells', () => {
    names(broken((d) => (row(d).stock = { value: 10.8, unit: 'ms' })), 'text');
    names(broken((d) => (row(d).stock = { text: '10.8 ms', value: 10.8 })), 'unit');
    names(broken((d) => (row(d).stock = { text: '10.8 ms', value: '10.8', unit: 'ms' })), 'value');
  });

  it('wants a grid row to fill its columns', () => {
    names(broken((d) => (group(d, 1).rows[0].cells = ['Stock, AUTO'])), 'cells');
  });

  it('checks charts', () => {
    names(broken((d) => delete group(d).chart.points[0].medius), 'medius');
    names(broken((d) => (group(d).chart.points = [])), 'points');
  });

  it('wants defects to name what exists', () => {
    names(broken((d) => (d.defects[0].group = 'latency')), 'latency');
    names(broken((d) => (d.defects[0].row = 'stream-30')), 'stream-30');
    names(broken((d) => (d.defects[0].box = 'both')), 'box');
  });

  it('reports a field the format does not name', () => {
    names(broken((d) => (row(d).medius_note = 'x')), 'medius_note');
    names(broken((d) => (group(d).caption = 'x')), 'caption');
  });

  it('checks pending tests', () => {
    names(broken((d) => delete d.pending[0].needs), 'needs');
  });

  it('wants defects and pending as lists, empty or not', () => {
    names(broken((d) => delete d.defects), 'defects');
    names(broken((d) => (d.pending = null)), 'pending');
    expect(broken((d) => ((d.defects = []), (d.pending = [])))).toEqual([]);
  });

  it('lets a defect name a row of results, never a grid row', () => {
    names(broken((d) => Object.assign(d.defects[0], { group: 'smoothing', row: 'smoothing-stock-auto' })), 'smoothing-stock-auto');
    expect(broken((d) => (Object.assign(d.defects[0], { group: 'smoothing' }), delete d.defects[0].row))).toEqual([]);
  });

  it('reports a wrong type rather than reading it', () => {
    names(broken((d) => (d.defects[0].group = ['streams'])), 'group');
    names(broken((d) => (d.defects[0].category = ['injection'])), 'category');
    names(broken((d) => (row(d).layer = 'constructor')), 'constructor');
    names(broken((d) => (d.format = true)), 'format');
  });

  it('lets a chart point leave one box unmeasured, not both', () => {
    expect(broken((d) => (group(d).chart.points[0].stock = null))).toEqual([]);
    names(broken((d) => Object.assign(group(d).chart.points[0], { stock: null, medius: null })), 'at least one');
    names(broken((d) => (group(d).chart.points[0].stock = '10.8')), 'stock');
  });

  it('reports something other than an object rather than throwing', () => {
    expect(checkResults(null).length).toBeGreaterThan(0);
    expect(checkResults([]).length).toBeGreaterThan(0);
  });
});
