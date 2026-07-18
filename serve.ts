import { join } from "path";
import { handleFirmwareApi } from "./server/firmware";
import { handleAgentDocs, DOC_CACHE } from "./server/agent";
import { handleMcp } from "./server/mcp";

const PORT = parseInt(process.env.PORT || "3000");
const PUBLIC_DIR = process.env.PUBLIC_DIR || "./dist";

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
  async fetch(req) {
    const api = await handleFirmwareApi(req);
    if (api) return api;

    const mcp = await handleMcp(req);
    if (mcp) return mcp;

    const agentDocs = await handleAgentDocs(req);
    if (agentDocs) return agentDocs;

    const url = new URL(req.url);
    let pathname = url.pathname;

    // Normalize path - if ends with /, add index.html
    if (pathname.endsWith("/")) {
      pathname = join(pathname, "index.html");
    }

    let filePath = join(PUBLIC_DIR, pathname);

    // Try to serve the file
    let file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, { headers: cacheHeaders(pathname) });
    }

    // Try with .html extension
    file = Bun.file(filePath + ".html");
    if (await file.exists()) {
      return new Response(file);
    }

    // Try as directory with index.html
    const dirIndex = join(filePath, "index.html");
    file = Bun.file(dirIndex);
    if (await file.exists()) {
      return new Response(file);
    }

    // Fallback to root index.html for SPA routing
    return new Response(Bun.file(join(PUBLIC_DIR, "index.html")));
  },
  error() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
