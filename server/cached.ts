// A live source behind a cache, so a page never waits long on it. A fresh value answers at once; a stale one
// answers at once while a refresh runs; with nothing kept, a caller waits at most its budget, then gets
// null. One fetch is in flight at a time, and a failed one keeps the last value.
export function cached<T>(
  source: () => Promise<T | null>,
  opts: { freshMs: number; budgetMs: number; now?: () => number },
): (budgetMs?: number) => Promise<T | null> {
  const now = opts.now ?? Date.now;
  let last: T | null = null;
  let at = -Infinity;
  let inflight: Promise<T | null> | null = null;

  const refresh = (): Promise<T | null> =>
    (inflight ??= source()
      .catch(() => null)
      .then((v) => {
        if (v !== null) {
          last = v;
          at = now();
        }
        return v ?? last;
      })
      .finally(() => {
        inflight = null;
      }));

  return async (budgetMs = opts.budgetMs) => {
    if (last !== null && now() - at < opts.freshMs) return last;
    const pending = refresh();
    if (last !== null) return last;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const out = await Promise.race([pending, new Promise<null>((r) => (timer = setTimeout(() => r(null), budgetMs)))]);
    clearTimeout(timer);
    return out;
  };
}
