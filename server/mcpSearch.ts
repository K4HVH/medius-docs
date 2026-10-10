import type { Searcher } from '../src/app/search/rank';
import { snippet } from '../src/app/search/text';

export interface IndexPage {
  path: string;
  title: string;
  section: string;
  description: string;
  text: string;
}

export interface SearchHit {
  path: string;
  title: string;
  section: string;
  snippet: string;
}

export function normalizePagePath(input: string): string {
  let p = input.trim();
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/#.*$/, '');
  p = p.replace(/\.md$/i, '');
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function listPages(pages: IndexPage[]): Array<{ path: string; title: string; section: string }> {
  return pages.map((p) => ({ path: p.path, title: p.title, section: p.section }));
}

export function getPage(pages: IndexPage[], path: string): IndexPage | null {
  const norm = normalizePagePath(path);
  return pages.find((p) => p.path === norm) ?? null;
}

// Hits of the site search, each with the sentence the words matched in; a release leads with its date and
// a device report with its verdict. An agent gets every match, up to its limit, from this site alone, and
// its query is finished: a space after it keeps the last word from reading as one still being typed.
export function searchHits(searcher: Searcher, query: string, limit = 10): SearchHit[] {
  const most = Math.max(0, Math.floor(limit));
  const hits = searcher.search(`${query} `, most + 10, { spread: false }).filter((h) => h.entry.kind !== 'external');
  return hits.slice(0, most).map(({ entry, terms }) => {
    const said = snippet(entry, terms);
    const lead = entry.kind === 'release' || entry.kind === 'device' ? entry.caption : undefined;
    return { path: entry.path, title: entry.title, section: entry.section, snippet: lead ? `${lead} · ${said}` : said };
  });
}

export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin);
}

// OpenAI deep-research "search" tool shape: { results: [{ id, title, url, text }] }.
// id is the address, which fetch() accepts back as its page.
export interface OpenAiSearchResult {
  id: string;
  title: string;
  url: string;
  text: string;
}

export function toSearchResults(hits: SearchHit[], site: string): OpenAiSearchResult[] {
  return hits.map((h) => ({ id: h.path, title: h.title, url: site + h.path, text: h.snippet }));
}

// OpenAI deep-research "fetch" tool shape: { id, title, text, url, metadata }.
export interface OpenAiDocument {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: { section: string };
}

export function toFetchDoc(pages: IndexPage[], id: string, site: string): OpenAiDocument | null {
  const p = getPage(pages, id);
  if (!p) return null;
  return { id: p.path, title: p.title, text: p.text, url: site + p.path, metadata: { section: p.section } };
}
