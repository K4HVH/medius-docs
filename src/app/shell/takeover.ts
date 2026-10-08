// The app replaces the prerendered snapshot while the snapshot's intro may still be playing. The app's copy
// picks the intro up where the snapshot had it, rather than playing it again from the start. A canvas is
// left alone: the snapshot's is blank, so its fade starts with the app.
const intro = (a: Animation) =>
  'animationName' in a &&
  a.effect?.getTiming().iterations !== Infinity &&
  !((a.effect as KeyframeEffect | null)?.target instanceof HTMLCanvasElement);

export function introElapsed(doc: Document = document): number {
  if (typeof doc.getAnimations !== 'function') return 0;
  return Math.max(0, ...doc.getAnimations().filter(intro).map((a) => Number(a.currentTime) || 0));
}

export function resumeIntro(elapsed: number, doc: Document = document): void {
  if (!elapsed || typeof doc.getAnimations !== 'function') return;
  for (const a of doc.getAnimations()) if (intro(a) && (Number(a.currentTime) || 0) < elapsed) a.currentTime = elapsed;
}
