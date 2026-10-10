import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../../src/app/search/types';
import { createSearcher } from '../../src/app/search/rank';
import { marks, matches, parseQuery, snippet, stem } from '../../src/app/search/text';

const e = (path: string, title: string, o: Partial<IndexEntry> = {}): IndexEntry => ({
  path,
  title,
  kind: path.includes('#') ? 'section' : 'page',
  section: 'Native API',
  crumb: '',
  text: '',
  ...o,
});

// Filler that shares the common words, so a rare word stands out against them.
const filler = Array.from({ length: 12 }, (_, i) =>
  e(`/native/filler${i}`, `Filler ${i}`, { text: 'The box sends a frame. The box answers each frame with a status.' }),
);

const ENTRIES: IndexEntry[] = [
  e('/native/commands/lock', 'LOCK', { caption: 'Block, pass, or amplify', text: 'LOCK weighs physical input before it reaches the PC.' }),
  e('/native/commands/lock#bearing', 'Bearing', { kind: 'section', crumb: 'Commands / LOCK', text: 'A lock can follow the bearing. The lock holds while the lock is set, lock after lock.' }),
  e('/native/commands/lock#blanket', 'BLANKET', { kind: 'anchor', crumb: 'Commands / LOCK', text: 'An id of 0xFFFF addresses the whole class in one command.' }),
  e('/guide/compatibility#device-fixes', 'Device fixes', { section: 'Guide', crumb: 'Guide / Devices', text: 'Settings some devices need. The Superstrike needs its report rate set to 1000 Hz.' }),
  e('/native/frame#crc', 'Checksums', { crumb: 'Overview / Frame', text: 'crc crc crc box over the payload, then the frame ends.' }),
  e('/native/frame#layout', 'Layout', { crumb: 'Overview / Frame', text: 'crc box box box at the end of every frame.' }),
  e('/native/injection#near', 'Pacing', { crumb: 'Overview / Injection', text: 'The report rate follows the mouse.' }),
  e('/native/injection#far', 'Spacing', { crumb: 'Overview / Injection', text: 'Each report goes out on a poll, and the box keeps a count of the rate it saw.' }),
  e('/library/patch#query', 'Query a patch', { section: 'Rust Library', crumb: 'Advanced / Patch', code: ['query_patch_entry', 'PatchEntry'], text: 'Reads one entry back.' }),
  e('/native/commands/move', 'MOVE', { caption: 'Relative motion', code: ['move_rel', 'MoveRel'], text: 'Moves the cursor by a relative amount.' }),
  e('/guide/compatibility#limits', 'Limits', { section: 'Guide', crumb: 'Guide / Devices', text: 'The box runs at full speed; its report rate tops out at 1000 Hz.' }),
  e('/guide/help#polling', 'Is polling rate kept?', { kind: 'anchor', section: 'Guide', crumb: 'Help / Mice', text: 'Yes: the polling rate the mouse runs at is kept.' }),
  e('/native/troubleshooting#nothing', 'Nothing to install', { crumb: 'Reference / Troubleshooting', text: 'The box needs no driver.' }),
  e('https://discord.gg/x', 'Discord', { kind: 'external', section: 'Elsewhere', keywords: ['community', 'chat'], text: '' }),
  ...filler,
];

const search = createSearcher(ENTRIES, { synonyms: [['polling rate', 'report rate']] });
const top = (q: string, n = 5) => search.search(q).slice(0, n).map((h) => h.entry.path);

describe('createSearcher', () => {
  it('puts the entry a word names first, ahead of entries that only mention it', () => {
    expect(top('lock', 1)).toEqual(['/native/commands/lock']);
    expect(top('lock')).toContain('/native/commands/lock#bearing');
  });

  it('finds a word only the body text holds', () => {
    expect(top('superstrike', 1)).toEqual(['/guide/compatibility#device-fixes']);
  });

  it('counts a rare word for more than a common one', () => {
    const order = top('crc box', 10);
    expect(order.indexOf('/native/frame#crc')).toBeLessThan(order.indexOf('/native/frame#layout'));
  });

  it('ranks words that sit together above the same words far apart', () => {
    const order = top('report rate', 10);
    expect(order.indexOf('/native/injection#near')).toBeLessThan(order.indexOf('/native/injection#far'));
  });

  it('holds a quoted phrase to its words together and in order', () => {
    const paths = top('"report rate"', 20);
    expect(paths).toContain('/native/injection#near');
    expect(paths).not.toContain('/native/injection#far');
  });

  it('matches the last word as a prefix while it is typed', () => {
    expect(top('query_pat', 1)).toEqual(['/library/patch#query']);
    expect(top('superstr', 1)).toEqual(['/guide/compatibility#device-fixes']);
  });

  it('takes words that run together into a code name as all of it', () => {
    const m = createSearcher([
      e('/library/move#move-rel-now', 'move_rel_now', { kind: 'section', text: 'Moves now.' }),
      e('/library/move#move-rel', 'move_rel', { kind: 'section', text: 'Moves.' }),
    ]);
    expect(m.search('move rel')[0].entry.path).toBe('/library/move#move-rel');
  });

  it('meets a code name whole, in parts or joined', () => {
    for (const q of ['move_rel', 'move rel', 'moverel', 'MoveRel', 'query_patch_entry', 'patch entry'])
      expect(top(q, 2), q).toContain(q.includes('patch') ? '/library/patch#query' : '/native/commands/move');
  });

  it('counts a code name for less the more entries share it', () => {
    const s = createSearcher([
      ...Array.from({ length: 10 }, (_, i) => e(`/native/c${i}`, `Common ${i}`, { code: ['device'] })),
      e('/native/r', 'Rare', { code: ['rare_fn'] }),
    ]);
    const shared = s.search('device').find((h) => h.entry.path === '/native/c0')!;
    const rare = s.search('rare_fn')[0];
    expect(shared.score).toBeLessThan(rare.score - 10);
  });

  it('forgives one slip in a word the site never uses, and says which word it took', () => {
    const hit = search.search('lcok')[0];
    expect(hit.entry.path).toBe('/native/commands/lock');
    expect(hit.terms).toContain('lock');
  });

  it('never corrects a number or a short word', () => {
    expect(top('1001 hz', 10)).not.toContain('/guide/compatibility#limits');
    expect(search.search('lok')).toEqual([]);
  });

  it('finds a synonym, below the entry that uses the words themselves', () => {
    const order = top('polling rate', 10);
    expect(order).toContain('/guide/compatibility#limits');
    expect(order.indexOf('/guide/help#polling')).toBeLessThan(order.indexOf('/guide/compatibility#limits'));
  });

  it('names a version whole, its repeated numbers and all', () => {
    const v = createSearcher([
      e('/dashboard/changelog#v3.4.0', 'v3.4.0', { kind: 'release', section: 'Dashboard', text: 'Moved the control port to 6 Mbaud.' }),
      e('/dashboard/changelog#v3.4.4', 'v3.4.4', { kind: 'release', section: 'Dashboard', text: 'Fixed the delay.' }),
    ]);
    expect(v.search('v3.4.4')[0].entry.path).toBe('/dashboard/changelog#v3.4.4');
  });

  it('reads a number run into its unit as the two words', () => {
    expect(top('1000hz', 3)).toContain('/guide/compatibility#limits');
  });

  it('meets a word by another ending', () => {
    expect(top('moving', 1)).toEqual(['/native/commands/move']);
  });

  it('drops the small words of a phrase too: over, into, via, about', () => {
    expect(parseQuery('flash over usb2 via the box').words).toEqual(['flash', 'usb2', 'box']);
  });

  it('drops the small words of a question, and keeps them when there is nothing else', () => {
    expect(top('how do i block the lock', 1)).toEqual(['/native/commands/lock']);
    expect(search.search('the').length).toBeGreaterThan(0);
  });

  it('puts what holds every word first, then what holds most of them by name', () => {
    const order = top('lock zzzz', 3);
    expect(order[0]).toBe('/native/commands/lock');
    expect(search.search('zzzz qqqq')).toEqual([]);
  });

  it('takes no more than three from one page and five from one section', () => {
    const onePage = createSearcher(Array.from({ length: 5 }, (_, i) => e(`/native/p#a${i}`, `Alpha ${i}`, { kind: 'section' }))).search('alpha');
    expect(onePage).toHaveLength(3);
    const sections = createSearcher(Array.from({ length: 12 }, (_, i) => e(`/native/q${i}`, `Beta ${i}`))).search('beta');
    expect(sections).toHaveLength(5);
  });

  it('puts a page above a part of a page that matches as well', () => {
    const s = createSearcher([e('/native/x#y', 'Gamma', { kind: 'anchor' }), e('/native/g', 'Gamma')]);
    expect(s.search('gamma')[0].entry.path).toBe('/native/g');
  });

  it('finds another site by its keywords', () => {
    expect(top('community', 1)).toEqual(['https://discord.gg/x']);
  });

  it('finds nothing for an empty query, and matches regardless of case', () => {
    expect(search.search('   ')).toEqual([]);
    expect(top('LoCk', 1)).toEqual(['/native/commands/lock']);
  });
});

describe('snippet', () => {
  it('takes the sentence that holds the most of the query', () => {
    const hit = search.search('lock bearing').find((h) => h.entry.path.endsWith('#bearing'))!;
    expect(snippet(hit.entry, hit.terms)).toBe('A lock can follow the bearing.');
  });

  it('falls back on the caption, then the first sentence, when only the title matched', () => {
    const lock = ENTRIES[0];
    expect(snippet(lock, ['block'])).toBe('Block, pass, or amplify');
    expect(snippet(ENTRIES[12], ['zzzz'])).toBe('The box needs no driver.');
  });

  it('never falls back on the date of a release or the verdict on a device, which show where it lives', () => {
    const r = e('/dashboard/changelog#v1', 'v1', { kind: 'release', caption: '2 October 2026', text: 'Fixed the delay.' });
    expect(snippet(r, ['zzzz'])).toBe('Fixed the delay.');
  });

  it('takes each line of an entry as a sentence, so a table row never runs into the next', () => {
    const rows = e('/n#t', 'Table', { text: 'Device · Setting · Where\nLogitech G PRO · Fixed rate · Options\nWooting · Imperfect clone · Options' });
    expect(snippet(rows, ['wooting'])).toBe('Wooting · Imperfect clone · Options');
  });

  it('cuts a long sentence around the first match', () => {
    const long = e('/n#l', 'Long', { text: `${'word '.repeat(60)}needle ${'word '.repeat(60)}end.` });
    const s = snippet(long, ['needle']);
    expect(s.length).toBeLessThanOrEqual(170);
    expect(s).toContain('needle');
    expect(s.startsWith('...')).toBe(true);
  });
});

describe('marks', () => {
  it('lights each word the query names, begins or names by another ending', () => {
    expect(marks('Lock scale', ['lock'])).toEqual([{ text: 'Lock', hit: true }, { text: ' scale', hit: false }]);
    expect(marks("My mouse doesn't move", ['mouse', 'moving'])).toEqual([
      { text: 'My ', hit: false },
      { text: 'mouse', hit: true },
      { text: " doesn't ", hit: false },
      { text: 'mov', hit: true },
      { text: 'e', hit: false },
    ]);
  });

  it('lights the parts of a code name', () => {
    expect(marks('move_rel(x)', ['move', 'rel'])).toEqual([
      { text: 'move', hit: true },
      { text: '_', hit: false },
      { text: 'rel', hit: true },
      { text: '(x)', hit: false },
    ]);
  });

  it('lets a word go only by its ending, so "notes" never lights "Nothing"', () => {
    expect(marks('Nothing to install', ['notes'])).toEqual([{ text: 'Nothing to install', hit: false }]);
    expect(top('notes', 40)).not.toContain('/native/troubleshooting#nothing');
  });

  it('takes a query as a string too', () => {
    expect(marks('Blanket lock', 'lock bl')).toEqual([
      { text: 'Bl', hit: true },
      { text: 'anket ', hit: false },
      { text: 'lock', hit: true },
    ]);
  });
});

describe('matches', () => {
  it('holds a text to every word of the query, by start, ending or one slip', () => {
    expect(matches('Another tab or program has this box open', 'program box')).toBe(true);
    expect(matches('Another tab or program has this box open', 'progam')).toBe(true);
    expect(matches('Another tab or program has this box open', 'opening')).toBe(true);
    expect(matches('Another tab or program has this box open', 'program mouse')).toBe(false);
    expect(matches('G502 X LIGHTSPEED 046d:c098', '046d')).toBe(true);
    expect(matches('anything', '  ')).toBe(true);
  });
});

describe('createSearcher on titles', () => {
  const T: IndexEntry[] = [
    e('/guide/help#mouse-still', "My mouse doesn't move", { kind: 'anchor', section: 'Guide', crumb: 'Help', text: 'Check the cable.' }),
    e('/native/commands/move', 'MOVE', { text: 'Moves the mouse cursor by a relative amount. The mouse reports it.' }),
    e('/bindings/c/types#move-timing', 'Move timing', { section: 'C / C++ bindings', crumb: 'Reference / Types', text: 'When the mouse sees a move.' }),
    e('/native/frame', 'Frame format', { text: 'Every frame starts with a sync byte.' }),
    e('/bindings/python/types#recordedframe', 'RecordedFrame', { kind: 'section', section: 'Python bindings', crumb: 'Reference / Types', text: 'One frame of a recording.' }),
    e('/native/commands/transform#order', 'Pipeline order', { kind: 'section', crumb: 'Commands / TRANSFORM', text: 'Transforms run in order.' }),
    e('/bindings/python', 'Python', { section: 'Python bindings', text: 'Install it with pip install medius.' }),
    e('/native/commands/lock#blanket', 'BLANKET', { kind: 'anchor', crumb: 'Commands / LOCK', text: 'An id of 0xFFFF covers the class.' }),
    e('/library/types/enums#blanket', 'Blanket', { kind: 'section', section: 'Rust Library', crumb: 'Types / Enums', text: 'A blanket lock covers a class.' }),
    e('/library/catch', 'Catch', { section: 'Rust Library', text: 'Subscribe to events.' }),
    e('/bindings/python/api#catch', 'Catch', { kind: 'section', section: 'Python bindings', crumb: 'Reference / API', text: 'Subscribe to events.' }),
    e('/native/commands/update', 'UPDATE', { text: 'Write an image to the second slot.' }),
    e('/dashboard/update', 'Update', { section: 'Dashboard', text: 'Update both chips.' }),
  ];
  const s = createSearcher(T);
  const first = (q: string) => s.search(q)[0]?.entry.path;

  it('puts a title that holds every word of the query first, read without its small words', () => {
    expect(first('mouse not moving')).toBe('/guide/help#mouse-still');
    expect(first('how do i move the mouse')).toBe('/guide/help#mouse-still');
  });

  it('counts the page an anchor sits on toward holding every word', () => {
    expect(first('blanket lock')).toBe('/native/commands/lock#blanket');
  });

  it('reads the site section as part of where an entry lives', () => {
    expect(first('python catch')).toBe('/bindings/python/api#catch');
    expect(first('python recordedframe')).toBe('/bindings/python/types#recordedframe');
  });

  it('counts a part of a code name after the first as a later word', () => {
    expect(first('frame')).toBe('/native/frame');
  });

  it('counts the start of a word for less the less of it the query has typed', () => {
    const score = (q: string) => s.search(q).find((h) => h.entry.path === '/native/commands/transform#order')!.score;
    expect(score('pip')).toBeLessThan(score('pipel'));
    expect(score('pipel')).toBeLessThan(score('pipeline'));
  });

  it('puts the owner pages first between equal titles', () => {
    expect(first('update')).toBe('/dashboard/update');
    const b = createSearcher([
      e('/native/commands/lock#bearing', 'Bearing', { kind: 'section', crumb: 'Commands / Lock', text: 'The injected direction.' }),
      e('/dashboard#bearing', 'Bearing', { kind: 'panel', section: 'Dashboard', crumb: 'Device / Options', text: 'The injected direction.' }),
    ]);
    expect(b.search('bearing')[0].entry.path).toBe('/dashboard#bearing');
  });

  it('takes a hand-kept keyword as another name for the place, as strong as its title', () => {
    const k = createSearcher([
      e('/bindings/python', 'Install', { section: 'Python bindings', text: 'Install with pip.' }),
      e('/dashboard/setup', 'Set up', { section: 'Dashboard', keywords: ['install'], text: 'Flash each chip.' }),
    ]);
    expect(k.search('install')[0].entry.path).toBe('/dashboard/setup');
  });

  it('reads the words of an address as part of where an entry lives', () => {
    const r = createSearcher([
      e('/native/commands/raw', 'RAW', { crumb: 'Advanced control', text: 'Put one packet on a cloned endpoint.' }),
      e('/native/commands/clip#items', 'Raw and transfer items', { kind: 'section', crumb: 'Commands / Clip', text: 'Items a clip holds, like the commands they stand for.' }),
    ]);
    expect(r.search('raw command')[0].entry.path).toBe('/native/commands/raw');
  });
});

describe('words, as the review found them', () => {
  it('reads a contraction in the text whole, and lights it', () => {
    const c = createSearcher([e('/guide/help#x', 'Answering', { kind: 'anchor', section: 'Guide', text: "The box can't clone this device." })]);
    expect(c.search("can't clone")[0]?.entry.path).toBe('/guide/help#x');
    expect(marks("The box isn't answering", ["isn't"])).toEqual([
      { text: 'The box ', hit: false },
      { text: "isn't", hit: true },
      { text: ' answering', hit: false },
    ]);
  });

  it('meets a plural and its word: entries and entry, classes and class, statuses and status, speeds and speed', () => {
    for (const [a, b] of [['entries', 'entry'], ['classes', 'class'], ['statuses', 'status'], ['speeds', 'speed'], ['moves', 'moving']])
      expect(stem(a), `${a} ${b}`).toBe(stem(b));
  });

  it('never lets another ending land on a common word: notes is not not', () => {
    const n = createSearcher([e('/guide/help#y', 'It works, but not on the version sent', { kind: 'anchor', section: 'Guide' }), e('/native/notes', 'Release notes')]);
    expect(n.search('notes').map((h) => h.entry.path)).toEqual(['/native/notes']);
  });

  it('reads a version with or without its v', () => {
    const v = createSearcher([
      e('/dashboard/changelog#v3.4.3', 'v3.4.3', { kind: 'release', section: 'Dashboard' }),
      e('/dashboard/changelog#v3.3.4', 'v3.3.4', { kind: 'release', section: 'Dashboard' }),
      e('/dashboard/changelog#v3.4.4', 'v3.4.4', { kind: 'release', section: 'Dashboard' }),
    ]);
    expect(v.search('3.4.4')[0].entry.path).toBe('/dashboard/changelog#v3.4.4');
    expect(v.search('firmware 3.4.4')[0].entry.path).toBe('/dashboard/changelog#v3.4.4');
  });

  it('takes curly quotes as quotes, and µs as us', () => {
    expect(parseQuery('\u201creport rate\u201d').phrases).toEqual([{ words: ['report', 'rate'], closed: true }]);
    expect(parseQuery('570 µs').words).toEqual(['570', 'us']);
  });

  it('keeps 8k whole, as the site writes it, and lets a number match inside a name', () => {
    expect(parseQuery('8k').words).toEqual(['8k']);
    expect(matches('Razer Viper V3 Pro 8K', '8k')).toBe(true);
    expect(matches('Logitech G502 HERO', '502')).toBe(true);
  });
});

describe('createSearcher, as the review found it', () => {
  it('counts only the first part of a camelCase name as the first word', () => {
    const s = createSearcher([e('/a#x', 'LockScope', { kind: 'section' }), e('/a#y', 'Scope rules', { kind: 'section' })]);
    expect(s.search('scope')[0].entry.path).toBe('/a#y');
  });

  it('runs words together into a code name only along its parts', () => {
    const s = createSearcher([e('/library/clock', 'Clock'), e('/bindings/c/api#lock', 'Locks', { kind: 'section', section: 'C / C++ bindings' })]);
    expect(s.search('c lock')[0].entry.path).toBe('/bindings/c/api#lock');
  });

  it('never holds a word by finding it inside another', () => {
    const s = createSearcher([
      e('/guide/compatibility#device-usb-mouse', 'USB OPTICAL MOUSE', { kind: 'device', section: 'Guide', caption: 'Supported' }),
      e('/guide#ports', 'Ports', { kind: 'section', section: 'Guide', text: 'USB3 takes the mouse.' }),
    ]);
    expect(s.search('mouse port')[0].entry.path).toBe('/guide#ports');
  });

  it('lists every device and release that matches, past the three a page may give', () => {
    const s = createSearcher(Array.from({ length: 6 }, (_, i) => e(`/guide/compatibility#device-logitech-${i}`, `Logitech M${i}`, { kind: 'device', section: 'Guide' })));
    expect(s.search('logitech')).toHaveLength(5);
    expect(s.search('logitech', 40, { spread: false })).toHaveLength(6);
  });

  it('finds a synonym through another ending of its words', () => {
    const s = createSearcher([e('/native/commands/clip', 'CLIP', { text: 'Plays a recording.' })], { synonyms: [['clip', 'macro']] });
    expect(s.search('macros')[0]?.entry.path).toBe('/native/commands/clip');
  });

  it('gives nothing for a limit of none, and keeps a fractional limit', () => {
    expect(search.search('lock', 0)).toEqual([]);
    expect(search.search('lock', 1.5)).toHaveLength(1);
  });

  it('stays quick on a long query of common words', () => {
    const many = createSearcher(Array.from({ length: 50 }, (_, i) => e(`/n/${i}`, `Page ${i}`, { text: 'a '.repeat(400) })));
    const started = performance.now();
    many.search(Array(16).fill('a').join(' '));
    expect(performance.now() - started).toBeLessThan(150);
  });
});
