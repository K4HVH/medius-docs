// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gh = (tags: string[]) =>
  new Response(JSON.stringify(tags.map((t) => ({ tag_name: t, name: t, published_at: '2026-10-05T12:00:00Z', prerelease: false, body: '', assets: [] }))));

let calls: string[][];
let next: string[];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ now: 1_000_000 });
  calls = [];
  next = ['v3.4.4'];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      calls.push(next);
      return gh(next);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tags = (list: { tag: string }[] | null) => list?.map((r) => r.tag);

describe('releases', () => {
  it('reads the list again at once when asked to, for a release published a moment ago', async () => {
    const fw = await import('../../server/firmware');
    expect(tags(await fw.getReleases())).toEqual(['v3.4.4']);
    next = ['v3.4.5', 'v3.4.4'];
    expect(tags(await fw.getReleases())).toEqual(['v3.4.4']);
    expect(tags(await fw.refreshReleases())).toEqual(['v3.4.5', 'v3.4.4']);
    expect(calls).toHaveLength(2);
  });

  it('reads it again at most once in 30 s, whatever tags are asked for', async () => {
    const fw = await import('../../server/firmware');
    await fw.getReleases();
    await fw.refreshReleases();
    await fw.refreshReleases();
    vi.advanceTimersByTime(29_000);
    await fw.refreshReleases();
    expect(calls).toHaveLength(2);
    vi.advanceTimersByTime(31_000 - 29_000);
    await fw.refreshReleases();
    expect(calls).toHaveLength(3);
  });

  it('shares one read among the requests that ask while it runs', async () => {
    const fw = await import('../../server/firmware');
    await Promise.all([fw.getReleases(), fw.getReleases(), fw.refreshReleases()]);
    expect(calls).toHaveLength(1);
  });
});
