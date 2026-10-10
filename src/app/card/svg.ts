import type { PathCommand } from 'opentype.js';
import { BLUE, type CardContent } from './content';
import { type Face, clampLines, drawable, fitTitle, measure } from './layout';

export interface Faces {
  regular: Face;
  bold: Face;
  mono: Face;
}

type FaceName = keyof Faces;

// One piece of text, placed: x is where it starts, y its baseline, width its measure and box the most it
// may take.
export interface Run {
  text: string;
  face: FaceName;
  size: number;
  tracking: number;
  x: number;
  y: number;
  width: number;
  box: number;
  fill: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export interface CardLayout {
  runs: Run[];
  rects: Rect[];
  // whole: every word of the title is on the card.
  title: { size: number; lines: string[]; whole: boolean };
  bottom: number;
  rule: number;
  // The texts the fonts could not draw in full.
  dropped: string[];
}

// The approved card at 1200 x 630, in the page header's measures (docs/superpowers/specs, medius-fw).
const W = 1200;
const H = 630;
const LEFT = 72;
const RIGHT = W - LEFT;
const WIDE = RIGHT - LEFT;
const TOP = 62;
const BODY = 170;
const GAP = 30;
// The footer: 58 px up, its 18 px line under 22 px of padding and a 1 px rule.
const FOOT = H - 58 - 18;
const RULE = FOOT - 22 - 1;
const CLEAR = 28;

const MARK = { size: 30, tracking: 0.08 };
const CRUMB = { size: 19, tracking: 0.2 };
const SMALL = { size: 18, min: 14, tracking: 0.16 };
const TITLE = { max: 140, min: 56, lines: 2, tracking: -0.045, leading: 0.94 };
const DESC = { size: 31, under: 27, leading: 1.36, width: 980, lines: 2 };
const LIST = { size: 28, leading: 1.3, gap: 10, indent: 26, width: 1000 - 26, lines: 2 };

const WHITE = '#fff';
const TEXT = '#ccc';
const MUTED = '#8a8a8a';
const DIM = '#7a7a7a';
const LINE = '#2a2a2a';

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim().normalize('NFC');

// The baseline's depth in a CSS line box of the given height, as a browser sets it from the face's ascent
// and descent.
function baseline(face: Face, size: number, height: number): number {
  const asc = face.ascender / face.unitsPerEm;
  const desc = face.descender / face.unitsPerEm;
  return (height - (asc - desc) * size) / 2 + asc * size;
}

export function layoutCard(c: CardContent, faces: Faces): CardLayout {
  const runs: Run[] = [];
  const rects: Rect[] = [];
  const dropped: string[] = [];
  const clean = (face: FaceName, text: string) => {
    const kept = drawable(faces[face], text);
    if (kept !== tidy(text)) dropped.push(text);
    return kept;
  };
  const put = (face: FaceName, text: string, size: number, tracking: number, x: number, top: number, height: number, box: number, fill: string) => {
    if (text) runs.push({ text, face, size, tracking, x, y: top + baseline(faces[face], size, height), width: measure(faces[face], text, size, tracking), box, fill });
  };
  // Right-aligned as a browser sets it: letter-spacing follows the last letter too.
  const end = (face: FaceName, text: string, size: number, tracking: number) => RIGHT - measure(faces[face], text, size, tracking) - tracking * size;

  const mark = 'MEDIUS';
  const markWidth = measure(faces.bold, mark, MARK.size, MARK.tracking);
  put('bold', mark, MARK.size, MARK.tracking, LEFT, TOP, MARK.size, markWidth, WHITE);
  const crumbBox = WIDE - markWidth - 48;
  const crumb = clampLines(faces.mono, clean('mono', c.crumb.toUpperCase()), CRUMB.size, crumbBox, 1, CRUMB.tracking)[0] ?? '';
  put('mono', crumb, CRUMB.size, CRUMB.tracking, end('mono', crumb, CRUMB.size, CRUMB.tracking), TOP + (MARK.size - CRUMB.size) / 2, CRUMB.size, crumbBox, MUTED);

  const items = (c.list ?? []).map((i) => clampLines(faces.regular, clean('regular', i), LIST.size, LIST.width, LIST.lines)).filter((l) => l.length);
  const listHeight = items.reduce((h, l) => h + l.length * LIST.size * LIST.leading, 0) + Math.max(0, items.length - 1) * LIST.gap;
  const descText = c.description ? clean('regular', c.description) : '';
  const descs = new Map<number, { size: number; lines: string[] }>();
  const desc = (titleLines: number) => {
    const size = titleLines > 1 ? DESC.under : DESC.size;
    let d = descs.get(size);
    if (!d) descs.set(size, (d = { size, lines: descText ? clampLines(faces.regular, descText, size, DESC.width, DESC.lines) : [] }));
    return d;
  };
  const under = (titleLines: number) => {
    if (items.length) return listHeight;
    const d = desc(titleLines);
    return d.lines.length * d.size * DESC.leading;
  };
  const room = (size: number, lines: number) => {
    const below = under(lines);
    return BODY + lines * size * TITLE.leading + (below ? GAP + below : 0) <= RULE - CLEAR;
  };

  const titleText = c.titleLines ? c.titleLines.map((l) => clean('bold', l)) : clean('bold', c.title);
  const fit = fitTitle(faces.bold, titleText, { max: TITLE.max, min: TITLE.min, width: WIDE, lines: TITLE.lines, tracking: TITLE.tracking, room });
  const n = fit.lines.length;
  const lineHeight = fit.size * TITLE.leading;
  fit.lines.forEach((line, i) =>
    put('bold', line, fit.size, TITLE.tracking, LEFT, BODY + i * lineHeight, lineHeight, WIDE, n > 1 && i === n - 1 ? BLUE : WHITE),
  );
  rects.push({ x: 0, y: BODY, w: 4, h: 132, fill: c.colour });

  let top = BODY + n * lineHeight;
  if (items.length) {
    top += GAP;
    const height = LIST.size * LIST.leading;
    for (const lines of items) {
      rects.push({ x: LEFT, y: top + 13, w: 10, h: 2, fill: BLUE });
      lines.forEach((line, j) => put('regular', line, LIST.size, 0, LEFT + LIST.indent, top + j * height, height, LIST.width, TEXT));
      top += lines.length * height + LIST.gap;
    }
    top -= LIST.gap;
  } else {
    const d = desc(n);
    const height = d.size * DESC.leading;
    if (d.lines.length) top += GAP;
    d.lines.forEach((line, j) => put('regular', line, d.size, 0, LEFT, top + j * height, height, DESC.width, TEXT));
    top += d.lines.length * height;
  }

  rects.push({ x: LEFT, y: RULE, w: WIDE, h: 1, fill: LINE });
  const lead = clean('mono', c.fact[0].toUpperCase());
  const tail = c.fact[1] ? clean('mono', c.fact[1].toUpperCase()) : '';
  const fact = tail ? `${lead} ${tail}` : lead;
  const factX = end('mono', fact, SMALL.size, SMALL.tracking);
  const factWidth = RIGHT - factX;
  const footBase = baseline(faces.mono, SMALL.size, SMALL.size);
  put('mono', lead, SMALL.size, SMALL.tracking, factX, FOOT, SMALL.size, factWidth, WHITE);
  if (tail) {
    const at = measure(faces.mono, `${lead} `, SMALL.size, SMALL.tracking) + SMALL.tracking * SMALL.size;
    put('mono', tail, SMALL.size, SMALL.tracking, factX + at, FOOT, SMALL.size, factWidth - at, DIM);
  }
  // The square sits on the baseline, raised 1 px, with 12 px before the fact.
  rects.push({ x: factX - 22, y: FOOT + footBase - 11, w: 10, h: 10, fill: c.colour });
  // A long address is set smaller, on the footer's baseline, before it is cut.
  const addressBox = factX - 22 - LEFT - 32;
  const addressText = clean('mono', c.address.toUpperCase());
  let addressSize = SMALL.size;
  while (addressSize > SMALL.min && measure(faces.mono, addressText, addressSize, SMALL.tracking) > addressBox) addressSize -= 0.5;
  const address = clampLines(faces.mono, addressText, addressSize, addressBox, 1, SMALL.tracking)[0] ?? '';
  if (address)
    runs.push({
      text: address,
      face: 'mono',
      size: addressSize,
      tracking: SMALL.tracking,
      x: LEFT,
      y: FOOT + footBase,
      width: measure(faces.mono, address, addressSize, SMALL.tracking),
      box: addressBox,
      fill: DIM,
    });

  const whole = fit.lines.join(' ') === (Array.isArray(titleText) ? titleText.join(' ') : titleText);
  return { runs, rects, title: { size: fit.size, lines: fit.lines, whole }, bottom: top, rule: RULE, dropped };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number) => String(Math.round(v * 100) / 100);

// Written here, not by opentype.js's toPathData: it rounds a fraction like 1e-14 to NaN, and a renderer
// stops drawing a path there.
function pathData(commands: PathCommand[]): string {
  return commands
    .map((c) => {
      if (c.type === 'Z') return 'Z';
      if (c.type === 'Q') return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
      if (c.type === 'C') return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
      return `${c.type}${num(c.x)} ${num(c.y)}`;
    })
    .join('');
}

// The ground's tint is a CSS gradient at 205deg; this is its line across the card, as CSS draws it.
function tintLine(angle: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
  return { x1: W / 2 - dx * half, y1: H / 2 - dy * half, x2: W / 2 + dx * half, y2: H / 2 + dy * half };
}

// The card as an SVG document. Text is drawn as the fonts' outlines, set where layoutCard measured it, so
// the renderer needs no fonts and draws exactly what was measured.
export function cardSvg(c: CardContent, faces: Faces): string {
  const l = layoutCard(c, faces);
  const t = tintLine(205);
  const rects = l.rects.map((r) => `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="${r.fill}"/>`);
  const paths = l.runs.map((r) => {
    const path = faces[r.face].getPath(r.text, r.x, r.y, r.size, { kerning: true, letterSpacing: r.tracking });
    return `<path aria-label="${esc(r.text)}" fill="${r.fill}" d="${pathData(path.commands)}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    '<defs>',
    '<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">',
    '<rect width="10" height="1" fill="rgb(120,120,135)" fill-opacity=".1"/><rect width="1" height="10" fill="rgb(120,120,135)" fill-opacity=".1"/>',
    '</pattern>',
    `<linearGradient id="tint" gradientUnits="userSpaceOnUse" x1="${num(t.x1)}" y1="${num(t.y1)}" x2="${num(t.x2)}" y2="${num(t.y2)}">`,
    '<stop offset=".35" stop-color="rgb(0,40,110)" stop-opacity="0"/><stop offset="1" stop-color="rgb(0,40,110)" stop-opacity=".35"/>',
    '</linearGradient>',
    '</defs>',
    `<rect width="${W}" height="${H}" fill="#000"/>`,
    `<rect width="${W}" height="${H}" fill="url(#grid)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#tint)"/>`,
    ...rects,
    ...paths,
    '</svg>',
  ].join('');
}
