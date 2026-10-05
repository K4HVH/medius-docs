import { defineConfig, loadEnv, type Plugin } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { handleFirmwareApi } from './server/firmware';
import { MAX_BODY, handleStatsApi } from './server/stats';
import { agentDocsDev } from './server/agentDevMiddleware';

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
    plugins: [firmwareApi(), statsApi(), agentDocs(), devtools(), solidPlugin()],
    root: 'src',
    publicDir: '../public',
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
      outDir: '../dist',
      emptyOutDir: true,
    },
  };
});
