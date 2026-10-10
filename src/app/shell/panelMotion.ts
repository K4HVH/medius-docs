// Dashboard panels. A panel arrives as a docs block does: its heading and contents rise in order, a
// table's rows come in one after another, and its charts grow. Panels on screen arrive when their tab
// opens, each a little after the one before; the rest as they come into view. Each column lights the rule
// of the panel being read in it, as the docs light the section being read.

import { arrive, armReveals, blocksOf, inOrder, shown } from './motion';

const parts = (p: HTMLElement): HTMLElement[] =>
  [p.querySelector<HTMLElement>(':scope > .ph'), ...p.querySelectorAll<HTMLElement>(':scope > .pb > *')].filter(shown);

// The panels in a tab's first row sit under the tab strip's rule and draw none.
export function markTop(scope: ParentNode): void {
  const ps = [...scope.querySelectorAll<HTMLElement>('.pn')].filter(shown);
  if (!ps.length) return;
  const tops = ps.map((p) => Math.round(p.getBoundingClientRect().top));
  const first = Math.min(...tops);
  ps.forEach((p, i) => p.classList.toggle('top', tops[i] - first < 2));
}

const atEnd = () => {
  const h = document.documentElement.scrollHeight;
  return h > window.innerHeight + 2 && window.scrollY >= h - window.innerHeight - 2;
};

// The panel being read in each column: the last whose top has passed a third of the screen, or at the
// page's end the last on it. A panel across both columns puts out those above it.
export function lightPanels(): void {
  const ps = [...document.querySelectorAll<HTMLElement>('.pane:not([hidden]) .pn, .panels-page .pn')].filter(
    (p) => shown(p) && p.firstElementChild?.classList.contains('ph'),
  );
  const line = atEnd() ? window.innerHeight : window.innerHeight * 0.35;
  const top = (p: HTMLElement) => p.getBoundingClientRect().top;
  const cols = new Map<number, HTMLElement>();
  for (const p of ps) {
    const k = Math.round(p.getBoundingClientRect().left);
    const cur = cols.get(k);
    if (top(p) < line && (!cur || top(p) > top(cur) + 1)) cols.set(k, p);
  }
  const lit = [...cols.values()];
  const wides = lit.filter((p) => p.classList.contains('wide'));
  ps.forEach((p) => p.classList.toggle('act', lit.includes(p) && !wides.some((w) => top(w) > top(p) + 1)));
}

let watching = false;
const disposers = new WeakMap<HTMLElement, () => void>();

// A pane just opened, or panels appeared in it: rows marked, panels brought in, rules lit. On a page's
// first arrival the panels wait for its header.
export function openPanels(scope: HTMLElement, panels?: HTMLElement[]): void {
  markTop(scope);
  const t0 = scope.parentElement?.closest('.arriving') ? 200 : 60;
  const ps = (panels ?? [...scope.querySelectorAll<HTMLElement>('.pn')]).filter(shown);
  if (ps.length) arrive(scope, ps.flatMap((p, k) => parts(p).map((el, j) => [el, t0 + k * 90 + j * 45] as const)));
  else arrive(scope, inOrder(blocksOf(scope), t0, 55));
  requestAnimationFrame(() => {
    disposers.get(scope)?.();
    disposers.delete(scope);
    if (!scope.isConnected) return;
    const all = [...scope.querySelectorAll<HTMLElement>('.pn')].filter(shown);
    disposers.set(scope, all.length ? armReveals(scope, () => all, parts) : armReveals(scope, () => blocksOf(scope)));
    lightPanels();
  });
  if (watching) return;
  watching = true;
  window.addEventListener('scroll', lightPanels, { passive: true });
  window.addEventListener('resize', () => {
    document.querySelectorAll<HTMLElement>('.pane:not([hidden]), .panels-page').forEach(markTop);
    lightPanels();
  });
}

// A pane leaving the page stops watching the scroll for its panels.
export function closePanels(scope: HTMLElement): void {
  disposers.get(scope)?.();
  disposers.delete(scope);
}
