import type { TopDevice } from '../../dashboard/stats';
import type { CompatEntry } from './compatibility';

export interface CompatRow extends CompatEntry {
  boxes?: number;
}

const KIND: Record<number, CompatEntry['kind']> = { 1: 'keyboard', 2: 'mouse' };
const hex = (n: number) => n.toString(16).padStart(4, '0');

// The reports, plus every device the stats saw cloned on at least minBoxes boxes. The stats only record a
// device once a box has cloned it, so one with no report counts as working. A device on fewer boxes stays
// out: one box is one person.
export function mergeCompat(entries: readonly CompatEntry[], top: TopDevice[] | null, minBoxes = 2): CompatRow[] {
  const rows: CompatRow[] = entries.map((e) => ({ ...e }));
  if (!top) return rows;
  for (const d of top) {
    if (d.boxes < minBoxes) continue;
    const vidpid = `${hex(d.vid)}:${hex(d.pid)}`;
    const known = rows.find((r) => r.vidpid === vidpid);
    if (known) {
      known.boxes = d.boxes;
      continue;
    }
    const product = d.product?.trim();
    rows.push({
      name: product && product !== 'None' ? product : vidpid,
      kind: KIND[d.kind] ?? 'other',
      verdict: 'works',
      vidpid,
      boxes: d.boxes,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
