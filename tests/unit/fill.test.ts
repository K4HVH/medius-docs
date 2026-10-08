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

const CHANGELOG = '<main><div data-fill="changelog"><p>Loading...</p></div></main>';
const STATS = '<main><div data-fill="stats"><p>Loading...</p></div></main>';

describe('fillPage', () => {
  it('puts every release into the changelog, notes first and commits folded', async () => {
    const html = await fillPage('/dashboard/changelog', CHANGELOG, SOURCES);
    expect(html).not.toContain('Loading...');
    expect(html).toContain('id="v3.4.5"');
    expect(html).toContain('<details><summary>Show commits</summary>');
    expect(html).toContain('firmware: answered from RAM (bf6e62f)');
    expect(html.indexOf('Fixed')).toBeLessThan(html.indexOf('<details>'));
  });

  it('escapes what the notes say', async () => {
    const html = await fillPage('/dashboard/changelog', CHANGELOG, SOURCES);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows an older release its commit list directly, with nothing to unfold', async () => {
    const html = await fillPage('/dashboard/changelog', CHANGELOG, SOURCES);
    const old = html.slice(html.indexOf('id="v2.2.0"'));
    expect(old).toContain('fw: older commit list (1234567)');
    expect(old).not.toContain('<details>');
  });

  it('puts the totals into the stats page', async () => {
    const html = await fillPage('/dashboard/stats', STATS, SOURCES);
    expect(html).toMatch(/87<\/\w+>\s*<\w+[^>]*>Unique boxes/);
    expect(html).toContain('Countries');
    expect(html).not.toContain('Loading...');
  });

  it('leaves the page alone when its source is down, and any other page always', async () => {
    const down: FillSources = { releases: async () => null, stats: async () => null };
    expect(await fillPage('/dashboard/changelog', CHANGELOG, down)).toBe(CHANGELOG);
    expect(await fillPage('/native', CHANGELOG, SOURCES)).toBe(CHANGELOG);
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
});
