// The Devices list as the Devices page shows it, for the Discord bot to post what's new: owners'
// reports merged with every mouse and keyboard the usage stats saw on 2 or more boxes.

import { COMPAT } from '../src/app/data/compatibility';
import { mergeCompat } from '../src/app/data/compatMerge';
import { getStatsSummary } from './stats';

export async function handleDevicesApi(req: Request): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/api/devices') return null;
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Use GET.' }), { status: 405, headers: { 'content-type': 'application/json' } });
  const stats = await getStatsSummary();
  // `stats` false: the usage stats were unavailable, so their devices are missing, not gone.
  const body = { devices: mergeCompat(COMPAT, stats?.devices.top ?? null), stats: stats !== null };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}
