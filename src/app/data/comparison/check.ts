// The faults medius-fw's tools/compare/results_check.py reports, for the site's copy: every one, or none.

const ID = /^[a-z0-9][a-z0-9-]*$/;
const VERDICTS = new Set(['medius', 'stock', 'equal', 'mixed', 'design', 'unranked']);
const BOXES = ['stock', 'medius'];

const TOP = new Set(['format', 'firmware', 'rig', 'layers', 'categories', 'defects', 'pending']);
const CATEGORY = new Set(['id', 'title', 'groups']);
const GROUP = new Set(['id', 'title', 'about', 'kind', 'label', 'rows', 'columns', 'chart']);
const ROW = new Set(['id', 'test', 'stock', 'medius', 'verdict', 'note', 'n', 'layer', 'hubs', 'evidence', 'reason', 'date', 'conditions']);
const GRID_ROW = new Set(['id', 'cells']);
const CELL = new Set(['text', 'value', 'unit']);
const CHART = new Set(['label', 'unit', 'points']);
const POINT = new Set(['x', 'stock', 'medius']);
const DEFECT = new Set(['id', 'box', 'text', 'category', 'group', 'row']);
const PENDING = new Set(['id', 'test', 'needs']);

type Obj = Record<string, unknown>;
const isObj = (o: unknown): o is Obj => typeof o === 'object' && o !== null && !Array.isArray(o);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function checkResults(d: unknown): string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  const fault = (where: string, what: string) => faults.push(`${where}: ${what}`);

  const text = (o: Obj, key: string, where: string) => {
    if (!filled(o[key])) fault(where, `${key} must be non-empty text`);
  };
  const fields = (o: unknown, allowed: Set<string>, where: string): o is Obj => {
    if (!isObj(o)) {
      fault(where, 'must be an object');
      return false;
    }
    for (const k of Object.keys(o).sort()) if (!allowed.has(k)) fault(where, `unknown field ${k}`);
    return true;
  };
  const ident = (o: Obj, kind: string, where: string): string | null => {
    const id = o.id;
    if (typeof id !== 'string' || !ID.test(id)) {
      fault(where, `id ${JSON.stringify(id)} must be lowercase letters, digits and hyphens`);
      return null;
    }
    if (seen.has(`${kind}:${id}`)) fault(where, `${kind} id ${id} is used twice`);
    seen.add(`${kind}:${id}`);
    return id;
  };
  const cell = (c: unknown, where: string) => {
    if (typeof c === 'string') {
      if (!c.trim()) fault(where, 'must not be empty');
      return;
    }
    if (!fields(c, CELL, where)) return;
    text(c, 'text', where);
    if ('value' in c) {
      if (!isNumber(c.value)) fault(where, 'value must be a number');
      if (!filled(c.unit)) fault(where, 'a value needs its unit');
    }
  };
  const list = (o: Obj, key: string, where: string): unknown[] => {
    const v = o[key];
    if (!Array.isArray(v) || v.length === 0) {
      fault(where, `${key} must be a non-empty list`);
      return [];
    }
    return v;
  };

  if (!fields(d, TOP, 'file')) return faults;
  if (d.format !== 1) fault('file', `format must be 1, not ${JSON.stringify(d.format)}`);
  if (fields(d.firmware, new Set(BOXES), 'firmware')) for (const b of BOXES) text(d.firmware, b, `firmware.${b}`);
  text(d, 'rig', 'rig');
  const layers = isObj(d.layers) ? d.layers : {};
  if (!isObj(d.layers)) fault('layers', 'must be an object');
  for (const [k, v] of Object.entries(layers)) {
    if (!ID.test(k)) fault('layers', `layer ${JSON.stringify(k)} must be lowercase letters, digits and hyphens`);
    if (!filled(v)) fault(`layers.${k}`, 'must be non-empty text');
  }

  const groupsOf = new Map<string, Set<string>>();
  const cats = Array.isArray(d.categories) && d.categories.length ? d.categories : [];
  if (!cats.length) fault('categories', 'must be a non-empty list');
  cats.forEach((c: unknown, ci) => {
    let cw = `categories[${ci}]`;
    if (!fields(c, CATEGORY, cw)) return;
    const cid = ident(c, 'category', cw);
    cw = `categories[${cid}]`;
    text(c, 'title', cw);
    list(c, 'groups', cw).forEach((g, gi) => {
      let gw = `${cw}.groups[${gi}]`;
      if (!fields(g, GROUP, gw)) return;
      const gid = ident(g, 'group', gw);
      gw = `${cw}.groups[${gid}]`;
      // The rows a defect may name: results, never a grid's rows.
      const rowIds = new Set<string>();
      groupsOf.set(`${cid}/${gid}`, rowIds);
      text(g, 'title', gw);
      text(g, 'about', gw);
      const rows = list(g, 'rows', gw);
      if (g.kind === 'rows') {
        if ('label' in g) text(g, 'label', gw);
        if ('columns' in g) fault(gw, 'columns belong to a grid');
        rows.forEach((r, ri) => {
          let rw = `${gw}.rows[${ri}]`;
          if (!fields(r, ROW, rw)) return;
          const rid = ident(r, 'row', rw);
          rw = `${gw}.rows[${rid}]`;
          if (rid) rowIds.add(rid);
          text(r, 'test', rw);
          for (const b of BOXES) {
            if (!(b in r)) fault(rw, `${b} is missing`);
            else cell(r[b], `${rw}.${b}`);
          }
          if (!VERDICTS.has(r.verdict as string))
            fault(rw, `verdict ${JSON.stringify(r.verdict)} must be one of ${[...VERDICTS].sort().join(', ')}`);
          if (r.verdict === 'unranked') text(r, 'reason', rw);
          for (const k of ['note', 'n', 'hubs', 'date']) if (k in r) text(r, k, rw);
          if ('layer' in r && !(typeof r.layer === 'string' && Object.hasOwn(layers, r.layer))) fault(rw, `layer ${JSON.stringify(r.layer)} isn't in layers`);
          if ('evidence' in r && !(Array.isArray(r.evidence) && r.evidence.every(filled))) fault(rw, 'evidence must be a list of file names');
          if ('conditions' in r && !isObj(r.conditions)) fault(rw, 'conditions must be an object');
        });
      } else if (g.kind === 'grid') {
        const cols = Array.isArray(g.columns) && g.columns.length >= 2 && g.columns.every(filled) ? g.columns : null;
        if (!cols) fault(gw, 'columns must list two or more headers');
        rows.forEach((r, ri) => {
          let rw = `${gw}.rows[${ri}]`;
          if (!fields(r, GRID_ROW, rw)) return;
          const rid = ident(r, 'row', rw);
          rw = `${gw}.rows[${rid}]`;
          if (!Array.isArray(r.cells) || (cols && r.cells.length !== cols.length)) {
            fault(rw, `cells must hold one per column (${cols?.length ?? 0})`);
            return;
          }
          r.cells.forEach((x, i) => cell(x, `${rw}.cells[${i}]`));
        });
      } else fault(gw, `kind ${JSON.stringify(g.kind)} must be rows or grid`);
      if ('chart' in g && fields(g.chart, CHART, `${gw}.chart`)) {
        const ch = g.chart;
        text(ch, 'label', `${gw}.chart`);
        text(ch, 'unit', `${gw}.chart`);
        list(ch, 'points', `${gw}.chart`).forEach((p, pi) => {
          const pw = `${gw}.chart.points[${pi}]`;
          if (!fields(p, POINT, pw)) return;
          text(p, 'x', pw);
          for (const b of BOXES)
            if (!(b in p) || (p[b] !== null && !isNumber(p[b]))) fault(pw, `${b} must be a number, or null where it wasn't measured`);
          if (p.stock == null && p.medius == null) fault(pw, 'needs a value for at least one box');
        });
      }
    });
  });

  const defects = d.defects;
  if (!Array.isArray(defects)) fault('defects', 'must be a list');
  else
    defects.forEach((x, i) => {
      const w = `defects[${i}]`;
      if (!fields(x, DEFECT, w)) return;
      ident(x, 'defect', w);
      text(x, 'text', w);
      if (!BOXES.includes(x.box as string)) fault(w, `box ${JSON.stringify(x.box)} must be stock or medius`);
      const bad = (['category', 'group', 'row'] as const).filter((k) => k in x && typeof x[k] !== 'string');
      for (const k of bad) fault(w, `${k} must be an id`);
      if (bad.length) return;
      const rows = groupsOf.get(`${x.category}/${x.group}`);
      if (!rows) fault(w, `no group ${JSON.stringify(x.group)} in category ${JSON.stringify(x.category)}`);
      else if ('row' in x && !rows.has(x.row as string)) fault(w, `no row ${JSON.stringify(x.row)} in group ${JSON.stringify(x.group)}`);
    });

  const pending = d.pending;
  if (!Array.isArray(pending)) fault('pending', 'must be a list');
  else
    pending.forEach((p, i) => {
      const w = `pending[${i}]`;
      if (!fields(p, PENDING, w)) return;
      ident(p, 'pending', w);
      text(p, 'test', w);
      text(p, 'needs', w);
    });
  return faults;
}
