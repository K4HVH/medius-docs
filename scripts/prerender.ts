import { chromium } from 'playwright';
import sirv from 'sirv';
import { createServer, type Server } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocRoutes } from './lib/routes';
import { htmlToMarkdown } from './lib/htmlToMarkdown';
import { assemblePageMarkdown } from './lib/pageDoc';
import { buildArtifacts, type PageRecord } from './lib/artifacts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = (process.env.SITE_ORIGIN || 'https://medius.k4tech.net').replace(/\/+$/, '');
const PORT = Number(process.env.PRERENDER_PORT || 4271);
const CONTENT = '.docs-page';

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function startStaticServer(dir: string, port: number): Promise<Server> {
  const serve = sirv(dir, { single: true, dev: false, etag: false });
  const server = createServer((req, res) =>
    serve(req, res, () => {
      res.statusCode = 404;
      res.end('not found');
    }),
  );
  await new Promise<void>((resolve) => server.listen(port, resolve));
  return server;
}

interface Captured {
  title: string;
  description: string;
  contentHtml: string;
  outerHtml: string;
}

async function main(): Promise<void> {
  const appSrc = readFileSync(join(ROOT, 'src/app/App.tsx'), 'utf8');
  const routes = getDocRoutes(appSrc);
  if (routes.length === 0) throw new Error('No doc routes parsed from App.tsx');

  const server = await startStaticServer(DIST, PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const records: PageRecord[] = [];

  try {
    for (const route of routes) {
      const url = `http://localhost:${PORT}${route.path}`;
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector(`${CONTENT} [data-search-target]`, { timeout: 20000 });
      // Let the route's post-render effects (incl. Prism) settle a couple of frames.
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );

      const cap = (await page.evaluate(
        ({ sel, mdPath }: { sel: string; mdPath: string }) => {
          // Advertise the Markdown twin to agents that scrape HTML without content negotiation.
          if (!document.head.querySelector('link[rel="alternate"][type="text/markdown"]')) {
            const link = document.createElement('link');
            link.setAttribute('rel', 'alternate');
            link.setAttribute('type', 'text/markdown');
            link.setAttribute('href', mdPath);
            document.head.appendChild(link);
          }
          const content = document.querySelector(sel);
          const h = content?.querySelector('.card__header h3');
          const sub = content?.querySelector('.card__header small');
          const firstP = content?.querySelector('p');
          const title = (h?.textContent || '').trim();
          const description = ((sub?.textContent || firstP?.textContent || '').trim()).slice(0, 200);
          return {
            title,
            description,
            contentHtml: content ? content.innerHTML : '',
            outerHtml: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
          };
        },
        { sel: CONTENT, mdPath: route.path + '.md' },
      )) as Captured;

      if (!cap.contentHtml.trim()) throw new Error(`Empty ${CONTENT} content for ${route.path}`);
      if (!cap.title) throw new Error(`No page title (card header) for ${route.path}`);

      const sourceUrl = SITE + route.path;
      const contentMd = htmlToMarkdown(cap.contentHtml);
      const markdown = assemblePageMarkdown(contentMd, sourceUrl);
      if (!/^# /m.test(markdown)) {
        process.stderr.write(`  [warn] ${route.path}: extracted markdown has no H1 heading\n`);
      }

      writeFile(join(DIST, route.path + '.md'), markdown);
      writeFile(join(DIST, route.path + '.html'), cap.outerHtml);

      records.push({
        path: route.path,
        section: route.section,
        title: cap.title,
        description: cap.description,
        markdown,
      });
      process.stdout.write(`  ${route.path} -> ${route.path}.html + ${route.path}.md\n`);
    }

    // Prerender the Home landing page into dist/index.html so the root URL (the
    // most-crawled one, and the SPA fallback) is real content, not an empty shell.
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 20000 });
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
    const homeHtml = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
    if (!/<h1[\s>]/i.test(homeHtml)) throw new Error('Home page did not render (no <h1>)');
    writeFile(join(DIST, 'index.html'), homeHtml);
    process.stdout.write('  / -> index.html (Home prerendered)\n');
  } finally {
    await browser.close();
    server.close();
  }

  buildArtifacts({ dist: DIST, site: SITE, pages: records });
  process.stdout.write(`prerendered ${records.length} routes + agent artifacts into ${DIST}\n`);
}

main().catch((err) => {
  console.error('[prerender] failed:', err);
  process.exit(1);
});
