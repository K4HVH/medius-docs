import { CLAIM, SITE } from '../site';
import { type RouteInfo, routeFor, sectionLabel } from '../routes';
import { itemPath } from '../items';
import type { HelpItem } from '../data/help';
import type { CompatRow } from '../data/compatMerge';
import { KIND_LABEL, VERDICT_LABEL, VERDICT_TONE } from '../data/compatibility';
import type { FirmwareRelease } from '../../dashboard/firmware';
import { inlineRuns, parseBlocks, splitRelease } from '../../dashboard/firmware/notes';

// What a link card says. Each part is read from the data the page renders.
export interface CardContent {
  crumb: string;
  title: string;
  // Lines kept as written, where the title has them.
  titleLines?: readonly string[];
  description?: string;
  list?: readonly string[];
  address: string;
  // The footer's fact: the first part bright, the rest dim.
  fact: readonly [string, string?];
  colour: string;
}

export const BLUE = '#0080ff';
const TONE: Record<string, string> = { ok: '#10b981', warn: '#f59e0b', bad: '#dc2626' };

// Raised whenever the card is drawn differently: its address changes with it, and unfurlers that keep an
// image by its address fetch the new one.
export const STYLE = 1;

const HOST = SITE.replace(/^https?:\/\//, '');
const FIRMWARE = ['MAKCU', 'firmware'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parentCrumb = (path: string) => {
  const r = routeFor(path)!;
  return `${sectionLabel(r)} / ${r.nav}`;
};

const plain = (md: string) => inlineRuns(md).map((run) => run.text).join('');
const stop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const firstSentence = (s: string) => s.match(/^.*?[.!?](?=\s+\S)/s)?.[0] ?? s;

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export function pageCard(r: RouteInfo): CardContent {
  if (r.section === 'home' || r.section === 'notfound') {
    const home = routeFor('/')!;
    return { crumb: '', title: CLAIM.join(' '), titleLines: CLAIM, description: home.description, address: HOST, fact: FIRMWARE, colour: BLUE };
  }
  const section = sectionLabel(r);
  const group = r.group && r.group.toLowerCase() !== section.toLowerCase() ? r.group : '';
  return {
    crumb: group ? `${section} / ${group}` : section,
    title: r.title,
    description: r.description,
    address: HOST + r.path,
    fact: FIRMWARE,
    colour: BLUE,
  };
}

export function helpCard(item: HelpItem): CardContent {
  return {
    crumb: parentCrumb('/guide/help'),
    title: item.q,
    description: firstSentence(item.a),
    address: HOST + itemPath('help', item.id),
    fact: FIRMWARE,
    colour: BLUE,
  };
}

export function releaseCard(r: FirmwareRelease): CardContent {
  const blocks = parseBlocks(splitRelease(r.notes).notes);
  const at = blocks.findIndex((b) => b.kind === 'heading' && /^changes$/i.test(b.text.trim()));
  const changes = at >= 0 ? blocks[at + 1] : undefined;
  const date = day(r.publishedAt);
  return {
    crumb: parentCrumb('/dashboard/changelog'),
    title: r.tag,
    list: changes?.kind === 'list' ? changes.items.slice(0, 2).map(plain) : undefined,
    address: HOST + itemPath('release', r.tag),
    fact: date ? [date] : FIRMWARE,
    colour: BLUE,
  };
}

// A device that is neither mouse nor keyboard is named by no kind: "Other." says nothing.
function deviceLine(row: CompatRow): string {
  const kind = row.kind === 'other' ? '' : KIND_LABEL[row.kind];
  const lead = kind ? `${kind}. ` : '';
  const seen = row.boxes ? `Seen on ${row.boxes} ${row.boxes === 1 ? 'box' : 'boxes'} in the usage stats.` : '';
  if (row.note) {
    const on = row.reported ? `${kind ? `${kind}, reported` : 'Reported'} on ${row.reported}.` : kind ? `${kind}.` : '';
    return `${stop(row.note)} ${on}`.trim();
  }
  if (row.reported)
    return `${lead}${row.verdict === 'works' ? 'Reported working through the box' : 'Reported'} on ${row.reported}.`;
  return `${lead}${seen}`.trim() || stop(VERDICT_LABEL[row.verdict]);
}

export function deviceCard(row: CompatRow & { id: string }): CardContent {
  return {
    crumb: parentCrumb('/guide/compatibility'),
    title: row.name,
    description: deviceLine(row),
    address: HOST + itemPath('device', row.id.replace(/^device-/, '')),
    fact: [VERDICT_LABEL[row.verdict]],
    colour: TONE[VERDICT_TONE[row.verdict]],
  };
}

// Everything the card shows and the style it is drawn in, as one string.
export function cardKey(c: CardContent): string {
  return JSON.stringify([STYLE, c.crumb, c.title, c.titleLines ?? null, c.description ?? null, c.list ?? null, c.address, c.fact, c.colour]);
}

// FNV-1a over cardKey. 32 bits tell one card's versions apart in its address; they can be made to collide,
// so nothing keeps a drawing by the hash alone.
export function cardHash(c: CardContent): string {
  const text = cardKey(c);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function cardUrl(path: string, c: CardContent): string {
  return `${SITE}/og${path === '/' ? '/index' : path}.png?v=${cardHash(c)}`;
}
