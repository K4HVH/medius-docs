// The landing page's live figures: the latest firmware, the stats' totals and the Discord member count.
// Each is absent while its source is down; none of them ever holds the page up.
import type { FirmwareRelease } from '../src/dashboard/firmware/client';
import { LINKS } from '../src/app/site';
import type { StatsSummary } from './stats/types';
import { getReleases } from './firmware';
import { getStatsSummary } from './stats';

export interface HomeFigures {
  firmware?: string;
  devices?: number;
  boxes?: number;
  discord?: number;
}

export interface HomeSources {
  releases: () => Promise<FirmwareRelease[] | null>;
  stats: () => Promise<StatsSummary | null>;
  discord: () => Promise<number | null>;
}

const HOUR_MS = 60 * 60 * 1000;
const DISCORD_TIMEOUT_MS = 10_000;
const INVITE = LINKS.discord.slice(LINKS.discord.lastIndexOf('/') + 1);

// The invite's public count: no token, cached an hour, the last good count kept while Discord is down.
export function createDiscordMembers(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  let last: number | null = null;
  let askedAt = -Infinity;
  return async (): Promise<number | null> => {
    if (now() - askedAt < HOUR_MS) return last;
    askedAt = now();
    try {
      const res = await fetchImpl(`https://discord.com/api/v10/invites/${INVITE}?with_counts=true`, {
        signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      });
      const n = res.ok ? ((await res.json()) as { approximate_member_count?: unknown }).approximate_member_count : null;
      if (typeof n === 'number' && n > 0) last = n;
    } catch {
      // keep the last count
    }
    return last;
  };
}

export const getDiscordMembers = createDiscordMembers();

const LIVE: HomeSources = { releases: getReleases, stats: getStatsSummary, discord: getDiscordMembers };

async function read<T>(source: () => Promise<T | null>): Promise<T | null> {
  try {
    return await source();
  } catch {
    return null;
  }
}

export async function getHomeFigures(sources: HomeSources = LIVE): Promise<HomeFigures> {
  const [releases, stats, discord] = await Promise.all([read(sources.releases), read(sources.stats), read(sources.discord)]);
  const latest = (releases ?? [])
    .filter((r) => !r.prerelease)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
  return {
    ...(latest ? { firmware: latest.tag } : {}),
    ...(stats ? { devices: stats.devices.unique, boxes: stats.boxes.total } : {}),
    ...(discord ? { discord } : {}),
  };
}

export async function handleHomeApi(req: Request, sources: HomeSources = LIVE): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/api/home') return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Use GET.', { status: 405 });
  return new Response(JSON.stringify(await getHomeFigures(sources)), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}
