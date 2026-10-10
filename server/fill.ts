// The changelog and stats pages read the server at run time, so their prerendered snapshots hold only
// "Loading...". These fill that block per request, for crawlers that run no JavaScript.
import type { FirmwareRelease } from '../src/dashboard/firmware/client';
import { groupCommits, inlineRuns, parseBlocks, splitRelease, type Block, type CommitGroup } from '../src/dashboard/firmware/notes';
import { SITE } from '../src/app/site';
import { COMPAT, KIND_LABEL, VERDICT_LABEL, VERDICT_TONE } from '../src/app/data/compatibility';
import { mergeCompat, withIds } from '../src/app/data/compatMerge';
import type { StatsSummary } from './stats/types';
import { getStatsSummary } from './stats';
import { figureText, type HomeFigures } from '../src/app/data/homeFigures';
import { getHomeFigures, liveReleases } from './home';

export interface FillSources {
  releases: () => Promise<FirmwareRelease[] | null>;
  stats: () => Promise<StatsSummary | null>;
  discord?: () => Promise<number | null>;
  home?: () => Promise<HomeFigures>;
}

// The changelog waits up to 5 s for releases it has never had, short of the server's 10 s request limit.
const LIVE: FillSources = { releases: () => liveReleases(5_000), stats: getStatsSummary, home: () => getHomeFigures() };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const runs = (text: string) =>
  inlineRuns(text)
    .map((r) =>
      r.href
        ? `<a href="${esc(r.href)}">${esc(r.text)}</a>`
        : r.strong
          ? `<strong>${esc(r.text)}</strong>`
          : r.code
            ? `<code>${esc(r.text)}</code>`
            : esc(r.text),
    )
    .join('');

const blocks = (list: Block[]) =>
  list
    .map((b) =>
      b.kind === 'heading'
        ? `<p class="sublabel">${esc(b.text)}</p>`
        : b.kind === 'list'
          ? `<ul>${b.items.map((i) => `<li>${runs(i)}</li>`).join('')}</ul>`
          : `<p>${runs(b.text)}</p>`,
    )
    .join('');

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const groups = (list: CommitGroup[]) =>
  '<div class="cmts">' +
  list
    .map(
      (g) =>
        (g.repo ? `<p class="sublabel">${esc(g.repo)}</p>` : '') +
        `<ol>${g.commits.map((c) => `<li>${esc(c.subject)}${c.hash ? `<code>${c.hash}</code>` : ''}</li>`).join('')}</ol>`,
    )
    .join('') +
  '</div>';

// As Changelog.tsx draws a release, with the commits in a <details> that opens where no script runs.
function releaseHtml(r: FirmwareRelease): string {
  const { notes, commits } = splitRelease(r.notes);
  const listed = commits ? groupCommits(commits) : null;
  const folded = commits
    ? `<details><summary>Show commits</summary>${listed ? groups(listed) : blocks(parseBlocks(commits))}</details>`
    : '';
  const old = commits ? null : groupCommits(notes);
  const pre = r.prerelease ? '<span class="chip chip--warning"><span class="chip__label">Pre-release</span></span>' : '';
  return (
    `<section id="${esc(r.tag)}" class="rel"><div class="rel-l"><h2>${esc(r.tag)}</h2>` +
    `<time class="caps" datetime="${esc(r.publishedAt)}">${esc(date(r.publishedAt))}</time>${pre}</div>` +
    `<div class="rel-r">${old ? groups(old) : blocks(parseBlocks(notes))}${folded}</div></section>`
  );
}

const figure = (value: number, label: string) => `<div><dt>${label}</dt><dd class="big">${value}</dd></div>`;

function statsHtml(s: StatsSummary): string {
  const countries = s.countries.filter((c) => c.key !== 'unknown').length;
  return (
    '<dl class="vit eight caps">' +
    figure(s.boxes.total, 'Unique boxes') +
    figure(s.boxes.active30, 'Active in 30 days') +
    figure(s.devices.unique, 'Unique devices') +
    figure(s.flashes.total, 'Flashes') +
    figure(countries, 'Countries') +
    '</dl>'
  );
}

const replaceFill = (html: string, key: string, inner: string) =>
  html.replace(new RegExp(`(<div\\b[^>]*\\sdata-fill="${key}"[^>]*>)[\\s\\S]*?</div>`), (_m, open: string) => `${open}${inner}</div>`);

// JSON inside <script>: "<" escaped so no value can close the tag.
const embed = (id: string, data: unknown) =>
  `<script id="${id}" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

async function read<T>(source: () => Promise<T | null>): Promise<T | null> {
  try {
    return await source();
  } catch {
    return null;
  }
}

// The last page each source filled, served while that source is down.
const LAST_GOOD = new Map<string, string>();

async function fresh(path: string, sources: FillSources, html: string): Promise<string | null> {
  if (path === '/dashboard/changelog') {
    const releases = await read(sources.releases);
    if (!releases) return null;
    // The data goes outside #root, which the client clears before it renders.
    const list = `<div class="rels">${releases.map(releaseHtml).join('')}</div>`;
    return replaceFill(html, 'changelog', list).replace('</body>', () => `${embed('releases-data', releases)}</body>`);
  }
  const stats = await read(sources.stats);
  return stats ? replaceFill(html, 'stats', statsHtml(stats)) : null;
}

const VITALS: (keyof HomeFigures)[] = ['firmware', 'devices', 'boxes', 'discord'];

// Each vital's cell holds its figure, or stays empty while its source is down. The boxes figure carries the
// live dot, as the app draws it.
function homeHtml(html: string, figures: HomeFigures): string {
  let out = html;
  for (const k of VITALS) {
    const v = figures[k];
    if (v === undefined) continue;
    out = out.replace(
      new RegExp(`(<(\\w+)[^>]*\\sdata-fill="vital-${k}"[^>]*>)[\\s\\S]*?(</\\2>)`),
      (_m, open: string, _t: string, close: string) =>
        `${k === 'boxes' ? open.replace(/>$/, ' class="live">') : open}${esc(figureText(k, v))}${close}`,
    );
  }
  return out.replace('</body>', () => `${embed('home-data', figures)}</body>`);
}

function compatHtml(html: string, stats: StatsSummary): string {
  const rows = withIds(mergeCompat(COMPAT, stats.devices.top))
    .map(
      (r) =>
        `<tr id="${r.id}"><td>${esc(r.name)}${r.vidpid && r.vidpid !== r.name ? `<span class="vp">${esc(r.vidpid)}</span>` : ''}</td>` +
        `<td>${KIND_LABEL[r.kind]}</td><td><span class="status ${VERDICT_TONE[r.verdict]}">${VERDICT_LABEL[r.verdict]}</span></td>` +
        `<td>${esc(r.note ?? '')}</td><td class="v">${esc(r.reported ?? '')}</td><td class="num">${r.boxes ?? ''}</td></tr>`,
    )
    .join('');
  return html.replace(/(<tbody[^>]*\sdata-fill="compat"[^>]*>)[\s\S]*?(<\/tbody>)/, (_m, open: string, close: string) => open + rows + close);
}

// The page with its live block filled, the last good copy while the source is down, or null when the
// source has never answered. The landing and compatibility pages always come back: what their sources
// can't give stays as prerendered. Any other page comes back unchanged.
export async function fillPage(
  path: string,
  html: string,
  sources: FillSources = LIVE,
  memory: Map<string, string> = LAST_GOOD,
): Promise<string | null> {
  if (path === '/') {
    const none = async () => null;
    return homeHtml(html, await (sources.home?.() ?? getHomeFigures({ ...sources, discord: sources.discord ?? none })));
  }
  if (path === '/guide/compatibility') {
    const stats = await read(sources.stats);
    return stats ? compatHtml(html, stats) : html;
  }
  if (path !== '/dashboard/changelog' && path !== '/dashboard/stats') return html;
  const filled = await fresh(path, sources, html);
  if (filled) memory.set(path, filled);
  return filled ?? memory.get(path) ?? null;
}

function freshMarkdown(path: string, releases: FirmwareRelease[] | null, s: StatsSummary | null): string | null {
  const source = `<!-- Source: ${SITE}${path} -->`;
  if (releases) {
    const parts = releases.map((r) => {
      const { notes, commits } = splitRelease(r.notes);
      const body = [notes.replace(/^## /gm, '### '), commits ? `### Commits\n\n${commits}` : ''].filter(Boolean);
      return [`## ${r.tag}`, date(r.publishedAt), ...body].join('\n\n');
    });
    return [`${source}\n# Medius firmware changelog`, ...parts].join('\n\n') + '\n';
  }
  if (s) {
    const countries = s.countries.filter((c) => c.key !== 'unknown').length;
    const rows = [
      ['Unique boxes', s.boxes.total],
      ['Active in 30 days', s.boxes.active30],
      ['Unique devices', s.devices.unique],
      ['Flashes', s.flashes.total],
      ['Countries', countries],
    ].map(([k, v]) => `| ${k} | ${v} |`);
    return [`${source}\n# Medius usage stats`, ['| Figure | Count |', '|---|---|', ...rows].join('\n')].join('\n\n') + '\n';
  }
  return null;
}

export async function fillMarkdown(
  path: string,
  sources: FillSources = LIVE,
  memory: Map<string, string> = LAST_GOOD,
): Promise<string | null> {
  const key = path + '.md';
  let md: string | null = null;
  if (path === '/dashboard/changelog') md = freshMarkdown(path, await read(sources.releases), null);
  else if (path === '/dashboard/stats') md = freshMarkdown(path, null, await read(sources.stats));
  else return null;
  if (md) memory.set(key, md);
  return md ?? memory.get(key) ?? null;
}
