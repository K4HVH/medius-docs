// Deletes everything the stats hold on one box, for an owner who asks. Run inside the site's container:
//   docker exec medius-docs bun run server/stats/forget.ts <Box ID>
// The Box ID is the one the dashboard shows (the device chip's MAC, 12 hex digits).

import type { Db } from './db';
import { boxId } from './store';

export interface Forgotten {
  boxes: number;
  days: number;
  devices: number;
  flashes: number;
}

export function forgetBox(db: Db, given: string): Forgotten {
  const mac = given.toLowerCase().replace(/[\s:.-]/g, '');
  if (!/^[0-9a-f]{12}$/.test(mac)) throw new Error(`${given} is not a Box ID: 12 hex digits, as the dashboard shows it`);
  const key = db.get<{ v: string }>("SELECT v FROM meta WHERE k = 'key'")?.v;
  if (!key) return { boxes: 0, days: 0, devices: 0, flashes: 0 };
  const id = boxId(key, mac);
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
  const given = process.argv[2];
  if (!given) {
    console.error('usage: bun run server/stats/forget.ts <Box ID>');
    process.exit(1);
  }
  const { openDb } = await import('./db');
  const db = await openDb(process.env.STATS_DB || 'data/stats.db');
  try {
    const gone = forgetBox(db, given);
    console.log(`Deleted: box ${gone.boxes}, active days ${gone.days}, devices ${gone.devices}, flashes ${gone.flashes}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
