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

export function loadIndex(): Promise<Loaded> {
  pending ??= fetch('/search-index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`search index: ${r.status}`);
      return r.json() as Promise<SearchIndex>;
    })
    .then((index) => ({
      searcher: createSearcher(index.entries, { synonyms: SYNONYMS }),
      byPath: new Map(index.entries.map((e) => [e.path, e])),
    }))
    .catch((e: unknown) => {
      pending = null;
      throw e;
    });
  return pending;
}

// Fetched ahead: once the page is idle, or when the reader heads for the search. Never in the search
// pass, whose dev server would build the index to answer it.
export function prefetchIndex(): void {
  if ((globalThis as { __mediusSearchPass?: boolean }).__mediusSearchPass) return;
  void loadIndex().catch(() => {});
}
