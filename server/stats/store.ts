// The counts behind the public stats page. A box is known by a keyed hash of its MAC; the key lives in
// the database, so the raw MAC is never written anywhere. Only a box event marks a box active: a flash or
// a device can come from a MAC that never connects.

import { createHmac, randomBytes } from 'node:crypto';
import type { Db } from './db';
import { type Count, RESULTS, type StatsEvent, type StatsSummary, type WeekFlashes } from './types';

const DAY_MS = 86_400_000;
const WEEKS = 26;
const DAYS = 90;
const TOP = 25;

// The kind most boxes reported for each VID:PID.
const KIND_OF = `SELECT vid, pid, kind FROM (SELECT vid, pid, kind, row_number() OVER (PARTITION BY vid, pid
  ORDER BY count(*) DESC, kind DESC) AS rk FROM devices GROUP BY vid, pid, kind) WHERE rk = 1`;
// A device is listed once two boxes have it, and named only by a name two boxes reported.
const SHARED = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS boxes (
  id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  fw TEXT NOT NULL, host_fw TEXT, proto INTEGER NOT NULL,
  country TEXT, os TEXT NOT NULL, browser TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS box_days (id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (id, day)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS devices (
  box TEXT NOT NULL, vid INTEGER NOT NULL, pid INTEGER NOT NULL, kind INTEGER NOT NULL, product TEXT,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY (box, vid, pid)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS flashes (
  at INTEGER NOT NULL, box TEXT, page TEXT NOT NULL, route TEXT NOT NULL, chips TEXT NOT NULL,
  source TEXT NOT NULL, kind TEXT, to_device TEXT, to_host TEXT, from_device TEXT, from_host TEXT,
  result TEXT NOT NULL, ms INTEGER NOT NULL, country TEXT);
CREATE INDEX IF NOT EXISTS flashes_at ON flashes (at);
`;

export interface Store {
  ingest(e: StatsEvent, country: string | null): void;
  summary(): StatsSummary;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const mondayOf = (ms: number) => {
  const d = new Date(Math.floor(ms / DAY_MS) * DAY_MS);
  return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS;
};

// Oldest first, ending at `last`.
const series = (last: number, n: number, stepMs: number) =>
  Array.from({ length: n }, (_, i) => dayOf(last - (n - 1 - i) * stepMs));

const fill = (keys: string[], counts: Count[]): Count[] => {
  const by = new Map(counts.map((c) => [c.key, c.n]));
  return keys.map((key) => ({ key, n: by.get(key) ?? 0 }));
};

// Seconds to the Monday of its week, as YYYY-MM-DD.
const WEEK_SQL = (col: string) => `date(${col}, 'unixepoch', '-6 days', 'weekday 1')`;
const RANKED = 'ORDER BY n DESC, key ASC';

export function createStore(db: Db, now: () => number = () => Date.now()): Store {
  db.exec(SCHEMA);
  let key = db.get<{ v: string }>("SELECT v FROM meta WHERE k = 'key'")?.v;
  if (!key) {
    key = randomBytes(32).toString('hex');
    db.run("INSERT INTO meta (k, v) VALUES ('key', ?)", key);
  }
  const secret = Buffer.from(key, 'hex');
  const idOf = (mac: string) => createHmac('sha256', secret).update(mac).digest('hex').slice(0, 16);

  const markDay = (id: string, ms: number) =>
    db.run('INSERT OR IGNORE INTO box_days (id, day) VALUES (?, ?)', id, dayOf(ms));

  const ingest = (e: StatsEvent, country: string | null) => {
    db.exec('BEGIN');
    try {
      write(e, country);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  const write = (e: StatsEvent, country: string | null) => {
    const ms = now();
    const at = Math.floor(ms / 1000);
    switch (e.type) {
      case 'box': {
        const id = idOf(e.mac);
        db.run(
          `INSERT INTO boxes (id, first_seen, last_seen, fw, host_fw, proto, country, os, browser)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET last_seen = excluded.last_seen, fw = excluded.fw,
             host_fw = coalesce(excluded.host_fw, host_fw), proto = excluded.proto,
             country = excluded.country, os = excluded.os, browser = excluded.browser`,
          id, at, at, e.fw, e.hostFw, e.proto, country, e.os, e.browser,
        );
        markDay(id, ms);
        return;
      }
      case 'device': {
        const id = idOf(e.mac);
        db.run(
          `INSERT INTO devices (box, vid, pid, kind, product, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (box, vid, pid) DO UPDATE SET kind = excluded.kind, product = excluded.product,
             last_seen = excluded.last_seen`,
          id, e.vid, e.pid, e.kind, e.product, at, at,
        );
        return;
      }
      case 'flash': {
        const id = e.mac ? idOf(e.mac) : null;
        db.run(
          `INSERT INTO flashes (at, box, page, route, chips, source, kind, to_device, to_host, from_device,
             from_host, result, ms, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          at, id, e.page, e.route, e.chips, e.source, e.kind, e.to.device, e.to.host, e.from.device,
          e.from.host, e.result, e.ms, country,
        );
        return;
      }
    }
  };

  const counts = (sql: string, ...p: (string | number)[]) => db.all<Count>(sql, ...p);

  const summary = (): StatsSummary => {
    const ms = now();
    const today = dayOf(ms);
    const days = series(ms, DAYS, DAY_MS);
    const weeks = series(mondayOf(ms), WEEKS, 7 * DAY_MS);
    const from = (n: number) => dayOf(ms - (n - 1) * DAY_MS);
    const activeSince = (n: number) =>
      db.get<{ n: number }>('SELECT count(DISTINCT id) AS n FROM box_days WHERE day >= ?', from(n))!.n;
    const ACTIVE30 = 'id IN (SELECT id FROM box_days WHERE day >= ?)';

    const perWeek = new Map<string, WeekFlashes>(
      weeks.map((week) => [week, { week, verified: 0, reverted: 0, sent: 0, failed: 0, written: 0 }]),
    );
    for (const r of db.all<{ week: string; result: string; n: number }>(
      `SELECT ${WEEK_SQL('at')} AS week, result, count(*) AS n FROM flashes WHERE week >= ? GROUP BY week, result`,
      weeks[0],
    )) {
      const w = perWeek.get(r.week);
      if (w && (RESULTS as readonly string[]).includes(r.result)) w[r.result as keyof Omit<WeekFlashes, 'week'>] = r.n;
    }

    const flashTotal = db.get<{ n: number }>('SELECT count(*) AS n FROM flashes')!.n;
    return {
      boxes: {
        total: db.get<{ n: number }>('SELECT count(*) AS n FROM boxes')!.n,
        active7: activeSince(7),
        active30: activeSince(30),
        newPerWeek: fill(
          weeks,
          counts(`SELECT ${WEEK_SQL('first_seen')} AS key, count(*) AS n FROM boxes GROUP BY key`),
        ),
        activePerDay: fill(
          days,
          counts('SELECT day AS key, count(*) AS n FROM box_days WHERE day >= ? AND day <= ? GROUP BY day', days[0], today),
        ),
      },
      firmware: {
        versions: counts(`SELECT fw AS key, count(*) AS n FROM boxes WHERE ${ACTIVE30} GROUP BY fw ${RANKED}`, from(30)),
      },
      devices: {
        unique: db.get<{ n: number }>('SELECT count(*) AS n FROM (SELECT DISTINCT vid, pid FROM devices)')!.n,
        byKind: db.all(
          `WITH k AS (${KIND_OF})
           SELECT k.kind, count(DISTINCT d.vid * 65536 + d.pid) AS devices, count(DISTINCT d.box) AS boxes
           FROM devices d JOIN k USING (vid, pid) GROUP BY k.kind ORDER BY devices DESC, k.kind DESC`,
        ),
        top: db.all(
          `WITH per AS (SELECT vid, pid, count(*) AS boxes FROM devices GROUP BY vid, pid),
           k AS (${KIND_OF}),
           names AS (SELECT vid, pid, product, n FROM (SELECT vid, pid, product, count(*) AS n, row_number()
             OVER (PARTITION BY vid, pid ORDER BY count(*) DESC, product) AS rk
             FROM devices WHERE product IS NOT NULL GROUP BY vid, pid, product) WHERE rk = 1)
           SELECT per.vid, per.pid, k.kind, CASE WHEN names.n >= ${SHARED} THEN names.product END AS product, per.boxes
           FROM per JOIN k USING (vid, pid) LEFT JOIN names USING (vid, pid)
           WHERE per.boxes >= ${SHARED} ORDER BY per.boxes DESC, per.vid, per.pid LIMIT ${TOP}`,
        ),
      },
      flashes: {
        total: flashTotal,
        succeeded: db.get<{ n: number }>("SELECT count(*) AS n FROM flashes WHERE result IN ('verified', 'written')")!.n,
        byResult: counts(`SELECT result AS key, count(*) AS n FROM flashes GROUP BY key ${RANKED}`),
        byRoute: counts(`SELECT page || ' ' || route AS key, count(*) AS n FROM flashes GROUP BY key ${RANKED}`),
        byChips: counts(`SELECT chips AS key, count(*) AS n FROM flashes GROUP BY key ${RANKED}`),
        bySource: counts(`SELECT source AS key, count(*) AS n FROM flashes GROUP BY key ${RANKED}`),
        byVersion: counts(
          `SELECT to_device AS key, count(*) AS n FROM flashes WHERE to_device IS NOT NULL GROUP BY key ${RANKED}`,
        ),
        perWeek: [...perWeek.values()],
      },
      countries: counts(`SELECT coalesce(country, 'unknown') AS key, count(*) AS n FROM boxes GROUP BY key ${RANKED}`),
      os: counts(`SELECT os AS key, count(*) AS n FROM boxes GROUP BY key ${RANKED}`),
      browsers: counts(`SELECT browser AS key, count(*) AS n FROM boxes GROUP BY key ${RANKED}`),
    };
  };

  return { ingest, summary };
}
