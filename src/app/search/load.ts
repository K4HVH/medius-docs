import { createSignal } from 'solid-js';
import { SYNONYMS } from './extra';
import { createSearcher, type Searcher } from './rank';
import type { IndexEntry, SearchIndex } from './types';

// The site's search index, fetched once per page load when it is first wanted; a failed fetch is tried
// again on the next call.

export interface Loaded {
  searcher: Searcher;
  byPath: Map<string, IndexEntry>;
}

let pending: Promise<Loaded> | null = null;
// The index once it is in, however it came: a panel that saw a fetch fail shows it when a later one lands.
const [loaded, setLoaded] = createSignal<Loaded | null>(null);
export { loaded as indexLoaded };

// Building the searcher is the longest piece of work here, so it waits for the next paint: a panel opened
// as the index lands shows first, and what is typed meanwhile is searched once it is built.
const afterPaint = () =>
  new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(r, 0)) : setTimeout(r, 0)));

export function loadIndex(): Promise<Loaded> {
  pending ??= fetch('/search-index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`search index: ${r.status}`);
      return r.json() as Promise<SearchIndex>;
    })
    .then((index) => afterPaint().then(() => index))
    .then((index) =>
      setLoaded({
        searcher: createSearcher(index.entries, { synonyms: SYNONYMS }),
        byPath: new Map(index.entries.map((e) => [e.path, e])),
      }),
    )
    .catch((e: unknown) => {
      pending = null;
      throw e;
    });
  return pending;
}

// Fetched ahead when a reader points at the search button (a touch on it too); opening search fetches it
// in any case. Never when the browser asks to save data; after a failed fetch, not again for half a minute
// (opening search still tries at once, and Retry). Never in the search pass, whose dev server would build
// the index to answer it.
let failedAt = -Infinity;
export function prefetchIndex(): void {
  if ((globalThis as { __mediusSearchPass?: boolean }).__mediusSearchPass) return;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  if (Date.now() - failedAt < 30_000) return;
  void loadIndex().catch(() => {
    failedAt = Date.now();
  });
}
