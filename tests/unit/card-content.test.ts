import { describe, it, expect } from 'vitest';
import { ROUTES, NOT_FOUND, routeFor } from '../../src/app/routes';
import { HELP_ITEMS } from '../../src/app/data/help';
import { CLAIM } from '../../src/app/site';
import { pageCard, helpCard, releaseCard, deviceCard, cardHash, cardUrl, BLUE } from '../../src/app/card/content';
import { itemFor, itemPath } from '../../src/app/items';
import { COMMITS_MARKER } from '../../src/dashboard/firmware/notes';
import type { FirmwareRelease } from '../../src/dashboard/firmware';

const route = (path: string) => routeFor(path)!;
const help = (id: string) => HELP_ITEMS.find((i) => i.id === id)!;

const release = (tag: string, notes: string, publishedAt = '2026-10-05T12:00:00Z'): FirmwareRelease => ({
  tag,
  name: tag,
  publishedAt,
  prerelease: false,
  notes,
  assets: [],
});

describe('pageCard', () => {
  it('sets home in the landing claim, its two lines kept', () => {
    const c = pageCard(route('/'));
    expect(c.crumb).toBe('');
    expect(c.titleLines).toEqual([...CLAIM]);
    expect(c.title).toBe(CLAIM.join(' '));
    expect(c.description).toBe(route('/').description);
    expect(c.address).toBe('medius.k4tech.net');
    expect(c.fact).toEqual(['MAKCU', 'firmware']);
    expect(c.colour).toBe(BLUE);
  });

  it('gives the 404 page the home card', () => {
    expect(pageCard(NOT_FOUND)).toEqual(pageCard(route('/')));
  });

  it('crumbs a page by its section, then its sidebar group', () => {
    const c = pageCard(route('/native/commands/lock'));
    expect(c.crumb).toBe('Native API / Commands');
    expect(c.title).toBe('Lock');
    expect(c.description).toBe(route('/native/commands/lock').description);
    expect(c.address).toBe('medius.k4tech.net/native/commands/lock');
    expect(c.titleLines).toBeUndefined();
  });

  it('leaves out a group named as its section', () => {
    expect(pageCard(route('/dashboard/update')).crumb).toBe('Dashboard');
    expect(pageCard(route('/guide/help')).crumb).toBe('Guide');
    expect(pageCard(route('/ai')).crumb).toBe('AI access');
  });

  it('draws every route blue', () => {
    expect(new Set(ROUTES.map((r) => pageCard(r).colour))).toEqual(new Set([BLUE]));
  });
});

describe('helpCard', () => {
  it('asks the question and answers with the first sentence', () => {
    const item = help('flash-stopped');
    const c = helpCard(item);
    expect(c.crumb).toBe('Guide / Help');
    expect(c.title).toBe(item.q);
    expect(c.description).toBe("Each chip's download mode is in ROM, so a flash that stops partway never locks the chip out.");
    expect(c.address).toBe(`medius.k4tech.net/guide/help/${item.id}`);
    expect(c.fact).toEqual(['MAKCU', 'firmware']);
  });

  it('keeps an answer of one sentence whole', () => {
    const item = HELP_ITEMS.find((i) => !/[.!?]\s/.test(i.a))!;
    expect(helpCard(item).description).toBe(item.a);
    expect(helpCard(help('protocol-changes')).description).toBe('Only when a release changes the protocol.');
  });

  it('does not end a sentence inside a version number', () => {
    expect(helpCard({ id: 'x', q: 'Q', a: 'Fixed in v3.4.2 for boxes. Then more.' }).description).toBe('Fixed in v3.4.2 for boxes.');
  });
});

describe('releaseCard', () => {
  const notes = `## Changes\n- Fixed **updates** on boxes without PSRAM\n- Faster \`EP0\` round trips\n- A third line\n\n${COMMITS_MARKER}\n## Commits\n- fw: x (1234567)`;

  it('lists the first two Changes lines as plain text, dated', () => {
    const c = releaseCard(release('v3.4.5', notes));
    expect(c.crumb).toBe('Dashboard / Changelog');
    expect(c.title).toBe('v3.4.5');
    expect(c.list).toEqual(['Fixed updates on boxes without PSRAM', 'Faster EP0 round trips']);
    expect(c.description).toBeUndefined();
    expect(c.fact).toEqual(['5 Oct 2026']);
    expect(c.address).toBe('medius.k4tech.net/dashboard/changelog/v3.4.5');
    expect(c.colour).toBe(BLUE);
  });

  it('dates by the day in UTC', () => {
    expect(releaseCard(release('v1.0.0', notes, '2026-01-31T23:30:00Z')).fact).toEqual(['31 Jan 2026']);
  });

  it('lists nothing for a release with no Changes list', () => {
    const c = releaseCard(release('v2.2.0', '**Firmware**\n- fw: older commit list (1234567)'));
    expect(c.list).toBeUndefined();
    expect(c.description).toBeUndefined();
  });

  it('turns a bare link into its text', () => {
    const c = releaseCard(release('v3.0.0', '## Changes\n- See https://example.com/x.'));
    expect(c.list).toEqual(['See https://example.com/x.']);
  });
});

describe('deviceCard', () => {
  const row = (over: object) => ({ name: 'Glorious Model O3', kind: 'mouse' as const, verdict: 'works' as const, id: 'device-glorious-model-o3', ...over });

  it('puts a note first', () => {
    const c = deviceCard(row({ verdict: 'partial', note: "Works wired at 1000 Hz only; wireless doesn't", reported: 'v3.0.1' }));
    expect(c.description).toBe("Works wired at 1000 Hz only; wireless doesn't. Mouse, reported on v3.0.1.");
    expect(c.crumb).toBe('Guide / Devices');
    expect(c.title).toBe('Glorious Model O3');
    expect(c.fact).toEqual(['Partial']);
    expect(c.colour).toBe('#f59e0b');
    expect(c.address).toBe('medius.k4tech.net/guide/compatibility/glorious-model-o3');
  });

  it('says a supported device without a note works through the box', () => {
    const c = deviceCard(row({ name: 'Logitech G502 X LIGHTSPEED', id: 'device-logitech-g502-x-lightspeed', reported: 'v2.2.0' }));
    expect(c.description).toBe('Mouse. Reported working through the box on v2.2.0.');
    expect(c.fact).toEqual(['Supported']);
    expect(c.colour).toBe('#10b981');
  });

  it('says only when another verdict was reported', () => {
    const c = deviceCard(row({ kind: 'keyboard', verdict: 'doesnt', reported: 'v3.0.1' }));
    expect(c.description).toBe('Keyboard. Reported on v3.0.1.');
    expect(c.fact).toEqual(['Unsupported']);
    expect(c.colour).toBe('#dc2626');
  });

  it('names no kind for a device that is neither mouse nor keyboard', () => {
    expect(deviceCard(row({ name: 'Logitech POWERPLAY', kind: 'other', reported: 'v2.2.0' })).description).toBe(
      'Reported working through the box on v2.2.0.',
    );
    expect(deviceCard(row({ kind: 'other', verdict: 'partial', note: 'Charging only', reported: 'v3.0.1' })).description).toBe(
      'Charging only. Reported on v3.0.1.',
    );
  });

  it('counts the boxes for a device known from the stats alone', () => {
    expect(deviceCard(row({ boxes: 4 })).description).toBe('Mouse. Seen on 4 boxes in the usage stats.');
  });

  it('does not stop a note twice', () => {
    expect(deviceCard(row({ note: 'Needs imperfect clone.', reported: 'v3.4.4' })).description).toBe(
      'Needs imperfect clone. Mouse, reported on v3.4.4.',
    );
  });
});

describe('cardHash and cardUrl', () => {
  it('is eight hex digits that change with the content', () => {
    const a = pageCard(route('/native/commands/lock'));
    expect(cardHash(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(cardHash({ ...a, title: 'Lock!' })).not.toBe(cardHash(a));
    expect(cardHash({ ...a, colour: '#10b981' })).not.toBe(cardHash(a));
    expect(cardHash({ ...a })).toBe(cardHash(a));
  });

  it('addresses the card by its page', () => {
    const c = pageCard(route('/native/commands/lock'));
    expect(cardUrl('/native/commands/lock', c)).toBe(`https://medius.k4tech.net/og/native/commands/lock.png?v=${cardHash(c)}`);
    expect(cardUrl('/', pageCard(route('/')))).toMatch(/^https:\/\/medius\.k4tech\.net\/og\/index\.png\?v=[0-9a-f]{8}$/);
  });
});

describe('itemFor', () => {
  it('names a Help answer', () => {
    expect(itemFor('/guide/help/bsod')).toEqual({ kind: 'help', parent: '/guide/help', id: 'bsod', target: 'bsod' });
  });

  it('names a release', () => {
    expect(itemFor('/dashboard/changelog/v3.4.5')).toEqual({
      kind: 'release',
      parent: '/dashboard/changelog',
      id: 'v3.4.5',
      target: 'v3.4.5',
    });
  });

  it('names a device by its row id', () => {
    expect(itemFor('/guide/compatibility/logitech-g502-x-lightspeed')).toEqual({
      kind: 'device',
      parent: '/guide/compatibility',
      id: 'logitech-g502-x-lightspeed',
      target: 'device-logitech-g502-x-lightspeed',
    });
  });

  it('reads past a trailing slash', () => {
    expect(itemFor('/guide/help/bsod/')?.id).toBe('bsod');
  });

  it('is null for the parent page and other shapes', () => {
    for (const p of ['/guide/help', '/guide/help/', '/guide/help/a/b', '/native/commands/lock', '/guide/helpx/bsod', '/guide/help/%20', '/guide/help/.x'])
      expect(itemFor(p)).toBeNull();
  });

  it('builds the address it reads', () => {
    expect(itemPath('help', 'bsod')).toBe('/guide/help/bsod');
    expect(itemPath('release', 'v3.4.5')).toBe('/dashboard/changelog/v3.4.5');
    expect(itemPath('device', 'glorious-model-o3')).toBe('/guide/compatibility/glorious-model-o3');
    expect(itemFor(itemPath('device', 'glorious-model-o3'))?.kind).toBe('device');
  });
});
