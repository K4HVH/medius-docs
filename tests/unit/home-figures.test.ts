import { describe, it, expect, vi } from 'vitest';
import { createDiscordMembers, getHomeFigures, handleHomeApi, type HomeSources } from '../../server/home';
import type { FirmwareRelease } from '../../src/dashboard/firmware';
import type { StatsSummary } from '../../server/stats/types';

const rel = (tag: string, prerelease = false, publishedAt = '2026-10-05T12:00:00Z'): FirmwareRelease => ({
  tag, name: tag, publishedAt, prerelease, notes: '', assets: [],
});
const STATS = { boxes: { total: 1201 }, devices: { unique: 70 } } as unknown as StatsSummary;
const UP: HomeSources = {
  releases: async () => [rel('v3.5.0-rc1', true, '2026-10-08T00:00:00Z'), rel('v3.4.5'), rel('v3.4.4', false, '2026-10-01T00:00:00Z')],
  stats: async () => STATS,
  discord: async () => 590,
};
const down = async () => {
  throw new Error('down');
};

describe('getHomeFigures', () => {
  it('reads the newest release that is not a pre-release, the stats and the Discord count', async () => {
    expect(await getHomeFigures(UP)).toEqual({ firmware: 'v3.4.5', devices: 70, boxes: 1201, discord: 590 });
  });

  it('leaves out what a source that is down would have given', async () => {
    expect(await getHomeFigures({ ...UP, releases: down })).toEqual({ devices: 70, boxes: 1201, discord: 590 });
    expect(await getHomeFigures({ ...UP, stats: async () => null })).toEqual({ firmware: 'v3.4.5', discord: 590 });
    expect(await getHomeFigures({ ...UP, discord: down })).toEqual({ firmware: 'v3.4.5', devices: 70, boxes: 1201 });
    expect(await getHomeFigures({ releases: down, stats: down, discord: down })).toEqual({});
  });
});

describe('Discord member count', () => {
  const answer = (n: number) => new Response(JSON.stringify({ approximate_member_count: n }));

  it('asks Discord at most once an hour, and keeps the last count while Discord is down', async () => {
    let t = 0;
    const fetchImpl = vi.fn(async () => answer(590));
    const members = createDiscordMembers(fetchImpl as unknown as typeof fetch, () => t);
    expect(await members()).toBe(590);
    t += 59 * 60_000;
    expect(await members()).toBe(590);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 2 * 60_000;
    fetchImpl.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    expect(await members()).toBe(590);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after 10 seconds, and has nothing to give before Discord ever answered', async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      throw new Error('timeout');
    });
    expect(await createDiscordMembers(fetchImpl as unknown as typeof fetch, () => 0)()).toBeNull();
    expect(signal).toBeDefined();
  });
});

describe('GET /api/home', () => {
  it('answers the figures for a minute of caching', async () => {
    const res = (await handleHomeApi(new Request('http://x/api/home'), UP))!;
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await res.json()).toEqual({ firmware: 'v3.4.5', devices: 70, boxes: 1201, discord: 590 });
    expect(await handleHomeApi(new Request('http://x/api/other'), UP)).toBeNull();
  });
});
