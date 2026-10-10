// One place a search can land: a page, a section or anchor on one, a dashboard panel, a release, a
// device report, or another site.
export type EntryKind = 'page' | 'section' | 'anchor' | 'panel' | 'release' | 'device' | 'external';

export interface IndexEntry {
  path: string;
  title: string;
  kind: EntryKind;
  // The site section it is filed under, as the sidebar names it.
  section: string;
  // Where in that section it lives: the sidebar group, and for a part of a page the page.
  crumb: string;
  caption?: string;
  text: string;
  code?: string[];
  keywords?: string[];
}

export interface SearchIndex {
  version: 1;
  built: string;
  entries: IndexEntry[];
}
