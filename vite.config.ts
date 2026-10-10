import { defineConfig, loadEnv, type Plugin } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { handleFirmwareApi } from './server/firmware';
import { MAX_BODY, handleStatsApi } from './server/stats';
import { agentDocsDev } from './server/agentDevMiddleware';
import { handleHomeApi } from './server/home';
import { serveIndex } from './server/searchIndex';
import { handleOg } from './server/og';
import { cardFor } from './server/items';
import type { SearchIndex } from './src/app/search/types';

// Serve the firmware proxy under the dev server, mirroring serve.ts in prod.
function firmwareApi(): Plugin {
  return {
    name: 'firmware-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/firmware')) return next();
        const request = new Request(`http://localhost${req.url}`, { method: req.method });
        handleFirmwareApi(request)
          .then(async (response) => {
            if (!response) return next();
            res.statusCode = response.status;
            response.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(Buffer.from(await response.arrayBuffer()));
          })
          .catch(() => next());
      });
    },
  };
}

// The landing page's figures under the dev server, mirroring serve.ts.
function homeApi(): Plugin {
  return {
    name: 'home-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/home') return next();
        handleHomeApi(new Request(`http://localhost${req.url}`, { method: req.method }))
          .then(async (response) => {
            if (!response) return next();
            res.statusCode = response.status;
            response.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(Buffer.from(await response.arrayBuffer()));
          })
          .catch(() => next());
      });
    },
  };
}

// Link cards under the dev server, drawn by the code serve.ts runs. An item's address needs no help here:
// with no snapshot to answer it from, the app draws its parent at the item.
function linkCards(): Plugin {
  return {
    name: 'link-cards',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/og/')) return next();
        handleOg(new Request(`http://localhost${req.url}`, { method: req.method }), cardFor)
          .then(async (response) => {
            if (!response) return next();
            res.statusCode = response.status;
            response.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(Buffer.from(await response.arrayBuffer()));
          })
          .catch(() => next());
      });
    },
  };
}

// The stats routes under the dev server, on a database in data/ beside the checkout.
function statsApi(): Plugin {
  return {
    name: 'stats-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !(req.url === '/api/stats' || req.url.startsWith('/api/stats/'))) return next();
        // Past the cap the rest is dropped; what was kept is still over it, so the handler refuses it.
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          if (size <= MAX_BODY) chunks.push(c);
          size += c.length;
        });
        req.on('end', () => {
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const body = req.method === 'POST' ? Buffer.concat(chunks) : undefined;
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
            method: req.method,
            headers,
            body,
          });
          handleStatsApi(request, req.socket.remoteAddress)
            .then(async (response) => {
              if (!response) return next();
              res.statusCode = response.status;
              response.headers.forEach((v, k) => res.setHeader(k, v));
              res.end(Buffer.from(await response.arrayBuffer()));
            })
            .catch(() => next());
        });
      });
    },
  };
}

// The search index under the dev server, built from the dev server itself (as the site build builds it)
// on the first request, and again 2 s after a change under src/, the last good one served meanwhile.
function searchIndex(): Plugin {
  return {
    name: 'search-index',
    configureServer(server) {
      let current: SearchIndex | null = null;
      let building: Promise<void> | null = null;
      // A change while a build runs: the build after it reads the change.
      let again = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const build = (): Promise<void> => {
        if (building) return building;
        const started = Date.now();
        building = (async () => {
          const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '');
          if (!base) return;
          const { buildSearchIndex } = await import('./scripts/lib/searchBuild');
          current = (await buildSearchIndex(base)).index;
          server.config.logger.info(`[search] index of ${current.entries.length} entries in ${Date.now() - started} ms`);
        })()
          .catch((e) => server.config.logger.warn(`[search] ${(e as Error).message}`))
          .finally(() => {
            building = null;
            if (again) {
              again = false;
              void build();
            }
          });
        return building;
      };
      server.watcher.on('change', (file) => {
        if (!current || !file.replace(/\\/g, '/').includes('/src/')) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (building) again = true;
          else void build();
        }, 2000);
      });
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/search-index.json') return next();
        void (async () => {
          if (!current) await build();
          if (!current) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'The search index did not build; the dev server log says why.' }));
            return;
          }
          const headers = new Headers();
          if (typeof req.headers['if-none-match'] === 'string') headers.set('if-none-match', req.headers['if-none-match']);
          const response = await serveIndex(new Request(`http://localhost${req.url}`, { headers }), current, undefined, { cache: 'no-store' });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        })();
      });
    },
  };
}

// Serve the agent surface (.md twins, content negotiation, llms.txt/sitemap/
// robots/agent-index, /mcp) under the dev and preview servers, from dist/.
function agentDocs(): Plugin {
  return {
    name: 'agent-docs',
    configureServer(server) {
      server.middlewares.use(agentDocsDev);
    },
    configurePreviewServer(server) {
      server.middlewares.use(agentDocsDev);
    },
  };
}

export default defineConfig(({ mode }) => {
  // The dev server runs under node, which does not auto-load .env. Load it from
  // the project root so the firmware proxy sees GITHUB_TOKEN / GITHUB_REPO.
  const env = loadEnv(mode, process.cwd(), '');
  process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN;
  process.env.GITHUB_REPO = process.env.GITHUB_REPO ?? env.GITHUB_REPO;

  return {
    plugins: [firmwareApi(), statsApi(), homeApi(), linkCards(), searchIndex(), agentDocs(), devtools(), solidPlugin()],
    root: 'src',
    publicDir: '../public',
    // The devtools plugin adds this import itself, past the dependency scan, and a dev server with a cold
    // cache would otherwise reload the page to bundle it.
    optimizeDeps: { include: ['solid-devtools/setup'] },
    server: {
      port: 3000,
      // Vite's own list, and the stats database: /@fs/ serves any file in the checkout otherwise.
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/stats.db*'] },
    },
    build: {
      target: 'esnext',
      outDir: '../dist',
      emptyOutDir: true,
    },
  };
});
