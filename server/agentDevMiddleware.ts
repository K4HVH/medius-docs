// Dev/preview middleware that serves the agent surface (Markdown twins, content
// negotiation, llms.txt/sitemap/robots/agent-index, and /mcp) from dist/, so the
// same features work under `vite dev` / `vite preview` as under the production
// serve.ts. The twins are build artifacts, so `bun run build:full` must have run;
// until then a helpful 404 is returned instead of the SPA shell.
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { LLMS_LINK, planAgentResponse } from './agent';
import { handleMcp } from './mcp';

const DIST = resolve('dist');

const ARTIFACT_TYPES: Record<string, string> = {
  '/llms.txt': 'text/plain; charset=utf-8',
  '/llms-full.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml; charset=utf-8',
  '/robots.txt': 'text/plain; charset=utf-8',
  '/agent-index.json': 'application/json; charset=utf-8',
  '/.well-known/mcp/server-card.json': 'application/json; charset=utf-8',
};

const HINT = 'Markdown twins are build artifacts. Run `bun run build:full` to generate dist/, then reload.\n';

function distFile(distRelPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(distRelPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const full = resolve(DIST, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  if (full !== DIST && !full.startsWith(DIST + sep)) return null;
  return full;
}

const has = (p: string): boolean => {
  const abs = distFile(p);
  return abs ? existsSync(abs) : false;
};

type Next = (err?: unknown) => void;

export async function agentDocsDev(req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> {
  try {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (pathname === '/mcp') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request('http://localhost' + req.url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body,
      });
      const response = await handleMcp(request);
      if (!response) return next();
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (ARTIFACT_TYPES[pathname]) {
      const abs = distFile(pathname);
      if (abs && existsSync(abs)) {
        res.setHeader('content-type', ARTIFACT_TYPES[pathname]);
        res.end(readFileSync(abs));
        return;
      }
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(HINT);
      return;
    }

    const acceptRaw = req.headers['accept'];
    const accept = Array.isArray(acceptRaw) ? acceptRaw.join(',') : acceptRaw ?? '';
    const action = planAgentResponse(pathname, accept, has);
    if (action.kind === 'markdown') {
      const abs = distFile(action.path);
      if (!abs) return next();
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.setHeader('vary', 'Accept');
      res.setHeader('link', LLMS_LINK);
      res.end(readFileSync(abs));
      return;
    }
    if (action.kind === 'notfound') {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('vary', 'Accept');
      res.end(HINT);
      return;
    }
    // 'html' / 'pass' -> let vite render the live SPA.
    next();
  } catch {
    next();
  }
}
