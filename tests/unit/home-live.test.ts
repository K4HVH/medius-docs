import { describe, it, expect, vi, afterEach } from 'vitest';

// GitHub and Discord accept the connection and never answer.
vi.hoisted(() => {
  globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;
});
vi.mock('../../server/firmware', () => ({ getReleases: () => new Promise(() => {}) }));
vi.mock('../../server/stats', () => ({
  getStatsSummary: async () => ({ devices: { unique: 70, top: [] }, boxes: { total: 1201 } }),
}));

import { fillPage } from '../../server/fill';
import { handleHomeApi } from '../../server/home';

afterEach(() => vi.useRealTimers());

const HTML =
  '<html><body><dd data-fill="vital-firmware"></dd><dd data-fill="vital-boxes"></dd>' +
  '<span data-fill="vital-discord"></span></body></html>';

const within = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let done = false;
  void p.then(() => (done = true));
  await vi.advanceTimersByTimeAsync(ms);
  expect(done).toBe(true);
  return p;
};

describe('the landing with its sources hung', () => {
  it('fills what it has within two seconds, leaving the hung cells empty', async () => {
    vi.useFakeTimers();
    const html = (await within(fillPage('/', HTML), 2000))!;
    expect(html).toContain('data-fill="vital-boxes" class="live">1,201<');
    expect(html).toContain('data-fill="vital-firmware"></dd>');
    expect(html).toContain('data-fill="vital-discord"></span>');
  });

  it('answers /api/home within two seconds', async () => {
    vi.useFakeTimers();
    const res = (await within(handleHomeApi(new Request('http://localhost/api/home')), 2000))!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ devices: 70, boxes: 1201 });
  });
});
