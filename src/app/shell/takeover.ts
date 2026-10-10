// The app replaces the prerendered snapshot while the snapshot's intro may still be playing. The app's copy
// picks the intro up where the snapshot had it, rather than playing it again from the start. A canvas is
// left alone: the snapshot's is blank, so its fade starts with the app.
const intro = (a: Animation) =>
  'animationName' in a &&
  a.effect?.getTiming().iterations !== Infinity &&
  !((a.effect as KeyframeEffect | null)?.target instanceof HTMLCanvasElement);

import { ARRIVAL_MS, arrive, pageArrival } from './motion';

type Animated = Pick<Document, 'getAnimations'>;

export function introElapsed(doc: Animated = document): number {
  if (typeof doc.getAnimations !== 'function') return 0;
  return Math.max(0, ...doc.getAnimations().filter(intro).map((a) => Number(a.currentTime) || 0));
}

export function resumeIntro(elapsed: number, doc: Animated = document): void {
  if (!elapsed || typeof doc.getAnimations !== 'function') return;
  for (const a of doc.getAnimations()) if (intro(a) && (Number(a.currentTime) || 0) < elapsed) a.currentTime = elapsed;
}

// A page drawn again while it arrives (a dashboard page whose box is found as it opens) takes the arrival
// up where the page it replaces had it, as the app takes up the snapshot's: its blocks stamped as the
// arrival stamped them, every motion started when the first one started. Once the arrival is over, a panel
// drawn again that says the same holds still, and one whose contents changed keeps its heading still while
// they come in (panelMotion.ts reads `data-still`). Called before the redraw; what it returns runs once the
// new page is in.
const heading = (p: Element) => p.querySelector(':scope > .ph')?.textContent ?? '';
export function carryArrival(page: HTMLElement | null): () => void {
  if (!page) return () => {};
  if (!page.classList.contains('arriving') || typeof page.getAnimations !== 'function') {
    const said = new Map([...page.querySelectorAll('.pn')].map((p) => [heading(p), p.textContent ?? '']));
    return () => {
      for (const p of page.querySelectorAll<HTMLElement>('.pn')) {
        const was = said.get(heading(p));
        if (was !== undefined) p.dataset.still = was === p.textContent ? 'all' : 'frame';
      }
      setTimeout(() => page.querySelectorAll<HTMLElement>('[data-still]').forEach((p) => delete p.dataset.still), 0);
    };
  }
  const within: Animated = { getAnimations: () => page.getAnimations({ subtree: true }) };
  const at = introElapsed(within);
  // Set as a start, not a time reached: a pending animation then keeps step through a long first frame.
  const began = (document.timeline?.currentTime as number | null ?? performance.now()) - at;
  return () => {
    arrive(page, pageArrival(page), Math.max(0, ARRIVAL_MS - at));
    // After the new page has mounted (its panes stamp their panels), before any frame shows it.
    queueMicrotask(() => {
      for (const a of within.getAnimations()) if (intro(a) && (Number(a.currentTime) || 0) < at) a.startTime = began;
    });
  };
}
