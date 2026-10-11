import type { TopDevice } from '../../dashboard/stats';
import type { CompatEntry } from './compatibility';

export interface CompatRow extends CompatEntry {
  boxes?: number;
}

const KIND: Record<number, CompatEntry['kind']> = { 1: 'keyboard', 2: 'mouse' };

const SETTING = /imperfect clone|forced to 1000 Hz/;
// Where a note naming a setting links: the Options tab for the wire rate, else Imperfect clone.
export const fixHref = (note?: string): string | null =>
  note && SETTING.test(note) ? (/wire rate/.test(note) ? '/dashboard#options' : '/dashboard#imperfect-clone') : null;
const hex = (n: number) => n.toString(16).padStart(4, '0');

// The reports, plus every mouse and keyboard the stats saw cloned on at least minBoxes boxes. The stats
// only record a device once a box has cloned it, so one with no report counts as working. A device on fewer
// boxes stays out: one box is one person. A product name matches a report, never another stats device:
// receivers share names.
export function mergeCompat(entries: readonly CompatEntry[], top: TopDevice[] | null, minBoxes = 2): CompatRow[] {
  const rows: CompatRow[] = entries.map((e) => ({ ...e }));
  const reported = [...rows];
  if (!top) return rows;
  for (const d of top) {
    if (d.boxes < minBoxes) continue;
    const vidpid = `${hex(d.vid)}:${hex(d.pid)}`;
    const product = d.product?.trim();
    const known =
      rows.find((r) => r.vidpid === vidpid) ??
      (product ? reported.find((r) => r.name.toLowerCase() === product.toLowerCase()) : undefined);
    if (known) {
      // One device can reach the stats under two ids, wired and through its receiver.
      known.boxes = (known.boxes ?? 0) + d.boxes;
      known.vidpid ??= vidpid;
      continue;
    }
    // The page lists mice and keyboards; a box clones other devices too.
    const kind = KIND[d.kind];
    if (!kind) continue;
    rows.push({
      name: product && product !== 'None' ? product : vidpid,
      kind,
      verdict: 'works',
      vidpid,
      boxes: d.boxes,
    });
  }
  // A device known only by its ids sorts after the named ones.
  const bare = (r: CompatRow) => (r.name === r.vidpid ? 1 : 0);
  return rows.sort((a, b) => bare(a) - bare(b) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

// Latin letters that don't decompose into a base letter and a mark.
const FOLD: Record<string, string> = { ł: 'l', đ: 'd', ð: 'd', ø: 'o', ß: 'ss', æ: 'ae', œ: 'oe', þ: 'th', ı: 'i', ħ: 'h', ŋ: 'n' };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łđðøßæœþıħŋ]/g, (c) => FOLD[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Each row with the id its table row carries: `device-` and its name, and its ids after the name where
// rows share one, so a row's id never turns on where another row sorts. A name with no Latin letters is
// named by its ids.
export function withIds<T extends CompatEntry>(rows: readonly T[]): (T & { id: string })[] {
  const key = (r: T) => slug(r.name) || slug(r.vidpid ?? '') || 'unnamed';
  const named = new Map<string, number>();
  for (const r of rows) named.set(key(r), (named.get(key(r)) ?? 0) + 1);
  const taken = new Set<string>();
  return rows.map((r) => {
    const base = `device-${key(r)}`;
    let id = named.get(key(r))! > 1 && r.vidpid && slug(r.name) ? `${base}-${slug(r.vidpid)}` : base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return { ...r, id };
  });
}
