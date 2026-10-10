// Crawl the built site through serve.ts the way a search engine would: every page, the redirects, a
// junk path, the live pages. Run after `bun run build:full`. Exits non-zero on any failure.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentTitle, routeFor, NOT_FOUND } from '../src/app/routes';
import { SITE } from '../src/app/site';
import { HELP_ITEMS } from '../src/app/data/help';
import { COMPAT } from '../src/app/data/compatibility';
import { withIds } from '../src/app/data/compatMerge';
import { cardUrl, deviceCard, helpCard, pageCard, type CardContent } from '../src/app/card/content';
import { itemFor } from '../src/app/items';

const PORT = Number(process.env.CRAWL_PORT || 4390);
const HERO = 'Replacement firmware for the MAKCU box.';
const BASE = `http://localhost:${PORT}`;
const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const get = (path: string, accept = 'text/html') => fetch(BASE + path, { redirect: 'manual', headers: { accept } });

const meta = (html: string, attr: string, key: string) => {
  const content = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
  return content === undefined ? null : decode(content);
};

// Every card a page names, fetched once each after the pages.
const images = new Map<string, string>();

// The head an unfurler reads: the card, its size and alt, and the stripe colour in theme-color with the
// script that turns the address bar black right after it.
function checkCard(path: string, html: string, card: CardContent, cardPath = path): void {
  const want = cardUrl(cardPath, card);
  for (const [attr, key] of [['property', 'og:image'], ['name', 'twitter:image']]) {
    const got = meta(html, attr, key);
    if (got !== want) fail(`${path}: ${key} ${got}, want ${want}`);
  }
  if (meta(html, 'property', 'og:image:width') !== '1200' || meta(html, 'property', 'og:image:height') !== '630') fail(`${path}: card size not 1200 x 630`);
  if (meta(html, 'property', 'og:image:alt') !== card.title) fail(`${path}: og:image:alt is not the card's title`);
  const theme = `<meta name="theme-color" content="${card.colour}" data-embed="${card.colour}">`;
  const black = `<script>document.querySelector('meta[name="theme-color"]').content = '#000000';</script>`;
  const at = html.indexOf(theme);
  if (at < 0 || html.slice(at + theme.length).trimStart().indexOf(black) !== 0)
    fail(`${path}: theme-color is not ${card.colour} ahead of the script that blacks it out`);
  images.set(want, path);
}

async function checkImage(url: string, page: string): Promise<void> {
  const res = await get(url.slice(SITE.length));
  if (res.status !== 200) return fail(`${page}: card ${url} answers ${res.status}`);
  if (res.headers.get('content-type') !== 'image/png') fail(`${page}: card is ${res.headers.get('content-type')}`);
  if (!res.headers.get('cache-control')?.includes('immutable')) fail(`${page}: card at its hash is not immutable`);
  const png = new DataView(await res.arrayBuffer());
  if (png.getUint32(16) !== 1200 || png.getUint32(20) !== 630) fail(`${page}: card is ${png.getUint32(16)} x ${png.getUint32(20)}`);
}

// An item's address: its parent page, under the item's head, out of search.
async function checkItem(path: string, card: CardContent, parent: string): Promise<void> {
  const res = await get(path);
  if (res.status !== 200) return fail(`${path}: status ${res.status}`);
  const html = await res.text();
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const want = `${card.title} · ${routeFor(parent)!.nav} · Medius`;
  if (title !== want) fail(`${path}: title "${title}", want "${want}"`);
  if (meta(html, 'name', 'robots') !== 'noindex') fail(`${path}: not noindex`);
  if (html.includes('rel="canonical"')) fail(`${path}: has a canonical tag`);
  if (meta(html, 'property', 'og:url') !== SITE + path) fail(`${path}: og:url ${meta(html, 'property', 'og:url')}`);
  if (meta(html, 'name', 'medius-item') !== path) fail(`${path}: no medius-item`);
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim();
  if (h1 !== routeFor(parent)!.title) fail(`${path}: page "${h1}", want its parent ${parent}`);
  checkCard(path, html, card);
}

async function waitUp(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(BASE + '/robots.txt');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('serve.ts did not start');
}

async function checkPage(path: string, titles: Map<string, string>): Promise<void> {
  const res = await get(path);
  if (res.status !== 200) return fail(`${path}: status ${res.status}`);
  const html = await res.text();
  const route = routeFor(path)!;
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  if (title !== documentTitle(route)) fail(`${path}: title "${title}", want "${documentTitle(route)}"`);
  const other = titles.get(title);
  if (other) fail(`${path}: title shared with ${other}`);
  titles.set(title, path);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const want = SITE + (path === '/' ? '/' : path);
  if (route.index && canonical !== want) fail(`${path}: canonical ${canonical}, want ${want}`);
  if (!route.index && !/<meta name="robots" content="noindex">/.test(html)) fail(`${path}: noindex page without robots noindex`);
  const ld = html.match(/<script id="ld-json" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (!ld) fail(`${path}: no JSON-LD`);
  else {
    try {
      const graph = (JSON.parse(ld)['@graph'] ?? []) as { '@type': string; mainEntity?: unknown[] }[];
      const asked = graph.find((n) => n['@type'] === 'FAQPage')?.mainEntity?.length ?? 0;
      const want = path === '/guide/help' ? HELP_ITEMS.length : 0;
      if (asked !== want) fail(`${path}: FAQPage holds ${asked} questions, want ${want}`);
    } catch {
      fail(`${path}: JSON-LD does not parse`);
    }
  }
  if (/Browser not supported|Page not secure/.test(html)) fail(`${path}: unsupported-browser card in the snapshot`);
  if (!html.includes('class="site-footer"')) fail(`${path}: no footer`);
  checkCard(path, html, pageCard(route));
  if (/class="[^"]*\brv-wait\b/.test(html)) fail(`${path}: a block held back for a scroll reveal in the snapshot`);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
  const heading = path === '/' ? HERO : route.title;
  if (h1s.length !== 1) fail(`${path}: ${h1s.length} h1 elements, want 1`);
  else if (h1s[0] !== heading) fail(`${path}: h1 "${h1s[0]}", want "${heading}"`);
  if (path === '/') {
    const boxes = html.match(/data-fill="vital-boxes"[^>]*>([^<]*)</)?.[1];
    if (boxes === undefined) fail('/: no vital-boxes cell');
    else if (boxes && !/^[\d,]+$/.test(boxes)) fail(`/: vital-boxes reads "${boxes}"`);
    if (/Loading/.test(html)) fail('/: "Loading" in the raw HTML');
  }
}

async function main(): Promise<void> {
  const routes = JSON.parse(readFileSync(join('dist', 'routes.json'), 'utf8')) as string[];
  const server = spawn('bun', ['serve.ts'], { env: { ...process.env, PORT: String(PORT), PUBLIC_DIR: './dist' }, stdio: 'ignore' });
  try {
    await waitUp();
    const titles = new Map<string, string>();
    for (const path of routes) await checkPage(path, titles);

    for (const [from, to] of [['/native/', '/native'], ['/Native', '/native'], ['/native.html', '/native'], ['/NATIVE.HTML', '/native'], ['/index.html', '/'], ['/Dashboard/Setup/', '/dashboard/setup']]) {
      const res = await get(from);
      if (res.status !== 301 || res.headers.get('location') !== to) fail(`${from}: ${res.status} -> ${res.headers.get('location')}, want 301 -> ${to}`);
    }

    const junk = await get('/zzz-no-such-page');
    const junkHtml = await junk.text();
    if (junk.status !== 404) fail(`/zzz-no-such-page: status ${junk.status}, want 404`);
    if (!junkHtml.includes(`<title>${documentTitle(NOT_FOUND)}</title>`)) fail('404 page: wrong title');
    if (!/<meta name="robots" content="noindex">/.test(junkHtml)) fail('404 page: not noindex');
    checkCard('/zzz-no-such-page', junkHtml, pageCard(routeFor('/')!), '/');
    if (!junkHtml.includes('data-not-found')) fail('404 page: not marked for the app');

    const bsod = HELP_ITEMS.find((i) => i.id === 'bsod')!;
    await checkItem('/guide/help/bsod', helpCard(bsod), '/guide/help');
    const device = withIds(COMPAT).find((d) => d.verdict === 'partial')!;
    await checkItem(`/guide/compatibility/${device.id.replace(/^device-/, '')}`, deviceCard(device), '/guide/compatibility');
    for (const lost of ['/guide/help/nope', '/guide/compatibility/nope']) {
      const res = await get(lost);
      if (res.status !== 404) fail(`${lost}: status ${res.status}, want 404`);
      else if (!(await res.text()).includes(`<title>${documentTitle(NOT_FOUND)}</title>`)) fail(`${lost}: not the 404 page`);
    }
    for (const [from, to] of [['/Guide/Help/BSOD/', '/guide/help/bsod'], ['/guide/help/bsod/', '/guide/help/bsod']]) {
      const res = await get(from);
      if (res.status !== 301 || res.headers.get('location') !== to) fail(`${from}: ${res.status} -> ${res.headers.get('location')}, want 301 -> ${to}`);
    }
    if ((await get('/og/guide/help/nope.png')).status !== 404) fail('/og/guide/help/nope.png: not 404');

    for (const [url, page] of images) await checkImage(url, page);

    const search = JSON.parse(readFileSync(join('dist', 'search-index.json'), 'utf8')) as { entries: { path: string }[] };
    for (const e of search.entries) if (itemFor(e.path.split('#')[0])) fail(`search index: holds the item address ${e.path}`);

    for (const odd of ['/404', '//native', '/%6Eative', '/native/commands']) {
      const res = await get(odd);
      if (res.status !== 404) fail(`${odd}: status ${res.status}, want 404`);
    }

    const md = await get('/native.md');
    if (md.status !== 200 || !md.headers.get('content-type')?.startsWith('text/markdown')) fail('/native.md: not served as Markdown');
    if (!md.headers.get('link')?.includes(`<${SITE}/native>; rel="canonical"`)) fail('/native.md: no canonical Link header');
    if ((await get('/llms.txt')).headers.get('x-robots-tag') !== 'noindex') fail('/llms.txt: not noindex');
    const home = await fetch(BASE + '/', { method: 'HEAD' });
    if (!home.headers.get('content-type')?.startsWith('text/html')) fail('HEAD /: no text/html content-type');

    const sitemap = await (await get('/sitemap.xml')).text();
    for (const p of ['/dashboard/setup', '/dashboard/changelog']) if (!sitemap.includes(`<loc>${SITE}${p}</loc>`)) fail(`sitemap: no ${p}`);
    for (const p of routes.filter((r) => !routeFor(r)!.index)) if (sitemap.includes(`<loc>${SITE}${p}</loc>`)) fail(`sitemap: lists noindex ${p}`);
    for (const p of ['/dashboard/changelog', '/dashboard/stats']) if (sitemap.includes(`<loc>${SITE}${p}</loc><lastmod>`)) fail(`sitemap: dates live page ${p}`);
    for (const loc of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) if (itemFor(loc[1].slice(SITE.length))) fail(`sitemap: lists the item address ${loc[1]}`);

    const changelog = await (await get('/dashboard/changelog')).text();
    if (process.env.GITHUB_TOKEN) {
      if (!/<section id="v\d+\.\d+\.\d+" class="rel">/.test(changelog)) fail('/dashboard/changelog: no release in the raw HTML');
      const clmd = await (await get('/dashboard/changelog.md')).text();
      if (!/^## v\d+\.\d+\.\d+$/m.test(clmd)) fail('/dashboard/changelog.md: no release heading');
      const tag = changelog.match(/<section id="(v\d+\.\d+\.\d+)" class="rel">/)?.[1];
      if (tag) {
        const res = await get(`/dashboard/changelog/${tag}`);
        const html = await res.text();
        if (res.status !== 200 || meta(html, 'name', 'medius-item') !== `/dashboard/changelog/${tag}`) fail(`/dashboard/changelog/${tag}: status ${res.status}, no item head`);
        const image = meta(html, 'property', 'og:image');
        if (image) await checkImage(image, `/dashboard/changelog/${tag}`);
        else fail(`/dashboard/changelog/${tag}: no og:image`);
      }
      if ((await get('/dashboard/changelog/v0.0.0')).status !== 404) fail('/dashboard/changelog/v0.0.0: not 404');
    } else {
      console.warn('GITHUB_TOKEN unset: the changelog fill was not checked');
    }

    console.log(`crawlcheck: ${routes.length} pages, ${failures.length} failures`);
  } finally {
    server.kill();
  }
  for (const f of failures) console.error(`  FAIL ${f}`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
