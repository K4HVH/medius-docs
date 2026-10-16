// The faults medius-fw's tools/compare/results_check.py reports, checked on the site's copy: every one, or
// none. The evidence stays in medius-fw, so refs are checked for shape here and resolved there.

const ID = /^[a-z0-9][a-z0-9-]*$/;
// What counts as blank: the same characters as the Python check, so both read a string alike.
const BLANK = /^[ \t\n\r\f\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\x1c-\x1f\x85]*$/;
const BOXES = ['stock', 'medius'] as const;
const KINDS = ['measure', 'outcome', 'feature', 'settings'];
const TIME = new Set(['us', 'µs', 'ms', 's']);

const TOP = new Set(['format', 'firmware', 'rig', 'layers', 'categories', 'defects', 'pending']);
const CATEGORY = new Set(['id', 'title', 'sections']);
const SECTION = new Set(['id', 'title', 'about', 'tables']);
const TABLE: Record<string, Set<string>> = {
  measure: new Set(['kind', 'label', 'key', 'rows', 'unit', 'better', 'stat', 'layer', 'n', 'hubs', 'commands']),
  outcome: new Set(['kind', 'label', 'key', 'rows', 'outcomes', 'ranked', 'commands']),
  feature: new Set(['kind', 'label', 'key', 'rows', 'ranked']),
  settings: new Set(['kind', 'label', 'key', 'rows', 'columns', 'layer', 'n']),
};
const ROW = new Set(['id', 'label', 'stock', 'medius', 'note']);
const SETTINGS_ROW = new Set(['id', 'box', 'label', 'default', 'values']);
const COLUMN = new Set(['id', 'label', 'unit', 'better']);
const VALUE = new Set(['value', 'lo', 'hi', 'of', 'src']);
const OUTCOME = new Set(['is', 'src']);
const REF = new Set(['file', 'ptr', 'unit']);
const DEFECT = new Set(['id', 'box', 'text', 'rows']);
const PENDING = new Set(['id', 'category', 'test', 'needs']);

type Obj = Record<string, unknown>;
const isObj = (o: unknown): o is Obj => typeof o === 'object' && o !== null && !Array.isArray(o);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const filled = (v: unknown): v is string => typeof v === 'string' && !BLANK.test(v);

export function checkResults(d: unknown): string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  const rowsOf = new Map<string, string>();
  const categories = new Set<string>();
  const fault = (where: string, what: string) => faults.push(`${where}: ${what}`);

  const fields = (o: unknown, allowed: Set<string>, where: string): o is Obj => {
    if (!isObj(o)) {
      fault(where, 'must be an object');
      return false;
    }
    for (const k of Object.keys(o).sort()) if (!allowed.has(k)) fault(where, `unknown field ${k}`);
    return true;
  };
  const text = (o: Obj, key: string, where: string, line = false) => {
    const v = o[key];
    if (!filled(v)) fault(where, `${key} must be non-empty text`);
    else if (line && v.includes(';')) fault(where, `${key} holds a semicolon: one thing per line`);
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
  const listed = (o: Obj, key: string, where: string, empty = false): unknown[] => {
    const v = o[key];
    if (!Array.isArray(v) || (!v.length && !empty)) {
      fault(where, `${key} must be a ${empty ? '' : 'non-empty '}list`);
      return [];
    }
    return v;
  };
  const refs = (o: Obj, where: string) => {
    const src = o.src;
    if (!Array.isArray(src) || !src.length) {
      fault(where, 'src must list at least one ref');
      return;
    }
    src.forEach((r, i) => {
      const rw = `${where}.src[${i}]`;
      if (!fields(r, REF, rw)) return;
      const f = r.file;
      if (!filled(f) || f.startsWith('/') || f.includes('\\') || f.split('/').includes('..') || !f.endsWith('.json'))
        fault(rw, `file ${JSON.stringify(f)} must name a .json file under evidence/`);
      if (typeof r.ptr !== 'string' || !r.ptr.startsWith('/')) fault(rw, `ptr ${JSON.stringify(r.ptr)} must be a JSON pointer starting with /`);
      if ('unit' in r && !TIME.has(r.unit as string)) fault(rw, `unit ${JSON.stringify(r.unit)} must be one of ${[...TIME].join(', ')}`);
    });
  };
  const value = (v: unknown, where: string) => {
    if (!fields(v, VALUE, where)) return;
    const has = (['value', 'lo', 'hi', 'of'] as const).filter((k) => k in v);
    for (const k of has) if (!isNumber(v[k])) fault(where, `${k} must be a number`);
    const shape = has.join(',');
    if (shape === 'lo,hi') {
      if (isNumber(v.lo) && isNumber(v.hi) && v.lo > v.hi) fault(where, 'lo must not be above hi');
    } else if (shape === 'value,of') {
      if (isNumber(v.of) && isNumber(v.value)) {
        if (v.of <= 0) fault(where, 'of must be above 0');
        if (!Number.isInteger(v.value) || !Number.isInteger(v.of)) fault(where, 'value and of must be whole numbers');
        else if (v.value > v.of) fault(where, 'value must not be above of');
      }
    } else if (shape !== 'value') fault(where, 'must hold value, lo and hi, or value and of');
    refs(v, where);
  };
  const outcome = (o: unknown, allowed: unknown[], where: string) => {
    if (!fields(o, OUTCOME, where)) return;
    if (!allowed.includes(o.is)) fault(where, `is ${JSON.stringify(o.is)} must be one of the table's outcomes`);
    refs(o, where);
  };

  if (!fields(d, TOP, 'file')) return faults;
  if (d.format !== 2) fault('file', `format must be 2, not ${JSON.stringify(d.format)}`);
  if (fields(d.firmware, new Set(BOXES), 'firmware')) for (const b of BOXES) text(d.firmware, b, `firmware.${b}`);
  text(d, 'rig', 'rig');
  const layers = isObj(d.layers) ? d.layers : {};
  if (!isObj(d.layers)) fault('layers', 'must be an object');
  for (const [k, v] of Object.entries(layers)) {
    if (!ID.test(k)) fault('layers', `layer ${JSON.stringify(k)} must be lowercase letters, digits and hyphens`);
    if (!filled(v)) fault(`layers.${k}`, 'must be non-empty text');
  }

  listed(d, 'categories', 'categories').forEach((c, ci) => {
    let cw = `categories[${ci}]`;
    if (!fields(c, CATEGORY, cw)) return;
    const cid = ident(c, 'category', cw);
    if (cid) categories.add(cid);
    cw = `categories[${cid}]`;
    text(c, 'title', cw);
    listed(c, 'sections', cw).forEach((s, si) => {
      let sw = `${cw}.sections[${si}]`;
      if (!fields(s, SECTION, sw)) return;
      sw = `${cw}.sections[${ident(s, 'section', sw)}]`;
      text(s, 'title', sw, true);
      text(s, 'about', sw);
      const tables = listed(s, 'tables', sw);
      tables.forEach((t, ti) => {
        const tw = `${sw}.tables[${ti}]`;
        const kind = isObj(t) ? t.kind : undefined;
        if (typeof kind !== 'string' || !KINDS.includes(kind)) {
          fault(tw, `kind ${JSON.stringify(kind)} must be one of ${KINDS.join(', ')}`);
          return;
        }
        if (!fields(t, TABLE[kind], tw)) return;
        text(t, 'label', tw, true);
        text(t, 'key', tw, true);
        if ('layer' in t && !(typeof t.layer === 'string' && Object.hasOwn(layers, t.layer))) fault(tw, `layer ${JSON.stringify(t.layer)} isn't in layers`);
        if ('n' in t) text(t, 'n', tw);
        if ('commands' in t && fields(t.commands, new Set(BOXES), `${tw}.commands`)) for (const b of BOXES) text(t.commands, b, `${tw}.commands`);
        if (kind === 'measure') {
          text(t, 'unit', tw);
          if (t.unit === 'us' || t.unit === '\u03bcs') fault(tw, `unit ${JSON.stringify(t.unit)} must be written µs (the micro sign)`);
          if (typeof t.stat === 'string' && t.stat !== 'p50' && typeof t.label === 'string' && !t.label.includes(t.stat))
            fault(tw, `label must name the statistic ${JSON.stringify(t.stat)}: the site shows no other`);
          if ('better' in t && t.better !== 'lower' && t.better !== 'higher') fault(tw, `better ${JSON.stringify(t.better)} must be lower or higher`);
          if ('stat' in t) text(t, 'stat', tw);
          if ('hubs' in t && t.hubs !== 'both') fault(tw, `hubs ${JSON.stringify(t.hubs)} must be both`);
        }
        let outs: unknown[] = [];
        if (kind === 'outcome') {
          const o = t.outcomes;
          if (Array.isArray(o) && o.length >= 2 && o.every(filled) && new Set(o).size === o.length) outs = o;
          else fault(tw, 'outcomes must list two or more different words');
          for (const x of outs as string[]) if (x.includes(';')) fault(tw, `outcome ${JSON.stringify(x)} holds a semicolon: one thing per line`);
        }
        if ('ranked' in t && t.ranked !== false) fault(tw, "ranked must be false where it's given");
        const cols: string[] = [];
        if (kind === 'settings')
          listed(t, 'columns', tw).forEach((col, i) => {
            const cwh = `${tw}.columns[${i}]`;
            if (!fields(col, COLUMN, cwh)) return;
            text(col, 'label', cwh, true);
            text(col, 'unit', cwh);
            if ('better' in col && col.better !== 'lower' && col.better !== 'higher') fault(cwh, `better ${JSON.stringify(col.better)} must be lower or higher`);
            if (typeof col.id === 'string' && ID.test(col.id) && !cols.includes(col.id)) cols.push(col.id);
            else fault(cwh, `id ${JSON.stringify(col.id)} must be a place id used once in the table`);
          });
        listed(t, 'rows', tw).forEach((r, ri) => {
          let rw = `${tw}.rows[${ri}]`;
          if (!fields(r, kind === 'settings' ? SETTINGS_ROW : ROW, rw)) return;
          const rid = ident(r, 'row', rw);
          rw = `${tw}.rows[${rid}]`;
          if (rid) rowsOf.set(rid, kind !== 'measure' || 'better' in t ? kind : 'unranked measure');
          text(r, 'label', rw, true);
          if ('note' in r) text(r, 'note', rw, true);
          if (kind === 'settings') {
            if (!BOXES.includes(r.box as never)) fault(rw, `box ${JSON.stringify(r.box)} must be stock or medius`);
            if ('default' in r && r.default !== true) fault(rw, "default must be true where it's given");
            const vals = r.values;
            if (!isObj(vals)) {
              fault(rw, 'values must be an object');
              return;
            }
            for (const k of cols) if (!Object.hasOwn(vals, k)) fault(rw, `values has no ${k}`);
            for (const k of Object.keys(vals)) {
              if (!cols.includes(k)) fault(rw, `values has ${k}, which isn't a column`);
              else value(vals[k], `${rw}.values.${k}`);
            }
            return;
          }
          if (kind === 'measure' && isObj(r.stock) && isObj(r.medius)) {
            const [s, m] = [r.stock, r.medius];
            if ('of' in s !== 'of' in m) fault(rw, 'of must be on both cells or neither');
            // A range cites one ref per run, a sum cites its parts, so only ranges need matching counts.
            if (('lo' in s || 'lo' in m) && Array.isArray(s.src) && Array.isArray(m.src) && s.src.length !== m.src.length)
              fault(rw, `the boxes cite ${s.src.length} and ${m.src.length} runs: each box gets the same number`);
          }
          for (const b of BOXES) {
            if (!(b in r)) fault(rw, `${b} is missing`);
            else if (kind === 'measure') value(r[b], `${rw}.${b}`);
            else if (kind === 'outcome') outcome(r[b], outs, `${rw}.${b}`);
            else if (r[b] !== null && !filled(r[b])) fault(rw, `${b} must be a command or null`);
          }
          if (kind === 'feature' && r.stock == null && r.medius == null) fault(rw, 'neither box has a command: the row compares nothing');
        });
      });
    });
  });

  listed(d, 'defects', 'defects', true).forEach((x, i) => {
    const w = `defects[${i}]`;
    if (!fields(x, DEFECT, w)) return;
    ident(x, 'defect', w);
    text(x, 'text', w);
    if (!BOXES.includes(x.box as never)) fault(w, `box ${JSON.stringify(x.box)} must be stock or medius`);
    const rs = x.rows;
    if (!Array.isArray(rs) || !rs.length || !rs.every((r) => typeof r === 'string')) {
      fault(w, 'rows must be a list of row ids, the one that shows it first');
      return;
    }
    for (const r of rs as string[]) {
      if (rs.filter((o) => o === r).length > 1) fault(w, `row ${JSON.stringify(r)} named twice`);
      if (!['measure', 'outcome'].includes(rowsOf.get(r) ?? '')) fault(w, `row ${JSON.stringify(r)} isn't a row of a ranked measure or an outcome table`);
    }
  });

  listed(d, 'pending', 'pending', true).forEach((p, i) => {
    const w = `pending[${i}]`;
    if (!fields(p, PENDING, w)) return;
    ident(p, 'pending', w);
    if (typeof p.category !== 'string' || !categories.has(p.category)) fault(w, `category ${JSON.stringify(p.category)} isn't a category in the file`);
    text(p, 'test', w);
    text(p, 'needs', w);
  });
  return faults;
}
