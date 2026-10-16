// Which elements a page marks for search become places (an index entry with an address of the form /page/id).
// The index builder (extract.ts) and the page's links (shell/share.ts) both decide it this way.

export const TARGET = '[data-search-target][id]';
const HEADING = 'h2, h3, h4';
export const LABEL = '.api-response-label, .field-l, dt, strong';

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// A target's title: its `data-search-title`, its first heading, its first label, or, when it is a label
// itself, its text.
export function heading(target: Element, all: Element[]): { el: Element | null; title: string; caption?: string } {
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

// What became of an element marked for search: an entry; folded into the page as its opening (the first
// titled element, if its title is the page's); or, lacking a title, read into the entry around it.
export type Fate = 'entry' | 'folded' | 'untitled';

export function sortMarked(root: Element, pageTitle: string) {
  const marked = [...root.querySelectorAll(TARGET)].filter((t) => !t.matches('.page-header'));
  const heads = new Map(marked.map((t) => [t, heading(t, marked)]));
  const first = marked.find((t) => heads.get(t)!.title);
  const opening = first && heads.get(first)!.title.toLowerCase() === pageTitle.toLowerCase() ? [first] : [];
  const targets = marked.filter((t) => heads.get(t)!.title && !opening.includes(t));
  const fate = (t: Element): Fate => (targets.includes(t) ? 'entry' : opening.includes(t) ? 'folded' : 'untitled');
  return { marked, heads, opening, targets, fate };
}
