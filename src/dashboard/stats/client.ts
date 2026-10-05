// The totals behind the stats page, from the server's /api/stats.

import type { StatsSummary } from '../../../server/stats/types';

const FAILED = "Couldn't load the stats.";

// Enough of the shape that the page can draw it; anything else is a failed read, not a frozen page.
const isSummary = (v: unknown): v is StatsSummary => {
  const s = v as StatsSummary | null;
  return (
    !!s &&
    [s.boxes?.newPerWeek, s.boxes?.activePerDay, s.firmware?.versions, s.devices?.byKind, s.devices?.top,
      s.flashes?.perWeek, s.countries, s.os, s.browsers].every(Array.isArray)
  );
};

export async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch('/api/stats').catch(() => null);
  if (!res) throw new Error(FAILED);
  if (res.status === 503) throw new Error("The stats aren't available right now.");
  if (!res.ok) throw new Error(`Couldn't load the stats (${res.status}).`);
  const body: unknown = await res.json().catch(() => null);
  if (!isSummary(body)) throw new Error(FAILED);
  return body;
}
