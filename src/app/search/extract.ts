import type { IndexEntry } from './types';
import { type Fate, clean, sortMarked } from './places';

// Turns a rendered page into search entries: the page, each titled element marked `data-search-target`
// (sections, dashboard panels, anchors such as a Help answer), and each dashboard tab. An entry's text is
// what it shows outside the entries nested in it, one line per block (or flex or grid item) and per table
// row. A diagram is read line by line; a code sample gives its names instead, and a control its
// `data-search-text` (what it shows only when opened). A marked element with no title gives its text to the
// tab or entry around it. On the dashboard only headings, labels, buttons, options, paragraphs and control
// names are read, since cells and fields hold the values of whichever box is connected.

export interface PageInfo {
  path: string;
  title: string;
  description: string;
  section: string;
  group?: string;
  nav: string;
  // A dashboard page.
  app: boolean;
}

// The page header's crumbs and title already belong to the page entry; what the page puts under them is
// read. A number input's step buttons say the same thing on every panel.
const SKIP = 'svg, script, style, template, [aria-hidden="true"], [data-search-skip], .page-header__bar, .page-header__row h1, [role="tablist"], .number-input__stepper';
const BLOCK = /^(P|DIV|SECTION|ARTICLE|ASIDE|NAV|HEADER|FOOTER|UL|OL|LI|DL|DT|DD|TABLE|THEAD|TBODY|TFOOT|CAPTION|H[1-6]|BLOCKQUOTE|FIGURE|FIGCAPTION|DETAILS|SUMMARY|LABEL|FIELDSET|LEGEND|FORM|BUTTON|SELECT|OPTION|PRE)$/;
// What a dashboard page is read by: its headings, labels and controls, and the names of its controls.
const LABELS = 'h2, h3, h4, label, .field-l, button, option, legend, summary, th, dt, p';
const NAMED = 'input, select, textarea, button, [role="radiogroup"], [role="group"], [role="slider"], [role="switch"]';
const NAME = /(?<![A-Za-z0-9_])[A-Za-z_][A-Za-z0-9_]{2,}/g;
// Words every code sample shares, which tell no section apart.
const SYNTAX = new Set(
  'let const var mut pub use mod crate fn impl struct enum trait type where self Self super return await async match loop while for if else break continue def import from class with as pass raise try except lambda yield None True False not and or int void char bool unsigned signed static extern include define ifdef ifndef endif sizeof null true false new this Ok Err Some unwrap expect Result Option String Vec usize isize u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 str print println printf'.split(' '),
);

interface Read {
  lines: string[];
  code: Set<string>;
}

// The names in a piece of code, leaving out its comments and strings.
function names(code: Element, into: Set<string>) {
  const text = (n: Node): string =>
    n.nodeType === Node.ELEMENT_NODE && (n as Element).matches('.token.comment, .token.string')
      ? ' '
      : n.nodeType === Node.TEXT_NODE
        ? (n.textContent ?? '')
        : [...n.childNodes].map(text).join('');
  for (const m of text(code).matchAll(NAME)) if (!SYNTAX.has(m[0])) into.add(m[0]);
}

// Text of `el` up to the elements in `stops` (separate entries, or the title already taken).
function read(el: Element, stops: Set<Element>, labels: boolean): Read {
  const out: Read = { lines: [], code: new Set() };
  let line = '';
  const flush = () => {
    const t = line.replace(/\s+/g, ' ').trim();
    if (t) out.lines.push(t);
    line = '';
  };
  const walk = (node: Node, live: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (live) line += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (stops.has(e) || e.matches(SKIP)) return;
    // A diagram is drawn in words, so it is read line by line; a code sample gives its names.
    if (e.tagName === 'PRE' && e.matches('.diagram')) {
      flush();
      if (live) for (const l of (e.textContent ?? '').split('\n')) if (l.trim()) out.lines.push(l.replace(/\s+/g, ' ').trim());
      return;
    }
    if (e.tagName === 'PRE') {
      flush();
      names(e, out.code);
      return;
    }
    if (e.tagName === 'CODE') names(e, out.code);
    const on = live || (labels && e.matches(LABELS));
    if (e.tagName === 'TR') {
      flush();
      const cells = [...e.children].map((c) => {
        if (!on && !(labels && c.matches(LABELS))) return '';
        const r = read(c, stops, false);
        for (const n of r.code) out.code.add(n);
        return r.lines.join(' ');
      });
      line = cells.filter(Boolean).join(' · ');
      flush();
      return;
    }
    const block = BLOCK.test(e.tagName) || laidApart(e);
    if (block) flush();
    if (labels && e.matches(NAMED)) {
      flush();
      for (const a of ['aria-label', 'placeholder']) {
        const v = e.getAttribute(a)?.trim();
        if (v) out.lines.push(v);
      }
    }
    // Text a control shows only when opened, such as a dropdown's options.
    const declared = e.getAttribute('data-search-text');
    if (declared) {
      flush();
      for (const l of declared.split('\n')) if (l.trim()) out.lines.push(l.trim());
    }
    for (const child of e.childNodes) walk(child, on);
    if (block) flush();
  };
  walk(el, !labels);
  flush();
  return out;
}


// Whether an inline element still stands apart from its neighbours, as a link does in a row of links laid
// out by flex or grid.
const layouts = new WeakMap<Element, boolean>();
function laidApart(e: Element): boolean {
  const parent = e.parentElement;
  if (!parent || typeof getComputedStyle !== 'function') return false;
  let apart = layouts.get(parent);
  if (apart === undefined) layouts.set(parent, (apart = /flex|grid/.test(getComputedStyle(parent).display)));
  return apart;
}


const crumb = (page: PageInfo, ...more: (string | undefined)[]) =>
  [page.group !== page.section ? page.group : undefined, ...more].filter((x, i, all) => x && all.indexOf(x) === i).join(' / ');

export type { Fate };

export function extractPage(root: Element, page: PageInfo, record?: (id: string, fate: Fate, panel: boolean) => void): IndexEntry[] {
  // If the first titled section has the page's title, it opens the page and is read as part of it.
  const { marked, heads, opening, targets, fate } = sortMarked(root, page.title);
  for (const t of marked) record?.(t.id, fate(t), t.matches('.pn'));
  const panes = [...root.querySelectorAll('[data-pane]')];
  const tabs = new Map([...root.querySelectorAll('[role="tab"][data-tab]')].map((t) => [t.getAttribute('data-tab')!, clean(t.textContent ?? '')]));
  const tabOf = (el: Element) => tabs.get(el.closest('[data-pane]')?.getAttribute('data-pane') ?? '');
  const stops = new Set<Element>(targets);
  const entry = (path: string, title: string, kind: IndexEntry['kind'], r: Read, extra: Partial<IndexEntry> = {}): IndexEntry => ({
    path,
    title,
    kind,
    section: page.section,
    crumb: crumb(page),
    ...extra,
    text: [extra.text, ...r.lines].filter(Boolean).join('\n'),
    ...(r.code.size ? { code: [...r.code] } : {}),
  });

  // A tab gets an entry unless a panel in it carries the tab's name. Its text is what its pane holds outside
  // any entry; a tab without an entry leaves that text to the page.
  const tabEntries: IndexEntry[] = [];
  const kept = new Set<Element>();
  for (const pane of panes) {
    const key = pane.getAttribute('data-pane')!;
    const label = tabs.get(key);
    if (!label || targets.some((t) => t.id === key)) continue;
    if (targets.some((t) => pane.contains(t) && heads.get(t)!.title === label)) continue;
    kept.add(pane);
    tabEntries.push(entry(`${page.path}#${key}`, label, 'section', read(pane, stops, page.app), { crumb: crumb(page, page.nav) }));
  }

  const caption = opening.map((t) => heads.get(t)!.caption).find(Boolean);
  const openingHeads = opening.flatMap((t) => heads.get(t)!.el ?? []);
  const entries = [
    entry(page.path, page.title, 'page', read(root, new Set([...stops, ...kept, ...openingHeads]), page.app), {
      text: page.description,
      ...(caption ? { caption } : {}),
    }),
  ];
  for (const t of targets) {
    const { el, title, caption } = heads.get(t)!;
    const tab = tabOf(t);
    const kind = t.matches('.doc-section') ? 'section' : t.matches('.pn') ? 'panel' : 'anchor';
    const r = read(t, new Set([...stops].filter((s) => s !== t).concat(el ? [el] : [])), page.app);
    entries.push(
      entry(`${page.path}#${t.id}`, title, kind, r, {
        crumb: crumb(page, page.nav !== title ? page.nav : undefined, tab !== title ? tab : undefined),
        ...(caption ? { caption } : {}),
      }),
    );
  }
  return [...entries, ...tabEntries];
}
