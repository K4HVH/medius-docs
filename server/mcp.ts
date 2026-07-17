// Remote MCP server (Streamable HTTP, stateless, read-only) co-hosted on /mcp.
// Backed by dist/agent-index.json (built by the prerender pipeline).
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPage, isOriginAllowed, listPages, searchDocs, type IndexPage } from './mcpSearch';

const DIST = resolve(process.env.PUBLIC_DIR || './dist');
const SITE = (process.env.SITE_ORIGIN || 'https://medius.k4tech.net').replace(/\/+$/, '');
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || SITE)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let cachedPages: IndexPage[] | null = null;
function loadPages(): IndexPage[] {
  if (cachedPages === null) {
    try {
      const raw = JSON.parse(readFileSync(resolve(DIST, 'agent-index.json'), 'utf8'));
      cachedPages = Array.isArray(raw?.pages) ? raw.pages : [];
    } catch {
      cachedPages = [];
    }
  }
  return cachedPages;
}

function textResult(value: unknown, isError = false) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text' as const, text }], isError };
}

function buildServer(): McpServer {
  const pages = loadPages();
  const server = new McpServer({ name: 'medius-docs', version: '1.0.0' });

  server.tool('list_pages', {
    description:
      'List every Medius documentation page (path, title, section). Start here to see what the docs cover.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => textResult(listPages(pages)),
  });

  server.tool('get_page', {
    description:
      'Return the full Markdown of one documentation page by its path, e.g. "/library/clip" or "/native/commands/inject".',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Page path, with or without a leading slash or .md suffix.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    handler: (args: any) => {
      const path = typeof args?.path === 'string' ? args.path : '';
      const page = getPage(pages, path);
      if (!page) return textResult(`No page at "${path}". Call list_pages for valid paths.`, true);
      return textResult(page.text);
    },
  });

  server.tool('search_docs', {
    description:
      'Full-text search the Medius docs. Returns ranked pages with a snippet; follow up with get_page for the full Markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms.' },
        limit: { type: 'number', description: 'Maximum results (default 10, max 50).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (args: any) => {
      const query = typeof args?.query === 'string' ? args.query : '';
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 50) : 10;
      return textResult(searchDocs(pages, query, limit));
    },
  });

  return server;
}

let boundHandler: ((request: Request) => Promise<Response>) | null = null;
function mcpHandler(): (request: Request) => Promise<Response> {
  if (!boundHandler) {
    boundHandler = new StreamableHttpTransport().bind(buildServer());
  }
  return boundHandler;
}

export async function handleMcp(req: Request): Promise<Response | null> {
  if (new URL(req.url).pathname !== '/mcp') return null;
  if (!isOriginAllowed(req.headers.get('origin'), ALLOWED_ORIGINS)) {
    return new Response('Forbidden origin', { status: 403 });
  }
  return mcpHandler()(req);
}
