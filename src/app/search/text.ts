import type { IndexEntry } from './types';

// Words and how they meet: shared by the site search, the agent search and the Help and Devices filters.

// Words too common to tell entries apart: a question's small words, and the name every page carries. A
// query of nothing else keeps them.
export const COMMON = new Set(
  'a an the is are am be i my me to do does did doesnt dont not how why what when where can cant it its of on in for with and or this that will wont so at from by your you should would there over into onto via about through under without as than then if but medius'.split(' '),
);

// A word without its ending, so a word and its other forms meet: entries and entry, classes and class,
// moving and moves and move. A number or a version keeps its form. Kept per word: a search asks again
// for every entry.
const stems = new Map<string, string>();
const cutEnding = (w: string): string => {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 4 && /(?:s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
  else if (/[^sui]s$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && /[^e]ed$/.test(s)) s = s.slice(0, -2);
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  return s.length >= 3 ? s : w;
};
export const stem = (w: string) => {
  let s = stems.get(w);
  if (s === undefined) {
    s = cutEnding(w);
    if (stems.size < 100_000) stems.set(w, s);
  }
  return s;
};

// Whether `w` is `t` by another ending. Never a common word, so notes never meets not.
export const sameStem = (w: string, t: string) => w === t || (stem(w) === stem(t) && !COMMON.has(w));

// One insertion, deletion, substitution or swap of neighbours.
export const oneOff = (a: string, b: string): boolean => {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
};

// Whether a slip may stand for this word: never a number, never a short word.
export const slips = (w: string) => w.length >= 4 && !/\d/.test(w);

export interface Part {
  start: number;
  end: number;
  w: string;
}

// A run of letters, digits and underscores, with the words a code name is made of: `move_rel` and
// `MoveRel` both hold move and rel. A contraction (can't) is one word, read without its apostrophe, and a
// version (v3.4.4) one token.
export interface Token {
  start: number;
  end: number;
  whole: string;
  parts: Part[];
}

const RAW = /[vV]?\d+(?:\.\d+)+(?!\w)|[A-Za-z0-9_]+(?:['\u2019][A-Za-z]+)*/g;
const APOSTROPHE = /['\u2019]/g;
const HEX = /^0x[0-9a-f]+$/i;
// Only a run with an underscore or a capital inside it has parts.
const CODE_NAME = /_|[a-z0-9][A-Z]|[A-Z][A-Z][a-z]/;

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  // Micro (µ) reads as u, as the site's microseconds are typed: µs, us. One letter for one, so places hold.
  for (const m of s.replace(/[\u00b5\u03bc]/g, 'u').matchAll(RAW)) {
    const raw = m[0];
    const at = m.index!;
    const parts: Part[] = [];
    if (CODE_NAME.test(raw) && !HEX.test(raw) && !APOSTROPHE.test(raw)) {
      let from = 0;
      for (const piece of raw.split('_')) {
        let i = 0;
        for (const sub of piece.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
          if (sub) parts.push({ start: at + from + i, end: at + from + i + sub.length, w: sub.toLowerCase() });
          i += sub.length;
        }
        from += piece.length + 1;
      }
    }
    out.push({ start: at, end: at + raw.length, whole: raw.toLowerCase().replace(APOSTROPHE, ''), parts: parts.length > 1 ? parts : [] });
  }
  return out;
}

// A number run into its unit (1000hz), which the site mostly writes apart. Ids such as 046d, and 8K,
// stay whole.
const UNIT = /^(\d+)(hz|khz|mhz|ms|us|baud|kbaud|mbaud|kb|mb)$/;

// Every form a token is found by: itself, its parts, and its parts run together; a version without its v,
// and a number and its unit apart.
export function forms(t: Token): string[] {
  if (!t.parts.length) {
    if (/^v\d/.test(t.whole)) return [t.whole, t.whole.slice(1)];
    const unit = UNIT.exec(t.whole);
    return unit ? [t.whole, unit[1], unit[2]] : [t.whole];
  }
  const joined = t.parts.map((p) => p.w).join('');
  const out = [t.whole, ...t.parts.map((p) => p.w)];
  if (joined !== t.whole) out.push(joined);
  return out;
}

// A field as one string of its words, for whole-field and phrase matches.
export const flat = (s: string) => tokenize(s).map((t) => t.whole).join(' ');

const MAX_WORDS = 16;

export interface Query {
  words: string[];
  phrases: { words: string[]; closed: boolean }[];
  // The last word is still being typed, so it may be the start of a word.
  typing: boolean;
}

const lower = (s: string) => s.toLowerCase().replace(APOSTROPHE, '');
const wordsOf = (s: string) =>
  tokenize(lower(s)).flatMap((t) => {
    const m = UNIT.exec(t.whole);
    return m ? [m[1], m[2]] : [t.whole];
  });

export function parseQuery(q: string): Query {
  const phrases: Query['phrases'] = [];
  // A keyboard's curly quotes quote as well as straight ones.
  const loose = lower(q.replace(/[\u201c\u201d]/g, '"')).replace(/"([^"]*)("|$)/g, (_, inner: string, end: string) => {
    const w = wordsOf(inner);
    if (w.length) phrases.push({ words: w, closed: end === '"' });
    return ` ${inner} `;
  });
  // A query reads no more than its first sixteen words. A word said twice stays twice: v3.4.4 is three.
  const all = wordsOf(loose);
  const kept = all.filter((w) => !COMMON.has(w));
  return { words: (kept.length ? kept : all).slice(0, MAX_WORDS), phrases, typing: /[A-Za-z0-9_]$/.test(q) };
}

export const queryWords = (q: string) => parseQuery(q).words;

// Whether a word of a text answers a word of a query: the same word, a word it begins, or the same word
// by another ending.
export const meets = (w: string, t: string) => w.startsWith(t) || sameStem(w, t);

// `text` cut where words of the query (or the words a search took for them) match, for marking: a word
// named whole or begun, a part of a code name, or the part of a word another form of it shares.
export function marks(text: string, terms: string[] | string): { text: string; hit: boolean }[] {
  const ts = typeof terms === 'string' ? queryWords(terms) : terms.map(lower);
  const out: { text: string; hit: boolean }[] = [];
  const push = (s: string, hit: boolean) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += s;
    else out.push({ text: s, hit });
  };
  const span = (w: string): number => {
    let n = 0;
    for (const t of ts) {
      if (w.startsWith(t)) n = Math.max(n, t.length);
      else if (sameStem(w, t)) n = Math.max(n, stem(t).length);
    }
    return n;
  };
  let from = 0;
  // `n` letters from `start`, an apostrophe inside them (isn't) going with them.
  const light = (start: number, n: number) => {
    let end = start;
    for (let k = 0; k < n && end < text.length; end++) if (text[end] !== "'" && text[end] !== '\u2019') k++;
    push(text.slice(from, start), false);
    push(text.slice(start, end), true);
    from = end;
  };
  for (const tok of tokenize(text)) {
    const whole = span(tok.whole);
    if (whole && (!tok.parts.length || whole > tok.parts[0].end - tok.parts[0].start)) {
      light(tok.start, whole);
      continue;
    }
    for (const p of tok.parts) {
      const n = span(p.w);
      if (n) light(p.start, n);
    }
  }
  push(text.slice(from), false);
  return out;
}

const formsOf = (s: string) => tokenize(lower(s)).flatMap(forms);

// Whether a text holds every word of a query, each by start, ending or one slip. An empty query holds.
export function matches(text: string, query: string): boolean {
  const ts = queryWords(query);
  if (!ts.length) return true;
  const ws = formsOf(text);
  // A number may sit inside a name: 502 in G502.
  return ts.every((t) => ws.some((w) => meets(w, t) || (slips(t) && oneOff(w, t)) || (/^\d+$/.test(t) && w.includes(t))));
}

// A sentence ends at its stop, or at the end of its line: a table row or a heading is one too.
const SENTENCE = /(?<=[.!?])\s+|\s*\n\s*/;
const WIDTH = 150;

// Each text's sentences, split once: a search asks again on every keystroke.
const split = new WeakMap<object, { lines: string[]; low: string[] }>();
const sentencesOf = (e: IndexEntry) => {
  let s = split.get(e);
  if (!s) {
    const lines = e.text.split(SENTENCE).filter((l) => l.trim());
    split.set(e, (s = { lines, low: lines.map((l) => l.toLowerCase()) }));
  }
  return s;
};

// The sentence of an entry that holds the most of the words, cut to about 150 characters around the
// first; its caption, or else its first sentence, when the text holds none of them.
export function snippet(entry: IndexEntry, terms: string[]): string {
  const ts = terms.map(lower);
  const { lines: sentences, low } = sentencesOf(entry);
  let best = '';
  let most = 0;
  let at = -1;
  // A sentence can answer a word only if it holds the word's stem, so the rest are never read word by word.
  const stemsOf = ts.map(stem);
  for (let n = 0; n < sentences.length; n++) {
    const s = sentences[n];
    if (!stemsOf.some((st) => low[n].includes(st))) continue;
    const toks = tokenize(s);
    const hit = new Set<string>();
    let first = -1;
    for (const tok of toks)
      for (const f of forms(tok))
        for (const t of ts)
          if (meets(f, t)) {
            hit.add(t);
            if (first < 0) first = tok.start;
          }
    if (hit.size > most) {
      most = hit.size;
      best = s;
      at = first;
    }
  }
  // A release's date and a device's verdict show where it lives, so they never stand for what it says.
  const told = entry.kind === 'release' || entry.kind === 'device' ? undefined : entry.caption;
  if (!most) return told ?? cut(sentences[0] ?? '', 0);
  return cut(best, at);
}

function cut(s: string, at: number): string {
  s = s.trim();
  if (s.length <= WIDTH + 10) return s;
  let start = Math.max(0, at - 50);
  if (start > 0) start = s.indexOf(' ', start) + 1 || start;
  let end = Math.min(s.length, start + WIDTH);
  if (end < s.length) end = s.lastIndexOf(' ', end) > start ? s.lastIndexOf(' ', end) : end;
  return `${start > 0 ? '...' : ''}${s.slice(start, end).trim()}${end < s.length ? '...' : ''}`;
}
