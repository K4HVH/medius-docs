import { describe, it, expect } from 'vitest';
import { planAgentResponse, acceptsMarkdown, isCandidateRoute, markdownLink, NOINDEX_ARTIFACTS, livePage } from '../../server/agent';

const FILES = new Set([
  '/library/clip.html',
  '/library/clip.md',
  '/native.html',
  '/native.md',
  '/native/commands/requests.html',
  '/native/commands/requests.md',
]);
const has = (p: string) => FILES.has(p);

describe('acceptsMarkdown', () => {
  it('is true only when the Accept header explicitly lists text/markdown', () => {
    expect(acceptsMarkdown('text/markdown')).toBe(true);
    expect(acceptsMarkdown('text/markdown, text/plain;q=0.9')).toBe(true);
    expect(acceptsMarkdown('text/html,application/xhtml+xml,*/*')).toBe(false);
    expect(acceptsMarkdown('*/*')).toBe(false);
    expect(acceptsMarkdown('')).toBe(false);
  });

  it('respects quality values: a zero refuses Markdown, and HTML preferred over it wins', () => {
    expect(acceptsMarkdown('text/markdown;q=0')).toBe(false);
    expect(acceptsMarkdown('text/html, text/markdown;q=0.1')).toBe(false);
    expect(acceptsMarkdown('text/markdown, text/html;q=0.5')).toBe(true);
    expect(acceptsMarkdown('text/markdown;q=0.8, text/html;q=0.8')).toBe(true);
  });
});

describe('isCandidateRoute', () => {
  it('accepts extensionless in-app paths and rejects root, assets, api, files, trailing slash', () => {
    expect(isCandidateRoute('/library/clip')).toBe(true);
    expect(isCandidateRoute('/native')).toBe(true);
    expect(isCandidateRoute('/')).toBe(false);
    expect(isCandidateRoute('/assets/index-abc.js')).toBe(false);
    expect(isCandidateRoute('/api/firmware/releases')).toBe(false);
    expect(isCandidateRoute('/favicon.svg')).toBe(false);
    expect(isCandidateRoute('/library/clip.md')).toBe(false);
    expect(isCandidateRoute('/library/')).toBe(false);
  });
});

describe('planAgentResponse', () => {
  it('serves a directly requested .md that exists', () => {
    expect(planAgentResponse('/library/clip.md', 'text/html', has)).toEqual({
      kind: 'markdown',
      path: '/library/clip.md',
    });
  });

  it('404s a directly requested .md that does not exist', () => {
    expect(planAgentResponse('/library/bogus.md', '*/*', has)).toEqual({ kind: 'notfound' });
  });

  it('negotiates a doc route to markdown when the agent asks for it', () => {
    expect(planAgentResponse('/library/clip', 'text/markdown', has)).toEqual({
      kind: 'markdown',
      path: '/library/clip.md',
    });
  });

  it('serves prerendered HTML for a doc route when markdown is not requested', () => {
    expect(planAgentResponse('/library/clip', 'text/html,*/*', has)).toEqual({
      kind: 'html',
      path: '/library/clip.html',
    });
  });

  it('falls back to HTML when markdown is asked for but no .md twin exists', () => {
    const htmlOnly = (p: string) => p === '/native/x.html';
    expect(planAgentResponse('/native/x', 'text/markdown', htmlOnly)).toEqual({
      kind: 'html',
      path: '/native/x.html',
    });
  });

  it('serves a prerendered dashboard page like any other page', () => {
    const withDash = (p: string) => p === '/dashboard/setup.html' || has(p);
    expect(planAgentResponse('/dashboard/setup', 'text/html', withDash)).toEqual({ kind: 'html', path: '/dashboard/setup.html' });
  });

  it('passes through non-doc routes (no prerendered .html): dashboard, root, assets, mcp', () => {
    expect(planAgentResponse('/dashboard/control', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/assets/index.js', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/mcp', 'text/markdown', has)).toEqual({ kind: 'pass' });
  });
});

describe('Markdown twin headers', () => {
  it('point a twin at its HTML page as the canonical copy, beside the llms.txt links', () => {
    const link = markdownLink('/native/quickstart.md');
    expect(link).toContain('<https://medius.k4tech.net/native/quickstart>; rel="canonical"');
    expect(link).toContain('</llms.txt>; rel="llms-txt"');
  });

  it('keep the agent artifacts out of the search index', () => {
    for (const p of ['/llms.txt', '/llms-full.txt', '/agent-index.json', '/routes.json']) expect(NOINDEX_ARTIFACTS.test(p)).toBe(true);
    expect(NOINDEX_ARTIFACTS.test('/sitemap.xml')).toBe(false);
    expect(NOINDEX_ARTIFACTS.test('/robots.txt')).toBe(false);
  });
});

describe('livePage', () => {
  const fill = (out: string | null) => async () => out;

  it('answers a live page 503 with its snapshot when no fill was ever possible', async () => {
    expect(await livePage('/dashboard/stats', 'snap', fill(null))).toEqual({ status: 503, html: 'snap' });
    expect(await livePage('/dashboard/stats', 'snap', fill('filled'))).toEqual({ status: 200, html: 'filled' });
  });

  it('answers the landing and compatibility pages 200 with their snapshot whatever the sources do', async () => {
    for (const p of ['/', '/guide/compatibility']) {
      expect(await livePage(p, 'snap', fill(null))).toEqual({ status: 200, html: 'snap' });
      expect(await livePage(p, 'snap', fill('filled'))).toEqual({ status: 200, html: 'filled' });
    }
  });

  it('serves any other page as it is', async () => {
    expect(await livePage('/native', 'snap', fill('filled'))).toBeNull();
  });
});

