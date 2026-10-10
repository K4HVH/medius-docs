import { describe, it, expect } from 'vitest';
import { fillPage, fillMarkdown, type FillSources } from '../../server/fill';
import { COMMITS_MARKER } from '../../src/dashboard/firmware/notes';
import type { FirmwareRelease } from '../../src/dashboard/firmware';

const release = (tag: string, notes: string): FirmwareRelease => ({
  tag,
  name: tag,
  publishedAt: '2026-10-05T12:00:00Z',
  prerelease: false,
  notes,
  assets: [],
});

const RELEASES = [
  release('v3.4.5', `## Changes\n- Fixed <script>alert(1)</script> updates\n\n${COMMITS_MARKER}\n## Commits\n**Firmware**\n- firmware: answered from RAM (bf6e62f)`),
  release('v2.2.0', '**Firmware**\n- fw: older commit list (1234567)'),
];

const SOURCES: FillSources = {
  releases: async () => RELEASES,
  stats: async () => ({
    boxes: { total: 87, active7: 80, active30: 87, newPerWeek: [], activePerDay: [] },
    firmware: { versions: [] },
    devices: { unique: 62, byKind: [], top: [] },
    flashes: { total: 265, succeeded: 224, byResult: [], byRoute: [], byChips: [], bySource: [], byVersion: [], perWeek: [] },
    countries: [{ key: 'US', n: 17 }, { key: 'unknown', n: 2 }],
    os: [],
    browsers: [],
  }),
};

const CHANGELOG = '<html><body><main><div data-fill="changelog"><p>Loading...</p></div></main></body></html>';
const STATS = '<main><div data-fill="stats"><p>Loading...</p></div></main>';

describe('fillPage', () => {
  it('puts every release into the changelog, notes first and commits folded', async () => {
    const html = (await fillPage('/dashboard/changelog', CHANGELOG, SOURCES))!;
    expect(html).not.toContain('Loading...');
    expect(html).toContain('id="v3.4.5"');
    expect(html).toContain('<section id="v3.4.5" class="rel"><div class="rel-l"><h2>v3.4.5</h2>');
    // Folded where no script runs, grouped by repo as the page groups them.
    expect(html).toContain('<details><summary>Show commits</summary><div class="cmts"><p class="sublabel">Firmware</p><ol><li>firmware: answered from RAM<code>bf6e62f</code></li></ol></div></details>');
    expect(html.indexOf('Fixed')).toBeLessThan(html.indexOf('<details>'));
  });

  it('fills the block as the prerender captures it, with the attributes the app gave it', async () => {
    const snapshot = (key: string) =>
      `<main><div data-fill="${key}" data-search-skip="" class="rb moving" style="--d: 200ms;"><p class="mut">Loading...</p></div></main>`;
    const changelog = (await fillPage('/dashboard/changelog', snapshot('changelog'), SOURCES, new Map()))!;
    expect(changelog).toContain('<section id="v3.4.5" class="rel">');
    expect(changelog).not.toContain('Loading');
    const stats = (await fillPage('/dashboard/stats', snapshot('stats'), SOURCES, new Map()))!;
    expect(stats).not.toContain('Loading');
  });

  it('renders the bold and code the notes are written in', async () => {
    const md: FillSources = { ...SOURCES, releases: async () => [release('v3.4.4', `## Notes\nthere is **almost **no difference, protocol \`8\`\n\n${COMMITS_MARKER}\n- c (1)`)] };
    const html = (await fillPage('/dashboard/changelog', CHANGELOG, md))!;
    expect(html).toContain('<strong>almost </strong>');
    expect(html).toContain('<code>8</code>');
  });

  it('escapes what the notes say', async () => {
    const html = (await fillPage('/dashboard/changelog', CHANGELOG, SOURCES))!;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows an older release its commit list directly, with nothing to unfold', async () => {
    const html = (await fillPage('/dashboard/changelog', CHANGELOG, SOURCES))!;
    const old = html.slice(html.indexOf('id="v2.2.0"'));
    expect(old).toContain('<div class="cmts"><p class="sublabel">Firmware</p><ol><li>fw: older commit list<code>1234567</code></li></ol></div>');
    expect(old).not.toContain('<details>');
  });

  it('puts the totals into the stats page', async () => {
    const html = (await fillPage('/dashboard/stats', STATS, SOURCES))!;
    // As the page draws them: a figure strip, each label over its value.
    expect(html).toMatch(/<dl class="vit eight caps"><div><dt>Unique boxes<\/dt><dd class="big">87<\/dd><\/div>/);
    expect(html).toContain('Countries');
    expect(html).not.toContain('Loading...');
  });

  it('says so when a source has never answered, and leaves any other page alone', async () => {
    const down: FillSources = { releases: async () => null, stats: async () => null };
    expect(await fillPage('/dashboard/changelog', CHANGELOG, down, new Map())).toBeNull();
    expect(await fillPage('/native', CHANGELOG, SOURCES)).toBe(CHANGELOG);
  });

  it('treats a source that throws like one that is down', async () => {
    const broken: FillSources = {
      releases: async () => { throw new Error('fetch failed'); },
      stats: async () => { throw new Error('db gone'); },
    };
    expect(await fillPage('/dashboard/changelog', CHANGELOG, broken, new Map())).toBeNull();
    expect(await fillPage('/dashboard/stats', STATS, broken, new Map())).toBeNull();
    expect(await fillMarkdown('/dashboard/changelog', broken, new Map())).toBeNull();
  });

  it('embeds the releases for the page to start from, so it does not flash back to Loading', async () => {
    const html = (await fillPage('/dashboard/changelog', CHANGELOG, SOURCES, new Map()))!;
    const json = html.match(/<script id="releases-data" type="application\/json">([\s\S]*?)<\/script>/)![1];
    expect(JSON.parse(json).map((r: { tag: string }) => r.tag)).toEqual(['v3.4.5', 'v2.2.0']);
    expect(json).not.toContain('<script>');
  });

  it('serves the last good copy while a source is down', async () => {
    const memory = new Map<string, string>();
    const good = await fillPage('/dashboard/changelog', CHANGELOG, SOURCES, memory);
    const down: FillSources = { releases: async () => null, stats: async () => null };
    expect(await fillPage('/dashboard/changelog', CHANGELOG, down, memory)).toBe(good);
  });
});

describe('fillMarkdown', () => {
  it('writes the changelog as Markdown with each release under its tag', async () => {
    const md = (await fillMarkdown('/dashboard/changelog', SOURCES))!;
    expect(md.startsWith('<!-- Source: https://medius.k4tech.net/dashboard/changelog -->\n# Medius firmware changelog')).toBe(true);
    expect(md).toContain('## v3.4.5');
    expect(md).toContain('- firmware: answered from RAM (bf6e62f)');
  });

  it('has nothing for a page it does not fill', async () => {
    expect(await fillMarkdown('/native', SOURCES)).toBeNull();
  });

  it('serves the last good Markdown while a source is down', async () => {
    const memory = new Map<string, string>();
    const good = await fillMarkdown('/dashboard/changelog', SOURCES, memory);
    expect(await fillMarkdown('/dashboard/changelog', { releases: async () => null, stats: async () => null }, memory)).toBe(good);
  });
});

const HOME =
  '<html><body><div id="root"><dl><dd data-fill="vital-firmware"></dd><dd data-fill="vital-devices"></dd>' +
  '<dd data-fill="vital-boxes"></dd></dl><span data-fill="vital-discord"></span></div></body></html>';
const COMPAT = '<table><tbody data-fill="compat"><tr><td>Seed row</td></tr></tbody></table>';

describe('fillPage on the soft pages', () => {
  it('fills the landing vitals and carries the figures for the app', async () => {
    const html = (await fillPage('/', HOME, { ...SOURCES, discord: async () => 590 }, new Map()))!;
    expect(html).toContain('<dd data-fill="vital-firmware">v3.4.5</dd>');
    expect(html).toContain('<dd data-fill="vital-devices">62</dd>');
    expect(html).toContain('<dd data-fill="vital-boxes" class="live">87</dd>');
    expect(html).toContain('<span data-fill="vital-discord">590 members</span>');
    expect(html).toMatch(/<script id="home-data" type="application\/json">\{"firmware":"v3.4.5"/);
  });

  it('answers the landing page with empty cells, never null and never Loading, when no source ever answered', async () => {
    const off = async () => null;
    const html = await fillPage('/', HOME, { releases: off, stats: off, discord: off }, new Map());
    expect(html).toContain('<dd data-fill="vital-boxes"></dd>');
    expect(html).not.toContain('Loading');
  });

  it('puts the merged compatibility rows in the table, and leaves the seed rows while the stats are down', async () => {
    const top = [{ vid: 0x31e3, pid: 0x1322, kind: 1, product: 'Wooting 60HE+', boxes: 45 }];
    const stats = async () => ({ ...(await SOURCES.stats())!, devices: { unique: 1, byKind: [], top } });
    const html = (await fillPage('/guide/compatibility', COMPAT, { ...SOURCES, stats }, new Map()))!;
    expect(html).not.toContain('Seed row');
    expect(html).toMatch(
      /<tr id="device-wooting-60he"><td>Wooting 60HE\+<span class="vp">31e3:1322<\/span><\/td><td>Keyboard<\/td><td><span class="status ok">Supported<\/span><\/td><td>Needs imperfect clone<\/td><td class="v">v3\.4\.4<\/td><td class="num">45<\/td><\/tr>/,
    );
    expect(await fillPage('/guide/compatibility', COMPAT, { ...SOURCES, stats: async () => null }, new Map())).toBe(COMPAT);
    const unnamed = async () => ({ ...(await SOURCES.stats())!, devices: { unique: 1, byKind: [], top: [{ vid: 0x3837, pid: 0x100a, kind: 2, product: null, boxes: 3 }] } });
    const once = (await fillPage('/guide/compatibility', COMPAT, { ...SOURCES, stats: unnamed }, new Map()))!;
    expect(once.match(/3837:100a/g)).toHaveLength(1);
  });
});

