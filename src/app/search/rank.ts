import type { IndexEntry } from './types';
import { COMMON, forms, oneOff, parseQuery, sameStem, slips, stem, tokenize, type Query } from './text';

// The site search's order. First the entries holding every word of the query, in any field; then, for a
// query of two words or more, those missing up to half of them that hold one in their title, keywords
// or caption. Within each, a word counts by where it falls: the title (or a hand-kept keyword, another
// name for the place), the caption, where the entry lives (its section, page and address), its code, its
// text. A title keeps the old order: the whole title, then its first word, the start of it, a later word,
// the start of one, part of one; a start counts for the share of the word typed. A longer query held
// whole by the title, or by the title and where the entry lives, counts for more again. A word of the
// text counts for more the rarer it is across the site (BM25), and more beside the query's next word. At
// an equal score a page comes before a part of one, and the Guide and the dashboard before the rest.
//
// A word the site never uses is tried as each site word one slip away, and a synonym group stands for any
// of its members; an entry found only that way scores less. The last word, while typed, may be the start
// of one. No section takes more than five places, so the next section's best shows early, and no page
// more than three.

export interface Hit {
  entry: IndexEntry;
  score: number;
  // The words the hit was found by, for marking: a slip or a synonym brings the word it was taken for.
  terms: string[];
}

export interface Searcher {
  // `spread: false` lifts the caps per section and page, for a reader who wants every match.
  search(query: string, limit?: number, opts?: { spread?: boolean }): Hit[];
}

const LIMIT = 40;
const PER_SECTION = 5;
const PER_PAGE = 3;
const K1 = 1.2;
const B = 0.75;
const NEAR = 8;

const LABEL = [0, 80, 120, 350, 600, 650, 1000];
const T_LABEL = [0, 10, 20, 40, 50, 60, 200];
const T_CAP = [0, 4, 8, 16, 20, 22, 30];
const T_CRUMB = [0, 1, 2, 4, 5, 6, 8];
const CODE = 24;
const TEXT = 6;
const CLOSE = 12;
const ALL = 250;
// Other readings of one query, at most: each costs another search.
const MAX_READINGS = 6;
// What a match through a synonym, or through a slip, is worth against a direct one.
const SYNONYM = 0.8;
const SLIP = 0.5;
const KIND: Partial<Record<IndexEntry['kind'], number>> = { page: 15, section: 5, panel: 5 };
// The pages written for box owners, who are most of the readers, come first between equal matches.
const OWNERS: Record<string, number> = { Guide: 20, Dashboard: 20 };

interface Field {
  flat: string;
  // Each form of each word, its stem, and whether it leads the field: its first word that is not a small
  // one, or the first part of that word's code name.
  words: { w: string; s: string; first: boolean }[];
  // Every form at once, to rule a field out before reading it word by word.
  blob: string;
  // A field that is one code name: its parts, which query words may run together into.
  parts?: string[];
}

interface Prepared {
  entry: IndexEntry;
  page: string;
  title: Field;
  caption: Field;
  crumb: Field;
  keys: Field[];
  code: Set<string>;
  codeList: string[];
  // Every form of every field but the text, and of the code, to rule the entry out at once.
  blob: string;
  len: number;
}

function field(s: string): Field {
  const toks = tokenize(s.replace(/['\u2019]/g, ''));
  const lead = Math.max(0, toks.findIndex((t) => !COMMON.has(t.whole)));
  const words = toks.flatMap((t, i) => {
    const joined = t.parts.map((p) => p.w).join('');
    return forms(t).map((w) => ({ w, s: stem(w), first: i === lead && (!t.parts.length || w === t.whole || w === joined || w === t.parts[0].w) }));
  });
  const parts = toks.length === 1 && toks[0].parts.length ? toks[0].parts.map((p) => p.w) : undefined;
  return { flat: toks.map((t) => t.whole).join(' '), words, blob: words.map((x) => x.w).join(' '), parts };
}

// How well `t` falls in a field, and how much of the word it found the query has typed: 6 all of it, 5 its
// first word, 4 the start of its first word or that word by another ending, 3 a later word, 2 the start or
// another form of one, 1 inside a word, 0 nowhere. A start counts in proportion to the share typed, never
// under a quarter. Every match holds the word's stem, so a field without it is passed over at once.
const NONE: [number, number] = [0, 0];
function level(f: Field, t: string, st = stem(t)): [number, number] {
  if (!f.flat) return NONE;
  if (f.flat === t) return [6, 1];
  if (t.includes(' ')) {
    // Words that are the parts of a one-word field's code name, in order, name all of it: move rel.
    if (f.parts && f.parts.join(' ') === t) return [6, 1];
    const i = ` ${f.flat} `.indexOf(` ${t} `);
    if (i === 0) return [4, 1];
    if (i > 0) return [2, 1];
    return f.flat.includes(t) ? [1, 1] : NONE;
  }
  if (!f.blob.includes(st)) return NONE;
  let best = NONE;
  for (const { w, s, first } of f.words) {
    let l = NONE;
    if (w === t) l = [first ? 5 : 3, 1];
    else if (s === st && !COMMON.has(w)) l = [first ? 4 : 2, 1];
    else if (w.startsWith(t)) l = [first ? 4 : 2, Math.max(0.25, t.length / w.length)];
    else if (w.includes(t)) l = [1, 1];
    if (l[0] * l[1] > best[0] * best[1] || (l[0] === best[0] && l[1] > best[1])) best = l;
  }
  return best;
}

const weigh = (w: number[], [l, f]: [number, number]) => w[l] * f;

// The least distance between a place in `a` and one in `b`, walking both in order.
function nearest(a: number[], b: number[]): number {
  const x = [...a].sort((m, n) => m - n);
  const y = [...b].sort((m, n) => m - n);
  let d = Infinity;
  for (let i = 0, j = 0; i < x.length && j < y.length; ) {
    d = Math.min(d, Math.abs(x[i] - y[j]));
    if (x[i] < y[j]) i++;
    else j++;
  }
  return d;
}

const holds = (f: Field, p: { words: string[]; closed: boolean }) =>
  ` ${f.flat} `.includes(` ${p.words.join(' ')}${p.closed ? ' ' : ''}`);

export function createSearcher(entries: readonly IndexEntry[], extra: { synonyms?: string[][] } = {}): Searcher {
  const prepared: Prepared[] = [];
  // Every form of every word of the texts, with where it stands: entry and place, in turn.
  const postings = new Map<string, number[]>();
  // How many entries hold each form anywhere, for choosing among slips.
  const reach = new Map<string, number>();
  // How many entries name each word in their code.
  const inCode = new Map<string, number>();
  const byStem = new Map<string, Set<string>>();
  const texts: string[] = [];
  let total = 0;

  // The last entry each form was counted for, so an entry counts once however often it says the word.
  const last = new Map<string, number>();
  const note = (w: string, i: number) => {
    const was = last.get(w);
    if (was === i) return;
    last.set(w, i);
    reach.set(w, (reach.get(w) ?? 0) + 1);
    if (was !== undefined) return;
    const s = stem(w);
    let set = byStem.get(s);
    if (!set) byStem.set(s, (set = new Set()));
    set.add(w);
  };

  entries.forEach((entry, i) => {
    const code = new Set<string>();
    for (const c of entry.code ?? []) for (const tok of tokenize(c)) for (const w of forms(tok)) code.add(w);
    const toks = tokenize(entry.text);
    toks.forEach((tok, at) => {
      for (const w of forms(tok)) {
        const p = postings.get(w);
        if (p) p.push(i, at);
        else postings.set(w, [i, at]);
        note(w, i);
      }
    });
    const title = field(entry.title);
    const caption = field(entry.caption ?? '');
    const crumb = field(`${entry.crumb} ${entry.section} ${entry.kind === 'external' ? '' : entry.path.replace(/[/#-]+/g, ' ')}`);
    const keys = (entry.keywords ?? []).map(field);
    const p: Prepared = {
      entry,
      page: entry.path.split('#')[0],
      title,
      caption,
      crumb,
      keys,
      code,
      codeList: [...code],
      blob: [title, caption, crumb, ...keys].map((f) => f.blob).concat([...code]).join(' '),
      len: toks.length,
    };
    for (const f of [p.title, p.caption, p.crumb, ...p.keys]) for (const { w } of f.words) note(w, i);
    for (const w of code) {
      note(w, i);
      inCode.set(w, (inCode.get(w) ?? 0) + 1);
    }
    prepared.push(p);
    texts.push(toks.map((t) => t.whole).join(' '));
    total += toks.length;
  });
  const n = prepared.length;
  const avg = total / Math.max(1, n);
  const vocab = [...reach.keys()].sort();
  // A code name counts for less the more entries share it: 1 for a name one entry holds.
  const rarity = (w: string) => Math.log(1 + n / (inCode.get(w) ?? 1)) / Math.log(1 + n);

  const startsWith = (t: string): string[] => {
    let lo = 0;
    let hi = vocab.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (vocab[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < vocab.length && vocab[i].startsWith(t); i++) out.push(vocab[i]);
    return out;
  };
  const known = (t: string) => reach.has(t) || byStem.has(stem(t)) || startsWith(t).length > 0;
  const slipsFor = (t: string) =>
    vocab
      .filter((w) => Math.abs(w.length - t.length) <= 1 && oneOff(w, t))
      .sort((a, b) => reach.get(b)! - reach.get(a)!)
      .slice(0, 3);

  // Where each entry's text holds `t`: the word, the word by another ending, and while typed its start
  // (from three letters: shorter starts are in nearly every text).
  const inText = (t: string, prefix: boolean): Map<number, number[]> => {
    const ws = new Set([t, ...[...(byStem.get(stem(t)) ?? [])].filter((w) => sameStem(w, t))]);
    if (prefix && t.length >= 3) for (const w of startsWith(t)) ws.add(w);
    const out = new Map<number, number[]>();
    for (const w of ws) {
      const p = postings.get(w);
      if (!p) continue;
      for (let j = 0; j < p.length; j += 2) {
        const list = out.get(p[j]);
        if (list) list.push(p[j + 1]);
        else out.set(p[j], [p[j + 1]]);
      }
    }
    return out;
  };

  const run = (q: Query): Map<number, { s: number; missed: number }> => {
    const ts = [...q.words];
    const whole = ts.join(' ');
    const miss = ts.length >= 2 ? Math.floor(ts.length / 2) : 0;
    const where = ts.map((t, k) => inText(t, q.typing && k === ts.length - 1));
    const idf = where.map((m) => Math.log(1 + (n - m.size + 0.5) / (m.size + 0.5)));
    const st = ts.map(stem);
    const out = new Map<number, { s: number; missed: number }>();
    prepared.forEach((p, i) => {
      // An entry that cannot hold enough of the words is passed over before it is read.
      let can = 0;
      for (let k = 0; k < ts.length; k++) if (where[k].has(i) || p.blob.includes(st[k])) can++;
      if (!can || can < ts.length - miss) return;
      if (q.phrases.length && !q.phrases.every((ph) => [p.title, p.caption, ...p.keys].some((f) => holds(f, ph)) || ` ${texts[i]} `.includes(` ${ph.words.join(' ')}${ph.closed ? ' ' : ''}`)))
        return;
      const names = [p.title, ...p.keys];
      let s = Math.max(...names.map((f) => weigh(LABEL, level(f, whole))));
      let missed = 0;
      let named = false;
      let titled = 0;
      let placed = 0;
      ts.forEach((t, k) => {
        const prefix = q.typing && k === ts.length - 1;
        const lt = names.map((f) => level(f, t, st[k])).reduce((a, b) => (b[0] * b[1] > a[0] * a[1] ? b : a));
        const lr = level(p.crumb, t, st[k]);
        const l = lt[0];
        const c = level(p.caption, t, st[k])[0];
        const r = lr[0];
        if (l >= 2) titled++;
        if (l >= 2 || r >= 2) placed++;
        const code = p.code.has(t) ? CODE * rarity(t) : prefix && p.codeList.some((w) => w.startsWith(t)) ? CODE / 4 : 0;
        const at = where[k].get(i);
        const tf = at?.length ?? 0;
        // A word found only inside another (port in Supported) is not held.
        if (l < 2 && c < 2 && r < 2 && !code && !tf) {
          missed++;
          return;
        }
        if (l >= 2 || c >= 2) named = true;
        const bm25 = tf ? (idf[k] * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * p.len) / avg)) : 0;
        s += weigh(T_LABEL, lt) + T_CAP[c] + weigh(T_CRUMB, lr) + code + TEXT * bm25;
      });
      // Every word of a longer query in the title, or in the title and the place it lives.
      if (ts.length >= 2 && titled && placed === ts.length) s += ALL;
      if (missed > miss || (missed && !named) || (missed === ts.length)) return;
      for (let k = 1; k < ts.length; k++) {
        const a = where[k - 1].get(i);
        const b = where[k].get(i);
        if (!a || !b) continue;
        const d = nearest(a, b);
        if (d <= NEAR) s += (CLOSE * (NEAR + 1 - d)) / NEAR;
      }
      out.set(i, { s: s + (KIND[p.entry.kind] ?? 0) + (OWNERS[p.entry.section] ?? 0) - p.entry.title.length * 0.1, missed });
    });
    return out;
  };

  // The query's other readings, with what a match through each is worth: each synonym of a group it names,
  // each slip of a word the site never uses.
  const readings = (q: Query): { q: Query; worth: number }[] => {
    const out: { q: Query; worth: number }[] = [];
    for (const group of extra.synonyms ?? []) {
      const members = group.map((m) => parseQuery(m).words);
      for (const m of members) {
        const at = q.words.findIndex((_, i) => m.every((w, j) => q.words[i + j] !== undefined && sameStem(q.words[i + j], w)));
        if (at < 0) continue;
        for (const other of members)
          if (other !== m) out.push({ q: { ...q, words: [...q.words.slice(0, at), ...other, ...q.words.slice(at + m.length)] }, worth: SYNONYM });
      }
    }
    let slipped: string[][] = [q.words];
    q.words.forEach((t, k) => {
      if (known(t) || !slips(t)) return;
      const alts = slipsFor(t);
      if (alts.length) slipped = slipped.flatMap((ws) => alts.map((a) => ws.map((w, j) => (j === k ? a : w)))).slice(0, 9);
    });
    for (const ws of slipped) if (ws !== q.words) out.push({ q: { ...q, words: ws, typing: false }, worth: SLIP });
    return out.slice(0, MAX_READINGS);
  };

  return {
    search(query, limit = LIMIT, { spread = true } = {}) {
      const q = parseQuery(query);
      const most = Math.floor(limit);
      if (!q.words.length || !(most >= 1)) return [];
      const best = new Map<number, { tier: number; s: number; terms: string[] }>();
      const take = (r: Map<number, { s: number; missed: number }>, factor: number, terms: string[]) => {
        for (const [i, { s, missed }] of r) {
          const tier = missed ? 1 : 0;
          const was = best.get(i);
          if (!was || tier < was.tier || (tier === was.tier && s * factor > was.s)) best.set(i, { tier, s: s * factor, terms });
        }
      };
      take(run(q), 1, q.words);
      for (const alt of readings(q)) take(run(alt.q), alt.worth, alt.q.words);
      const order = [...best].sort((a, b) => a[1].tier - b[1].tier || b[1].s - a[1].s);
      const sections = new Map<string, number>();
      const pages = new Map<string, number>();
      const hits: Hit[] = [];
      for (const [i, { s, terms }] of order) {
        const p = prepared[i];
        const inSection = sections.get(p.entry.section) ?? 0;
        const onPage = pages.get(p.page) ?? 0;
        // Releases and device rows share one page each, and are each a place of their own.
        const listed = p.entry.kind === 'release' || p.entry.kind === 'device';
        if (spread && (inSection >= PER_SECTION || (onPage >= PER_PAGE && !listed))) continue;
        sections.set(p.entry.section, inSection + 1);
        pages.set(p.page, onPage + 1);
        hits.push({ entry: p.entry, score: s, terms });
        if (hits.length >= most) break;
      }
      return hits;
    },
  };
}
