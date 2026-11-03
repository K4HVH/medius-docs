// Builds the comparison's results from the tests' declarations and the run files the comparison tool wrote.
// Pure: the script around it reads the files and writes results.json.
import { checkResults } from './check';
import { showValue } from './result';
import type { Box, Category, Defect, FeatureTable, MeasureRow, OutcomeRow, Pending, Ref, Results, SettingsRow, Table, Value } from './types';

type Ptr = string | string[];
type RunBox = Box | 'native';

export interface RowDecl {
  id: string;
  label: string;
  note?: string;
  ptr?: Ptr;
  unit?: string;
  of?: number;
  of_ptr?: Ptr;
  native_ptr?: Ptr;
  target?: number;
  test?: string;
  box?: Box;
  default?: true;
  values?: Record<string, Ptr | { ptr: Ptr; unit?: string }>;
}

export interface TableDecl {
  section: string;
  order: number;
  kind: 'measure' | 'outcome' | 'settings';
  label: string;
  key: string;
  unit?: string;
  better?: 'lower' | 'higher' | 'nearer';
  stat?: string;
  layer?: string;
  n?: string;
  hubs?: 'both';
  resolution?: number;
  commands?: Record<Box, string>;
  outcomes?: string[];
  ranked?: false;
  columns?: { id: string; label: string; unit: string; better?: 'lower' | 'higher' }[];
  rows: RowDecl[];
}

export interface TestDecl {
  id: string;
  version: number;
  category: string;
  layout: string;
  boxes: RunBox[];
  tables: TableDecl[];
}

export interface RunEntry {
  version: number;
  runs: unknown[];
  failed?: string;
  skipped?: string;
  [k: string]: unknown;
}

export interface RunFileDoc {
  format: 'medius-compare-run/1';
  box: RunBox;
  entry: string;
  tool: { version: string };
  host: unknown;
  firmware: { version?: string; [k: string]: unknown };
  sims: unknown;
  tests: Record<string, RunEntry>;
}

export interface FactTable {
  section: string;
  order: number;
  table: FeatureTable;
}

export interface CategoryDecl {
  id: string;
  title: string;
  sections: { id: string; title: string; about: string }[];
}

export interface GenerateInput {
  site: { firmware: Record<Box, string>; rig: string };
  layers: Record<string, string>;
  categories: CategoryDecl[];
  defects: Defect[];
  pending: Pending[];
  facts: FactTable[];
  tests: TestDecl[];
  runs: { path: string; doc: RunFileDoc }[];
}

export interface Generated {
  results: Results;
  varied: string[];
  faults: string[];
}

const RUNS = 3;
const TIME: Record<string, number> = { us: 1e-6, µs: 1e-6, ms: 1e-3, s: 1 };
const BOXES: Box[] = ['stock', 'medius'];

function resolve(doc: unknown, ptr: string): unknown {
  let at = doc;
  for (const raw of ptr.split('/').slice(1)) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(at)) at = at[Number(key)];
    else if (at && typeof at === 'object' && key in at) at = (at as Record<string, unknown>)[key];
    else return undefined;
  }
  return at;
}

const list = (p: Ptr | undefined): string[] => (p === undefined ? [] : Array.isArray(p) ? p : [p]);
const decimals = (x: number) => (Number.isInteger(x) ? 0 : (String(x).split('.')[1] ?? '').length);
const round = (x: number, res?: number) => (res ? Number((Math.round(x / res) * res).toFixed(decimals(res))) : x);

interface Picked {
  path: string;
  entry: RunEntry;
}

export function generate(input: GenerateInput): Generated {
  const faults: string[] = [];
  const varied: string[] = [];
  const tests = new Map(input.tests.map((t) => [t.id, t]));

  for (const { path, doc } of input.runs) {
    if (doc.box === 'native') continue;
    const want = input.site.firmware[doc.box];
    if (doc.firmware.version !== want) faults.push(`${path}: ${doc.box} runs are on ${doc.firmware.version}; the comparison is of ${want}`);
  }

  const latest = new Map<string, Picked>();
  for (const { path, doc } of [...input.runs].sort((a, b) => a.path.localeCompare(b.path)))
    for (const [id, entry] of Object.entries(doc.tests)) latest.set(`${doc.box}:${id}`, { path, entry });

  const picked = (test: string, box: RunBox, where: string): Picked | undefined => {
    const decl = tests.get(test);
    const p = latest.get(`${box}:${test}`);
    if (!decl) {
      faults.push(`${where}: no test ${test}`);
      return undefined;
    }
    if (!p) {
      faults.push(`${where}: test ${test} has no run on ${box}`);
      return undefined;
    }
    if (p.entry.failed || p.entry.skipped) {
      faults.push(`${where}: test ${test} on ${box} ${p.entry.failed ? `failed: ${p.entry.failed}` : `was skipped: ${p.entry.skipped}`}`);
      return undefined;
    }
    if (p.entry.version !== decl.version) {
      faults.push(`${where}: test ${test} on ${box} ran version ${p.entry.version}; the declaration is version ${decl.version}`);
      return undefined;
    }
    if (p.entry.runs.length < RUNS) {
      faults.push(`${where}: test ${test} on ${box} has ${p.entry.runs.length} runs; it needs ${RUNS}`);
      return undefined;
    }
    return p;
  };

  const reads = (p: Picked, test: string, ptrs: Ptr | undefined, unit: string | undefined, where: string) => {
    const out: { ref: Ref; v: unknown; run: number }[] = [];
    p.entry.runs.forEach((raw, k) => {
      for (const ptr of list(ptrs)) {
        const v = resolve(raw, ptr);
        if (v === undefined) faults.push(`${where}: ${p.path} has nothing at /tests/${test}/runs/${k}${ptr}`);
        out.push({ ref: { file: p.path, ptr: `/tests/${test}/runs/${k}${ptr}`, ...(unit ? { unit } : {}) }, v, run: k });
      }
    });
    return out;
  };

  const value = (p: Picked, test: string, row: RowDecl, ptrs: Ptr | undefined, tableUnit: string | undefined, res: number | undefined, where: string): Value | undefined => {
    const got = reads(p, test, ptrs, row.unit, where);
    const scale = row.unit ? (TIME[row.unit] ?? NaN) / (TIME[tableUnit ?? ''] ?? NaN) : 1;
    if (Number.isNaN(scale)) {
      faults.push(`${where}: a value in ${row.unit} needs a table unit of time, not ${tableUnit}`);
      return undefined;
    }
    const nums = got.map((g) => g.v);
    if (nums.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      faults.push(`${where}: a value at ${got.find((g) => typeof g.v !== 'number')?.ref.ptr} is not a number`);
      return undefined;
    }
    const src = got.map((g) => g.ref);
    if (row.of !== undefined || row.of_ptr !== undefined) {
      const sum = (nums as number[]).reduce((a, b) => a + b, 0);
      let of = (row.of ?? 0) * got.length;
      if (row.of_ptr !== undefined) {
        const totals = reads(p, test, row.of_ptr, undefined, where).map((g) => g.v);
        if (totals.some((v) => typeof v !== 'number')) faults.push(`${where}: a total is not a number`);
        of = (totals as number[]).reduce((a, b) => a + b, 0);
      }
      return { value: sum, of, src };
    }
    const vals = (nums as number[]).map((v) => round(v * scale, res));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return lo === hi ? { value: lo, src } : { lo, hi, src };
  };

  const outcome = (p: Picked, test: string, row: RowDecl, outcomes: string[], where: string) => {
    const got = reads(p, test, row.ptr, undefined, where);
    const bad = got.find((g) => typeof g.v !== 'string' || !outcomes.includes(g.v));
    if (bad) {
      faults.push(`${where}: ${bad.ref.ptr} is ${JSON.stringify(bad.v)}, not one of the table's outcomes`);
      return undefined;
    }
    const seen = got.map((g) => g.v as string);
    const worst = seen.reduce((a, b) => (outcomes.indexOf(b) > outcomes.indexOf(a) ? b : a));
    return { is: worst, src: got.map((g) => g.ref), varied: new Set(seen).size > 1 };
  };

  const placed = new Map<string, { order: number; table: Table }[]>();
  const place = (section: string, order: number, table: Table) => placed.set(section, [...(placed.get(section) ?? []), { order, table }]);
  for (const f of input.facts) place(f.section, f.order, f.table);

  for (const t of input.tests) {
    for (const td of t.tables) {
      const where = (row: string) => `test ${t.id}, row ${row}`;
      const common = { label: td.label, key: td.key };
      if (td.kind === 'measure') {
        const rows: MeasureRow[] = [];
        for (const r of td.rows) {
          const test = r.test ?? t.id;
          const vals: Partial<Record<RunBox, Value>> = {};
          for (const b of [...BOXES, ...(r.native_ptr !== undefined ? (['native'] as const) : [])]) {
            const p = picked(test, b, where(r.id));
            if (!p) continue;
            const v = value(p, test, r, b === 'native' ? r.native_ptr : r.ptr, td.unit, td.resolution, `${where(r.id)}, ${b}`);
            if (v) vals[b] = v;
          }
          if (!vals.stock || !vals.medius) continue;
          rows.push({
            id: r.id,
            label: r.label,
            ...(r.note ? { note: r.note } : {}),
            stock: vals.stock,
            medius: vals.medius,
            ...(vals.native ? { native: vals.native } : {}),
            ...(r.target !== undefined ? { target: r.target } : {}),
          });
        }
        place(td.section, td.order, {
          kind: 'measure',
          ...common,
          unit: td.unit ?? '',
          ...(td.better ? { better: td.better } : {}),
          ...(td.stat ? { stat: td.stat } : {}),
          ...(td.layer ? { layer: td.layer } : {}),
          ...(td.n ? { n: td.n } : {}),
          ...(td.hubs ? { hubs: td.hubs } : {}),
          ...(td.commands ? { commands: td.commands } : {}),
          rows,
        });
      } else if (td.kind === 'outcome') {
        const outcomes = td.outcomes ?? [];
        const rows: OutcomeRow[] = [];
        for (const r of td.rows) {
          const test = r.test ?? t.id;
          const got: Partial<Record<Box, { is: string; src: Ref[] }>> = {};
          for (const b of BOXES) {
            const p = picked(test, b, where(r.id));
            const o = p && outcome(p, test, r, outcomes, `${where(r.id)}, ${b}`);
            if (!o) continue;
            if (o.varied) varied.push(`${r.id}:${b}`);
            got[b] = { is: o.is, src: o.src };
          }
          if (got.stock && got.medius) rows.push({ id: r.id, label: r.label, ...(r.note ? { note: r.note } : {}), stock: got.stock, medius: got.medius });
        }
        place(td.section, td.order, {
          kind: 'outcome',
          ...common,
          outcomes,
          ...(td.ranked === false ? { ranked: false as const } : {}),
          ...(td.commands ? { commands: td.commands } : {}),
          rows,
        });
      } else {
        const units = Object.fromEntries((td.columns ?? []).map((c) => [c.id, c.unit]));
        const rows: SettingsRow[] = [];
        for (const r of td.rows) {
          const box = r.box ?? 'stock';
          const test = r.test ?? t.id;
          const p = picked(test, box, where(r.id));
          if (!p) continue;
          const values: Record<string, Value> = {};
          for (const [col, at] of Object.entries(r.values ?? {})) {
            const { ptr, unit } = typeof at === 'string' || Array.isArray(at) ? { ptr: at, unit: r.unit } : at;
            const v = value(p, test, { ...r, unit }, ptr, units[col], td.resolution, `${where(r.id)}, ${col}`);
            if (v) values[col] = v;
          }
          rows.push({ id: r.id, box, label: r.label, ...(r.default ? { default: true as const } : {}), values });
        }
        place(td.section, td.order, {
          kind: 'settings',
          ...common,
          columns: td.columns ?? [],
          ...(td.layer ? { layer: td.layer } : {}),
          ...(td.n ? { n: td.n } : {}),
          rows,
        });
      }
    }
  }

  const categories: Category[] = input.categories.map((c) => ({
    id: c.id,
    title: c.title,
    sections: c.sections.map((s) => ({
      ...s,
      tables: (placed.get(s.id) ?? []).sort((a, b) => a.order - b.order).map((x) => x.table),
    })),
  }));
  const known = new Set(input.categories.flatMap((c) => c.sections.map((s) => s.id)));
  for (const s of placed.keys()) if (!known.has(s)) faults.push(`section ${s} is in no category`);

  const rowsById = new Map<string, { table: Table; row: MeasureRow | OutcomeRow }>();
  for (const c of categories)
    for (const s of c.sections)
      for (const table of s.tables) if (table.kind === 'measure' || table.kind === 'outcome') for (const row of table.rows) rowsById.set(row.id, { table, row });

  const defects = input.defects.map((d) => {
    const text = d.text.replace(/\{row:([a-z0-9-]+):(stock|medius|native)\}/g, (whole, id: string, box: RunBox) => {
      const at = rowsById.get(id);
      const v = at && (at.row as unknown as Record<string, Value | { is: string }>)[box];
      if (!at || !v) {
        faults.push(`defect ${d.id}: ${whole} names no row with that value`);
        return whole;
      }
      return 'is' in v ? v.is : showValue(v, at.table.kind === 'measure' ? at.table.unit : '');
    });
    for (const id of d.rows) if (!rowsById.has(id)) faults.push(`defect ${d.id}: row ${id} is not in the comparison`);
    const first = rowsById.get(d.rows[0]);
    if (first && !shows(first.table, first.row, d.box)) faults.push(`defect ${d.id}: row ${d.rows[0]} no longer shows ${d.box} short of the best`);
    return { ...d, text };
  });

  const results: Results = {
    format: 2,
    firmware: input.site.firmware,
    rig: input.site.rig,
    layers: input.layers,
    categories,
    defects,
    pending: input.pending,
  };
  faults.push(...checkResults(results));
  return { results, varied, faults };
}

const middle = (v: Value) => ('lo' in v ? (v.lo + v.hi) / 2 : v.value);

// Whether a row shows a box short of the best: a count under its total, an outcome other than the best, or a
// measure worse than the other box.
function shows(table: Table, row: MeasureRow | OutcomeRow, box: Box): boolean {
  const other: Box = box === 'stock' ? 'medius' : 'stock';
  if (table.kind === 'outcome') return (row as OutcomeRow)[box].is !== table.outcomes[0];
  if (table.kind !== 'measure') return true;
  const r = row as MeasureRow;
  const v = r[box];
  if (!('lo' in v) && v.of !== undefined) return v.value < v.of;
  if (!table.better) return true;
  const [mine, theirs] = [middle(v), middle(r[other])];
  if (table.better === 'lower') return mine > theirs;
  if (table.better === 'higher') return mine < theirs;
  const ref = r.native ? middle(r.native) : (r.target ?? 0);
  return Math.abs(mine - ref) > Math.abs(theirs - ref);
}
