// Remote MCP server (Streamable HTTP, stateless, read-only) co-hosted on /mcp.
// Pages come from dist/agent-index.json (built by the prerender pipeline); search is the site search, over
// dist/search-index.json with the live releases and device reports.
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getPage,
  isOriginAllowed,
  listPages,
  searchHits,
  toFetchDoc,
  toSearchResults,
  type IndexPage,
} from './mcpSearch';
import { liveSearcher } from './searchIndex';
import { fillMarkdown } from './fill';
import { LIVE_PATHS } from '../src/app/site';

const DIST = resolve(process.env.PUBLIC_DIR || './dist');
const SITE = (process.env.SITE_ORIGIN || 'https://medius.k4tech.net').replace(/\/+$/, '');
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || SITE)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let cachedPages: IndexPage[] | null = null;
function loadPages(): IndexPage[] {
  if (cachedPages !== null) return cachedPages;
  let pages: IndexPage[];
  try {
    const raw = JSON.parse(readFileSync(resolve(DIST, 'agent-index.json'), 'utf8'));
    pages = Array.isArray(raw?.pages) ? raw.pages : [];
  } catch {
    pages = [];
  }
  cachedPages = pages;
  return pages;
}

// The changelog and stats as they are now, from the same fill the server gives crawlers.
async function liveText(page: IndexPage): Promise<string> {
  if (!LIVE_PATHS.has(page.path)) return page.text;
  return (await fillMarkdown(page.path)) ?? page.text;
}

const NO_INDEX = 'Search is not available: the site was built without its search index.';

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
    handler: async (args: any) => {
      const path = typeof args?.path === 'string' ? args.path : '';
      const page = getPage(pages, path);
      if (!page) return textResult(`No page at "${path}". Call list_pages for valid paths.`, true);
      return textResult(await liveText(page));
    },
  });

  server.tool('search_docs', {
    description:
      'Search the Medius site: every page and section of the docs and the Guide, the dashboard, each firmware release and device report. Returns ranked results with the sentence that matched; follow up with get_page on a result\'s path for the full Markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms.' },
        limit: { type: 'number', description: 'Maximum results (default 10, max 50).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const query = (typeof args?.query === 'string' ? args.query : '').slice(0, 200);
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 50) : 10;
      const searcher = await liveSearcher(DIST);
      if (!searcher) return textResult(NO_INDEX, true);
      return textResult(searchHits(searcher, query, limit));
    },
  });

  // OpenAI deep-research compatibility: ChatGPT's connector/deep-research picker
  // requires two tools named exactly `search` and `fetch` with these shapes.
  server.tool('search', {
    description:
      'Search the Medius documentation and return matching pages and sections. Use the returned id with the fetch tool to read its page.',
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
    handler: async (args: any) => {
      const query = (typeof args?.query === 'string' ? args.query : '').slice(0, 200);
      const searcher = await liveSearcher(DIST);
      if (!searcher) return textResult(NO_INDEX, true);
      const results = toSearchResults(searchHits(searcher, query, 10), SITE);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ results }) }], structuredContent: { results } };
    },
  });

  server.tool('fetch', {
    description: "Fetch the full Markdown of one documentation page by its id (the id returned by search; a section's id gives its page).",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'An id returned by search (an address on the site).' } },
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
    handler: async (args: any) => {
      const id = typeof args?.id === 'string' ? args.id : '';
      const doc = toFetchDoc(pages, id, SITE);
      if (!doc) return textResult(`No page with id "${id}". Use search or list_pages for valid ids.`, true);
      const page = getPage(pages, id);
      if (page) doc.text = await liveText(page);
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
