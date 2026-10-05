// Sends what the dashboard sees to the public stats. Never awaited and never thrown from: counting
// must not get in the way of a connect or a flash.

import type { BoxEvent, DeviceEvent, FlashEvent } from '../../../server/stats/types';
import { readEnv } from './env';

export type StatsReport = Omit<BoxEvent, 'os' | 'browser'> | DeviceEvent | FlashEvent;
export type StatsSink = (r: StatsReport) => void;

export const STATS_EVENT_URL = '/api/stats/event';

// A string goes as text/plain, which a beacon sends without a preflight; the server reads JSON either way.
const send = (url: string, body: string) => {
  if (navigator.sendBeacon?.(url, body)) return;
  void fetch(url, { method: 'POST', body, keepalive: true }).catch(() => undefined);
};

export function createStatsSink(post: (url: string, body: string) => void = send, env = readEnv): StatsSink {
  return (r) => {
    try {
      post(STATS_EVENT_URL, JSON.stringify(r.type === 'box' ? { ...r, ...env() } : r));
    } catch {
      /* counting must not break a connect or a flash */
    }
  };
}
