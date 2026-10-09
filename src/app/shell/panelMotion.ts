// Dashboard panels. A panel arrives as a docs block does: its heading and contents rise in order, a
// table's rows come in one after another as the landing's comparison rows do, and its charts draw. Panels
// on screen arrive when their tab opens; the rest as they come into view. Each column lights the rule of
// the panel being read in it, as the docs light the section being read.

import { prefersReducedMotion } from './motion';

const play = (el: HTMLElement, anim: string, delay: number) => {
  const end = (e: AnimationEvent) => {
    if (e.target !== el) return;
    el.style.animation = '';
    el.removeEventListener('animationend', end);
  };
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = `${anim} var(--ease) ${delay}ms both`;
  el.addEventListener('animationend', end);
};

const shown = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null;

function reveal(p: HTMLElement, delay: number): void {
  p.classList.remove('pre');
  p.querySelectorAll('.chart').forEach((c) => c.classList.add('on'));
  if (prefersReducedMotion()) return;
  let t = delay;
  // Only what shows: a part shown later appears when the control that shows it does.
  for (const el of [p.querySelector(':scope > .ph'), ...p.querySelectorAll(':scope > .pb > *')]) {
    if (!shown(el)) continue;
    if (el.matches('.vals, .table-scroll')) {
      [...el.querySelectorAll<HTMLElement>('tr')].filter(shown).forEach((tr, i) => play(tr, 'rowin .45s', t + Math.min(i, 14) * 35));
    } else play(el, 'rise .7s', t);
    t += 45;
  }
}

let io: IntersectionObserver | null = null;

// The panels in a tab's first row sit under the tab strip's rule and draw none.
export function markTop(scope: ParentNode): void {
  const ps = [...scope.querySelectorAll<HTMLElement>('.pn')].filter(shown);
  if (!ps.length) return;
  const tops = ps.map((p) => Math.round(p.getBoundingClientRect().top));
  const first = Math.min(...tops);
  ps.forEach((p, i) => p.classList.toggle('top', tops[i] - first < 2));
}

// Hides the panels given and brings each in: at once and in order when on screen, else on arrival.
export function armPanels(panels: HTMLElement[]): void {
  const ps = panels.filter(shown);
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    ps.forEach((p) => reveal(p, 0));
    return;
  }
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        reveal(e.target as HTMLElement, 0);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  let k = 0;
  for (const p of ps) {
    io.unobserve(p);
    p.classList.add('pre');
    if (p.getBoundingClientRect().top < window.innerHeight * 0.94) reveal(p, 60 + k++ * 90);
    else io.observe(p);
  }
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

// A pane just opened, or its panels changed: rows marked, panels brought in, rules lit.
export function openPanels(scope: HTMLElement, panels?: HTMLElement[]): void {
  markTop(scope);
  armPanels(panels ?? [...scope.querySelectorAll<HTMLElement>('.pn')]);
  lightPanels();
  if (watching) return;
  watching = true;
  window.addEventListener('scroll', lightPanels, { passive: true });
  window.addEventListener('resize', () => {
    document.querySelectorAll<HTMLElement>('.pane:not([hidden]), .panels-page').forEach(markTop);
    lightPanels();
  });
}
