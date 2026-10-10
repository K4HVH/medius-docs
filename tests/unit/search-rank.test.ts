import { describe, expect, it } from 'vitest';
import { entries } from '../../src/app/searchIndex';
import { groupHits, marks, rank } from '../../src/app/searchRank';

const top = (q: string, n = 5) => rank(entries, q).slice(0, n).map((h) => h.entry.label);

describe('rank', () => {
  it('puts the page a word names first, ahead of answers that merely mention it', () => {
    expect(top('lock', 1)).toEqual(['LOCK']);
    expect(top('lock')).toContain('Lock (library)');
    expect(top('lock', 10)).not.toContain('A flash stopped partway');
    expect(top('clip', 1)).toEqual(['Clip']);
  });

  it('ranks titles that begin with the query ahead of titles that only contain it later on', () => {
    const order = rank(entries, 'lock').map((h) => h.entry.label);
    expect(order.indexOf('Locks')).toBeLessThan(order.indexOf("Weighing is the lock's"));
    expect(order.indexOf('Lock scale')).toBeLessThan(order.indexOf('Blanket lock'));
  });

  it('finds an entry by its keywords and its description as well as its title', () => {
    expect(top('superstrike')).toContain('Device fixes');
    expect(top('bsod')).toContain('My PC blue-screens');
  });

  it('puts what holds every word of a query first, in any order', () => {
    expect(top('flash usb2', 3)).toContain('Manual flash');
    expect(top('usb2 flash', 3)).toContain('Manual flash');
  });

  it('still finds what one word names when another matches nothing', () => {
    expect(top('lock zzzz', 1)).toEqual(['LOCK']);
    expect(rank(entries, 'mouse click').length).toBeGreaterThan(0);
    const move = top('how do i move the mouse', 8);
    expect(move[0]).toBe("My mouse doesn't move");
    expect(move).toContain('MOVE');
  });

  it('answers what Medius is with the page that says so', () => {
    expect(rank(entries, 'what is medius').slice(0, 3).map((h) => h.entry.path)).toContain('/native');
    expect(top('medius lock', 1)).toEqual(['LOCK']);
  });

  it('leaves room for every section, so one long family cannot fill the list', () => {
    expect(rank(entries, 'medius').map((h) => h.entry.path)).toContain('/native');
  });

  it('ranks a keyword the query names whole above a title word it only begins', () => {
    const order = rank(entries, 'pip').map((h) => h.entry.label);
    expect(order.indexOf('Python · Install')).toBeLessThan(order.indexOf('Transform pipeline order'));
  });

  it('takes a number as written, never one slip off another', () => {
    expect(top('8khz', 10)).not.toContain('Wire rate');
    expect(rank(entries, '8000hz').map((h) => h.entry.label)).not.toContain('Wire rate');
  });

  it('answers a question asked in plain words', () => {
    expect(top('mouse not moving', 3)).toContain("My mouse doesn't move");
    expect(top('how do i update', 3)).toContain('Update');
    expect(top('why is my logitech mouse slow', 3)).toContain('My Logitech mouse feels delayed, or runs at 125 Hz');
  });

  it('forgives one slip in a word', () => {
    expect(top('lcok', 3)).toContain('LOCK');
    expect(top('flsh', 5)).toContain('Manual flash');
  });

  it('matches regardless of case and finds nothing for an empty query', () => {
    expect(top('LoCk', 1)).toEqual(['LOCK']);
    expect(rank(entries, '   ')).toEqual([]);
  });

  it('keeps the list short enough to read', () => {
    expect(rank(entries, 'e').length).toBeLessThanOrEqual(40);
  });
});

describe('groupHits', () => {
  it('leads with the section of the best hit, and keeps each section in score order', () => {
    const groups = groupHits(rank(entries, 'lock'));
    expect(groups[0].group).toBe('Native Commands');
    for (const g of groups) {
      const scores = g.hits.map((h) => h.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
  });
});

describe('marks', () => {
  it('marks the start of each word the query names', () => {
    expect(marks('Lock scale', 'lock')).toEqual([{ text: 'Lock', hit: true }, { text: ' scale', hit: false }]);
    expect(marks('Blanket lock', 'lock bl')).toEqual([
      { text: 'Bl', hit: true },
      { text: 'anket ', hit: false },
      { text: 'lock', hit: true },
    ]);
  });

  it('marks a word a question named by another ending', () => {
    expect(marks("My mouse doesn't move", 'mouse not moving')).toEqual([
      { text: 'My ', hit: false },
      { text: 'mouse', hit: true },
      { text: " doesn't ", hit: false },
      { text: 'mov', hit: true },
      { text: 'e', hit: false },
    ]);
  });

  it('lets a word go only by its ending, so "notes" never lights "Nothing"', () => {
    expect(marks('Nothing to install to', 'notes')).toEqual([{ text: 'Nothing to install to', hit: false }]);
    expect(top('notes', 40)).not.toContain('Nothing to install to');
  });

  it('marks nothing it did not match, so a slip shows no false light', () => {
    expect(marks('LOCK', 'lcok')).toEqual([{ text: 'LOCK', hit: false }]);
  });
});
