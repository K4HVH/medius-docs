// Motion shared by every page. A page arrives in reading order: its header, then each block rising after
// the one before it, a table row by row. What starts below the first screen is held back and rises the
// first time it comes into view; at the page bottom whatever is still held shows.
//
// Arrival is the stylesheet's: a block is stamped with its delay and its scope marked `arriving`, so the
// prerendered snapshot plays the same arrival and the app picks it up where the snapshot had it (see
// takeover.ts). Stamping runs under reduced motion too; the stylesheet stills it there.

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fontsReady = (): Promise<unknown> => document.fonts?.ready ?? Promise.resolve();

// Long enough for the last block and the last row of its table to finish.
export const ARRIVAL_MS = 2400;
const ROWS = 14;

type Item = readonly [el: HTMLElement, delay: number];

const isTable = (el: Element) => el.matches('table, .table-scroll, .vals');

// A block rises whole; a table brings its rows in one after another. `moving` moves it, for this arrival
// alone: a later arrival in the same scope leaves it still.
function stamp(el: HTMLElement, delay: number): void {
  el.style.setProperty('--d', `${Math.round(delay)}ms`);
  if (isTable(el)) {
    el.classList.add('rt');
    el.querySelectorAll<HTMLElement>('tr').forEach((tr, i) => tr.style.setProperty('--r', String(Math.min(i, ROWS))));
  } else el.classList.add('rb');
  el.classList.add('moving');
}

// Takes a motion class off once its motion has played; a block moved again keeps it for the new motion.
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const settle = (els: HTMLElement[], cls: string) =>
  els.forEach((el) => {
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => el.classList.remove(cls), ARRIVAL_MS));
  });

// Blocks in reading order from `t0`, each `step` after the one before, the rest together after `cap`.
export const inOrder = (els: Iterable<HTMLElement>, t0: number, step: number, cap = 12): Item[] =>
  [...els].map((el, i) => [el, t0 + Math.min(i, cap) * step] as const);

const ends = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
// When each scope's arrival began, so a block that comes late joins it where it is.
const begun = new WeakMap<HTMLElement, number>();

// `ms`: how long the scope stays arriving from now, the whole arrival unless it began before.
export function arrive(scope: HTMLElement, items: Item[], ms = ARRIVAL_MS): void {
  const moving = items.filter(([el]) => !el.classList.contains('moving') && !el.classList.contains('rv-wait'));
  for (const [el, delay] of moving) stamp(el, delay);
  settle(moving.map(([el]) => el), 'moving');
  if (!scope.classList.contains('arriving')) begun.set(scope, performance.now());
  scope.classList.add('arriving');
  clearTimeout(ends.get(scope));
  ends.set(scope, setTimeout(() => scope.classList.remove('arriving'), ms));
}

export const shown = (el: Element | null): el is HTMLElement => !!el && el.getClientRects().length > 0;

// When a block brought in now starts: during its page's arrival, its turn after the header, or at once when
// that turn is past; otherwise `alone` from now.
export function turnIn(el: HTMLElement, alone = 60): number {
  const scope = el.closest<HTMLElement>('.arriving');
  return scope ? Math.max(0, 200 - (performance.now() - (begun.get(scope) ?? 0))) : alone;
}

// The blocks a page reads in, in order: a section, a panel, a list of releases or of steps, by its parts;
// the header by what follows its title (the stylesheet moves the header's crumbs, title and aside).
const GROUPS = '.page-header, .doc-section, .doc-section > div[id], #changelog, .rels, .flow, .panels, .stack, .pn, .pb';
export function blocksOf(root: ParentNode, skip = '.page-header__bar, .page-header__row, .ptabs, .pane'): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: Element) => {
    if (!(el instanceof HTMLElement) || el.matches(skip) || !shown(el)) return;
    if (el.matches(GROUPS)) [...el.children].forEach(walk);
    else out.push(el);
  };
  [...root.children].forEach(walk);
  return out;
}

// A page's blocks as a page arrives: after its header has begun, each a little after the one before,
// counted from the first block in view, so a page opened deep (Back, a reload, a link to a section) fills
// its screen first. Blocks above the screen are not moved.
const inView = (blocks: HTMLElement[]) => blocks.filter((el) => el.getBoundingClientRect().bottom >= 0);
// After the header's turn when the header shows; at once when the page opened past it.
const fromView = (page: HTMLElement, blocks: HTMLElement[]): Item[] => {
  const header = page.querySelector('.page-header');
  return inOrder(blocks, !header || header.getBoundingClientRect().bottom >= 0 ? 200 : 0, 55);
};
export const pageArrival = (page: HTMLElement): Item[] => fromView(page, inView(blocksOf(page)));
// The arrival's blocks counted again from the first in view, after the page has jumped (to a hash, or to
// where a reload left it, on the snapshot before the app takes over).
export function retime(page: HTMLElement): void {
  for (const [el, d] of fromView(page, inView(blocksOf(page)).filter((el) => el.classList.contains('moving'))))
    el.style.setProperty('--d', `${Math.round(d)}ms`);
}

// `blocks` is a selector, or the blocks themselves. `parts` brings a group in by its parts (a panel by its
// heading and contents), each a little after the one before.
export function armReveals(
  scope: ParentNode,
  blocks: string | (() => HTMLElement[]),
  parts?: (el: HTMLElement) => HTMLElement[],
): () => void {
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return () => {};

  // Blocks coming into view together rise one after another.
  let burst = 0;
  let calm: ReturnType<typeof setTimeout> | undefined;
  const show = (el: HTMLElement) => {
    el.classList.remove('rv-wait');
    const d = Math.min(burst++, 6) * 70;
    clearTimeout(calm);
    calm = setTimeout(() => (burst = 0), 120);
    const list = parts?.(el) ?? [el];
    list.forEach((p, i) => stamp(p, d + i * 45));
    settle(list, 'moving');
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        show(e.target as HTMLElement);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );

  (typeof blocks === 'string' ? [...scope.querySelectorAll<HTMLElement>(blocks)] : blocks()).forEach((el) => {
    if (el.classList.contains('rv-wait')) return;
    if (el.getBoundingClientRect().top >= window.innerHeight) {
      el.classList.add('rv-wait');
      io.observe(el);
    }
  });

  const atBottom = () => {
    if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 4) return;
    [...scope.querySelectorAll<HTMLElement>('.rv-wait')]
      .filter((el) => el.getBoundingClientRect().top < window.innerHeight)
      .forEach((el) => {
        io.unobserve(el);
        show(el);
      });
  };
  window.addEventListener('scroll', atBottom, { passive: true });

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', atBottom);
    clearTimeout(calm);
    scope.querySelectorAll('.rv-wait').forEach((el) => el.classList.remove('rv-wait'));
  };
}

// A block that appears on a state change (a refusal, a step, a connected box's panel contents) rises in.
// Only the block itself: a chip or row redrawn inside one stays still, so a poll never sets it moving. A
// page block a fetch delivers while the page is arriving joins the arrival. A tab brings in the panels inside it.
// `n` takes its place in the arrival of the block `lead` heads: a step after it, started when it started.
function join(n: HTMLElement, lead: HTMLElement): void {
  const led = lead.getAnimations?.()[0];
  if (led?.playState === 'finished') {
    n.classList.add('st-in');
    settle([n], 'st-in');
    return;
  }
  stamp(n, (parseFloat(lead.style.getPropertyValue('--d')) || 0) + 45);
  settle([n], 'moving');
  // A heading not started yet (pending) starts on the same frame as `n`; one started gives its start.
  if (led && led.startTime !== null) queueMicrotask(() => n.getAnimations().forEach((a) => (a.startTime = led.startTime)));
}

const CHANGES = ':is(.pb, .boxstate, .cv, .flow, .step, .page-header__aside, .doc-section) > *, .callout, [role="alert"]';
const LISTS = '.doc-section, #changelog, .rels, .flow';
export function watchChanges(root: HTMLElement): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const added = (n: HTMLElement) => {
    if (n.closest('.rv-wait') || n.parentElement?.closest('.st-in')) return;
    // A header or tab strip drawn again holds still; only the state at its right is news.
    if (n.matches('.page-header, .ptabs')) {
      const state = n.querySelector<HTMLElement>(':scope .page-header__aside');
      if (state && !root.classList.contains('arriving')) {
        state.classList.add('st-in');
        settle([state], 'st-in');
      }
      return;
    }
    const page = (n.parentElement === root || !!n.parentElement?.matches(LISTS)) && !n.closest('.pane, .panels');
    if (page && root.classList.contains('arriving')) {
      if (!n.matches('.rb, .rt')) arrive(root, inOrder(n.matches(GROUPS) ? blocksOf(n) : [n], turnIn(n), 55));
    } else if ((page || n.matches(CHANGES)) && !n.closest('.arriving')) {
      n.classList.add('st-in');
      settle([n], 'st-in');
    } else if (n.matches(CHANGES) && !n.matches('.rb, .rt')) {
      // Contents swapped into a panel or section while it arrives (a box's panel as the box connects) rise
      // with its heading, in step, rather than showing before it; in a panel already in, or holding still,
      // they are news.
      const block = n.parentElement?.closest('.pn, .doc-section');
      if (!block) return;
      const lead = block.querySelector<HTMLElement>(':scope > .ph.moving, :scope > .moving');
      if (lead) join(n, lead);
      else {
        n.classList.add('st-in');
        settle([n], 'st-in');
      }
    }
  };
  const mo = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement) added(n);
  });
  mo.observe(root, { childList: true, subtree: true });
  return () => mo.disconnect();
}
