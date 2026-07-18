// Remote MCP server (Streamable HTTP, stateless, read-only) co-hosted on /mcp.
// Backed by dist/agent-index.json (built by the prerender pipeline).
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getPage,
  isOriginAllowed,
  listPages,
  searchDocs,
  toFetchDoc,
  toSearchResults,
  type IndexPage,
} from './mcpSearch';

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
      const query = (typeof args?.query === 'string' ? args.query : '').slice(0, 200);
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 50) : 10;
      return textResult(searchDocs(pages, query, limit));
    },
  });

  // OpenAI deep-research compatibility: ChatGPT's connector/deep-research picker
  // requires two tools named exactly `search` and `fetch` with these shapes.
  server.tool('search', {
    description:
      'Search the Medius documentation and return matching pages. Use the returned id with the fetch tool to read a page.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search terms.' } },
      required: ['query'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['id', 'title', 'url', 'text'],
          },
        },
      },
      required: ['results'],
    },
    handler: (args: any) => {
      const query = (typeof args?.query === 'string' ? args.query : '').slice(0, 200);
      const results = toSearchResults(pages, query, SITE, 10);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ results }) }], structuredContent: { results } };
    },
  });

  server.tool('fetch', {
    description: 'Fetch the full Markdown of one documentation page by its id (the id returned by search).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The page id returned by search (its path).' } },
      required: ['id'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        text: { type: 'string' },
        url: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['id', 'title', 'text', 'url'],
    },
    handler: (args: any) => {
      const id = typeof args?.id === 'string' ? args.id : '';
      const doc = toFetchDoc(pages, id, SITE);
      if (!doc) return textResult(`No page with id "${id}". Use search or list_pages for valid ids.`, true);
      return { content: [{ type: 'text' as const, text: JSON.stringify(doc) }], structuredContent: doc };
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
