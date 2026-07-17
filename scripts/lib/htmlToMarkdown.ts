import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

const CALLOUT_LABEL: Record<string, string> = {
  info: 'Note',
  warning: 'Warning',
  danger: 'Danger',
};

function classList(node: any): string[] {
  const c = node.getAttribute ? node.getAttribute('class') : null;
  return c ? c.split(/\s+/).filter(Boolean) : [];
}

function hasClass(node: any, cls: string): boolean {
  return classList(node).includes(cls);
}

function fence(text: string, lang: string): string {
  const body = (text || '').replace(/\n+$/, '');
  return '\n\n```' + lang + '\n' + body + '\n```\n\n';
}

// Rewrite an internal router href (/x, /x#frag) to its .md twin, keeping the hash.
function rewriteInternalHref(href: string): string {
  const hashIndex = href.indexOf('#');
  const path = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const frag = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const mdPath = path === '/' ? '/' : path.replace(/\/+$/, '') + '.md';
  return mdPath + frag;
}

export function createTurndown(): TurndownService {
  const td = new TurndownService({
    codeBlockStyle: 'fenced',
    fence: '```',
    headingStyle: 'atx',
    bulletListMarker: '-',
    hr: '---',
    emDelimiter: '_',
    strongDelimiter: '**',
  });
  td.use(tables);

  // CardHeader -> h2 title + italic subtitle line.
  td.addRule('cardHeader', {
    filter: (node: any) => node.nodeName === 'DIV' && hasClass(node, 'card__header'),
    replacement: (_content, node: any) => {
      const h = node.querySelector('h1, h2, h3, h4');
      const title = (h?.textContent || '').trim();
      const sub = (node.querySelector('small')?.textContent || '').trim();
      return '\n\n## ' + title + (sub ? '\n\n_' + sub + '_' : '') + '\n\n';
    },
  });

  // pre.api-signature -> fenced text block, verbatim.
  td.addRule('apiSignature', {
    filter: (node: any) => node.nodeName === 'PRE' && hasClass(node, 'api-signature'),
    replacement: (_content, node: any) => fence(node.textContent, 'text'),
  });

  // pre.diagram -> fenced block, whitespace preserved exactly.
  td.addRule('diagram', {
    filter: (node: any) => node.nodeName === 'PRE' && hasClass(node, 'diagram'),
    replacement: (_content, node: any) => fence(node.textContent, ''),
  });

  // Any other bare <pre> without a <code> child -> fenced text (defensive).
  td.addRule('barePre', {
    filter: (node: any) =>
      node.nodeName === 'PRE' &&
      !hasClass(node, 'api-signature') &&
      !hasClass(node, 'diagram') &&
      !(node.firstChild && node.firstChild.nodeName === 'CODE'),
    replacement: (_content, node: any) => fence(node.textContent, ''),
  });

  // div.api-response-label (all-caps sub-label) -> h4.
  td.addRule('apiResponseLabel', {
    filter: (node: any) => node.nodeName === 'DIV' && hasClass(node, 'api-response-label'),
    replacement: (_content, node: any) => '\n\n#### ' + (node.textContent || '').trim() + '\n\n',
  });

  // span.api-badge -> italic tag.
  td.addRule('apiBadge', {
    filter: (node: any) => node.nodeName === 'SPAN' && hasClass(node, 'api-badge'),
    replacement: (_content, node: any) => '_' + (node.textContent || '').trim() + '_',
  });

  // div.callout--info/warning/danger -> labelled blockquote.
  td.addRule('callout', {
    filter: (node: any) =>
      node.nodeName === 'DIV' && classList(node).some((c) => c.startsWith('callout--')),
    replacement: (content: string, node: any) => {
      const kind = classList(node)
        .find((c) => c.startsWith('callout--'))!
        .slice('callout--'.length);
      const label = CALLOUT_LABEL[kind] || 'Note';
      const body = content
        .trim()
        .split('\n')
        .map((l) => (l.length ? '> ' + l : '>'))
        .join('\n');
      return '\n\n> **' + label + '**\n>\n' + body + '\n\n';
    },
  });

  // Internal router links -> .md twin, preserving the hash.
  td.addRule('internalLink', {
    filter: (node: any) =>
      node.nodeName === 'A' && (node.getAttribute('href') || '').startsWith('/'),
    replacement: (content: string, node: any) =>
      '[' + content + '](' + rewriteInternalHref(node.getAttribute('href') || '') + ')',
  });

  // div.docs-grid nav tiles (an <a> wrapping a Card) -> a bullet list of links.
  // A CardHeader is block-level and cannot nest inside a Markdown link, so build
  // each item from the tile's title/subtitle instead of the link's inner markup.
  td.addRule('docsGrid', {
    filter: (node: any) => node.nodeName === 'DIV' && hasClass(node, 'docs-grid'),
    replacement: (_content, node: any) => {
      const items: string[] = [];
      for (const a of Array.from(node.querySelectorAll('a[href]')) as any[]) {
        const href = a.getAttribute('href') || '';
        const title = (a.querySelector('h1, h2, h3, h4')?.textContent || a.textContent || '').trim();
        const subtitle = (a.querySelector('small')?.textContent || '').trim();
        const target = href.startsWith('/') ? rewriteInternalHref(href) : href;
        items.push(`- [${title}](${target})${subtitle ? ': ' + subtitle : ''}`);
      }
      return '\n\n' + items.join('\n') + '\n\n';
    },
  });

  return td;
}

export function htmlToMarkdown(html: string): string {
  const md = createTurndown().turndown(html);
  return normalizeMarkdown(md);
}

export function normalizeMarkdown(md: string): string {
  return md.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
