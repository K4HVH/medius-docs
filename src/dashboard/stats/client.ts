// The totals behind the stats page, from the server's /api/stats.

import type { StatsSummary } from '../../../server/stats/types';

export async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch('/api/stats');
  if (res.status === 503) throw new Error("The stats aren't available right now.");
  if (!res.ok) throw new Error(`Couldn't load the stats (${res.status}).`);
  return (await res.json()) as StatsSummary;
}
