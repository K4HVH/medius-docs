import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { handleFirmwareApi } from "./server/firmware";
import { handleStatsApi } from "./server/stats";
import { handleAgentDocs, DOC_CACHE } from "./server/agent";
import { handleMcp } from "./server/mcp";
import { planRedirect } from "./server/routing";

const PORT = parseInt(process.env.PORT || "3000");
const PUBLIC_DIR = process.env.PUBLIC_DIR || "./dist";

// Every page path, written by the prerender. Without it (a plain `vite build`) nothing redirects.
const ROUTES_FILE = join(PUBLIC_DIR, "routes.json");
const ROUTES: ReadonlySet<string> = new Set(
  existsSync(ROUTES_FILE) ? (JSON.parse(readFileSync(ROUTES_FILE, "utf8")) as string[]) : [],
);

function notFound(): Response {
  const page = Bun.file(join(PUBLIC_DIR, "404.html"));
  return new Response(page, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

const ASSET_CACHE = "public, max-age=31536000, immutable";
const ARTIFACTS = /^\/(llms\.txt|llms-full\.txt|sitemap\.xml|robots\.txt|agent-index\.json)$/;

function cacheHeaders(pathname: string): Record<string, string> | undefined {
  if (pathname.startsWith("/assets/")) return { "cache-control": ASSET_CACHE };
  if (ARTIFACTS.test(pathname) || pathname.startsWith("/.well-known/"))
    return { "cache-control": DOC_CACHE };
  return undefined;
}

Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const api = await handleFirmwareApi(req);
    if (api) return api;

    const stats = await handleStatsApi(req, server.requestIP(req)?.address);
    if (stats) return stats;

    const mcp = await handleMcp(req);
    if (mcp) return mcp;

    const url = new URL(req.url);
    const location = planRedirect(url.pathname, url.search, ROUTES);
    if (location) return new Response(null, { status: 301, headers: { location } });

    const agentDocs = await handleAgentDocs(req);
    if (agentDocs) return agentDocs;

    // Pages are served only above, as prerendered routes; a stray .html (404.html itself) is not a page.
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    if (pathname === "/index.html" || !pathname.endsWith(".html")) {
      const file = Bun.file(join(PUBLIC_DIR, pathname));
      if (await file.exists()) return new Response(file, { headers: cacheHeaders(pathname) });
    }

    if (await Bun.file(join(PUBLIC_DIR, "404.html")).exists()) return notFound();
    return new Response("Not Found", { status: 404 });
  },
  error() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
