import { describe, it, expect } from 'vitest';
import { COMPAT, type CompatEntry } from '../../src/app/data/compatibility';
import { mergeCompat } from '../../src/app/data/compatMerge';
import type { TopDevice } from '../../src/dashboard/stats';

const entries: CompatEntry[] = [
  { name: 'Logitech G502 HERO', kind: 'mouse', verdict: 'works', vidpid: '046d:c08b' },
  { name: 'Wooting Two HE', kind: 'keyboard', verdict: 'works', note: 'Turn on imperfect clone' },
];

const top = (vid: number, pid: number, boxes: number, product: string | null = 'Thing', kind = 2): TopDevice => ({
  vid,
  pid,
  kind,
  product,
  boxes,
});

describe('mergeCompat', () => {
  it('returns the entries as they are when the stats are out', () => {
    expect(mergeCompat(entries, null)).toEqual(entries);
  });

  it('counts the boxes behind a reported device', () => {
    const rows = mergeCompat(entries, [top(0x046d, 0xc08b, 2)]);
    expect(rows.find((r) => r.vidpid === '046d:c08b')?.boxes).toBe(2);
  });

  it('never shows a device the stats saw on one box', () => {
    const rows = mergeCompat(entries, [top(0x1234, 0x5678, 1, 'Lonely Mouse')]);
    expect(rows.map((r) => r.name)).not.toContain('Lonely Mouse');
    expect(rows).toHaveLength(entries.length);
  });

  it('matches a reported device by name when its ids are not known, and adds up its ids\' boxes', () => {
    const rows = mergeCompat(entries, [top(0x31e3, 0x1220, 4, 'Wooting two HE', 1), top(0x31e3, 0x1221, 3, 'Wooting Two HE', 1)]);
    expect(rows).toHaveLength(entries.length);
    expect(rows.find((r) => r.name === 'Wooting Two HE')).toMatchObject({ boxes: 7, vidpid: '31e3:1220' });
  });

  it('keeps two stats devices with one product name apart by their ids', () => {
    const rows = mergeCompat(entries, [top(0x046d, 0xc547, 230, 'USB Receiver'), top(0x046d, 0xc539, 107, 'USB Receiver')]);
    expect(rows.filter((r) => r.name === 'USB Receiver').map((r) => [r.vidpid, r.boxes])).toEqual([
      ['046d:c547', 230],
      ['046d:c539', 107],
    ]);
  });

  it('adds only mice and keyboards from the stats, not other devices a box cloned', () => {
    const rows = mergeCompat(entries, [top(0x2dc8, 0x3106, 23, '8BitDo Ultimate Wireless', 0), top(0x1a86, 0x7523, 5, null, 0)]);
    expect(rows).toHaveLength(entries.length);
  });

  it('adds a device cloned on two boxes with no report, named by its product or else its ids, in name order, ids last', () => {
    const rows = mergeCompat(entries, [top(0x31e3, 0x1322, 2, 'Wooting 60HE+', 1), top(0x3837, 0x100a, 3, null), top(0x3838, 0x100b, 2, 'None')]);
    expect(rows.map((r) => r.name)).toEqual(['Logitech G502 HERO', 'Wooting 60HE+', 'Wooting Two HE', '3837:100a', '3838:100b']);
    expect(rows.find((r) => r.name === 'Wooting 60HE+')).toEqual({ name: 'Wooting 60HE+', kind: 'keyboard', verdict: 'works', vidpid: '31e3:1322', boxes: 2 });
  });
});

describe('COMPAT seed', () => {
  it('gives every report a verdict, a kind and its own name', () => {
    expect(COMPAT.length).toBeGreaterThan(40);
    expect(new Set(COMPAT.map((e) => e.name.toLowerCase())).size).toBe(COMPAT.length);
    for (const e of COMPAT) {
      expect(['works', 'partial', 'doesnt']).toContain(e.verdict);
      expect(['mouse', 'keyboard', 'other']).toContain(e.kind);
      if (e.vidpid) expect(e.vidpid).toMatch(/^[0-9a-f]{4}:[0-9a-f]{4}$/);
      if (e.note) expect(e.note).not.toMatch(/\.$/);
      expect(e.reported, e.name).toMatch(/^v\d+\.\d+\.\d+$/);
    }
  });

  it('says what a partial device lacks', () => {
    for (const e of COMPAT.filter((x) => x.verdict === 'partial')) expect(e.note, e.name).toBeTruthy();
  });
});
