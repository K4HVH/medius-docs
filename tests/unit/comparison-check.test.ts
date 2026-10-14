// The site's check of the comparison results: the faults medius-fw's tools/compare/results_check.py reports.
import { describe, expect, it } from 'vitest';
import { checkResults } from '../../src/app/data/comparison/check';
import { GOOD, ref } from './helpers/comparison-results';

type Json = Record<string, any>;
const broken = (change: (d: Json) => void) => {
  const d = structuredClone(GOOD) as Json;
  change(d);
  return checkResults(d);
};
const sections = (d: Json) => d.categories[0].sections;
const table = (d: Json, s = 0, t = 0) => sections(d)[s].tables[t];
const row = (d: Json, s = 0, t = 0, r = 0) => table(d, s, t).rows[r];
const names = (faults: string[], text: string) => expect(faults.some((f) => f.includes(text)), `${text} in ${faults.join(' | ')}`).toBe(true);

describe('checkResults', () => {
  it('passes a good file', () => {
    expect(checkResults(GOOD)).toEqual([]);
  });

  it('wants format 2, both versions, the rig and categories', () => {
    names(broken((d) => (d.format = 1)), 'format');
    names(broken((d) => (d.format = true)), 'format');
    names(broken((d) => delete d.firmware.medius), 'firmware.medius');
    names(broken((d) => (d.rig = '')), 'rig');
    names(broken((d) => (d.categories = [])), 'categories');
  });

  it('wants place ids, each used once in the file', () => {
    names(broken((d) => (row(d).id = 'Move_1')), 'Move_1');
    names(broken((d) => (row(d).id = 'move-1\n')), 'move-1');
    names(broken((d) => (row(d, 0, 2, 0).id = 'move-rest-1')), 'move-rest-1');
    names(broken((d) => (sections(d)[1].id = 'move-latency')), 'move-latency');
    names(broken((d) => (row(d, 4).id = 'move-rest-1')), 'move-rest-1');
  });

  it('checks sections', () => {
    names(broken((d) => delete sections(d)[0].about), 'about');
    names(broken((d) => (sections(d)[0].tables = [])), 'tables');
    names(broken((d) => delete table(d).label), 'label');
  });

  it('wants every table to name its quantity', () => {
    names(broken((d) => delete table(d, 1).label), 'label');
    names(broken((d) => delete table(d, 3).label), 'label');
  });

  it('checks tables', () => {
    names(broken((d) => (table(d).kind = 'grid')), 'kind');
    names(broken((d) => delete table(d).key), 'key');
    names(broken((d) => (table(d).rows = [])), 'rows');
    names(broken((d) => (table(d).layer = 'radio')), 'radio');
    names(broken((d) => (table(d).caption = 'x')), 'caption');
  });

  it('checks measure tables', () => {
    names(broken((d) => delete table(d).unit), 'unit');
    names(broken((d) => (table(d).better = 'faster')), 'better');
    names(broken((d) => (table(d).hubs = 'genesys')), 'hubs');
    names(broken((d) => delete table(d).commands.medius), 'commands');
    names(broken((d) => delete row(d).medius), 'medius');
  });

  it('checks values', () => {
    names(broken((d) => (row(d, 0, 0, 1).medius.value = '1.02')), 'number');
    names(broken((d) => delete row(d, 0, 0, 1).medius.value), 'value');
    names(broken((d) => (row(d).stock.lo = 65.0)), 'lo');
    names(broken((d) => (row(d, 0, 0, 1).medius.lo = 1.0)), 'value');
    names(broken((d) => (row(d, 0, 2, 0).stock.of = 0)), 'of');
    names(broken((d) => (row(d, 0, 0, 1).medius.text = '1.02 ms')), 'text');
  });

  it('checks refs', () => {
    names(broken((d) => delete row(d).medius.src), 'src');
    names(broken((d) => (row(d).medius.src = [])), 'src');
    names(broken((d) => (row(d).medius.src[0].ptr = 'cells/0')), 'ptr');
    names(broken((d) => (row(d).medius.src[0].unit = 'ns')), 'unit');
    names(broken((d) => (row(d).medius.src[0].file = '../x.json')), 'file');
    names(broken((d) => (row(d).medius.src[0].file = '/tmp/x.json')), 'file');
    names(broken((d) => (row(d).medius.src[0].file = 'adoption/x.txt')), 'file');
    expect(broken((d) => (row(d).medius.src[0].file = 'adoption/pypi/x.json'))).toEqual([]);
    names(broken((d) => (row(d).medius.src[0].line = 4)), 'line');
  });

  it('checks outcome tables', () => {
    names(broken((d) => (row(d, 1).stock.is = 'Dropped')), 'Dropped');
    names(broken((d) => (table(d, 1).outcomes = ['Arrives'])), 'outcomes');
    names(broken((d) => (table(d, 1).outcomes = ['Arrives', 'Arrives'])), 'outcomes');
    names(broken((d) => (table(d, 2).ranked = 'no')), 'ranked');
    names(broken((d) => delete row(d, 1).stock.src), 'src');
  });

  it('checks feature tables', () => {
    expect(broken((d) => (table(d, 3).ranked = false))).toEqual([]);
    names(broken((d) => (table(d, 3).ranked = true)), 'ranked');
    names(broken((d) => Object.assign(row(d, 3), { medius: null, stock: null })), 'neither');
    names(broken((d) => (row(d, 3).medius = '')), 'medius');
    names(broken((d) => (row(d, 3).medius = { is: 'MOVE' })), 'medius');
  });

  it('checks settings tables', () => {
    names(broken((d) => (row(d, 4).box = 'both')), 'box');
    names(broken((d) => (row(d, 4).values = {})), 'rest-1');
    names(broken((d) => (row(d, 4).values.extra = { value: 1, src: [ref('a.json', '/a')] })), 'extra');
    names(broken((d) => delete table(d, 4).columns[0].unit), 'unit');
    names(broken((d) => (row(d, 4).default = 'yes')), 'default');
  });

  it('wants one thing per line', () => {
    names(broken((d) => (row(d).label = 'At rest; 1 count')), 'semicolon');
    names(broken((d) => (table(d, 1).outcomes = ['Arrives; late', 'Lost'])), 'semicolon');
    names(broken((d) => (row(d, 0, 2, 0).note = 'One run; stock only')), 'semicolon');
  });

  it('wants defects to name rows of results', () => {
    names(broken((d) => (d.defects[0].rows = ['nope'])), 'nope');
    names(broken((d) => (d.defects[0].rows = ['move-cold', 'absolute-move'])), 'absolute-move');
    names(broken((d) => (d.defects[0].rows = ['stock-auto'])), 'stock-auto');
    names(broken((d) => (d.defects[0].box = 'both')), 'box');
    names(broken((d) => (d.defects[0].rows = 'move-cold')), 'rows');
    names(broken((d) => (d.defects[0].rows = [])), 'rows');
    names(broken((d) => (d.defects[0].rows = ['move-cold', 'move-cold'])), 'twice');
    names(broken((d) => (d.defects[0].row = 'move-cold')), 'row');
    expect(broken((d) => (d.defects[0].rows = ['move-cold', 'move-rest-1']))).toEqual([]);
  });

  it('wants defects and pending as lists, empty or not', () => {
    names(broken((d) => delete d.defects), 'defects');
    names(broken((d) => (d.pending = null)), 'pending');
    expect(broken((d) => ((d.defects = []), (d.pending = [])))).toEqual([]);
    names(broken((d) => delete d.pending[0].needs), 'needs');
  });

  it('wants a pending test to name its category', () => {
    names(broken((d) => delete d.pending[0].category), 'category');
    names(broken((d) => (d.pending[0].category = 'nowhere')), 'nowhere');
  });

  it('lets a defect sit only on a row that shows a result', () => {
    names(broken((d) => (d.defects[0].rows = ['move-cold', 'move-rest-reports'])), 'move-rest-reports');
  });

  it('wants counts of a total on both cells, whole, and within the total', () => {
    names(broken((d) => delete row(d, 0, 2, 0).stock.of), 'of');
    names(broken((d) => (row(d, 0, 2, 0).stock.value = 5)), 'of');
    names(broken((d) => (row(d, 0, 2, 0).stock.value = 2.5)), 'whole');
  });

  it('wants µs written with the micro sign', () => {
    names(broken((d) => (table(d).unit = 'us')), 'µs');
    names(broken((d) => (table(d).unit = '\u03bcs')), 'µs');
  });

  it('wants a statistic other than p50 named in the label', () => {
    names(broken((d) => (table(d).stat = 'p95')), 'p95');
    expect(broken((d) => Object.assign(table(d), { stat: 'p95', label: 'Latency, p95' }))).toEqual([]);
  });

  it('wants both boxes to cite the same number of runs', () => {
    names(broken((d) => row(d).medius.src.push(ref('lat_medius.json', '/cells/2/p50', 'us'))), 'runs');
    names(broken((d) => (row(d).stock = { value: 64.2, src: [ref('lat_stock_gl.json', '/cells/0/p50', 'us')] })), 'runs');
  });

  it('lets a sum add up any number of refs', () => {
    expect(broken((d) => row(d, 0, 0, 1).medius.src.push(ref('lat_medius.json', '/cells/2/p50', 'us')))).toEqual([]);
  });

  it('reads blank text and the format number as the Python check does', () => {
    names(broken((d) => (d.rig = '\ufeff')), 'rig');
    names(broken((d) => (d.rig = '\x1c')), 'rig');
    expect(broken((d) => (d.format = 2.0))).toEqual([]);
  });

  it('reads a settings value only from the row itself', () => {
    names(broken((d) => (table(d, 4).columns[0].id = 'constructor')), 'constructor');
  });

  it('reports a wrong type rather than reading it', () => {
    expect(checkResults(null).length).toBeGreaterThan(0);
    expect(checkResults([]).length).toBeGreaterThan(0);
    names(broken((d) => (table(d).layer = 'constructor')), 'constructor');
    names(broken((d) => (sections(d)[0].tables = { kind: 'measure' })), 'tables');
    names(broken((d) => (row(d).stock = [1])), 'stock');
  });
});
