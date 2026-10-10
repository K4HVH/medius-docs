import { describe, it, expect, vi, afterEach } from 'vitest';
import { cached } from '../../server/cached';

afterEach(() => vi.useRealTimers());

const never = () => new Promise<number | null>(() => {});

describe('cached', () => {
  it('answers a fresh value without asking the source again', async () => {
    let t = 0;
    const source = vi.fn(async () => 7);
    const get = cached(source, { freshMs: 1000, budgetMs: 100, now: () => t });
    expect(await get()).toBe(7);
    t = 999;
    expect(await get()).toBe(7);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('keeps one fetch in flight however many ask', async () => {
    let done!: (v: number) => void;
    const source = vi.fn(() => new Promise<number | null>((r) => (done = r)));
    const get = cached(source, { freshMs: 1000, budgetMs: 10_000 });
    const asks = [get(), get(), get()];
    done(3);
    expect(await Promise.all(asks)).toEqual([3, 3, 3]);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('with nothing kept, answers null once the budget runs out on a hung source', async () => {
    vi.useFakeTimers();
    const get = cached(never, { freshMs: 1000, budgetMs: 1500 });
    const ask = get();
    await vi.advanceTimersByTimeAsync(1499);
    let settled = false;
    void ask.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await ask).toBeNull();
  });

  it('answers a stale value at once while a refresh runs', async () => {
    let t = 0;
    let calls = 0;
    const source = vi.fn(() => (++calls === 1 ? Promise.resolve(5) : never()));
    const get = cached(source, { freshMs: 1000, budgetMs: 60_000, now: () => t });
    expect(await get()).toBe(5);
    t = 5000;
    expect(await get()).toBe(5);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('keeps the last value when the source fails, and asks again next time', async () => {
    let t = 0;
    const answers: (number | null | Error)[] = [4, null, new Error('down'), 9];
    const source = vi.fn(async () => {
      const a = answers.shift()!;
      if (a instanceof Error) throw a;
      return a;
    });
    const get = cached(source, { freshMs: 10, budgetMs: 100, now: () => t });
    const flush = () => new Promise((r) => setTimeout(r, 0));
    expect(await get()).toBe(4);
    t = 100;
    expect(await get()).toBe(4); // stale: a refresh answers null
    await flush();
    expect(await get()).toBe(4); // stale: a refresh throws
    await flush();
    expect(await get()).toBe(4); // stale: a refresh brings 9
    await flush();
    expect(await get()).toBe(9);
    expect(source).toHaveBeenCalledTimes(4);
  });
});
