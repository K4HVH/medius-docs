// An owner's requests about the stats held on their box: a copy of every record, or their deletion.
// Run inside the site's container:
//   docker exec medius-docs bun run server/stats/requests.ts copy <Box ID>
//   docker exec medius-docs bun run server/stats/requests.ts delete <Box ID>
// The Box ID is the one the dashboard shows (the device chip's MAC, 12 hex digits).

import type { Db } from './db';
import { boxId } from './store';

export interface Forgotten {
  boxes: number;
  days: number;
  devices: number;
  flashes: number;
}

// The box's id in the stats, or null when they hold nothing yet.
function idFor(db: Db, given: string): string | null {
  const mac = given.toLowerCase().replace(/[\s:.-]/g, '');
  if (!/^[0-9a-f]{12}$/.test(mac)) throw new Error(`${given} is not a Box ID: 12 hex digits, as the dashboard shows it`);
  const key = db.get<{ v: string }>("SELECT v FROM meta WHERE k = 'key'")?.v;
  return key ? boxId(key, mac) : null;
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
const hex4 = (n: number) => n.toString(16).padStart(4, '0');

export function copyBox(db: Db, given: string) {
  const id = idFor(db, given);
  if (!id) return { box: null, daysConnected: [], devices: [], flashes: [] };
  const box = db.get<{ first_seen: number; last_seen: number; fw: string; host_fw: string | null; proto: number; country: string | null; os: string; browser: string }>(
    'SELECT first_seen, last_seen, fw, host_fw, proto, country, os, browser FROM boxes WHERE id = ?',
    id,
  );
  return {
    box: box
      ? {
          firstSeen: iso(box.first_seen),
          lastSeen: iso(box.last_seen),
          firmware: box.fw,
          hostFirmware: box.host_fw,
          protocol: box.proto,
          country: box.country,
          os: box.os,
          browser: box.browser,
        }
      : null,
    daysConnected: db.all<{ day: string }>('SELECT day FROM box_days WHERE id = ? ORDER BY day', id).map((d) => d.day),
    devices: db
      .all<{ vid: number; pid: number; kind: number; product: string | null; first_seen: number; last_seen: number }>(
        'SELECT vid, pid, kind, product, first_seen, last_seen FROM devices WHERE box = ? ORDER BY first_seen, vid, pid',
        id,
      )
      .map((d) => ({ vid: hex4(d.vid), pid: hex4(d.pid), kind: d.kind, product: d.product, firstSeen: iso(d.first_seen), lastSeen: iso(d.last_seen) })),
    flashes: db
      .all<Record<string, string | number | null> & { at: number }>(
        `SELECT at, page, route, chips, source, kind, to_device, to_host, from_device, from_host, result, ms, country
         FROM flashes WHERE box = ? ORDER BY at`,
        id,
      )
      .map(({ at, ...rest }) => ({ at: iso(at), ...rest })),
  };
}

export function forgetBox(db: Db, given: string): Forgotten {
  const id = idFor(db, given);
  if (!id) return { boxes: 0, days: 0, devices: 0, flashes: 0 };
  const n = (sql: string) => db.get<{ n: number }>(sql, id)!.n;
  const found: Forgotten = {
    boxes: n('SELECT count(*) AS n FROM boxes WHERE id = ?'),
    days: n('SELECT count(*) AS n FROM box_days WHERE id = ?'),
    devices: n('SELECT count(*) AS n FROM devices WHERE box = ?'),
    flashes: n('SELECT count(*) AS n FROM flashes WHERE box = ?'),
  };
  db.exec('BEGIN');
  try {
    db.run('DELETE FROM boxes WHERE id = ?', id);
    db.run('DELETE FROM box_days WHERE id = ?', id);
    db.run('DELETE FROM devices WHERE box = ?', id);
    db.run('DELETE FROM flashes WHERE box = ?', id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return found;
}

if (import.meta.main) {
  const [what, given] = process.argv.slice(2);
  if ((what !== 'copy' && what !== 'delete') || !given) {
    console.error('usage: bun run server/stats/requests.ts copy|delete <Box ID>');
    process.exit(1);
  }
  const { openDb } = await import('./db');
  const db = await openDb(process.env.STATS_DB || 'data/stats.db');
  try {
    if (what === 'copy') {
      console.log(JSON.stringify(copyBox(db, given), null, 2));
    } else {
      const gone = forgetBox(db, given);
      console.log(`Deleted: box ${gone.boxes}, active days ${gone.days}, devices ${gone.devices}, flashes ${gone.flashes}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
