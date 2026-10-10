import { LINKS } from '../site';
import type { IndexEntry } from './types';

// The hand-kept part of the search, kept small: words readers use for one thing the site calls by
// another, words for a place the page never uses itself, and other sites. Everything else comes from
// the pages. The build fails when an address here is no longer on the site.

// Each group's members stand for one another; a match through one scores half of a direct match.
export const SYNONYMS: string[][] = [
  ['report rate', 'polling rate', 'poll rate'],
  ['blue screen', 'bsod'],
  ['clip', 'macro'],
  ['firmware', 'fw'],
  ['update', 'upgrade'],
  ['inject', 'simulate'],
  ['checksum', 'crc'],
];

// Extra words for an address, where readers ask with a word its page never uses.
export const KEYWORDS: Record<string, string[]> = {
  '/native': ['what is medius', 'about'],
  '/guide': ['getting started', 'first time', 'new box'],
  '/guide/compatibility': ['compatible', 'compatibility', 'supported devices'],
  '/guide/compatibility#reporting': ['broken', 'not working'],
  '/guide/help': ['faq', 'questions', 'troubleshooting'],
  '/dashboard/setup': ['install', 'installer', 'first install'],
  '/dashboard/update': ['update firmware', 'firmware update', 'outdated', 'out of date', 'downgrade'],
  '/dashboard/update#manual': ['brick', 'bricked', 'recover', 'test firmware', 'custom firmware'],
  '/native/commands/update#rollback': ['brick', 'bricked'],
  '/dashboard#your-box': ['icon', 'box icon'],
  '/dashboard#box-name': ['rename'],
  '/dashboard/control': ['unstick', 'stuck key', 'stuck button'],
  '/dashboard/control#injection': ['drag'],
  '/dashboard/control#input-locks': ['damp'],
  '/dashboard/control#control-transfer': ['urb'],
  '/dashboard#bearing': ['sticky aim'],
  '/dashboard/stats': ['analytics'],
  '/native/commands/lock#bearing': ['sticky aim'],
  '/native/commands/lock#scale': ['negate', 'damp'],
  '/native/transport#serial': ['6000000'],
  '/library/guides/calls#smooth-motion': ['glide', 'teleport'],
  '/library/types/errors': ['refusal', 'refused', 'error codes'],
};

export const EXTERNAL: IndexEntry[] = [
  { path: LINKS.discord, title: 'Discord', kind: 'external', section: 'Elsewhere', crumb: 'discord.gg', text: 'The Medius community: help, device reports and releases.', keywords: ['community', 'chat', 'support', 'server', 'invite'] },
  { path: LINKS.github, title: 'GitHub', kind: 'external', section: 'Elsewhere', crumb: 'github.com', text: 'The Medius library and tools, open source.', keywords: ['source', 'code', 'repository', 'issues'] },
  { path: LINKS.crates, title: 'crates.io', kind: 'external', section: 'Elsewhere', crumb: 'crates.io', text: 'The medius Rust crate.', keywords: ['rust', 'crate', 'cargo'] },
  { path: LINKS.pypi, title: 'PyPI', kind: 'external', section: 'Elsewhere', crumb: 'pypi.org', text: 'The medius Python package.', keywords: ['python', 'pip', 'package'] },
];

// The entries with the hand-kept words added, and the other sites after them.
export function withExtra(entries: IndexEntry[]): IndexEntry[] {
  return [
    ...entries.map((e) => (KEYWORDS[e.path] ? { ...e, keywords: [...(e.keywords ?? []), ...KEYWORDS[e.path]] } : e)),
    ...EXTERNAL,
  ];
}

// Addresses given keywords here that no entry has.
export const strayKeywords = (entries: IndexEntry[]): string[] => {
  const paths = new Set(entries.map((e) => e.path));
  return Object.keys(KEYWORDS).filter((p) => !paths.has(p));
};
