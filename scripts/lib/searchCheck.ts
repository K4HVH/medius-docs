import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES } from '../../src/app/routes';
import { HELP_ITEMS } from '../../src/app/data/help';
import { KEYWORDS, SYNONYMS } from '../../src/app/search/extra';
import { createSearcher } from '../../src/app/search/rank';
import type { SearchIndex } from '../../src/app/search/types';
import type { Fate } from '../../src/app/search/extract';

// What the pass saw on each page: every element marked for search, and what became of it.
export type Rendered = Record<string, { id: string; fate: Fate; panel: boolean }[]>;

// What a built search index is held to before it ships: every page, docs section, titled dashboard panel
// and Help answer in it; each entry titled, at an address no other entry has; nothing a page shows only
// while loading or failing, and no value of the dev build's fake box; every hand-kept address still on
// the site; and the queries below answered as they must be.

export interface CheckContext {
  routes: string[];
  // Ids of the docs sections, titled panels and hand-marked anchors in the page sources, less the panels
  // marked transient.
  sectionIds: string[];
  helpIds: string[];
  // Today's first result for each query from the search this one replaced; a `why` says why another is
  // better.
  golden: { q: string; first: string; why?: string }[];
  expect: { q: string; path: string; within: number }[];
  keywordPaths: string[];
  // From the pass, when there was one: each page is held to what it rendered.
  rendered?: Rendered;
}

// Queries the search must answer from the built site. Releases and devices come from the server and are
// held by its tests.
export const EXPECT: CheckContext['expect'] = [
  { q: '"every-id sentinel"', path: '/library/types/errors', within: 1 },
  { q: 'query_patch_entry', path: '/library/advanced/patch#query-patch-entry', within: 1 },
  { q: 'lcok', path: '/native/commands/lock', within: 3 },
  { q: 'polling rate', path: '/dashboard#emit-rate', within: 8 },
  { q: '"blanket"', path: '/native/commands/lock#blanket', within: 3 },
  { q: 'move rel', path: '/library/move#move-rel', within: 1 },
  { q: 'bsod', path: '/guide/help#bsod', within: 1 },
  { q: 'unstick', path: '/dashboard/control', within: 1 },
  { q: '1000hz', path: '/guide/compatibility#limits', within: 3 },
  { q: 'install', path: '/dashboard/setup', within: 1 },
  // A dashboard panel, by the words on its controls.
  { q: 'flash over usb2', path: '/dashboard/update#manual', within: 1 },
  { q: 'test firmware', path: '/dashboard/update#manual', within: 3 },
  { q: 'mark complete', path: '/dashboard/control#clip-build', within: 1 },
  { q: 'replayable', path: '/dashboard/control#clip-settings', within: 1 },
  { q: 'mask', path: '/dashboard/control#any-input', within: 3 },
  { q: 'drag', path: '/dashboard/control#injection', within: 1 },
  { q: 'every axis', path: '/dashboard/control#input-locks', within: 5 },
  { q: 'consume', path: '/dashboard/control#clip-triggers', within: 8 },
  { q: 'clear everything', path: '/dashboard/control', within: 1 },
  { q: 'stuck key', path: '/dashboard/control', within: 3 },
  // A name a reader pastes in after seeing it, and the wire's name for a field the library renamed.
  { q: 'catchtablefull', path: '/library/types/errors', within: 1 },
  { q: 'snaplen', path: '/native/commands/catch', within: 1 },
];

// The dev build's fake box: its MAC anywhere, and its name on the dashboard.
const FAKE_MAC = /58:8C:81:DF:1E:28|588c81df1e28/i;
const FAKE_NAME = /\bDesk\b/;
const LOADING = /Loading\.\.\.|Loading releases|Reading\.\.\.|couldn['\u2019]t load/i;

// A hit on the wanted place, on a part of the wanted page, or on the page a wanted section was folded
// into (a section titled as its page, whose id is the page's last word).
const samePlace = (hit: string, want: string) =>
  hit === want || hit.startsWith(`${want}#`) || (!hit.includes('#') && want === `${hit}#${hit.split('/').pop()}`);

export function checkIndex(index: SearchIndex, ctx: CheckContext): string[] {
  const out: string[] = [];
  const paths = new Set(index.entries.map((e) => e.path));
  const anchors = new Set(index.entries.map((e) => e.path.split('#')[1]).filter(Boolean));
  const slugs = new Set([...paths].filter((p) => !p.includes('#')).map((p) => p.split('/').pop()));

  for (const r of ctx.routes) if (!paths.has(r)) out.push(`page ${r} has no entry`);
  if (ctx.rendered) {
    // Each element a page marked: an entry at its address on that page, the page's opening, or a panel
    // that only holds others. A marked element with no title is a place a link can name and search
    // cannot.
    const seen = new Set(Object.values(ctx.rendered).flatMap((list) => list.map((t) => t.id)));
    for (const [path, list] of Object.entries(ctx.rendered))
      for (const t of list) {
        if (t.fate === 'entry' && !paths.has(`${path}#${t.id}`)) out.push(`${path}#${t.id} is in no entry`);
        if (t.fate === 'untitled' && !t.panel) out.push(`${path}#${t.id} is marked for search but has no title`);
      }
    for (const id of ctx.sectionIds) if (!seen.has(id)) out.push(`section #${id} was never rendered`);
  } else for (const id of ctx.sectionIds) if (!anchors.has(id) && !slugs.has(id)) out.push(`section #${id} is in no entry`);
  for (const id of ctx.helpIds) if (!paths.has(`/guide/help#${id}`)) out.push(`help answer ${id} is in no entry`);

  const seen = new Set<string>();
  for (const e of index.entries) {
    if (!e.title.trim() || !e.section.trim()) out.push(`${e.path} has no title`);
    if (seen.has(e.path)) out.push(`${e.path} is in the index twice`);
    seen.add(e.path);
    const all = [e.title, e.caption ?? '', e.text, ...(e.code ?? []), ...(e.keywords ?? [])].join('\n');
    if (LOADING.test(e.text)) out.push(`${e.path} holds loading or failure text`);
    if (FAKE_MAC.test(all) || (e.path.startsWith('/dashboard') && FAKE_NAME.test(all))) out.push(`${e.path} holds the fake box's name or address`);
  }
  for (const p of ctx.keywordPaths) if (!paths.has(p)) out.push(`keywords for ${p}, which is in no entry`);

  const search = createSearcher(index.entries, { synonyms: SYNONYMS });
  const top = (q: string, n: number) => search.search(q).slice(0, n).map((h) => h.entry.path);
  for (const g of ctx.golden) {
    const got = top(g.q, 3);
    if (!g.why && !got.some((h) => samePlace(h, g.first))) out.push(`golden "${g.q}": wanted ${g.first} in the first 3, got ${got.join(', ')}`);
  }
  for (const x of ctx.expect) {
    const got = top(x.q, x.within);
    if (!got.some((h) => samePlace(h, x.path))) out.push(`query "${x.q}": wanted ${x.path} in the first ${x.within}, got ${got.join(', ')}`);
  }
  return out;
}

const tsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? tsx(p) : p.endsWith('.tsx') ? [p] : [];
  });

// The context from the checkout: the routes, the ids in the page sources, the Help answers, the golden
// queries and the hand-kept addresses.
export function siteContext(root = '.'): CheckContext {
  const sources = tsx(join(root, 'src/app/pages')).map((f) => readFileSync(f, 'utf8'));
  const sectionIds = sources.flatMap((s) => [
    ...[...s.matchAll(/<DocSection\b[^>]*?\bid="([^"]+)"/g)].map((m) => m[1]),
    ...[...s.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bdata-search-target\b[^>]*>/g)].map((m) => /\bid="([^"]+)"/.exec(m[0])?.[1]).filter((x): x is string => !!x),
    ...[...s.matchAll(/<Panel\b[^>]*>/g)]
      .map((m) => (/\btitle="/.test(m[0]) && !/\btransient\b/.test(m[0]) ? /\bid="([^"]+)"/.exec(m[0])?.[1] : undefined))
      .filter((x): x is string => !!x),
  ]);
  return {
    routes: ROUTES.filter((r) => r.kind !== 'home' && r.section !== 'notfound').map((r) => r.path),
    sectionIds: [...new Set(sectionIds)],
    helpIds: HELP_ITEMS.map((h) => h.id),
    golden: JSON.parse(readFileSync(join(root, 'tests/fixtures/search-golden.json'), 'utf8')),
    expect: EXPECT,
    keywordPaths: Object.keys(KEYWORDS),
  };
}
