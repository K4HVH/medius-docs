import type { IndexEntry } from './types';

// A rendered page as search entries: the page, each element marked `data-search-target` that carries a
// title (sections, dashboard panels, anchors such as a Help answer), and on the dashboard each tab. An
// entry's text is what it shows outside the entries nested in it, a block (or a flex or grid item) to a
// line and a table row to a line; a diagram is read line by line, a code sample gives its names instead,
// and a control its `data-search-text` (what it shows only when opened). A marked element with no title
// gives its text to the tab or entry around it. On the dashboard only headings, labels, buttons, options,
// paragraphs and the names of controls are read, since cells and fields hold the values of whichever box
// is connected.

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

const TARGET = '[data-search-target][id]';
// The page header's crumbs and title are the page entry's already; what a page puts under them is read.
// A number input's step buttons say the same on every panel.
const SKIP = 'svg, script, style, template, [aria-hidden="true"], [data-search-skip], .page-header__bar, .page-header__row h1, [role="tablist"], .number-input__stepper';
const BLOCK = /^(P|DIV|SECTION|ARTICLE|ASIDE|NAV|HEADER|FOOTER|UL|OL|LI|DL|DT|DD|TABLE|THEAD|TBODY|TFOOT|CAPTION|H[1-6]|BLOCKQUOTE|FIGURE|FIGCAPTION|DETAILS|SUMMARY|LABEL|FIELDSET|LEGEND|FORM|BUTTON|SELECT|OPTION|PRE)$/;
const HEADING = 'h2, h3, h4';
const LABEL = '.api-response-label, .field-l, dt, strong';
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

// Text of `el` up to the elements in `stops` (entries of their own, or the title already taken).
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

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// Whether an element stands apart from its neighbours though its tag runs inline: a link in a row of
// links laid out by flex or grid.
const layouts = new WeakMap<Element, boolean>();
function laidApart(e: Element): boolean {
  const parent = e.parentElement;
  if (!parent || typeof getComputedStyle !== 'function') return false;
  let apart = layouts.get(parent);
  if (apart === undefined) layouts.set(parent, (apart = /flex|grid/.test(getComputedStyle(parent).display)));
  return apart;
}

// A target's title: its `data-search-title`, its first heading, its first label, or, when it is a label
// itself, its text.
function heading(target: Element, all: Element[]): { el: Element | null; title: string; caption?: string } {
  const named = target.getAttribute('data-search-title');
  if (target.matches(LABEL)) return { el: null, title: clean(named ?? target.textContent ?? '') };
  const inner = (sel: string) =>
    [...target.querySelectorAll(sel)].find((h) => !all.some((t) => t !== target && t.contains(h) && target.contains(t))) ?? null;
  // A dashboard panel is titled by its heading alone; its labels name fields, not the panel.
  const h = inner(HEADING) ?? (target.matches('.pn') ? null : inner(LABEL));
  const cap = h?.querySelector('.doc-caption') ?? null;
  const title = h ? [...h.childNodes].filter((n) => n !== cap).map((n) => n.textContent).join('') : '';
  return { el: h, title: clean(named ?? title), caption: cap?.textContent ? clean(cap.textContent) : undefined };
}

const crumb = (page: PageInfo, ...more: (string | undefined)[]) =>
  [page.group !== page.section ? page.group : undefined, ...more].filter((x, i, all) => x && all.indexOf(x) === i).join(' / ');

// What became of an element marked for search: an entry, folded into the page as its opening,
// or read into the entry around it for want of a title.
export type Fate = 'entry' | 'folded' | 'untitled';

export function extractPage(root: Element, page: PageInfo, record?: (id: string, fate: Fate, panel: boolean) => void): IndexEntry[] {
  const marked = [...root.querySelectorAll(TARGET)].filter((t) => !t.matches('.page-header'));
  const heads = new Map(marked.map((t) => [t, heading(t, marked)]));
  // The first titled section, when it is titled as its page, opens the page, and is read as part of it.
  const first = marked.find((t) => heads.get(t)!.title);
  const opening = first && heads.get(first)!.title.toLowerCase() === page.title.toLowerCase() ? [first] : [];
  const targets = marked.filter((t) => heads.get(t)!.title && !opening.includes(t));
  for (const t of marked) record?.(t.id, targets.includes(t) ? 'entry' : opening.includes(t) ? 'folded' : 'untitled', t.matches('.pn'));
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

  // A tab gets an entry unless a panel in it carries its name; what its pane holds outside any entry is
  // its text, or the page's when it has none.
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
