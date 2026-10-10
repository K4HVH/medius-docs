import type { TopDevice } from '../../dashboard/stats';
import type { CompatEntry } from './compatibility';

export interface CompatRow extends CompatEntry {
  boxes?: number;
}

const KIND: Record<number, CompatEntry['kind']> = { 1: 'keyboard', 2: 'mouse' };
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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Each row with the id its table row carries: `device-` and its name, and its ids after the name where
// rows share one, so a row's id never turns on where another row sorts.
export function withIds<T extends CompatEntry>(rows: readonly T[]): (T & { id: string })[] {
  const named = new Map<string, number>();
  for (const r of rows) named.set(slug(r.name), (named.get(slug(r.name)) ?? 0) + 1);
  const taken = new Set<string>();
  return rows.map((r) => {
    const base = `device-${slug(r.name)}`;
    let id = named.get(slug(r.name))! > 1 && r.vidpid ? `${base}-${slug(r.vidpid)}` : base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return { ...r, id };
  });
}
