import { describe, it, expect } from 'vitest';
import { planAgentResponse, acceptsMarkdown, isCandidateRoute } from '../../server/agent';

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

  it('passes through non-doc routes (no prerendered .html): dashboard, root, assets, mcp', () => {
    expect(planAgentResponse('/dashboard/control', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/assets/index.js', 'text/markdown', has)).toEqual({ kind: 'pass' });
    expect(planAgentResponse('/mcp', 'text/markdown', has)).toEqual({ kind: 'pass' });
  });
});
