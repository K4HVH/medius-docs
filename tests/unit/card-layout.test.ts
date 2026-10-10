// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFace, measure, fitTitle, clampLines, drawable } from '../../src/app/card/layout';

const face = (name: string) => loadFace(readFileSync(`server/og/fonts/${name}.ttf`));
const bold = face('inter-700');
const regular = face('inter-400');

const TITLE = { width: 1056, tracking: -0.045 };
const wide = (lines: string[], size: number, width = 1056, tracking = -0.045) =>
  lines.every((l) => measure(bold, l, size, tracking) <= width);

describe('measure', () => {
  it('adds the tracking between characters, in ems', () => {
    const plain = measure(bold, 'MEDIUS', 30, 0);
    expect(measure(bold, 'MEDIUS', 30, 0.08)).toBeCloseTo(plain + 0.08 * 30 * 5, 5);
  });

  it('scales with the size', () => {
    expect(measure(regular, 'Lock', 62, 0)).toBeCloseTo(2 * measure(regular, 'Lock', 31, 0), 5);
  });

  it('measures nothing as zero', () => {
    expect(measure(bold, '', 140, -0.045)).toBe(0);
  });
});

describe('fitTitle', () => {
  it('sets a short title at 140 on one line', () => {
    expect(fitTitle(bold, 'Lock', TITLE)).toEqual({ size: 140, lines: ['Lock'] });
  });

  it('shrinks a long title to two whole-word lines inside the width', () => {
    const text = 'Does my software need updating when Medius updates?';
    const { size, lines } = fitTitle(bold, text, TITLE);
    expect(size).toBeLessThan(140);
    expect(size).toBeGreaterThanOrEqual(56);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).toBe(text);
    expect(wide(lines, size)).toBe(true);
  });

  it('takes the largest size that fits', () => {
    const text = 'Does my software need updating when Medius updates?';
    const { size } = fitTitle(bold, text, TITLE);
    const above = fitTitle(bold, text, { ...TITLE, max: size + 1, min: size + 1 });
    expect(above.lines.at(-1)!.endsWith('…') || !wide(above.lines, size + 1)).toBe(true);
  });

  it('gives way to the room the rest of the card needs', () => {
    expect(fitTitle(bold, 'Lock', { ...TITLE, room: (s) => s <= 100 }).size).toBe(100);
  });

  it('tells room how many lines it would take', () => {
    const seen = new Set<number>();
    fitTitle(bold, 'Does my software need updating when Medius updates?', {
      ...TITLE,
      room: (_s, n) => (seen.add(n), true),
    });
    expect([...seen]).toEqual([2]);
  });

  it('stops at the minimum and ends the last line in an ellipsis on a word', () => {
    const text = Array(30).fill('Wireless receiver').join(' ');
    const { size, lines } = fitTitle(bold, text, TITLE);
    expect(size).toBe(56);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(text.startsWith(`${lines[0]} ${lines[1].slice(0, -1)}`)).toBe(true);
    expect(wide(lines, size)).toBe(true);
  });

  it('keeps lines given to it as they are', () => {
    const given = ['Replacement firmware', 'for the MAKCU box.'];
    const { size, lines } = fitTitle(bold, given, TITLE);
    expect(lines).toEqual(given);
    expect(size).toBeLessThan(140);
    expect(wide(lines, size)).toBe(true);
    expect(wide(lines, size + 1)).toBe(false);
  });

  it('collapses runs of white space', () => {
    expect(fitTitle(bold, '  Lock \n  ', TITLE).lines).toEqual(['Lock']);
  });
});

describe('clampLines', () => {
  const text =
    'Medius is replacement firmware for the MAKCU box: it clones your mouse or keyboard to the PC and adds input sent over an open protocol, so any program can drive it from any language.';

  it('returns text that fits in its lines whole', () => {
    const short = 'Mouse. Reported on v3.0.1.';
    expect(clampLines(regular, short, 31, 980, 2)).toEqual([short]);
  });

  it('ends text past its lines in an ellipsis on a word', () => {
    const lines = clampLines(regular, text, 31, 980, 2);
    expect(lines).toHaveLength(2);
    const last = lines[1];
    expect(last.endsWith('…')).toBe(true);
    const kept = `${lines[0]} ${last.slice(0, -1)}`;
    expect(text.startsWith(kept)).toBe(true);
    expect(text[kept.length]).toBe(' ');
    expect(lines.every((l) => measure(regular, l, 31, 0) <= 980)).toBe(true);
  });

  it('drops the punctuation an ellipsis would follow', () => {
    const lines = clampLines(regular, 'one, two, three, four, five, six, seven', 31, measure(regular, 'one, two…', 31, 0) + 1, 1);
    expect(lines).toEqual(['one, two…']);
  });

  it('cuts a word wider than the box', () => {
    const word = 'X'.repeat(200);
    const lines = clampLines(regular, word, 31, 400, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(lines.every((l) => measure(regular, l, 31, 0) <= 400)).toBe(true);
  });

  it('returns no lines for no text', () => {
    expect(clampLines(regular, '', 31, 980, 2)).toEqual([]);
  });
});

describe('drawable', () => {
  it('drops characters the font lacks', () => {
    expect(bold.hasChar('中')).toBe(false);
    expect(drawable(bold, 'Mouse 中文 Pro')).toBe('Mouse Pro');
  });

  it('keeps the letter under an accent the font lacks', () => {
    expect(bold.hasChar('ǎ')).toBe(false);
    expect(drawable(bold, 'Hǎo')).toBe('Hao');
  });

  it('drops control characters, though the font maps some', () => {
    expect(bold.hasChar('\u0000')).toBe(true);
    expect(drawable(bold, 'Mo\u0000use\u0007')).toBe('Mouse');
  });

  it('never sets an accent the font lacks as a mark beside its letter', () => {
    const lacking = [...'źŚşřůĳ'].find((c) => !bold.hasChar(c) && /\p{M}/u.test(c.normalize('NFD')));
    expect(lacking).toBeDefined();
    expect(drawable(bold, `M${lacking}x`)).toBe(`M${lacking!.normalize('NFD')[0]}x`);
  });

  it('keeps the characters it has', () => {
    expect(drawable(bold, 'Café: G502 · Über')).toBe('Café: G502 · Über');
  });
});
