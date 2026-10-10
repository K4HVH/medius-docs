import { describe, it, expect } from 'vitest';
import { COMMITS_MARKER, splitRelease, parseBlocks, linkify, inlineRuns, groupCommits, releaseDay } from '../../src/dashboard/firmware/notes';

const BODY = [
  '## Changes',
  '- Fixed an issue where certain models without PSRAM would fail to update',
  '- Improved EP0 round-trip timing',
  '',
  '## Notes',
  'Sorry to those affected, this hotfix should address the issues.',
  '',
  COMMITS_MARKER,
  '## Commits',
  '**Firmware**',
  '- firmware: control requests are answered from RAM (bf6e62f)',
].join('\n');

describe('splitRelease', () => {
  it('splits at the marker and drops the Commits heading the button already names', () => {
    const { notes, commits } = splitRelease(BODY);
    expect(notes.startsWith('## Changes')).toBe(true);
    expect(notes).not.toContain(COMMITS_MARKER);
    expect(commits.startsWith('**Firmware**')).toBe(true);
  });

  it('treats a body with no marker as notes alone, as every release before written notes was', () => {
    const old = '**Firmware**\n- fw: robustness fixes (dd34ba4)';
    expect(splitRelease(old)).toEqual({ notes: old, commits: '' });
  });
});

describe('parseBlocks', () => {
  it('reads headings, bullets and paragraphs, including bold repo headings', () => {
    expect(parseBlocks(splitRelease(BODY).notes)).toEqual([
      { kind: 'heading', text: 'Changes' },
      { kind: 'list', items: ['Fixed an issue where certain models without PSRAM would fail to update', 'Improved EP0 round-trip timing'] },
      { kind: 'heading', text: 'Notes' },
      { kind: 'text', text: 'Sorry to those affected, this hotfix should address the issues.' },
    ]);
    expect(parseBlocks('**Firmware**\n- a (1)')[0]).toEqual({ kind: 'heading', text: 'Firmware' });
  });
});

describe('linkify', () => {
  it('splits text around bare https links, leaving a full stop after one outside it', () => {
    expect(linkify('Stats here: https://medius.k4tech.net/dashboard/stats. Enjoy')).toEqual([
      { text: 'Stats here: ' },
      { text: 'https://medius.k4tech.net/dashboard/stats', href: 'https://medius.k4tech.net/dashboard/stats' },
      { text: '. Enjoy' },
    ]);
    expect(linkify('no links')).toEqual([{ text: 'no links' }]);
  });
});

describe('inlineRuns', () => {
  it('reads the Discord markdown the notes are written in: bold, code and links', () => {
    expect(inlineRuns('there is **almost **no difference, version `8`: https://x.dev/a.')).toEqual([
      { text: 'there is ' },
      { text: 'almost ', strong: true },
      { text: 'no difference, version ' },
      { text: '8', code: true },
      { text: ': ' },
      { text: 'https://x.dev/a', href: 'https://x.dev/a' },
      { text: '.' },
    ]);
  });

  it('leaves a lone asterisk or backtick as text', () => {
    expect(inlineRuns('2 * 3 and a ` tick')).toEqual([{ text: '2 * 3 and a ` tick' }]);
  });
});

describe('groupCommits', () => {
  it('groups commits under the bold line naming their repo, each subject apart from its hash', () => {
    const md = [
      '**Firmware**',
      '- firmware: control requests are answered from RAM (bf6e62f)',
      '- release v3.4.5 (95a4d53)',
      '',
      '**Docs**',
      '- dashboard: fewer words on the Update page (8b0a097)',
      '**Library**',
    ].join('\n');
    expect(groupCommits(md)).toEqual([
      {
        repo: 'Firmware',
        commits: [
          { subject: 'firmware: control requests are answered from RAM', hash: 'bf6e62f' },
          { subject: 'release v3.4.5', hash: '95a4d53' },
        ],
      },
      { repo: 'Docs', commits: [{ subject: 'dashboard: fewer words on the Update page', hash: '8b0a097' }] },
    ]);
  });

  it('keeps a commit with no hash, and one before any repo line in a group with no name', () => {
    expect(groupCommits('- fw: a fix (a1b2c3d)\n- fw: (with brackets) inside')).toEqual([
      {
        repo: null,
        commits: [
          { subject: 'fw: a fix', hash: 'a1b2c3d' },
          { subject: 'fw: (with brackets) inside', hash: null },
        ],
      },
    ]);
  });

  it('reads nothing as a commit list that carries prose, so such notes render as written', () => {
    expect(groupCommits('**Firmware**\nThis release fixes updates.\n- fw: a fix (a1b2c3d)')).toBeNull();
    expect(groupCommits('')).toBeNull();
  });
});

describe('releaseDay', () => {
  it('names the day a release came out in UTC, the same for every reader', () => {
    expect(releaseDay('2026-10-05T15:29:06Z')).toBe('5 Oct 2026');
    expect(releaseDay('2026-01-31T23:30:00Z')).toBe('31 Jan 2026');
  });

  it('names no day for a date it cannot read', () => {
    expect(releaseDay('')).toBe('');
    expect(releaseDay('not a date')).toBe('');
    expect(releaseDay(null as unknown as string)).toBe('');
  });
});
