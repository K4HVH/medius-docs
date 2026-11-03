// Declarations and run files for the generator's tests: two tests, three runs on each box and on the native
// reference.
import type { GenerateInput, RunFileDoc, TestDecl } from '../../../src/app/data/comparison/generate';

export const LATENCY: TestDecl = {
  id: 'latency',
  version: 2,
  category: 'injection',
  layout: 'main',
  boxes: ['stock', 'medius', 'native'],
  tables: [
    {
      section: 'timing',
      order: 1,
      kind: 'measure',
      label: 'Move',
      key: 'Moves',
      unit: 'ms',
      better: 'nearer',
      resolution: 0.01,
      rows: [
        { id: 'lat-p50', label: 'p50', ptr: '/lat/p50', unit: 'us', native_ptr: '/lat/p50' },
      ],
    },
    {
      section: 'timing',
      order: 2,
      kind: 'measure',
      label: 'Move',
      key: 'Moves',
      unit: 'moves',
      better: 'higher',
      rows: [{ id: 'lat-delivered', label: 'Delivered', ptr: ['/a/n', '/b/n'], of: 50 }],
    },
  ],
};

export const DATA: TestDecl = {
  id: 'data',
  version: 1,
  category: 'devices',
  layout: 'main',
  boxes: ['stock', 'medius'],
  tables: [
    {
      section: 'reach',
      order: 1,
      kind: 'outcome',
      label: 'Device',
      key: 'Devices',
      outcomes: ['All data arrives', 'Some data lost', 'Nothing arrives'],
      rows: [{ id: 'data-mouse', label: 'Mouse', ptr: '/outcomes/data-mouse' }],
    },
  ],
};

const latencyRun = (p50us: number, n: number) => ({ lat: { p50: p50us }, a: { n }, b: { n } });

export function runFile(box: 'stock' | 'medius' | 'native', stamp: string, tests: RunFileDoc['tests']): { path: string; doc: RunFileDoc } {
  const firmware = box === 'stock' ? { version: 'V4.122' } : box === 'medius' ? { version: '3.5.0', proto: 10 } : {};
  return {
    path: `runs/${box}/${stamp}.json`,
    doc: { format: 'medius-compare-run/1', box, entry: 'sim', tool: { version: '1.0.0' }, host: {}, firmware, sims: {}, tests },
  };
}

const entry = (version: number, runs: unknown[]) => ({ version, layout: 'main', legs: ['rest'], devices: [], state: {}, integrity: {}, runs });

export function input(over: Partial<{ stockData: string[]; medius: string; latencyVersion: number; runs: number }> = {}): GenerateInput {
  const n = over.runs ?? 3;
  const pick = <T>(xs: T[]) => xs.slice(0, n);
  return {
    site: { firmware: { stock: 'V4.122', medius: '3.5.0' }, rig: 'A test rig' },
    layers: { wire: 'Timed on the bus' },
    categories: [
      { id: 'injection', title: 'Injection', sections: [{ id: 'timing', title: 'Timing', about: 'How long a move takes.' }] },
      { id: 'devices', title: 'Devices', sections: [{ id: 'reach', title: 'Reach', about: 'What arrives.' }] },
    ],
    defects: [{ id: 'slow-move', box: 'stock', text: 'Stock takes {row:lat-p50:stock} to move.', rows: ['lat-p50'] }],
    pending: [],
    facts: [],
    tests: [LATENCY, DATA],
    runs: [
      runFile('stock', '20261103-100000', {
        latency: entry(over.latencyVersion ?? 2, pick([latencyRun(760, 49), latencyRun(812, 50), latencyRun(790, 50)])),
        data: entry(1, pick((over.stockData ?? ['All data arrives', 'All data arrives', 'All data arrives']).map((o) => ({ outcomes: { 'data-mouse': o } })))),
      }),
      {
        ...runFile('medius', '20261103-110000', {
          latency: entry(2, pick([latencyRun(531, 50), latencyRun(531.4, 50), latencyRun(530.6, 50)])),
          data: entry(1, pick(['All data arrives', 'All data arrives', 'All data arrives'].map((o) => ({ outcomes: { 'data-mouse': o } })))),
        }),
      },
      runFile('native', '20261103-120000', { latency: entry(2, pick([latencyRun(500, 50), latencyRun(500, 50), latencyRun(500, 50)])) }),
    ].map((r) => (r.doc.box === 'medius' && over.medius ? { ...r, doc: { ...r.doc, firmware: { version: over.medius } } } : r)),
  };
}
