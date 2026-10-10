// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFace, measure } from '../../src/app/card/layout';
import { cardSvg, layoutCard, type Faces } from '../../src/app/card/svg';
import { BLUE, pageCard, type CardContent } from '../../src/app/card/content';
import { routeFor } from '../../src/app/routes';

const face = (name: string) => loadFace(readFileSync(`server/og/fonts/${name}.ttf`));
const faces: Faces = { regular: face('inter-400'), bold: face('inter-700'), mono: face('plex-mono-500') };

const card = (over: Partial<CardContent> = {}): CardContent => ({
  crumb: 'Native API / Commands',
  title: 'Lock',
  description: 'LOCK (0x0A): set how much of one physical input reaches the game PC.',
  address: 'medius.k4tech.net/native/commands/lock',
  fact: ['MAKCU', 'firmware'],
  colour: BLUE,
  ...over,
});

const run = (svg: string, label: string) => svg.match(new RegExp(`<path aria-label="${label}" fill="([^"]+)" d="[^"]+"/>`));

describe('layoutCard', () => {
  it('sets a short title at 140 with the description under it', () => {
    const l = layoutCard(card(), faces);
    expect(l.title).toEqual({ size: 140, lines: ['Lock'], whole: true });
    const desc = l.runs.filter((r) => r.face === 'regular');
    expect(desc.map((r) => r.text).join(' ')).toBe(card().description);
    expect(desc.every((r) => r.size === 31)).toBe(true);
  });

  it('sets the description smaller under a title of two lines', () => {
    const l = layoutCard(card({ title: 'Does my software need updating when Medius updates?' }), faces);
    expect(l.title.lines).toHaveLength(2);
    expect(l.runs.filter((r) => r.face === 'regular').every((r) => r.size === 27)).toBe(true);
  });

  it('keeps the body 28 px clear of the footer rule', () => {
    const long = Array(12).fill('one physical input reaches the game PC').join(', ');
    for (const c of [card({ description: long }), card({ title: long, description: long }), card({ list: [long, long] })]) {
      const l = layoutCard(c, faces);
      expect(l.bottom).toBeLessThanOrEqual(l.rule - 28);
      expect(l.runs.every((r) => r.width <= r.box + 0.01)).toBe(true);
    }
  });

  it('keeps every piece of text inside its box', () => {
    const c = card({
      crumb: 'C / C++ bindings / A group with a very long name indeed that runs on',
      address: `medius.k4tech.net/guide/compatibility/${'x'.repeat(120)}`,
      fact: ['Unsupported'],
    });
    const l = layoutCard(c, faces);
    for (const r of l.runs) {
      expect(r.width).toBeLessThanOrEqual(r.box + 0.01);
      expect(r.x).toBeGreaterThanOrEqual(72);
      expect(r.x + r.width).toBeLessThanOrEqual(1128 + 0.01);
    }
  });

  it('keeps the address clear of the fact', () => {
    const l = layoutCard(card({ address: `medius.k4tech.net/${'y'.repeat(120)}` }), faces);
    const address = l.runs.find((r) => r.text.startsWith('MEDIUS.K4TECH.NET'))!;
    const square = l.rects.find((r) => r.w === 10 && r.h === 10)!;
    expect(address.text.endsWith('…')).toBe(true);
    expect(address.x + address.width).toBeLessThan(square.x);
  });

  it('sets a long address smaller on the same baseline before cutting it', () => {
    const long = 'medius.k4tech.net/guide/compatibility/corsair-sabre-pro-champion-series';
    const l = layoutCard(card({ address: long, fact: ['Supported'] }), faces);
    const address = l.runs.find((r) => r.text.startsWith('MEDIUS.K4TECH.NET'))!;
    const fact = l.runs.find((r) => r.text === 'SUPPORTED')!;
    expect(address.text).toBe(long.toUpperCase());
    expect(address.size).toBeLessThan(18);
    expect(address.size).toBeGreaterThanOrEqual(14);
    expect(address.y).toBeCloseTo(fact.y, 5);
    expect(address.width).toBeLessThanOrEqual(address.box);
  });

  it('lists each line under a bar', () => {
    const l = layoutCard(card({ description: undefined, list: ['Fixed updates', 'Faster round trips'] }), faces);
    const items = l.runs.filter((r) => r.face === 'regular');
    expect(items.map((r) => r.text)).toEqual(['Fixed updates', 'Faster round trips']);
    expect(items.every((r) => r.x === 72 + 26 && r.size === 28)).toBe(true);
    expect(l.rects.filter((r) => r.w === 10 && r.h === 2)).toHaveLength(2);
  });

  it('notes text that lost characters the fonts lack', () => {
    const l = layoutCard(card({ title: 'Mouse 中文' }), faces);
    expect(l.title.lines).toEqual(['Mouse']);
    expect(l.dropped).toEqual(['Mouse 中文']);
    expect(layoutCard(card(), faces).dropped).toEqual([]);
  });

  it('keeps the home claim on its two lines', () => {
    const home = pageCard(routeFor('/')!);
    const l = layoutCard(home, faces);
    expect(l.title.lines).toEqual([...home.titleLines!]);
    expect(l.title.whole).toBe(true);
  });

  it('places right-hand text against the right margin, its last letter spaced as a browser does', () => {
    const l = layoutCard(card(), faces);
    const crumb = l.runs.find((r) => r.text === 'NATIVE API / COMMANDS')!;
    expect(crumb.x + crumb.width + 0.2 * 19).toBeCloseTo(1128, 5);
    expect(crumb.width).toBeCloseTo(measure(faces.mono, 'NATIVE API / COMMANDS', 19, 0.2), 5);
  });
});

describe('cardSvg', () => {
  it('draws the wordmark, crumb, title, address and fact', () => {
    const svg = cardSvg(card(), faces);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')).toBe(true);
    for (const label of ['MEDIUS', 'NATIVE API / COMMANDS', 'Lock', 'MEDIUS.K4TECH.NET/NATIVE/COMMANDS/LOCK', 'MAKCU', 'FIRMWARE'])
      expect(run(svg, label.replace(/[/.]/g, '\\$&'))).not.toBeNull();
    expect(run(svg, 'MAKCU')![1]).toBe('#fff');
    expect(run(svg, 'FIRMWARE')![1]).toBe('#7a7a7a');
  });

  it('draws the edge and the footer square in the colour', () => {
    const svg = cardSvg(card({ colour: '#10b981' }), faces);
    expect(svg).toContain('<rect x="0" y="170" width="4" height="132" fill="#10b981"/>');
    expect(svg.match(/<rect x="[\d.]+" y="[\d.]+" width="10" height="10" fill="#10b981"\/>/)).not.toBeNull();
  });

  it('turns the last line of a title that wraps blue', () => {
    const l = layoutCard(card({ title: 'Does my software need updating when Medius updates?' }), faces);
    const svg = cardSvg(card({ title: 'Does my software need updating when Medius updates?' }), faces);
    expect(run(svg, l.title.lines[0].replace(/\?/g, '\\?'))![1]).toBe('#fff');
    expect(run(svg, l.title.lines[1].replace(/\?/g, '\\?'))![1]).toBe(BLUE);
    expect(run(cardSvg(card(), faces), 'Lock')![1]).toBe('#fff');
  });

  it('writes every outline as numbers', () => {
    // opentype.js rounds a fraction like 1e-14 to NaN, and a renderer stops drawing a path at it.
    for (const c of [card(), pageCard(routeFor('/')!), pageCard(routeFor('/dashboard/changelog')!)]) {
      const paths = [...cardSvg(c, faces).matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
      expect(paths.length).toBeGreaterThan(5);
      const bad = paths.flatMap((d) => d.split(/(?=[MLQCZ])/)).filter((step) => !/^(?:Z|[MLQC]-?\d+(?:\.\d+)?(?:[ -]-?\d*(?:\.\d+)?)*)$/.test(step));
      expect(bad).toEqual([]);
    }
  });

  it('escapes the text it labels', () => {
    const svg = cardSvg(card({ title: 'A < B & "C"' }), faces);
    expect(svg).toContain('aria-label="A &lt; B &amp; &quot;C&quot;"');
    expect(svg).not.toContain('A < B');
  });
});
