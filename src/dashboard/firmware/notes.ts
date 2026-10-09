// A release body from medius-fw's release CI: the notes written for users, then this marker, then the
// commit list. Releases from before written notes have the commit list alone and no marker.
export const COMMITS_MARKER = '<!-- commits -->';

export function splitRelease(body: string): { notes: string; commits: string } {
  const at = body.indexOf(COMMITS_MARKER);
  if (at < 0) return { notes: body.trim(), commits: '' };
  const commits = body
    .slice(at + COMMITS_MARKER.length)
    .trim()
    .replace(/^## Commits\s*\n/, '');
  return { notes: body.slice(0, at).trim(), commits: commits.trim() };
}

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'text'; text: string };

// Headings ("## X" or a line of "**X**"), "- " bullets, and anything else as a paragraph line.
export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*(.+?)\*\*$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] });
    } else if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'list') last.items.push(bullet[1]);
      else blocks.push({ kind: 'list', items: [bullet[1]] });
    } else {
      blocks.push({ kind: 'text', text: line });
    }
  }
  return blocks;
}

export interface CommitGroup {
  repo: string | null;
  commits: { subject: string; hash: string | null }[];
}

// A release's commit list: a bold line names a repo and the bullets under it are its commits, each
// "subject (hash)". Null for anything holding other lines, which renders as written. A repo with no
// commits is left out.
export function groupCommits(md: string): CommitGroup[] | null {
  const groups: CommitGroup[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const repo = line.match(/^\*\*(.+?)\*\*$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (repo) groups.push({ repo: repo[1], commits: [] });
    else if (bullet) {
      if (!groups.length) groups.push({ repo: null, commits: [] });
      const c = bullet[1].match(/^(.*?)\s+\(([0-9a-f]{7,40})\)$/);
      groups[groups.length - 1].commits.push(c ? { subject: c[1], hash: c[2] } : { subject: bullet[1], hash: null });
    } else return null;
  }
  const kept = groups.filter((g) => g.commits.length);
  return kept.length ? kept : null;
}

export interface Run {
  text: string;
  href?: string;
  strong?: boolean;
  code?: boolean;
}

// Bare https links become runs with an href; a trailing full stop or bracket stays outside the link.
export function linkify(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    const start = m.index!;
    if (start > last) runs.push({ text: text.slice(last, start) });
    runs.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

// The Discord markdown release notes are written in: `code`, **bold**, then bare links in the rest.
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(/`([^`]+)`|\*\*(.+?)\*\*/g)) {
    if (m.index! > last) runs.push(...linkify(text.slice(last, m.index)));
    runs.push(m[1] !== undefined ? { text: m[1], code: true } : { text: m[2], strong: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) runs.push(...linkify(text.slice(last)));
  return runs.length ? runs : [{ text }];
}
