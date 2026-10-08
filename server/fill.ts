// The changelog and stats pages read the server at run time, so their prerendered snapshots hold only
// "Loading...". These fill that block per request, for crawlers that run no JavaScript.
import type { FirmwareRelease } from '../src/dashboard/firmware/client';
import { inlineRuns, parseBlocks, splitRelease, type Block } from '../src/dashboard/firmware/notes';
import { SITE } from '../src/app/site';
import type { StatsSummary } from './stats/types';
import { getReleases } from './firmware';
import { getStatsSummary } from './stats';

export interface FillSources {
  releases: () => Promise<FirmwareRelease[] | null>;
  stats: () => Promise<StatsSummary | null>;
}

const LIVE: FillSources = { releases: getReleases, stats: getStatsSummary };

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
        ? `<div class="release__heading">${esc(b.text)}</div>`
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

function releaseHtml(r: FirmwareRelease): string {
  const { notes, commits } = splitRelease(r.notes);
  const folded = commits ? `<details><summary>Show commits</summary>${blocks(parseBlocks(commits))}</details>` : '';
  const pre = r.prerelease ? ' <span class="release__pre">Pre-release</span>' : '';
  return (
    `<section id="${esc(r.tag)}" class="release"><div class="release__title"><h4>${esc(r.tag)}</h4>${pre}` +
    `<span class="release__date">${esc(date(r.publishedAt))}</span></div>${blocks(parseBlocks(notes))}${folded}</section>`
  );
}

const figure = (value: number, label: string) =>
  `<div class="stat-figure"><div class="stat-figure__value">${value}</div><div class="stat-figure__label">${label}</div></div>`;

function statsHtml(s: StatsSummary): string {
  const countries = s.countries.filter((c) => c.key !== 'unknown').length;
  return (
    '<div class="stat-figures">' +
    figure(s.boxes.total, 'Unique boxes') +
    figure(s.boxes.active30, 'Active in 30 days') +
    figure(s.devices.unique, 'Unique devices') +
    figure(s.flashes.total, 'Flashes') +
    figure(countries, 'Countries') +
    '</div>'
  );
}

const replaceFill = (html: string, key: string, inner: string) =>
  html.replace(new RegExp(`<div data-fill="${key}">[\\s\\S]*?</div>`), () => `<div data-fill="${key}">${inner}</div>`);

export async function fillPage(path: string, html: string, sources: FillSources = LIVE): Promise<string> {
  if (path === '/dashboard/changelog') {
    const releases = await sources.releases();
    return releases
      ? replaceFill(html, 'changelog', `<div class="releases">${releases.map(releaseHtml).join('')}</div>`)
      : html;
  }
  if (path === '/dashboard/stats') {
    const stats = await sources.stats();
    return stats ? replaceFill(html, 'stats', statsHtml(stats)) : html;
  }
  return html;
}

export async function fillMarkdown(path: string, sources: FillSources = LIVE): Promise<string | null> {
  const source = `<!-- Source: ${SITE}${path} -->`;
  if (path === '/dashboard/changelog') {
    const releases = await sources.releases();
    if (!releases) return null;
    const parts = releases.map((r) => {
      const { notes, commits } = splitRelease(r.notes);
      const body = [notes.replace(/^## /gm, '### '), commits ? `### Commits\n\n${commits}` : ''].filter(Boolean);
      return [`## ${r.tag}`, date(r.publishedAt), ...body].join('\n\n');
    });
    return [`${source}\n# Medius firmware changelog`, ...parts].join('\n\n') + '\n';
  }
  if (path === '/dashboard/stats') {
    const s = await sources.stats();
    if (!s) return null;
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
