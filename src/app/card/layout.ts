import { parse, type Font } from 'opentype.js';

export type Face = Font;

export interface FitOptions {
  max?: number;
  min?: number;
  width?: number;
  lines?: number;
  tracking?: number;
  room?: (size: number, lines: number) => boolean;
}

const ELLIPSIS = '…';
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

export function loadFace(bytes: ArrayBuffer | Uint8Array): Face {
  return parse(bytes instanceof Uint8Array ? bytes.slice().buffer : bytes);
}

// What the face can draw of the text: a letter whose accent it lacks keeps the letter, anything else it
// lacks goes, so a card never shows a missing-glyph box.
export function drawable(face: Face, text: string): string {
  const kept = [...collapse(text).normalize('NFC')].map((ch) =>
    face.hasChar(ch) ? ch : [...ch.normalize('NFD')].filter((c) => face.hasChar(c)).join(''),
  );
  return collapse(kept.join(''));
}

// Kerned width in px; tracking is in ems, between characters as a browser sets letter-spacing.
export function measure(face: Face, text: string, size: number, tracking = 0): number {
  if (!text) return 0;
  return face.getAdvanceWidth(text, size, { kerning: true }) + tracking * size * ([...text].length - 1);
}

// Width scales with size, so each string is measured once per fit.
function ruler(face: Face, tracking: number) {
  const unit = new Map<string, number>();
  return (text: string, size: number) => {
    let w = unit.get(text);
    if (w === undefined) unit.set(text, (w = measure(face, text, 1, tracking)));
    return w * size;
  };
}

type Ruler = ReturnType<typeof ruler>;

// Greedy on spaces. A word wider than the width keeps a line to itself, and is left wide.
function wrap(width: Ruler, words: string[], size: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && width(next, size) > max) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function cut(width: Ruler, word: string, size: number, max: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const ch of word) {
    if (piece && width(piece + ch, size) > max) {
      pieces.push(piece);
      piece = ch;
    } else piece += ch;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

const bare = (s: string) => s.replace(/[\s,;:.!?·–—-]+$/u, '');

function ellipsize(width: Ruler, line: string, size: number, max: number): string {
  const fits = (s: string) => width(s + ELLIPSIS, size) <= max;
  const words = line.split(' ');
  while (words.length > 1 && !fits(bare(words.join(' ')))) words.pop();
  let s = bare(words.join(' '));
  while (s && !fits(s)) s = bare([...s].slice(0, -1).join(''));
  return s + ELLIPSIS;
}

function clampWith(width: Ruler, text: string, size: number, max: number, lines: number): string[] {
  const words = collapse(text).split(' ').filter(Boolean);
  const set = wrap(width, words, size, max).flatMap((l) => (width(l, size) > max ? cut(width, l, size, max) : [l]));
  if (set.length <= lines) return set;
  return [...set.slice(0, lines - 1), ellipsize(width, set[lines - 1], size, max)];
}

// At most `lines` lines inside the width; text past them ends in an ellipsis on a word.
export function clampLines(face: Face, text: string, size: number, width: number, lines: number, tracking = 0): string[] {
  return clampWith(ruler(face, tracking), text, size, width, lines);
}

// The largest size from max down to min at which the title fits its lines and the width, and leaves the
// room the rest of the card asks for. Lines given as an array are kept as they are. Below min, the title
// is set at min and clamped.
export function fitTitle(face: Face, text: string | readonly string[], opts: FitOptions = {}): { size: number; lines: string[] } {
  const { max = 140, min = 56, width = 1056, lines = 2, tracking = 0, room = () => true } = opts;
  const w = ruler(face, tracking);
  const given = typeof text === 'string' ? null : text.map(collapse);
  const words = typeof text === 'string' ? collapse(text).split(' ').filter(Boolean) : [];
  for (let size = max; size >= min; size--) {
    const set = given ?? wrap(w, words, size, width);
    if (set.length <= lines && set.every((l) => w(l, size) <= width) && room(size, set.length)) return { size, lines: [...set] };
  }
  const set = given ? given.map((l) => clampWith(w, l, min, width, 1)[0] ?? '') : clampWith(w, words.join(' '), min, width, lines);
  return { size: min, lines: set };
}
