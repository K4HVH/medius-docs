import { describe, it, expect } from 'vitest';
import {
  buildLlmsTxt,
  buildLlmsFullTxt,
  buildSitemap,
  buildRobotsTxt,
  buildAgentIndex,
  buildServerCard,
  type PageRecord,
} from '../../scripts/lib/artifacts';

const SITE = 'https://s';
const PAGES: PageRecord[] = [
  {
    path: '/native',
    section: 'Native API',
    title: 'Introduction',
    description: 'Native API overview',
    markdown: '<!-- Source: https://s/native -->\n# Introduction\n\nintro body',
  },
  {
    path: '/native/commands/clip',
    section: 'Native API',
    title: 'Clip',
    description: 'CLIP commands',
    markdown: '<!-- Source: https://s/native/commands/clip -->\n# Clip\n\nnative clip body',
  },
  {
    path: '/library/clip',
    section: 'Rust Library',
    title: 'Clip',
    description: 'Preload input',
    markdown: '<!-- Source: https://s/library/clip -->\n# Clip\n\nlib clip body',
  },
];

describe('buildLlmsTxt', () => {
  const out = buildLlmsTxt(SITE, PAGES);
  it('starts with the H1 project name and a blockquote summary', () => {
    expect(out.startsWith('# Medius\n')).toBe(true);
    expect(out).toContain('\n> ');
  });
  it('groups links under section headings in a fixed order', () => {
    const nativeAt = out.indexOf('## Native API');
    const libAt = out.indexOf('## Rust Library');
    expect(nativeAt).toBeGreaterThan(-1);
    expect(libAt).toBeGreaterThan(nativeAt);
  });
  it('links each page to its .md twin with the description', () => {
    expect(out).toContain('- [Clip](https://s/native/commands/clip.md): CLIP commands');
    expect(out).toContain('- [Introduction](https://s/native.md): Native API overview');
  });
  it('points at the full corpus file', () => {
    expect(out).toContain('https://s/llms-full.txt');
  });
  it('advertises the MCP server endpoint', () => {
    expect(out).toContain('MCP server: https://s/mcp');
  });
});

describe('buildServerCard', () => {
  const card = JSON.parse(buildServerCard('https://s'));
  it('is a valid MCP server card pointing at /mcp with search + fetch tools', () => {
    expect(card.url).toBe('https://s/mcp');
    expect(card.transport).toBe('streamable-http');
    const names = card.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('search');
    expect(names).toContain('fetch');
  });
});

describe('buildLlmsFullTxt', () => {
  const out = buildLlmsFullTxt(SITE, PAGES);
  it('includes every page body in route order', () => {
    expect(out).toContain('native clip body');
    expect(out).toContain('lib clip body');
    expect(out.indexOf('intro body')).toBeLessThan(out.indexOf('lib clip body'));
  });
  it('separates pages with a horizontal rule', () => {
    expect(out).toContain('\n---\n');
  });
});

describe('buildSitemap', () => {
  const out = buildSitemap(SITE, PAGES);
  it('is a urlset with the homepage and every canonical HTML route (not .md)', () => {
    expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(out).toContain('<urlset');
    expect(out).toContain('<loc>https://s/</loc>');
    expect(out).toContain('<loc>https://s/library/clip</loc>');
    expect(out).not.toContain('.md</loc>');
  });
});

describe('buildRobotsTxt', () => {
  const out = buildRobotsTxt(SITE);
  it('allows all and names AI crawlers explicitly', () => {
    expect(out).toContain('User-agent: *');
    expect(out).toContain('User-agent: GPTBot');
    expect(out).toContain('User-agent: ClaudeBot');
    expect(out).toContain('User-agent: PerplexityBot');
  });
  it('advertises the sitemap', () => {
    expect(out).toContain('Sitemap: https://s/sitemap.xml');
  });
});

describe('buildAgentIndex', () => {
  const out = buildAgentIndex(SITE, PAGES);
  it('carries one searchable record per page with the source comment stripped from text', () => {
    expect(out.site).toBe(SITE);
    expect(out.mcp).toBe('https://s/mcp');
    expect(out.pages).toHaveLength(3);
    const clip = out.pages.find((p) => p.path === '/library/clip')!;
    expect(clip.title).toBe('Clip');
    expect(clip.section).toBe('Rust Library');
    expect(clip.text).not.toContain('<!-- Source');
    expect(clip.text).toContain('lib clip body');
  });
});
