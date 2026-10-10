// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { cardFor, itemPage, type ItemSources } from '../../server/items';
import { planRedirect } from '../../server/routing';
import { BLUE, cardUrl, helpCard, pageCard, releaseCard } from '../../src/app/card/content';
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

const sources = (over: Partial<ItemSources> = {}): ItemSources => ({
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

  it('reads the list once for a release it already has', async () => {
    const s = sources();
    expect((await itemPage('/dashboard/changelog/v3.4.4', read, s, fill))!.status).toBe(200);
    expect(s.refresh).not.toHaveBeenCalled();
  });

  it('answers an item it knows nothing of with the 404 page', async () => {
    for (const path of ['/guide/help/nope', '/dashboard/changelog/v9.9.9', '/guide/compatibility/nope']) {
      const page = (await itemPage(path, read, sources(), fill))!;
      expect(page.status).toBe(404);
      expect(page.html).toContain('/404 page');
    }
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
