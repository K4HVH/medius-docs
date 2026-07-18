import { normalizeMarkdown } from './htmlToMarkdown';

// Turn the extracted content markdown into the final per-page .md file: promote
// the first card heading (the page title) from h2 to the page h1, and record the
// canonical source URL as a machine-readable comment.
export function assemblePageMarkdown(contentMd: string, sourceUrl: string): string {
  let md = normalizeMarkdown(contentMd);
  if (md.startsWith('## ')) {
    md = '#' + md.slice(2);
  }
  return `<!-- Source: ${sourceUrl} -->\n${md}\n`;
}
