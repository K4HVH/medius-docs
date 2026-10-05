// SQLite under either runtime: Bun serves the site, Node runs the vite dev server and vitest. The two
// drivers differ only in names, so the store sees one shape.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Param = string | number | null;

export interface Db {
  exec(sql: string): void;
  run(sql: string, ...params: Param[]): void;
  get<T>(sql: string, ...params: Param[]): T | undefined;
  all<T>(sql: string, ...params: Param[]): T[];
  close(): void;
}

interface Statement {
  run(...params: Param[]): unknown;
  get(...params: Param[]): unknown;
  all(...params: Param[]): unknown[];
}

// A name the bundler can't follow, so neither runtime's driver is pulled into the other's build.
const load = (name: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ name);

export async function openDb(path: string): Promise<Db> {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  let prepare: (sql: string) => Statement;
  let exec: (sql: string) => void;
  let close: () => void;
  if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
    const { Database } = (await load('bun:sqlite')) as {
      Database: new (p: string, o: object) => { query(s: string): Statement; exec(s: string): void; close(): void };
    };
    const db = new Database(path, { create: true, strict: true });
    prepare = (sql) => db.query(sql);
    exec = (sql) => db.exec(sql);
    close = () => db.close();
  } else {
    const { DatabaseSync } = (await load('node:sqlite')) as {
      DatabaseSync: new (p: string) => { prepare(s: string): Statement; exec(s: string): void; close(): void };
    };
    const db = new DatabaseSync(path);
    const cache = new Map<string, Statement>();
    prepare = (sql) => {
      let s = cache.get(sql);
      if (!s) cache.set(sql, (s = db.prepare(sql)));
      return s;
    };
    exec = (sql) => db.exec(sql);
    close = () => db.close();
  }
  if (path !== ':memory:') exec('PRAGMA journal_mode = WAL');
  exec('PRAGMA busy_timeout = 5000');
  return {
    exec,
    run: (sql, ...p) => void prepare(sql).run(...p),
    // bun:sqlite answers null for no row, node:sqlite undefined.
    get: <T,>(sql: string, ...p: Param[]) => (prepare(sql).get(...p) ?? undefined) as T | undefined,
    all: <T,>(sql: string, ...p: Param[]) => prepare(sql).all(...p) as T[],
    close,
  };
}
