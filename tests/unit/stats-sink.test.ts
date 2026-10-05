import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStatsSink, fetchStats, readEnv } from '../../src/dashboard/stats';

const nav = (o: { ua?: string; platform?: string; brands?: string[]; brave?: boolean }) =>
  ({
    userAgent: o.ua ?? '',
    ...(o.platform || o.brands
      ? { userAgentData: { platform: o.platform ?? '', brands: (o.brands ?? []).map((brand) => ({ brand, version: '1' })) } }
      : {}),
    ...(o.brave ? { brave: {} } : {}),
  }) as unknown as Navigator;

afterEach(() => vi.unstubAllGlobals());

describe('readEnv', () => {
  it('reads the platform and brand from userAgentData', () => {
    expect(readEnv(nav({ platform: 'Windows', brands: ['Not A;Brand', 'Chromium', 'Google Chrome'] }))).toEqual({
      os: 'windows',
      browser: 'chrome',
    });
    expect(readEnv(nav({ platform: 'macOS', brands: ['Chromium', 'Microsoft Edge'] }))).toEqual({ os: 'macos', browser: 'edge' });
    expect(readEnv(nav({ platform: 'Chrome OS', brands: ['Chromium', 'Opera'] }))).toEqual({ os: 'chromeos', browser: 'opera' });
    expect(readEnv(nav({ platform: 'Linux', brands: ['Chromium', 'Brave'] }))).toEqual({ os: 'linux', browser: 'brave' });
    expect(readEnv(nav({ platform: 'Android', brands: ['Chromium'] }))).toEqual({ os: 'android', browser: 'chromium' });
  });

  it('falls back to the user agent string', () => {
    const ua = (s: string) => readEnv(nav({ ua: s }));
    expect(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toEqual({
      os: 'windows',
      browser: 'edge',
    });
    expect(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 OPR/115.0')).toEqual({ os: 'macos', browser: 'opera' });
    expect(ua('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile')).toEqual({ os: 'android', browser: 'chromium' });
    expect(ua('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130.0')).toEqual({ os: 'chromeos', browser: 'chromium' });
    expect(ua('Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Vivaldi/7.0')).toEqual({ os: 'linux', browser: 'vivaldi' });
    expect(ua('')).toEqual({ os: 'other', browser: 'chromium' });
  });

  it("knows Brave by navigator.brave when it hides its brand", () => {
    expect(readEnv(nav({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', brave: true })).browser).toBe('brave');
  });
});

describe('createStatsSink', () => {
  const env = () => ({ os: 'linux' as const, browser: 'chrome' as const });

  it('adds the OS and browser to a box report, and passes the others as they are', () => {
    const posted: [string, string][] = [];
    const sink = createStatsSink((url, body) => posted.push([url, body]), env);
    sink({ type: 'box', mac: '588c81e08244', fw: '3.4.4', hostFw: null, proto: 9 });
    sink({ type: 'device', mac: '588c81e08244', vid: 1, pid: 2, kind: 2, product: null });
    expect(posted.map(([u]) => u)).toEqual(['/api/stats/event', '/api/stats/event']);
    expect(JSON.parse(posted[0][1])).toEqual({
      type: 'box',
      mac: '588c81e08244',
      fw: '3.4.4',
      hostFw: null,
      proto: 9,
      os: 'linux',
      browser: 'chrome',
    });
    expect(JSON.parse(posted[1][1])).toEqual({ type: 'device', mac: '588c81e08244', vid: 1, pid: 2, kind: 2, product: null });
  });

  it('swallows a post that throws', () => {
    const sink = createStatsSink(() => {
      throw new Error('offline');
    }, env);
    expect(() => sink({ type: 'device', mac: '588c81e08244', vid: 1, pid: 2, kind: 2, product: null })).not.toThrow();
  });

  it('sends with sendBeacon, and with fetch keepalive when the beacon is refused', async () => {
    const beacon = vi.fn(() => false);
    const fetcher = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    vi.stubGlobal('fetch', fetcher);
    createStatsSink(undefined, env)({ type: 'device', mac: '588c81e08244', vid: 1, pid: 2, kind: 2, product: null });
    expect(beacon).toHaveBeenCalledWith('/api/stats/event', expect.stringContaining('"device"'));
    expect(fetcher).toHaveBeenCalledWith('/api/stats/event', expect.objectContaining({ method: 'POST', keepalive: true }));
    await Promise.resolve();
  });

  it('sends nothing more when the beacon is queued', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: () => true });
    vi.stubGlobal('fetch', fetcher);
    createStatsSink(undefined, env)({ type: 'device', mac: '588c81e08244', vid: 1, pid: 2, kind: 2, product: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('fetchStats', () => {
  it('returns the summary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ since: null }), { status: 200 })));
    expect(await fetchStats()).toEqual({ since: null });
  });

  it('says why when the server has no stats', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    await expect(fetchStats()).rejects.toThrow("The stats aren't available right now.");
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchStats()).rejects.toThrow("Couldn't load the stats (500).");
  });
});
