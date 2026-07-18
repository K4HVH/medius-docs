import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PageRecord {
  path: string;
  section: string;
  title: string;
  description: string;
  markdown: string;
}

export interface AgentIndex {
  site: string;
  mcp: string;
  pages: Array<{ path: string; title: string; section: string; description: string; text: string }>;
}

const SECTION_ORDER = ['Native API', 'Rust Library', 'Bindings'];
const SITE_SUMMARY =
  'Mouse-passthrough firmware for MAKCU-class boxes: an open binary control protocol, byte-exact device behavior, and the medius Rust library.';

function bySectionOrder(pages: PageRecord[]): Array<[string, PageRecord[]]> {
  const groups = new Map<string, PageRecord[]>();
  for (const p of pages) {
    if (!groups.has(p.section)) groups.set(p.section, []);
    groups.get(p.section)!.push(p);
  }
  const ordered: Array<[string, PageRecord[]]> = [];
  for (const s of SECTION_ORDER) if (groups.has(s)) ordered.push([s, groups.get(s)!]);
  for (const [s, list] of groups) if (!SECTION_ORDER.includes(s)) ordered.push([s, list]);
  return ordered;
}

function stripSourceComment(markdown: string): string {
  return markdown.replace(/^<!-- Source:[^\n]*-->\n/, '');
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildLlmsTxt(site: string, pages: PageRecord[]): string {
  const lines: string[] = [
    '# Medius',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    `Documentation as Markdown for AI agents. Each link is the Markdown twin of a page; the whole corpus is at ${site}/llms-full.txt.`,
    '',
    `MCP server: ${site}/mcp (Streamable HTTP; tools: search, fetch, search_docs, get_page, list_pages).`,
  ];
  for (const [section, list] of bySectionOrder(pages)) {
    lines.push('', `## ${section}`, '');
    for (const p of list) {
      const desc = p.description ? `: ${p.description}` : '';
      lines.push(`- [${p.title}](${site}${p.path}.md)${desc}`);
    }
  }
  return lines.join('\n') + '\n';
}

export function buildLlmsFullTxt(site: string, pages: PageRecord[]): string {
  const header = [
    '# Medius Documentation',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    `Source: ${site}`,
  ].join('\n');
  const body = pages.map((p) => p.markdown.trim()).join('\n\n---\n\n');
  return `${header}\n\n---\n\n${body}\n`;
}

export function buildSitemap(site: string, pages: PageRecord[]): string {
  const urls = ['/', ...pages.map((p) => p.path)];
  const entries = urls
    .map((u) => `  <url><loc>${xmlEscape(site + u)}</loc></url>`)
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries +
    '\n</urlset>\n'
  );
}

export function buildRobotsTxt(site: string): string {
  const aiBots = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-Web',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'CCBot',
  ];
  const lines: string[] = ['User-agent: *', 'Allow: /', ''];
  lines.push('# AI agents and crawlers are welcome.');
  for (const bot of aiBots) {
    lines.push(`User-agent: ${bot}`, 'Allow: /', '');
  }
  lines.push(`Sitemap: ${site}/sitemap.xml`);
  lines.push(`# Markdown index for LLMs: ${site}/llms.txt`);
  return lines.join('\n') + '\n';
}

export function buildServerCard(site: string): string {
  const card = {
    name: 'net.k4tech.medius/docs',
    description:
      'Medius documentation: the binary control protocol, device behavior, and the medius Rust library.',
    version: '1.0.0',
    url: `${site}/mcp`,
    transport: 'streamable-http',
    tools: [
      { name: 'search', description: 'Search the docs; returns pages with an id for fetch.' },
      { name: 'fetch', description: 'Fetch a page as Markdown by id.' },
      { name: 'search_docs', description: 'Ranked full-text search with snippets.' },
      { name: 'get_page', description: 'Full Markdown of one page by path.' },
      { name: 'list_pages', description: 'List every documentation page.' },
    ],
  };
  return JSON.stringify(card, null, 2) + '\n';
}

export function buildAgentIndex(site: string, pages: PageRecord[]): AgentIndex {
  return {
    site,
    mcp: `${site}/mcp`,
    pages: pages.map((p) => ({
      path: p.path,
      title: p.title,
      section: p.section,
      description: p.description,
      text: stripSourceComment(p.markdown).trim(),
    })),
  };
}

export function buildArtifacts(opts: { dist: string; site: string; pages: PageRecord[] }): void {
  const { dist, site, pages } = opts;
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'llms.txt'), buildLlmsTxt(site, pages));
  writeFileSync(join(dist, 'llms-full.txt'), buildLlmsFullTxt(site, pages));
  writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(site, pages));
  writeFileSync(join(dist, 'robots.txt'), buildRobotsTxt(site));
  writeFileSync(join(dist, 'agent-index.json'), JSON.stringify(buildAgentIndex(site, pages), null, 2) + '\n');
  const wellKnown = join(dist, '.well-known', 'mcp');
  mkdirSync(wellKnown, { recursive: true });
  writeFileSync(join(wellKnown, 'server-card.json'), buildServerCard(site));
}
