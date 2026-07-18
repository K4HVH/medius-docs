import TurndownService from 'turndown';

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

// Rewrite an internal router href (/x, /x#frag) to its .md twin, keeping the
// hash. A path whose last segment has a file extension (a static asset) is left
// as-is, since it has no .md twin.
function rewriteInternalHref(href: string): string {
  const hashIndex = href.indexOf('#');
  const path = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const frag = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const lastSeg = path.slice(path.lastIndexOf('/') + 1);
  const isFile = /\.[A-Za-z0-9]+$/.test(lastSeg);
  const mdPath = path === '/' || isFile ? path : path.replace(/\/+$/, '') + '.md';
  return mdPath + frag;
}

// Convert one table cell's inner HTML to single-line inline Markdown, escaping
// pipes (even inside code spans, per GFM) so they can't break the row.
function cellMarkdown(td: TurndownService, cell: any): string {
  const md = td.turndown(cell.innerHTML || '');
  return md
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

// Build a rectangular grid of cell text from an HTML table, expanding colspan
// (repeat across columns) and rowspan (carry the value down). Markdown tables
// have no spans, so repeating the value preserves both data and alignment.
function tableGrid(td: TurndownService, table: any): string[][] {
  const rows = Array.from(table.querySelectorAll('tr')) as any[];
  const grid: string[][] = [];
  const carry = new Map<number, { text: string; rowsLeft: number }>();

  rows.forEach((tr, r) => {
    const rowArr: string[] = grid[r] || (grid[r] = []);
    // Place any cells carried down from a rowspan above, at their fixed columns.
    for (const [col, info] of carry) {
      if (info.rowsLeft > 0) {
        rowArr[col] = info.text;
        info.rowsLeft--;
        if (info.rowsLeft === 0) carry.delete(col);
      }
    }
    let col = 0;
    const cells = (Array.from(tr.children) as any[]).filter(
      (c) => c.nodeName === 'TD' || c.nodeName === 'TH',
    );
    for (const cell of cells) {
      const text = cellMarkdown(td, cell);
      const cspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
      const rspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
      for (let k = 0; k < cspan; k++) {
        while (rowArr[col] !== undefined) col++;
        rowArr[col] = text;
        if (rspan > 1) carry.set(col, { text, rowsLeft: rspan - 1 });
        col++;
      }
    }
  });

  const width = grid.reduce((w, row) => Math.max(w, row.length), 0);
  return grid.map((row) => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) out.push(row[i] ?? '');
    return out;
  });
}

function renderTable(td: TurndownService, table: any): string {
  const grid = tableGrid(td, table);
  if (grid.length === 0) return '';
  const [header, ...body] = grid;
  const line = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
  const sep = '| ' + header.map(() => '---').join(' | ') + ' |';
  const lines = [line(header), sep, ...body.map(line)];
  return '\n\n' + lines.join('\n') + '\n\n';
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

  // Full table handling: pipe-escaped cells, colspan/rowspan expansion.
  td.addRule('table', {
    filter: (node: any) => node.nodeName === 'TABLE',
    replacement: (_content, node: any) => renderTable(td, node),
  });

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

  // Drop agent-hidden chrome (the AI-actions menu) if it ever lands in content.
  td.addRule('agentHidden', {
    filter: (node: any) =>
      hasClass(node, 'ai-actions') || (node.getAttribute && node.getAttribute('data-agent-hide') !== null),
    replacement: () => '',
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

// Collapse runs of blank lines to a single blank line, but never inside a fenced
// code block (diagrams and code must keep their exact internal spacing).
export function normalizeMarkdown(md: string): string {
  const parts = md.replace(/\r\n/g, '\n').split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => (i % 2 === 0 ? part.replace(/\n{3,}/g, '\n\n') : part))
    .join('')
    .trim();
}
