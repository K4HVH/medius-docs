// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFace } from '../../src/app/card/layout';
import { layoutCard, type Faces } from '../../src/app/card/svg';
import { STYLE, deviceCard, helpCard, pageCard, type CardContent } from '../../src/app/card/content';
import { NOT_FOUND, ROUTES } from '../../src/app/routes';
import { HELP_ITEMS } from '../../src/app/data/help';
import { COMPAT } from '../../src/app/data/compatibility';
import { withIds } from '../../src/app/data/compatMerge';

const face = (name: string) => loadFace(readFileSync(`server/og/fonts/${name}.ttf`));
const faces: Faces = { regular: face('inter-400'), bold: face('inter-700'), mono: face('plex-mono-500') };

const cards: [string, CardContent][] = [
  ...[...ROUTES, NOT_FOUND].map((r): [string, CardContent] => [r.path, pageCard(r)]),
  ...HELP_ITEMS.map((i): [string, CardContent] => [`help ${i.id}`, helpCard(i)]),
  ...withIds(COMPAT).map((d): [string, CardContent] => [d.id, deviceCard(d)]),
];

describe('every card the site draws', () => {
  it.each(cards)('%s fits', (_name, c) => {
    const l = layoutCard(c, faces);
    expect(l.dropped).toEqual([]);
    expect(l.title.whole).toBe(true);
    expect(l.title.size).toBeGreaterThanOrEqual(56);
    expect(l.bottom).toBeLessThanOrEqual(l.rule - 28);
    for (const r of l.runs) {
      expect(r.width).toBeLessThanOrEqual(r.box + 0.01);
      expect(r.x).toBeGreaterThanOrEqual(72);
      expect(r.x + r.width).toBeLessThanOrEqual(1128 + 0.01);
    }
    // The crumb, address and fact are never cut.
    expect(l.runs.filter((r) => r.face === 'mono' && r.text.endsWith('…'))).toEqual([]);
  });
});

// A card's address carries its hash, and an address with a hash is kept for a year: drawn differently
// under the same hash, it would never reach anyone. Raise STYLE in src/app/card/content.ts when this
// fails, then record the new digest here.
const DRAWN = { style: 1, digest: 'd71bda121ae424b0' };

it('raises STYLE when the card is drawn differently', () => {
  const files = ['src/app/card/layout.ts', 'src/app/card/svg.ts', ...['inter-400', 'inter-700', 'plex-mono-500'].map((f) => `server/og/fonts/${f}.ttf`)];
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(f));
  expect({ style: STYLE, digest: h.digest('hex').slice(0, 16) }).toEqual(DRAWN);
});
