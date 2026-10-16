import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { handleFirmwareApi } from "./server/firmware";
import { handleComparisonApi } from "./server/comparison";
import { handleDevicesApi } from "./server/devices";
import { handleStatsApi } from "./server/stats";
import { acceptsMarkdown, handleAgentDocs, livePage, DOC_CACHE, LIVE_CACHE, LLMS_LINK, NOINDEX_ARTIFACTS } from "./server/agent";
import { handleHomeApi } from "./server/home";
import { handleMcp } from "./server/mcp";
import { handleSearchIndex } from "./server/searchIndex";
import { planRedirect } from "./server/routing";
import { handleOg } from "./server/og";
import { addressFor } from "./src/app/routes";
import { cardFor, itemPage } from "./server/items";
import { createStock } from "./server/stock";

const stock = createStock();

const PORT = parseInt(process.env.PORT || "3000");
const PUBLIC_DIR = process.env.PUBLIC_DIR || "./dist";

// Every page path, written by the prerender. Without it (a plain `vite build`) nothing redirects.
const ROUTES_FILE = join(PUBLIC_DIR, "routes.json");
const ROUTES: ReadonlySet<string> = new Set(
  existsSync(ROUTES_FILE) ? (JSON.parse(readFileSync(ROUTES_FILE, "utf8")) as string[]) : [],
);

// A prerendered page by its path, "/404" for the 404 page.
async function snapshot(path: string): Promise<string | null> {
  const file = Bun.file(join(PUBLIC_DIR, `${path}.html`));
  return (await file.exists()) ? file.text() : null;
}

function notFound(): Response {
  const page = Bun.file(join(PUBLIC_DIR, "404.html"));
  return new Response(page, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

const ASSET_CACHE = "public, max-age=31536000, immutable";
const ARTIFACTS = /^\/(llms\.txt|llms-full\.txt|sitemap\.xml|robots\.txt|agent-index\.json)$/;

function cacheHeaders(pathname: string): Record<string, string> | undefined {
  if (pathname.startsWith("/assets/")) return { "cache-control": ASSET_CACHE };
  if (pathname === "/index.html")
    return { "content-type": "text/html; charset=utf-8", "cache-control": DOC_CACHE, link: LLMS_LINK };
  if (NOINDEX_ARTIFACTS.test(pathname)) return { "cache-control": DOC_CACHE, "x-robots-tag": "noindex" };
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

    const devices = await handleDevicesApi(req);
    if (devices) return devices;

    const comparison = await handleComparisonApi(req);
    if (comparison) return comparison;

    const stocked = await stock(req, server.requestIP(req)?.address);
    if (stocked) return stocked;

    const home = await handleHomeApi(req);
    if (home) return home;

    const mcp = await handleMcp(req);
    if (mcp) return mcp;

    const search = await handleSearchIndex(req, PUBLIC_DIR);
    if (search) return search;

    const card = await handleOg(req, cardFor);
    if (card) return card;

    const url = new URL(req.url);
    const location = planRedirect(url.pathname, url.search, ROUTES);
    if (location) return new Response(null, { status: 301, headers: { location } });

    // An address inside a page asked for as Markdown: its page's twin, as the page answers.
    const inside = addressFor(url.pathname);
    if (inside && acceptsMarkdown(req.headers.get("accept") || "")) {
      const twin = await handleAgentDocs(new Request(new URL(inside.parent + url.search, req.url), { method: req.method, headers: req.headers }), ROUTES.size ? ROUTES : undefined);
      if (twin) return twin;
    }

    // One Help answer, release, device or place: its page under a head naming it.
    const item = req.method === "GET" || req.method === "HEAD" ? await itemPage(url.pathname, snapshot) : null;
    if (item?.location) return new Response(null, { status: item.status, headers: { location: item.location, "cache-control": "no-store" } });
    if (item) {
      const cache: Record<string, string> =
        item.status === 200
          ? { "cache-control": LIVE_CACHE }
          : item.status === 503
            ? { "retry-after": "120", "cache-control": "no-store" }
            : {};
      return new Response(item.html, { status: item.status, headers: { "content-type": "text/html; charset=utf-8", ...cache } });
    }

    const agentDocs = await handleAgentDocs(req, ROUTES.size ? ROUTES : undefined);
    if (agentDocs) return agentDocs;

    // Pages come only from above. Here: Home, and files with an extension other than .html (assets,
    // favicons, the agent files), never a directory or a stray .html like 404.html itself.
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const last = pathname.slice(pathname.lastIndexOf("/") + 1);
    if (pathname === "/index.html" || (/\.[A-Za-z0-9]+$/.test(last) && !last.endsWith(".html"))) {
      const file = Bun.file(join(PUBLIC_DIR, pathname));
      if (await file.exists()) {
        // Home carries the live figures, filled as far as their sources allow.
        if (pathname === "/index.html") {
          const page = (await livePage("/", await file.text()))!;
          return new Response(page.html, { headers: { ...cacheHeaders(pathname), "cache-control": LIVE_CACHE } });
        }
        return new Response(file, { headers: cacheHeaders(pathname) });
      }
    }

    if (await Bun.file(join(PUBLIC_DIR, "404.html")).exists()) return notFound();
    return new Response("Not Found", { status: 404 });
  },
  error(e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
