import { describe, it, expect } from 'vitest';
import { COMMITS_MARKER, splitRelease, parseBlocks, linkify, inlineRuns } from '../../src/dashboard/firmware/notes';

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
