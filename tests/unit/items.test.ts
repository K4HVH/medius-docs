// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { cardFor, itemPage, type ItemSources } from '../../server/items';
import { placeFor } from '../../server/places';
import type { SearchIndex } from '../../src/app/search/types';
import { planRedirect } from '../../server/routing';
import { BLUE, cardUrl, helpCard, pageCard, placeCard, releaseCard } from '../../src/app/card/content';
import { HELP_ITEMS } from '../../src/app/data/help';
import { routeFor } from '../../src/app/routes';
import { SITE } from '../../src/app/site';
import type { FirmwareRelease } from '../../src/dashboard/firmware';
import type { StatsSummary } from '../../server/stats/types';

const snapshot = (path: string) =>
  '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
  '<meta name="theme-color" content="#0080ff" data-embed="#0080ff"><script>theme()</script>' +
  `<meta name="description" content="${path} description"><link rel="canonical" href="${SITE}${path}">` +
  `<meta property="og:type" content="article"><meta property="og:url" content="${SITE}${path}">` +
  `<meta property="og:title" content="${path} title"><meta property="og:description" content="${path} description">` +
  `<meta property="og:image" content="${SITE}/og${path}.png?v=00000000"><meta property="og:image:alt" content="${path}">` +
  `<meta name="twitter:title" content="${path} title"><meta name="twitter:description" content="${path} description">` +
  `<meta name="twitter:image" content="${SITE}/og${path}.png?v=00000000"><meta name="twitter:image:alt" content="${path}">` +
  `<script id="ld-json" type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Thing"},{"@type":"FAQPage","url":"${SITE}${path}"}]}</script>` +
  `<title>${path} title</title></head><body><main>${path} page</main></body></html>`;

const read = async (path: string) => (path === '/nowhere' ? null : snapshot(path));
const fill = async (_path: string, html: string) => html.replace('page</main>', 'page filled</main>');

const release = (tag: string): FirmwareRelease => ({
  tag,
  name: tag,
  publishedAt: '2026-10-05T12:00:00Z',
  prerelease: false,
  notes: '## Changes\n- Fixed updates without PSRAM\n- Faster round trips',
  assets: [],
});

const stats = (top: StatsSummary['devices']['top']) => ({ devices: { unique: top.length, byKind: [], top } }) as unknown as StatsSummary;

// The places a build's search index holds: a section, a marked block opening on a table, a tab with no
// text, Help's answer and topic, and a Devices section.
const INDEX: SearchIndex = {
  version: 1,
  built: 'now',
  entries: [
    { path: '/native/transport', title: 'Transport', kind: 'page', section: 'Native API', crumb: 'Protocol', text: '' },
    { path: '/native/transport#usb-identity', title: 'USB identity', kind: 'section', section: 'Native API', crumb: 'Protocol / Transport', text: 'A WCH CH343 does the USB-to-serial conversion. Match its VID and PID to find the box.' },
    { path: '/native/transport#framing', title: 'Framing', kind: 'section', section: 'Native API', crumb: 'Protocol / Transport', caption: 'One frame per command', text: 'Every frame opens with SOF.' },
    { path: '/native/commands/lock#scale', title: 'SCALE', kind: 'anchor', section: 'Native API', crumb: 'Commands / Lock', text: 'Name · Value · Effect\nmin · -255 · 2.55x, reversed' },
    { path: '/dashboard#options', title: 'Options', kind: 'section', section: 'Dashboard', crumb: 'Device', text: '' },
    { path: '/dashboard#box-name', title: 'Box name', kind: 'panel', section: 'Dashboard', crumb: 'Device / Options', text: 'Up to 32 letters, numbers and symbols.\nName' },
    { path: '/dashboard#bearing', title: 'Bearing', kind: 'panel', section: 'Dashboard', crumb: 'Device / Options', text: 'The direction of the last injected motion, kept for the window.' },
    { path: '/dashboard#your-box', title: 'Your box', kind: 'panel', section: 'Dashboard', crumb: 'Device / Overview', text: 'Identify\nDisconnect' },
    { path: '/guide/help#bsod', title: 'My PC blue-screens', kind: 'anchor', section: 'Guide', crumb: 'Help', text: 'Placeholder.' },
    { path: '/guide/help#q-windows', title: 'Windows', kind: 'section', section: 'Guide', crumb: 'Help', text: '' },
    { path: '/guide/compatibility#limits', title: 'Limits', kind: 'section', section: 'Guide', crumb: 'Devices', text: 'Limit · Value · Note' },
    { path: '/native/injection#long', title: 'Long', kind: 'section', section: 'Native API', crumb: 'Protocol / Injection', text: `${'word '.repeat(60)}end.` },
  ],
};

const sources = (over: Partial<ItemSources> = {}): ItemSources => ({
  index: () => INDEX,
  releases: async () => [release('v3.4.4')],
  refresh: vi.fn(async () => [release('v3.4.5'), release('v3.4.4')]),
  stats: async () => stats([{ vid: 0x1234, pid: 0x5678, kind: 2, product: 'Stats Only Mouse', boxes: 3 }]),
  ...over,
});

const tag = (html: string, attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1] ?? null;
const count = (html: string, s: string) => html.split(s).length - 1;

describe('itemPage', () => {
  it("answers a Help answer's address with Help, filled, under the answer's head", async () => {
    const item = HELP_ITEMS.find((i) => i.id === 'bsod')!;
    const page = (await itemPage('/guide/help/bsod', read, sources(), fill))!;
    expect(page.status).toBe(200);
    const { html } = page;
    expect(html).toContain('/guide/help page</main>');
    expect(html).toContain(`<title>${item.q} · Help · Medius</title>`);
    expect(tag(html, 'name', 'description')).toBe(item.a);
    expect(tag(html, 'property', 'og:title')).toBe(`${item.q} · Help · Medius`);
    expect(tag(html, 'property', 'og:url')).toBe(`${SITE}/guide/help/bsod`);
    expect(tag(html, 'property', 'og:image')).toBe(cardUrl('/guide/help/bsod', helpCard(item)));
    expect(tag(html, 'name', 'twitter:image')).toBe(cardUrl('/guide/help/bsod', helpCard(item)));
    expect(tag(html, 'property', 'og:image:alt')).toBe(item.q);
    expect(tag(html, 'name', 'robots')).toBe('noindex');
    expect(tag(html, 'name', 'medius-item')).toBe('/guide/help/bsod');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain(`<meta name="theme-color" content="${BLUE}" data-embed="${BLUE}">`);
    expect(count(html, 'property="og:image"')).toBe(1);
    expect(count(html, '<title>')).toBe(1);
    const ld = JSON.parse(/<script id="ld-json" type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
    expect(ld['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['WebSite', 'Thing']);
  });

  it("colours a device's stripe by its verdict", async () => {
    const { html } = (await itemPage('/guide/compatibility/glorious-model-o3', read, sources(), fill))!;
    expect(html).toContain('/guide/compatibility page filled');
    expect(html).toContain('<meta name="theme-color" content="#f59e0b" data-embed="#f59e0b">');
    expect(html).toContain('<title>Glorious Model O3 · Devices · Medius</title>');
  });

  it('finds a device the stats add', async () => {
    const page = (await itemPage('/guide/compatibility/stats-only-mouse', read, sources(), fill))!;
    expect(page.status).toBe(200);
    expect(tag(page.html, 'name', 'description')).toBe('Mouse. Seen on 3 boxes in the usage stats.');
  });

  it('finds a release published since the list was read, by reading it once more', async () => {
    const s = sources();
    const page = (await itemPage('/dashboard/changelog/v3.4.5', read, s, fill))!;
    expect(page.status).toBe(200);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    expect(tag(page.html, 'property', 'og:image')).toBe(cardUrl('/dashboard/changelog/v3.4.5', releaseCard(release('v3.4.5'))));
    expect(tag(page.html, 'name', 'description')).toBe('Fixed updates without PSRAM. Faster round trips.');
  });

  it("fills a new release's page from the list that found it", async () => {
    const changelog = (path: string) => (path === '/dashboard/changelog' ? '<html><head></head><body><main><div data-fill="changelog"><p>Loading...</p></div></main></body></html>' : null);
    const page = (await itemPage('/dashboard/changelog/v3.4.5', async (p) => changelog(p), sources()))!;
    expect(page.status).toBe(200);
    expect(page.html).toContain('id="v3.4.5"');
  });

  it('reads the list once for a release it already has', async () => {
    const s = sources();
    expect((await itemPage('/dashboard/changelog/v3.4.4', read, s, fill))!.status).toBe(200);
    expect(s.refresh).not.toHaveBeenCalled();
  });

  it('answers an item it knows nothing of with the 404 page', async () => {
    for (const path of ['/guide/help/nope', '/dashboard/changelog/v9.9.9']) {
      const page = (await itemPage(path, read, sources(), fill))!;
      expect(page.status).toBe(404);
      expect(page.html).toContain('/404 page');
    }
  });

  it('sends a device address that names no device to the Devices page, since the stats can drop or rename one', async () => {
    expect(await itemPage('/guide/compatibility/nope', read, sources(), fill)).toEqual({ status: 302, html: '', location: '/guide/compatibility' });
  });

  it('asks again later, at once, while the list is slow to come', async () => {
    const slow = sources({
      releases: () => new Promise((r) => setTimeout(() => r([release('v3.4.4')]), 40)),
      refresh: () => new Promise(() => {}),
      budgetMs: 150,
    });
    const at = Date.now();
    const page = (await itemPage('/dashboard/changelog/v3.4.5', read, slow, fill))!;
    expect(page.status).toBe(503);
    expect(Date.now() - at).toBeLessThan(1_000);
  });

  it('asks again later when reading the list again fails, though an older one is in hand', async () => {
    const page = (await itemPage('/dashboard/changelog/v3.4.5', read, sources({ refresh: async () => null }), fill))!;
    expect(page.status).toBe(503);
  });

  it('asks again later while the list a release is in cannot be read', async () => {
    const page = (await itemPage('/dashboard/changelog/v3.4.5', read, sources({ releases: async () => null, refresh: async () => null }), fill))!;
    expect(page.status).toBe(503);
    expect(page.html).not.toContain('medius-item');
  });

  it('asks again later for a device while the stats cannot be read', async () => {
    const page = (await itemPage('/guide/compatibility/stats-only-mouse', read, sources({ stats: async () => null }), fill))!;
    expect(page.status).toBe(503);
  });

  it('leaves every other path alone', async () => {
    expect(await itemPage('/guide/help', read, sources(), fill)).toBeNull();
    expect(await itemPage('/native/commands/lock', read, sources(), fill)).toBeNull();
  });

  it('escapes what it writes into the head', async () => {
    const s = sources({ releases: async () => [{ ...release('v1.0.0'), notes: '## Changes\n- A "quoted" <b>change</b> & more' }] });
    const { html } = (await itemPage('/dashboard/changelog/v1.0.0', read, s, fill))!;
    expect(tag(html, 'name', 'description')).toBe('A &quot;quoted&quot; &lt;b&gt;change&lt;/b&gt; &amp; more.');
  });
});

describe('itemPage for places', () => {
  it("answers a place's address with its page, filled, under the place's head and card", async () => {
    const page = (await itemPage('/native/transport/usb-identity', read, sources(), fill))!;
    expect(page.status).toBe(200);
    const { html } = page;
    expect(html).toContain('/native/transport page</main>');
    expect(html).toContain('<title>USB identity · Transport · Medius</title>');
    expect(tag(html, 'name', 'description')).toBe('A WCH CH343 does the USB-to-serial conversion.');
    expect(tag(html, 'property', 'og:url')).toBe(`${SITE}/native/transport/usb-identity`);
    const card = placeCard(routeFor('/native/transport')!, 'usb-identity', placeFor(INDEX, '/native/transport', 'usb-identity')!);
    expect(tag(html, 'property', 'og:image')).toBe(cardUrl('/native/transport/usb-identity', card));
    expect(tag(html, 'name', 'robots')).toBe('noindex');
    expect(tag(html, 'name', 'medius-item')).toBe('/native/transport/usb-identity');
    expect(html).not.toContain('rel="canonical"');
  });

  it("says a place's caption first, and its page's description where it has no prose", async () => {
    const say = async (path: string) => tag((await itemPage(path, read, sources(), fill))!.html, 'name', 'description');
    expect(await say('/native/transport/framing')).toBe('One frame per command.');
    expect(await say('/native/commands/lock/scale')).toBe(routeFor('/native/commands/lock')!.description);
    expect(await say('/dashboard/options')).toBe('Box name and Bearing.');
    expect(await say('/dashboard/your-box')).toBe(routeFor('/dashboard')!.description);
    expect(await say('/dashboard/box-name')).toBe('Up to 32 letters, numbers and symbols.');
    expect((await say('/native/injection/long'))!.length).toBeLessThanOrEqual(200);
    expect(await say('/native/injection/long')).toMatch(/word…$/);
  });

  it('names a dashboard tab after the tab and its page', async () => {
    const { html } = (await itemPage('/dashboard/options', read, sources(), fill))!;
    expect(html).toContain('<title>Options · Device · Medius</title>');
  });

  it("keeps a Help answer's card, and answers Help's topics as places", async () => {
    const { html } = (await itemPage('/guide/help/q-windows', read, sources(), fill))!;
    expect(html).toContain('<title>Windows · Help · Medius</title>');
    expect(await cardFor('/guide/help/bsod', sources())).toEqual(helpCard(HELP_ITEMS.find((i) => i.id === 'bsod')!));
  });

  it("answers a Devices section without the stats, before any device of that name", async () => {
    const page = (await itemPage('/guide/compatibility/limits', read, sources({ stats: async () => null }), fill))!;
    expect(page.status).toBe(200);
    expect(page.html).toContain('<title>Limits · Devices · Medius</title>');
  });

  it('answers a Changelog place without reading the releases', async () => {
    const index: SearchIndex = { ...INDEX, entries: [...INDEX.entries, { path: '/dashboard/changelog#older', title: 'Older', kind: 'section', section: 'Dashboard', crumb: 'Changelog', text: 'Releases before v3.' }] };
    const refresh = vi.fn(async () => null);
    const page = (await itemPage('/dashboard/changelog/older', read, sources({ index: () => index, releases: async () => null, refresh }), fill))!;
    expect(page.status).toBe(200);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('answers a place no index holds with the 404 page', async () => {
    for (const path of ['/native/transport/nope', '/dashboard/nope']) {
      const page = (await itemPage(path, read, sources(), fill))!;
      expect(page.status, path).toBe(404);
    }
  });

  it("draws a place's card", async () => {
    expect(await cardFor('/native/transport/usb-identity', sources())).toEqual(
      placeCard(routeFor('/native/transport')!, 'usb-identity', placeFor(INDEX, '/native/transport', 'usb-identity')!),
    );
    expect(await cardFor('/native/transport/nope', sources())).toBeNull();
  });
});

describe('cardFor', () => {
  it('finds the card of a page, the home page and an item', async () => {
    expect(await cardFor('/', sources())).toEqual(pageCard(routeFor('/')!));
    expect(await cardFor('/native/commands/lock', sources())).toEqual(pageCard(routeFor('/native/commands/lock')!));
    expect(await cardFor('/guide/help/bsod', sources())).toEqual(helpCard(HELP_ITEMS.find((i) => i.id === 'bsod')!));
    expect(await cardFor('/dashboard/changelog/v3.4.4', sources())).toEqual(releaseCard(release('v3.4.4')));
  });

  it('has none for an unknown page or item', async () => {
    expect(await cardFor('/nope', sources())).toBeNull();
    expect(await cardFor('/guide/help/nope', sources())).toBeNull();
    expect(await cardFor('/404', sources())).toBeNull();
  });
});

describe('planRedirect for item addresses', () => {
  const routes = new Set(['/guide/help', '/dashboard/changelog', '/guide/compatibility']);

  it('sends odd case and a trailing slash to the address', () => {
    expect(planRedirect('/Guide/Help/BSOD/', '', routes)).toBe('/guide/help/bsod');
    expect(planRedirect('/dashboard/changelog/V3.4.5', '?x=1', routes)).toBe('/dashboard/changelog/v3.4.5?x=1');
    expect(planRedirect('/guide/help/bsod', '', routes)).toBeNull();
  });
});
