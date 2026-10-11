import type { IndexEntry, SearchIndex } from '../src/app/search/types';

// A place a link can name (src/app/routes.ts addressFor): a section, marked block or dashboard tab or panel
// in a build's search index, with the titles of the places filed under it (a tab's panels).
export interface Place {
  title: string;
  caption?: string;
  text: string;
  members: string[];
}

const KINDS = new Set(['section', 'anchor', 'panel']);
const byIndex = new WeakMap<SearchIndex, Map<string, IndexEntry>>();

function placesOf(index: SearchIndex): Map<string, IndexEntry> {
  let map = byIndex.get(index);
  if (!map) {
    map = new Map(index.entries.filter((e) => KINDS.has(e.kind) && e.path.includes('#')).map((e) => [e.path, e]));
    byIndex.set(index, map);
  }
  return map;
}

export function placeFor(index: SearchIndex | null, page: string, id: string): Place | null {
  if (!index) return null;
  const places = placesOf(index);
  const entry = places.get(`${page}#${id}`);
  if (!entry) return null;
  const under = `${entry.crumb} / ${entry.title}`;
  const members = [...places.values()].filter((e) => e.path.startsWith(`${page}#`) && e.crumb === under).map((e) => e.title);
  return { title: entry.title, caption: entry.caption, text: entry.text, members };
}
