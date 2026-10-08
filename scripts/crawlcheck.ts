// Crawl the built site through serve.ts the way a search engine would: every page, the redirects, a
// junk path, the live pages. Run after `bun run build:full`. Exits non-zero on any failure.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentTitle, routeFor, NOT_FOUND } from '../src/app/routes';
import { SITE } from '../src/app/site';

const PORT = Number(process.env.CRAWL_PORT || 4390);
const BASE = `http://localhost:${PORT}`;
const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const get = (path: string, accept = 'text/html') => fetch(BASE + path, { redirect: 'manual', headers: { accept } });

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
  if (canonical !== want) fail(`${path}: canonical ${canonical}, want ${want}`);
  const ld = html.match(/<script id="ld-json" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (!ld) fail(`${path}: no JSON-LD`);
  else {
    try {
      JSON.parse(ld);
    } catch {
      fail(`${path}: JSON-LD does not parse`);
    }
  }
  if (/Browser not supported|Page not secure/.test(html)) fail(`${path}: unsupported-browser card in the snapshot`);
  if (path !== '/' && !html.includes('class="site-footer"')) fail(`${path}: no footer`);
}

async function main(): Promise<void> {
  const routes = JSON.parse(readFileSync(join('dist', 'routes.json'), 'utf8')) as string[];
  const server = spawn('bun', ['serve.ts'], { env: { ...process.env, PORT: String(PORT), PUBLIC_DIR: './dist' }, stdio: 'ignore' });
  try {
    await waitUp();
    const titles = new Map<string, string>();
    for (const path of routes) await checkPage(path, titles);

    for (const [from, to] of [['/native/', '/native'], ['/Native', '/native'], ['/native.html', '/native'], ['/index.html', '/'], ['/Dashboard/Setup/', '/dashboard/setup']]) {
      const res = await get(from);
      if (res.status !== 301 || res.headers.get('location') !== to) fail(`${from}: ${res.status} -> ${res.headers.get('location')}, want 301 -> ${to}`);
    }

    const junk = await get('/zzz-no-such-page');
    const junkHtml = await junk.text();
    if (junk.status !== 404) fail(`/zzz-no-such-page: status ${junk.status}, want 404`);
    if (!junkHtml.includes(`<title>${documentTitle(NOT_FOUND)}</title>`)) fail('404 page: wrong title');
    if (!/<meta name="robots" content="noindex">/.test(junkHtml)) fail('404 page: not noindex');

    const md = await get('/native.md');
    if (md.status !== 200 || !md.headers.get('content-type')?.startsWith('text/markdown')) fail('/native.md: not served as Markdown');

    const sitemap = await (await get('/sitemap.xml')).text();
    for (const p of ['/dashboard/setup', '/dashboard/changelog']) if (!sitemap.includes(`<loc>${SITE}${p}</loc>`)) fail(`sitemap: no ${p}`);

    const changelog = await (await get('/dashboard/changelog')).text();
    if (process.env.GITHUB_TOKEN) {
      if (!/<section id="v\d+\.\d+\.\d+" class="release">/.test(changelog)) fail('/dashboard/changelog: no release in the raw HTML');
      const clmd = await (await get('/dashboard/changelog.md')).text();
      if (!/^## v\d+\.\d+\.\d+$/m.test(clmd)) fail('/dashboard/changelog.md: no release heading');
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
