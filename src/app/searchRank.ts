import type { SearchEntry } from './searchIndex';

// The site search's order. First, the entries that hold every word of the query in their title,
// description or keywords; then, for a query of two words or more, those missing up to half of them. Each
// ranks by where its words fall: the title before the keywords before the description, a whole title
// before one the query starts, a word before part of one, a page before a section of one. Words too
// common to tell entries apart are dropped, and a word may differ by its ending ("moving" finds "move", "notes" never
// finds "nothing"). No section takes more than eight places. Failing all of that, each word may be one
// slip off a word of an entry, a number never.

export interface Hit {
  entry: SearchEntry;
  score: number;
}

const LIMIT = 40;
const PER_GROUP = 8;

// Words too common to tell entries apart: a question's small words, and the name every page carries. A
// query of nothing else keeps them.
const COMMON = new Set(
  'a an the is are am be i my me to do does did doesnt dont not how why what when where can cant it its of on in for with and or this that will wont so at from by your you should would there medius'.split(' '),
);
const tokens = (q: string) => {
  const all = q.toLowerCase().replace(/['’]/g, '').trim().split(/\s+/).filter(Boolean);
  const kept = all.filter((t) => !COMMON.has(t));
  return kept.length ? kept : all;
};

// A word without its ending, so a word and its other forms meet.
const stem = (w: string) => {
  const s = w.replace(/(ing|ed|es|e|s)$/, '');
  return s.length >= 3 ? s : w;
};

const PLAIN = /^[a-z0-9]+$/;
const WORDS = /[a-z0-9]+/g;

// How well `t` falls in `s`: 6 all of it, 5 its first word, 4 the start of its first word or its first
// word in another form, 3 a later word, 2 the start or another form of a later word, 1 inside a word, 0
// nowhere. A phrase or a token with other characters (c++, 0x0a, move_rel) is found as written.
function level(s: string, t: string): number {
  if (!s) return 0;
  if (s === t) return 6;
  if (!PLAIN.test(t)) {
    const i = s.indexOf(t);
    if (i < 0) return 0;
    if (i === 0) return 4;
    return /[a-z0-9]/.test(s[i - 1]) ? 1 : 2;
  }
  const st = stem(t);
  let best = 0;
  let first = true;
  for (const [w] of s.matchAll(WORDS)) {
    let l = 0;
    if (w === t) l = first ? 5 : 3;
    else if (w.startsWith(t) || stem(w) === st) l = first ? 4 : 2;
    else if (w.includes(t)) l = 1;
    if (l > best) best = l;
    first = false;
  }
  return best;
}

const LABEL = [0, 80, 120, 350, 600, 650, 1000];
const KEY = [0, 40, 60, 150, 100, 260, 320];
const T_LABEL = [0, 10, 20, 40, 50, 60, 200];
const T_KEY = [0, 5, 10, 20, 25, 25, 25];
const T_DESC = [0, 2, 4, 10, 12, 12, 12];

const isPage = (e: SearchEntry) => e.external || !e.path.includes('#');

// The entry's score for the query, and how many of its words it lacks; null when it lacks too many.
function score(e: SearchEntry, q: string, ts: string[], miss: number): { s: number; missed: number } | null {
  const label = e.label.toLowerCase();
  const desc = (e.description ?? '').toLowerCase();
  const keys = (e.keywords ?? []).map((k) => k.toLowerCase());
  const group = e.group.toLowerCase();
  let s = LABEL[level(label, q)] + Math.max(0, ...keys.map((k) => KEY[level(k, q)]));
  let missed = 0;
  let named = false;
  for (const t of ts) {
    const l = level(label, t), k = Math.max(0, ...keys.map((x) => level(x, t))), d = level(desc, t);
    if (!l && !k && !d && !level(group, t)) {
      if (++missed > miss) return null;
      continue;
    }
    if (l || k) named = true;
    s += T_LABEL[l] + T_KEY[k] + T_DESC[d];
  }
  // A partial match counts only when a word it holds is in its title or keywords.
  if (missed && !named) return null;
  return { s: s + (isPage(e) ? 15 : 0) - e.label.length * 0.1, missed };
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);

// One insertion, deletion, substitution or swap of neighbours.
const oneOff = (a: string, b: string): boolean => {
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

function slipScore(e: SearchEntry, ts: string[]): number {
  const label = words(e.label);
  const rest = [...words(e.description ?? ''), ...(e.keywords ?? []).flatMap(words)];
  let s = 0;
  for (const t of ts) {
    if (t.length < 4 || /\d/.test(t)) return 0;
    if (label.some((w) => oneOff(w, t))) s += 40;
    else if (rest.some((w) => oneOff(w, t))) s += 10;
    else return 0;
  }
  return s - e.label.length * 0.1 + (isPage(e) ? 15 : 0);
}

// The best hits, no section taking more than its share.
function pick(hits: Hit[]): Hit[] {
  const taken = new Map<string, number>();
  const out: Hit[] = [];
  for (const h of hits) {
    const n = taken.get(h.entry.group) ?? 0;
    if (n >= PER_GROUP) continue;
    taken.set(h.entry.group, n + 1);
    out.push(h);
    if (out.length === LIMIT) break;
  }
  return out;
}

export function rank(entries: readonly SearchEntry[], query: string): Hit[] {
  const ts = tokens(query);
  if (!ts.length) return [];
  const q = ts.join(' ');
  const miss = ts.length >= 2 ? Math.floor(ts.length / 2) : 0;
  const full: Hit[] = [];
  const part: Hit[] = [];
  for (const entry of entries) {
    const r = score(entry, q, ts, miss);
    if (r && r.s > 0) (r.missed ? part : full).push({ entry, score: r.s });
  }
  const byScore = (a: Hit, b: Hit) => b.score - a.score;
  const hits = pick([...full.sort(byScore), ...part.sort(byScore)]);
  if (hits.length) return hits;
  return pick(
    entries
      .map((entry) => ({ entry, score: slipScore(entry, ts) }))
      .filter((h) => h.score > 0)
      .sort(byScore),
  );
}

// Hits by section, the section of the best hit first.
export function groupHits(hits: Hit[], key: (e: SearchEntry) => string = (e) => e.group): { group: string; hits: Hit[] }[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) groups.set(key(h.entry), [...(groups.get(key(h.entry)) ?? []), h]);
  return [...groups].map(([group, list]) => ({ group, hits: list }));
}

// `text` cut where the query's words match a word of it, for marking: a word the query names whole or
// begins, or the part of a word another form of it shares.
export function marks(text: string, query: string): { text: string; hit: boolean }[] {
  const ts = tokens(query);
  const out: { text: string; hit: boolean }[] = [];
  const push = (s: string, hit: boolean) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += s;
    else out.push({ text: s, hit });
  };
  let from = 0;
  for (const m of text.matchAll(/[A-Za-z0-9]+/g)) {
    const w = m[0].toLowerCase();
    const i = m.index!;
    let n = 0;
    for (const t of ts) {
      if (w.startsWith(t)) n = Math.max(n, t.length);
      else if (PLAIN.test(t) && stem(w) === stem(t)) n = Math.max(n, stem(t).length);
    }
    if (!n) continue;
    push(text.slice(from, i), false);
    push(text.slice(i, i + n), true);
    from = i + n;
  }
  push(text.slice(from), false);
  return out;
}
