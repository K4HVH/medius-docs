// The Devices list as the Devices page shows it, for the Discord bot to post what's new: owners'
// reports merged with every mouse and keyboard the usage stats saw on >=2 boxes.

import { COMPAT } from '../src/app/data/compatibility';
import { mergeCompat, withIds } from '../src/app/data/compatMerge';
import { itemPath } from '../src/app/items';
import { SITE } from '../src/app/site';
import { getStatsSummary } from './stats';

export async function handleDevicesApi(req: Request): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/api/devices') return null;
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Use GET.' }), { status: 405, headers: { 'content-type': 'application/json' } });
  const stats = await getStatsSummary();
  // `stats` false: the usage stats were unavailable, so their devices are missing, not gone.
  // Each device with the address of its card, as the Devices page links it.
  const devices = withIds(mergeCompat(COMPAT, stats?.devices.top ?? null)).map(({ id, ...d }) => ({
    ...d,
    url: `${SITE}${itemPath('device', id.replace(/^device-/, ''))}`,
  }));
  const body = { devices, stats: stats !== null };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}
