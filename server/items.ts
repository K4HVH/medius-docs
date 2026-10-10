import { type Item, itemFor } from '../src/app/items';
import { type RouteInfo, routeFor } from '../src/app/routes';
import { SITE } from '../src/app/site';
import { type CardContent, cardUrl, deviceCard, helpCard, pageCard, releaseCard } from '../src/app/card/content';
import { HELP_ITEMS } from '../src/app/data/help';
import { COMPAT } from '../src/app/data/compatibility';
import { mergeCompat, withIds } from '../src/app/data/compatMerge';
import type { FirmwareRelease } from '../src/dashboard/firmware/client';
import type { StatsSummary } from './stats/types';
import { getStatsSummary } from './stats';
import { getReleases, refreshReleases } from './firmware';
import { livePage } from './agent';
import { fillPage } from './fill';

// An item's address (src/app/items.ts) is answered with its parent page, filled as the parent is, under a
// head naming the item: its title, description and card, noindex and no canonical, and its stripe colour.
export interface ItemSources {
  releases: () => Promise<FirmwareRelease[] | null>;
  // The list read again, for a release published since it was read.
  refresh: () => Promise<FirmwareRelease[] | null>;
  stats: () => Promise<StatsSummary | null>;
  // The longest a release is looked for, short of the server's 10 s request limit.
  budgetMs?: number;
}

const LIVE: ItemSources = { releases: getReleases, refresh: refreshReleases, stats: getStatsSummary };

// down: the source that would know the item can't be read, so the reader is asked to come back.
type Found = { card: CardContent; description: string } | 'unknown' | 'down';

async function read<T>(source: () => Promise<T | null>): Promise<T | null> {
  try {
    return await source();
  } catch {
    return null;
  }
}

const stop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

const LATE = Symbol('late');

// Each promise given to the result settles by the end of the budget, as itself or LATE.
function timer(budgetMs: number) {
  const end = Date.now() + budgetMs;
  return <T>(p: Promise<T>): Promise<T | typeof LATE> => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<typeof LATE>((r) => (id = setTimeout(() => r(LATE), Math.max(0, end - Date.now()))));
    return Promise.race([p, late]).finally(() => clearTimeout(id));
  };
}

async function find(item: Item, sources: ItemSources): Promise<Found> {
  if (item.kind === 'help') {
    const help = HELP_ITEMS.find((i) => i.id === item.id);
    return help ? { card: helpCard(help), description: help.a } : 'unknown';
  }
  if (item.kind === 'release') {
    const named = (list: FirmwareRelease[] | null) => list?.find((r) => r.tag.toLowerCase() === item.id.toLowerCase());
    const within = timer(sources.budgetMs ?? 5_000);
    const list = await within(read(sources.releases));
    if (list === LATE) return 'down';
    let release = named(list);
    if (!release) {
      // Only a list read again says a release isn't out.
      const again = await within(read(sources.refresh));
      if (again === LATE || !again) return 'down';
      release = named(again);
      if (!release) return 'unknown';
    }
    const card = releaseCard(release);
    return { card, description: card.list?.length ? card.list.map(stop).join(' ') : routeFor(item.parent)!.description };
  }
  const stats = await read(sources.stats);
  const row = withIds(mergeCompat(COMPAT, stats?.devices.top ?? null)).find((d) => d.id === item.target);
  if (!row) return stats ? 'unknown' : 'down';
  const card = deviceCard(row);
  return { card, description: card.description ?? '' };
}

// The card for /og: a page's, or an item's; 'down' while the item's source can't be read.
export async function cardFor(path: string, sources: ItemSources = LIVE): Promise<CardContent | null | 'down'> {
  const item = itemFor(path);
  if (item) {
    const found = await find(item, sources);
    return found === 'unknown' ? null : found === 'down' ? 'down' : found.card;
  }
  const route = routeFor(path);
  return route ? pageCard(route) : null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One tag for the key, where the first stood; theme-color stays ahead of the script that reads it.
function setMeta(head: string, attr: 'name' | 'property', key: string, content: string, extra = ''): string {
  const tag = `<meta ${attr}="${key}" content="${esc(content)}"${extra}>`;
  const like = new RegExp(`<meta\\b[^>]*\\b${attr}="${key.replace(/[.:]/g, '\\$&')}"[^>]*>`, 'g');
  let placed = false;
  const out = head.replace(like, () => (placed ? '' : ((placed = true), tag)));
  return placed ? out : out + tag;
}

function writeHead(html: string, path: string, parent: RouteInfo, found: { card: CardContent; description: string }): string {
  const end = html.indexOf('</head>');
  if (end < 0) return html;
  const { card, description } = found;
  const title = `${card.title} · ${parent.nav} · Medius`;
  const image = cardUrl(path, card);
  let head = html
    .slice(0, end)
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(/<link\b[^>]*\brel="canonical"[^>]*>/g, '');
  const tags: ['name' | 'property', string, string][] = [
    ['name', 'description', description],
    ['name', 'robots', 'noindex'],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', SITE + path],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:image', image],
    ['property', 'og:image:alt', card.title],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', card.title],
    ['name', 'medius-item', path],
  ];
  for (const [attr, key, value] of tags) head = setMeta(head, attr, key, value);
  head = setMeta(head, 'name', 'theme-color', card.colour, ` data-embed="${card.colour}"`);
  return head + html.slice(end);
}

// Null for a path that is no item's address. `snapshot` reads a prerendered page by its path ('/404' for
// the 404 page).
export async function itemPage(
  path: string,
  snapshot: (path: string) => Promise<string | null>,
  sources: ItemSources = LIVE,
  fill: (path: string, html: string) => Promise<string | null> = fillPage,
): Promise<{ status: number; html: string } | null> {
  const item = itemFor(path);
  if (!item) return null;
  const found = await find(item, sources);
  if (found === 'unknown') return { status: 404, html: (await snapshot('/404')) ?? 'Not Found' };
  const html = await snapshot(item.parent);
  if (!html) return null;
  const page = (await livePage(item.parent, html, fill)) ?? { status: 200, html };
  if (found === 'down' || page.status !== 200) return { status: 503, html: page.html };
  return { status: 200, html: writeHead(page.html, path, routeFor(item.parent)!, found) };
}
