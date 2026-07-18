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

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

function makeSnippet(page: IndexPage, terms: string[]): string {
  const text = page.text.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return page.description || text.slice(0, 160);
  const start = Math.max(0, at - 40);
  const snippet = text.slice(start, start + 200).trim();
  return (start > 0 ? '...' : '') + snippet + (start + 200 < text.length ? '...' : '');
}

const MAX_TERMS = 24;

export function searchDocs(pages: IndexPage[], query: string, limit = 10): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  if (terms.length === 0) return [];
  const scored = pages
    .map((p) => {
      const title = p.title.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const text = p.text.toLowerCase();
      let score = 0;
      for (const t of terms) {
        score += countOccurrences(title, t) * 5;
        score += countOccurrences(desc, t) * 3;
        score += countOccurrences(text, t) * 1;
      }
      return { p, score };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.p.path.localeCompare(b.p.path));
  return scored.slice(0, Math.max(0, limit)).map((s) => ({
    path: s.p.path,
    title: s.p.title,
    section: s.p.section,
    snippet: makeSnippet(s.p, terms),
  }));
}

export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin);
}
