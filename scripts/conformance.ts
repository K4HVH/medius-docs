// Structural conformance for the docs pages: does each page look like its siblings?
//
// The prose checks (banned words, dashes) and the correctness checks (byte offsets, dead symbols) never
// caught a card shaped unlike every other card, because neither looks at shape. This does.
//
// Every rule is DERIVED, not asserted. A structural rule fires only where the corpus is near-unanimous
// (>=85% one way), and a punctuation rule is measured against the page's OWN majority, since a page that
// is consistently one way is consistent, and two stragglers on a page that is otherwise the other way
// are the drift. The measured rate prints beside the rule, so changing the corpus moves the rule.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PAGES = join(ROOT, 'src/app/pages');
const rel = (f: string) => relative(ROOT, f);

interface Finding {
  file: string;
  line: number;
  rule: string;
  detail: string;
}
const findings: Finding[] = [];
const rates = new Map<string, string>();
const report = (file: string, line: number, rule: string, detail: string) =>
  findings.push({ file: rel(file), line, rule, detail });

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
const files = walk(PAGES).sort();
const srcOf = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const lineOf = (s: string, i: number) => s.slice(0, i).split('\n').length;
const strip = (h: string) =>
  h
    .replace(/<[^>]+>|\{'?[^}]*'?\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface CardBlock {
  title: string;
  subtitle: string;
  body: string;
  start: number;
  sig: string;
}
const SIGS = (b: string) =>
  strip(
    [...b.matchAll(/<pre class="api-signature">([\s\S]*?)<\/pre>/g)].map((m) => m[1]).join(' \n '),
  );
function cards(src: string): CardBlock[] {
  return [
    ...src.matchAll(
      /<CardHeader\s+title="([^"]*)"(?:\s+subtitle="([^"]*)")?[^>]*\/>([\s\S]*?)<\/Card>/g,
    ),
  ].map((m) => ({
    title: m[1],
    subtitle: m[2] ?? '',
    body: m[3],
    start: m.index!,
    sig: SIGS(m[3]),
  }));
}

// A method section's signature is a CALL you make; a type card's is a declaration or a constructor
// list.
const isMethod = (sig: string, file: string, title: string) =>
  !!sig &&
  !file.includes('/types/') &&
  !/^\s*(enum|struct|typedef|union|#define|\[)/.test(sig) &&
  !/at offset/.test(sig) &&
  !new RegExp(`->\\s*${title}\\b`).test(sig) &&
  /(\bfn\s+\w+|^[A-Z_]{3,}\s+0x[0-9A-Fa-f]{2}\s*·|\bmedius_\w+\s*\(|\bdev\.\w+\(|^QUERY\s+what)/.test(
    sig.trim(),
  );

// Fires only where the corpus agrees at >=85%, and records the rate either way so the rule stays honest.
const familyOf = (f: string) =>
  f.includes('/native/commands/') ? 'native command'
  : f.includes('/bindings/') ? 'bindings'
  : f.includes('/dashboard/') ? 'dashboard'
  : f.includes('/library/') ? 'library'
  : 'other';

// Derived per family, because a native opcode section and a library method are different shapes: pooled,
// one family's majority silently rules the other, which is how INJECT looked broken for matching the
// four other umbrella opcode cards exactly.
function derived<T>(
  name: string,
  items: T[],
  holds: (t: T) => boolean,
  at: (t: T) => [string, number, string],
) {
  if (!items.length) return;
  const groups = new Map<string, T[]>();
  for (const t of items) {
    const g = familyOf(at(t)[0]);
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const summary: string[] = [];
  for (const [g, ts] of [...groups].sort()) {
    const ok = ts.filter(holds).length;
    const pct = ok / ts.length;
    summary.push(`${g} ${ok}/${ts.length} (${Math.round(pct * 100)}%)`);
    if (ts.length < 5 || pct < 0.85) continue; // too few to be a pattern, or a genuine choice
    for (const t of ts)
      if (!holds(t)) {
        const [f, l, d] = at(t);
        report(f, l, name, d);
      }
  }
  rates.set(name, summary.join(', '));
}

const allCards = files.flatMap((f) => cards(srcOf.get(f)!).map((c) => ({ f, c })));
const methodCards = allCards.filter(({ f, c }) => isMethod(c.sig, f, c.title));
const typeCards = allCards.filter(({ f, c }) => c.sig && !isMethod(c.sig, f, c.title));
const lineAt = (f: string, c: CardBlock) => lineOf(srcOf.get(f)!, c.start);

// ---- a method section carries a badge, and an example ----
derived(
  'missing-badge',
  methodCards,
  ({ c }) => c.body.includes('api-badge'),
  ({ f, c }) => [f, lineAt(f, c), `"${c.title}" has a call signature and no api-badge`],
);
// A dispatch card declares the frame and its variant cards below carry the examples: INJECT over
// "class = button", OPTION over its option ids, UPDATE over its five ops, RESP over its selectors.
const hasExample = (c: CardBlock) => c.body.includes('api-response-label">EXAMPLE<');
const isDispatch = ({ f, c }: { f: string; c: CardBlock }) => {
  const cs = cards(srcOf.get(f)!);
  const after = cs.filter((x) => x.start > c.start);
  return after.filter(hasExample).length >= 2;
};
derived(
  'missing-example',
  methodCards,
  ({ f, c }) => hasExample(c) || isDispatch({ f, c }),
  ({ f, c }) => [f, lineAt(f, c), `"${c.title}" has a call signature and no EXAMPLE`],
);
// ---- a code example inside a method section carries its EXAMPLE label (CLAUDE.md) ----
const codeBlocks = methodCards.flatMap(({ f, c }) =>
  [...c.body.matchAll(/<pre><code class="language-(?!bash|sh|console)/g)].map((m) => ({ f, c, i: m.index! })),
);
derived(
  'unlabelled-example',
  codeBlocks,
  (b) => b.c.body.slice(Math.max(0, b.i - 400), b.i).includes('api-response-label">EXAMPLE<'),
  (b) => [b.f, lineAt(b.f, b.c), `"${b.c.title}" has a code example with no EXAMPLE label`],
);

// ---- and a type card does not ----
derived(
  'type-card-badge',
  typeCards,
  ({ c }) => !c.body.includes('api-badge'),
  ({ f, c }) => [f, lineAt(f, c), `type card "${c.title}" carries an api-badge`],
);

// ---- badge text is one the house uses ----
const badges = allCards.flatMap(({ f, c }) =>
  [...c.body.matchAll(/<span class="api-badge[^"]*">([^<]*)<\/span>/g)].map((m) => ({
    f,
    c,
    t: m[1].trim(),
  })),
);
const BADGE_OK = new Set([
  'Fire-and-forget',
  'No round-trip',
  'Blocks',
  'Unsolicited',
  'Returns RESP',
  'Reply',
]);
derived(
  'badge-text',
  badges,
  (b) => BADGE_OK.has(b.t),
  (b) => [b.f, lineAt(b.f, b.c), `"${b.c.title}" badge reads "${b.t}"`],
);

// ---- an opcode section states its payload ----
const opcodeCards = allCards.filter(
  ({ f, c }) => f.includes('/native/commands/') && /^[A-Z_]{3,}\s+0x[0-9A-Fa-f]{2}\s*·/.test(c.sig.trim()) && !/at offset/.test(c.sig),
);
derived(
  'missing-payload',
  opcodeCards,
  ({ c }) => /api-response-label">PAYLOAD</.test(c.body) || /No payload/.test(c.body),
  ({ f, c }) => [f, lineAt(f, c), `opcode section "${c.title}" states neither a PAYLOAD nor "No payload"`],
);

// ---- a card named for a type, with no table and no example, is that type's entry with the content gone ----
// CLAUDE.md: method pages link to Types and show usage; they do not re-table variants or fields.
for (const f of files) {
  const cs = cards(srcOf.get(f)!);
  if (f.includes('/types/')) continue;
  for (const c of cs.slice(1)) {
    if (!/^[A-Z][A-Za-z]+$/.test(c.title)) continue;
    if (c.body.includes('<table') || c.body.includes('<pre')) continue;
    if (/href="\/library\/types\/(enums|structs)#/.test(c.body))
      report(
        f,
        lineAt(f, c),
        'pointer-card',
        `card "${c.title}" carries no table and no example, and only links the types reference`,
      );
  }
}

// ---- an api-response-label over a table whose first column repeats it (CLAUDE.md) ----
for (const f of files) {
  const src = srcOf.get(f)!;
  for (const m of src.matchAll(
    /<div class="api-response-label">([^<]*)<\/div>\s*(?:<[^>]*>\s*)*?<table[^>]*>\s*<thead>\s*<tr>\s*<th>([^<]*)<\/th>/g,
  )) {
    const a = m[1].trim().toLowerCase().replace(/s$/, '');
    const b = m[2].trim().toLowerCase().replace(/s$/, '');
    if (a && a === b)
      report(
        f,
        lineOf(src, m.index!),
        'label-doubling',
        `label "${m[1].trim()}" over a "${m[2].trim()}" column`,
      );
  }
}

// ---- cell punctuation, against the PAGE's own majority ----
// One page is 149 cells of lowercase fragments and internally consistent; another is full sentences with
// two stragglers. Only the second is drift, so the majority has to be per page rather than global.
interface Cell {
  f: string;
  line: number;
  text: string;
  kind: string;
  head: string;
}
const cellsByPage = new Map<string, Cell[]>();
for (const f of files) {
  const src = srcOf.get(f)!;
  for (const t of src.matchAll(/<table class="(byte-table|api-params)"[^>]*>([\s\S]*?)<\/table>/g)) {
    const heads = [...t[2].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((h) => strip(h[1]));
    for (const r of t[2].matchAll(/<tr>((?:\s*<td>[\s\S]*?<\/td>)+)\s*<\/tr>/g)) {
      const cs = [...r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1]));
      const last = cs[cs.length - 1];
      const head = heads[cs.length - 1] ?? '';
      if (!last || last.length < 25) continue;
      if (!/^(Description|Meaning|Effect|Notes?|What the box does|Reports as|Why)$/i.test(head))
        continue;
      const key = `${f}::${t[1]}`;
      cellsByPage.set(key, [
        ...(cellsByPage.get(key) ?? []),
        { f, line: lineOf(src, t.index! + r.index!), text: last, kind: t[1], head },
      ]);
    }
  }
}
let punctChecked = 0;
let punctDrift = 0;
for (const cs of cellsByPage.values()) {
  if (cs.length < 6) continue;
  punctChecked += cs.length;
  const withStop = cs.filter((c) => /[.)]$/.test(c.text)).length;
  const pct = withStop / cs.length;
  if (pct >= 0.85)
    for (const c of cs.filter((x) => !/[.)]$/.test(x.text))) {
      punctDrift++;
      report(
        c.f,
        c.line,
        'cell-punctuation',
        `${c.head} cell has no full stop where ${Math.round(pct * 100)}% of this page's ${c.kind} cells do: "${c.text.slice(0, 55)}"`,
      );
    }
  else if (pct <= 0.15)
    for (const c of cs.filter((x) => /[.)]$/.test(x.text))) {
      punctDrift++;
      report(
        c.f,
        c.line,
        'cell-punctuation',
        `${c.head} cell ends in a full stop where ${Math.round(100 - pct * 100)}% of this page's ${c.kind} cells do not: "${c.text.slice(0, 55)}"`,
      );
    }
}
rates.set('cell-punctuation', `${punctChecked} cells measured against their own page, ${punctDrift} against it`);

// ---- subtitles: no trailing period ----
derived(
  'subtitle-period',
  allCards.filter(({ c }) => c.subtitle),
  ({ c }) => !/[.]$/.test(c.subtitle),
  ({ f, c }) => [f, lineAt(f, c), `"${c.title}" subtitle ends in a period`],
);

// ---- byte grids are fixed-width (CLAUDE.md) ----
for (const f of files) {
  const src = srcOf.get(f)!;
  for (const m of src.matchAll(/<pre class="diagram">\{`([\s\S]*?)`\}<\/pre>/g)) {
    const blocks: string[][] = [[]];
    for (const raw of m[1].split('\n')) {
      const l = raw.replace(/\s+$/, '');
      if (/^[+|]/.test(l.trim()) && l.includes('|')) blocks[blocks.length - 1].push(l);
      else if (blocks[blocks.length - 1].length) blocks.push([]);
    }
    for (const b of blocks) {
      // A byte grid is ruled with +--------+ separators. A topology diagram also starts lines with "+"
      // and "|" and is not a grid, so the ruling is what tells them apart.
      if (b.length < 3 || !b.some((l) => /^\+[-+]+\+$/.test(l.trim()))) continue;
      const w = new Set(b.map((l) => l.length));
      if (w.size > 1)
        report(
          f,
          lineOf(src, m.index!),
          'grid-ragged',
          `byte grid rows differ in width: ${[...w].sort((a, z) => a - z).join(', ')}`,
        );
    }
  }
}

// ---- anchors, following component composition ----
// A route's page often renders children that own the ids (/dashboard -> Device -> DeviceOptions), so an
// id check that reads only the route's own file reports anchors that resolve fine in the browser.
const appFile = join(ROOT, 'src/app/App.tsx');
const app = readFileSync(appFile, 'utf8');
const importsOf = (src: string, file: string) => {
  const map = new Map<string, string>();
  for (const m of src.matchAll(/import\s+(\w+)[^'";]*from\s+'(\.[^']+)'/g))
    map.set(m[1], resolve(dirname(file), m[2]) + '.tsx');
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('(\.[^']+)'\)\)/g))
    map.set(m[1], resolve(dirname(file), m[2]) + '.tsx');
  return map;
};
function idsWithChildren(file: string, seen = new Set<string>()): Set<string> {
  const out = new Set<string>();
  if (seen.has(file)) return out;
  seen.add(file);
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const m of src.matchAll(/id="([A-Za-z0-9-]+)"/g)) out.add(m[1]);
  for (const [name, path] of importsOf(src, file))
    if (new RegExp(`<${name}\\b`).test(src))
      for (const id of idsWithChildren(path, seen)) out.add(id);
  return out;
}
const appImports = importsOf(app, appFile);
const routeIds = new Map<string, Set<string>>();
for (const m of app.matchAll(/path="([^"]+)"\s+component=\{(\w+)\}/g)) {
  const file = appImports.get(m[2]);
  if (file) routeIds.set(m[1], idsWithChildren(file));
}
const checkAnchor = (from: string, line: number, href: string) => {
  const [route, anchor] = href.split('#');
  if (!anchor) return;
  const ids = routeIds.get(route);
  if (!ids) {
    report(from, line, 'dead-route', `${href} resolves to no route`);
    return;
  }
  if (!ids.has(anchor)) report(from, line, 'dead-anchor', `${href} is not an id on that page`);
};
for (const f of files)
  for (const m of srcOf.get(f)!.matchAll(/href="(\/[^"]*#[A-Za-z0-9-]+)"/g))
    checkAnchor(f, lineOf(srcOf.get(f)!, m.index!), m[1]);
const idxFile = join(ROOT, 'src/app/searchIndex.ts');
const idx = readFileSync(idxFile, 'utf8');
for (const m of idx.matchAll(/path: '(\/[^']+)'/g))
  checkAnchor(idxFile, lineOf(idx, m.index!), m[1]);

// ---- a paragraph that runs past every other paragraph on its page ----
// Measured per PARAGRAPH, not per card: a card grouping eight enums is long because it covers eight
// things, and each of its intros is the normal length. The smell is one paragraph that rambles.
for (const f of files) {
  const src = srcOf.get(f)!;
  const paras = [...src.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ n: strip(m[1]).split(/\s+/).filter(Boolean).length, i: m.index!, t: strip(m[1]) }))
    .filter((p) => p.n > 3);
  if (paras.length < 8) continue;
  const med = [...paras.map((p) => p.n)].sort((a, b) => a - b)[Math.floor(paras.length / 2)] || 1;
  for (const p of paras)
    if (p.n > med * 3 && p.n > 70)
      report(f, lineOf(src, p.i), 'long-paragraph',
        `one paragraph of ${p.n} words against this page's median of ${med}: "${p.t.slice(0, 70)}"`);
}

// ---- report ----
const byRule = new Map<string, Finding[]>();
for (const x of findings) byRule.set(x.rule, [...(byRule.get(x.rule) ?? []), x]);
for (const [rule, xs] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${rule}  (${xs.length})${rates.has(rule) ? `   [${rates.get(rule)}]` : ''}`);
  for (const x of xs) console.log(`  ${x.file}:${x.line}  ${x.detail}`);
}
const quiet = [...rates].filter(([r]) => !byRule.has(r));
if (quiet.length) console.log(`\nclean: ${quiet.map(([r, v]) => `${r} [${v}]`).join(', ')}`);
console.log(findings.length ? `\nconformance: ${findings.length} findings` : '\nconformance: clean');
process.exit(findings.length ? 1 : 0);
