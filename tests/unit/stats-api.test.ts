// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleStatsApi, resetStatsForTests } from '../../server/stats';
import type { StatsSummary } from '../../server/stats/types';

const BOX = { type: 'box', mac: '588c81e08244', fw: '3.4.4', hostFw: '3.4.4', proto: 9, os: 'linux', browser: 'chrome' };
const SITE = 'https://medius.k4tech.net';

let now = Date.UTC(2026, 9, 7, 12);

const post = (body: unknown, headers: Record<string, string> = {}, ip = '10.0.0.1') =>
  handleStatsApi(
    new Request(`${SITE}/api/stats/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ip,
  );

const read = async (): Promise<StatsSummary> => {
  const r = await handleStatsApi(new Request(`${SITE}/api/stats`), '10.0.0.1');
  expect(r!.status).toBe(200);
  return r!.json();
};

beforeEach(() => {
  now = Date.UTC(2026, 9, 7, 12);
  resetStatsForTests({ path: ':memory:', now: () => now });
});

describe('POST /api/stats/event', () => {
  it('stores a valid event and answers 204', async () => {
    expect((await post(BOX))!.status).toBe(204);
    expect((await read()).boxes.total).toBe(1);
  });

  it('refuses a body that is not JSON, or not an event, with 400', async () => {
    expect((await post('{nope'))!.status).toBe(400);
    const r = await post({ ...BOX, mac: 'x' });
    expect(r!.status).toBe(400);
    expect((await r!.json()).error).toMatch(/mac/);
    expect((await read()).boxes.total).toBe(0);
  });

  it('refuses a body over 2 KB with 413', async () => {
    expect((await post({ ...BOX, pad: 'x'.repeat(2100) }))!.status).toBe(413);
  });

  it('stops reading a body with no length once it passes 2 KB', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled += 1024;
        if (pulled > 100 * 1024) return c.close();
        c.enqueue(new Uint8Array(1024).fill(0x20));
      },
    });
    const r = await handleStatsApi(
      new Request(`${SITE}/api/stats/event`, { method: 'POST', body, duplex: 'half' } as RequestInit),
      '10.0.0.1',
    );
    expect(r!.status).toBe(413);
    expect(pulled).toBeLessThan(10 * 1024);
  });

  it('answers 405 to anything but POST', async () => {
    const r = await handleStatsApi(new Request(`${SITE}/api/stats/event`), '10.0.0.1');
    expect(r!.status).toBe(405);
  });

  it('limits one address to 60 events a minute, and not another', async () => {
    for (let i = 0; i < 60; i++) expect((await post(BOX))!.status).toBe(204);
    expect((await post(BOX))!.status).toBe(429);
    expect((await post(BOX, {}, '10.0.0.2'))!.status).toBe(204);
    now += 60_000;
    expect((await post(BOX))!.status).toBe(204);
  });

  it('counts an IPv6 client by its /64, as one home network hands out many addresses', async () => {
    for (let i = 1; i <= 60; i++) expect((await post(BOX, { 'cf-connecting-ip': `2001:db8:1:2::${i.toString(16)}` }))!.status).toBe(204);
    expect((await post(BOX, { 'cf-connecting-ip': '2001:0db8:0001:0002:ffff:1:2:3' }))!.status).toBe(429);
    expect((await post(BOX, { 'cf-connecting-ip': '2001:db8:1:3::1' }))!.status).toBe(204);
  });

  it('refuses new addresses while the table is full, and frees it a window later', async () => {
    resetStatsForTests({ path: ':memory:', now: () => now, limits: { addresses: 3 } });
    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) expect((await post(BOX, {}, ip))!.status).toBe(204);
    expect((await post(BOX, {}, '10.0.0.4'))!.status).toBe(429);
    expect((await post(BOX, {}, '10.0.0.1'))!.status).toBe(204);
    now += 60_000;
    expect((await post(BOX, {}, '10.0.0.4'))!.status).toBe(204);
  });

  it('caps every address together per minute', async () => {
    resetStatsForTests({ path: ':memory:', now: () => now, limits: { total: 5 } });
    for (let i = 1; i <= 5; i++) expect((await post(BOX, {}, `10.0.3.${i}`))!.status).toBe(204);
    expect((await post(BOX, {}, '10.0.3.6'))!.status).toBe(429);
    now += 60_000;
    expect((await post(BOX, {}, '10.0.3.6'))!.status).toBe(204);
  });

  it("limits by Cloudflare's client address before the socket's", async () => {
    for (let i = 0; i < 60; i++) await post(BOX, { 'cf-connecting-ip': '203.0.113.9' }, `10.0.1.${i}`);
    expect((await post(BOX, { 'cf-connecting-ip': '203.0.113.9' }, '10.0.2.1'))!.status).toBe(429);
  });

  it('takes a same-origin browser behind a proxy that rewrote Host, or forwarded it with a port', async () => {
    const via = (headers: Record<string, string>) =>
      handleStatsApi(
        new Request('http://medius-docs:3000/api/stats/event', { method: 'POST', headers, body: JSON.stringify(BOX) }),
        '10.0.0.1',
      );
    expect((await via({ origin: SITE, 'sec-fetch-site': 'same-origin' }))!.status).toBe(204);
    expect((await via({ origin: SITE, 'x-forwarded-host': 'medius.k4tech.net:443' }))!.status).toBe(204);
    expect((await via({ origin: SITE }))!.status).toBe(403);
    expect((await via({ origin: 'null' }))!.status).toBe(403);
    expect((await via({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))!.status).toBe(403);
  });

  it('refuses a foreign Origin, and takes one matching Host or X-Forwarded-Host', async () => {
    expect((await post(BOX, { origin: 'https://evil.example' }))!.status).toBe(403);
    expect((await post(BOX, { origin: SITE }))!.status).toBe(204);
    const proxied = await handleStatsApi(
      new Request('http://medius-docs:3000/api/stats/event', {
        method: 'POST',
        headers: { origin: SITE, 'x-forwarded-host': 'medius.k4tech.net' },
        body: JSON.stringify(BOX),
      }),
      '10.0.0.1',
    );
    expect(proxied!.status).toBe(204);
  });

  it("stores Cloudflare's country, and XX or T1 as unknown", async () => {
    await post(BOX, { 'cf-ipcountry': 'au' });
    await post({ ...BOX, mac: '588c81df1e28' }, { 'cf-ipcountry': 'XX' });
    await post({ ...BOX, mac: '112233445566' }, { 'cf-ipcountry': 'T1' });
    expect((await read()).countries).toEqual([
      { key: 'unknown', n: 2 },
      { key: 'AU', n: 1 },
    ]);
  });
});

describe('GET /api/stats', () => {
  it('serves the summary for a minute, then a fresh one', async () => {
    const r = await handleStatsApi(new Request(`${SITE}/api/stats`), '10.0.0.1');
    expect(r!.headers.get('cache-control')).toBe('public, max-age=60');
    expect(r!.headers.get('content-type')).toBe('application/json');
    await post(BOX);
    expect((await read()).boxes.total).toBe(0);
    now += 60_000;
    expect((await read()).boxes.total).toBe(1);
  });
});

describe('without a database', () => {
  it('answers 503 on both routes when the directory cannot be made', async () => {
    resetStatsForTests({ path: '/dev/null/stats/stats.db', now: () => now });
    expect((await post(BOX))!.status).toBe(503);
    expect((await handleStatsApi(new Request(`${SITE}/api/stats`), '10.0.0.1'))!.status).toBe(503);
  });

  it('answers 503 when the file is not a database, and tries again a minute later', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'stats-')), 'stats.db');
    writeFileSync(path, 'not a database, and long enough to have a header page '.repeat(200));
    resetStatsForTests({ path, now: () => now });
    expect((await post(BOX))!.status).toBe(503);
    rmSync(path);
    expect((await post(BOX))!.status).toBe(503);
    now += 60_000;
    expect((await post(BOX))!.status).toBe(204);
  });
});

describe('routing', () => {
  it('leaves other paths alone and answers 404 under /api/stats', async () => {
    expect(await handleStatsApi(new Request(`${SITE}/api/firmware/releases`))).toBeNull();
    expect(await handleStatsApi(new Request(`${SITE}/dashboard/stats`))).toBeNull();
    expect((await handleStatsApi(new Request(`${SITE}/api/stats/nope`)))!.status).toBe(404);
  });
});
