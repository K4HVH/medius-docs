import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const INDEX = { version: 1, built: 'now', entries: [{ path: '/native', title: 'Native', kind: 'page', section: 'Native API', crumb: '', text: '' }] };
const load = () => import('../../src/app/search/load');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the search index loader', () => {
  it('fetches the index once however often a reader reaches for search', async () => {
    const fetches = vi.fn(async () => new Response(JSON.stringify(INDEX)));
    vi.stubGlobal('fetch', fetches);
    const { prefetchIndex, loadIndex } = await load();
    for (let i = 0; i < 5; i++) prefetchIndex();
    const ready = loadIndex();
    await vi.advanceTimersByTimeAsync(50);
    await ready;
    prefetchIndex();
    expect(fetches).toHaveBeenCalledTimes(1);
  });

  it('after a failed fetch, waits half a minute before reaching ahead again, while opening search tries at once', async () => {
    const fetches = vi.fn(async () => new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetches);
    const { prefetchIndex, loadIndex } = await load();
    prefetchIndex();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 30; i++) prefetchIndex();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toHaveBeenCalledTimes(1);
    await expect(loadIndex()).rejects.toThrow('503');
    expect(fetches).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    prefetchIndex();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toHaveBeenCalledTimes(3);
  });

  it('builds the searcher only after the page has painted, so the panel shows before the work', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(INDEX))));
    const { loadIndex } = await load();
    let built = false;
    void loadIndex().then(() => (built = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(built).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(built).toBe(true);
  });

  it('never reaches ahead when the browser asks to save data, while opening search still loads', async () => {
    const fetches = vi.fn(async () => new Response(JSON.stringify(INDEX)));
    vi.stubGlobal('fetch', fetches);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { connection: { saveData: true } }));
    const { prefetchIndex, loadIndex } = await load();
    prefetchIndex();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).not.toHaveBeenCalled();
    const ready = loadIndex();
    await vi.advanceTimersByTimeAsync(50);
    await ready;
    expect(fetches).toHaveBeenCalledTimes(1);
  });
});

