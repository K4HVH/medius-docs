import { describe, it, expect } from 'vitest';
import { introElapsed, resumeIntro } from '../../src/app/shell/takeover';

const anim = (name: string | null, currentTime: number, iterations = 1, target: Element = document.createElement('div')) => ({
  ...(name === null ? { transitionProperty: 'color' } : { animationName: name }),
  currentTime,
  effect: { getTiming: () => ({ iterations }), target },
});
const doc = (list: ReturnType<typeof anim>[]) => ({ getAnimations: () => list }) as unknown as Document;

describe('takeover', () => {
  it('reads how far the snapshot intro has run, from its finite animations', () => {
    expect(introElapsed(doc([anim('up', 640), anim('pulse', 9000, Infinity), anim(null, 5000)]))).toBe(640);
    expect(introElapsed(doc([]))).toBe(0);
  });

  it('moves the app copy of the intro to where the snapshot was, never back, and leaves the rest', () => {
    const list = [anim('up', 0), anim('rise', 900), anim('pulse', 0, Infinity), anim(null, 0), anim('fade', 0, 1, document.createElement('canvas'))];
    resumeIntro(640, doc(list));
    expect(list.map((a) => a.currentTime)).toEqual([640, 900, 0, 0, 0]);
  });
});
