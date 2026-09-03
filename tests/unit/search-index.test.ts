import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { type SearchEntry, entries as allEntries } from '../../src/app/searchIndex';

// The dashboard is excluded from the doc routes, so it never reaches the markdown twins, llms.txt
// or the MCP surface. Ctrl+K is its only search, which makes this index the single place a renamed
// card can silently stop being findable.

type Entry = SearchEntry;

const dash = allEntries.filter((e) => e.group === 'Dashboard');

// Every term a card can be reached by: its own label, its description, and its keywords.
const haystack = (e: Entry) => [e.label, e.description ?? '', ...(e.keywords ?? [])].join(' | ').toLowerCase();

const find = (term: string): Entry[] => dash.filter((e) => haystack(e).includes(term.toLowerCase()));

describe('dashboard search index', () => {
  it('points every card at the tab it actually lives on', () => {
    const onControl = ['Injection', 'Input locks', 'Input catch', 'Clip playback', 'Status light', 'Safety clear'];
    const onDevice = ['Options', 'Imperfect clone', 'Movement riding', 'Bearing', 'Emit rate', 'Render', 'Capabilities', 'Performance', 'Device log'];
    // The tab is the path before the anchor. A card entry without one lands on the tab and scrolls
    // nowhere, which is what left every Dashboard result pointing at the same two pages.
    const route = (e: Entry) => e.path.split('#')[0];
    for (const label of onControl) {
      const e = dash.find((x) => x.label === label);
      expect(e, label).toBeDefined();
      expect(route(e!), label).toBe('/dashboard/control');
      expect(e!.path, label).toContain('#');
    }
    for (const label of onDevice) {
      const e = dash.find((x) => x.label === label);
      expect(e, label).toBeDefined();
      expect(route(e!), label).toBe('/dashboard');
      expect(e!.path, label).toContain('#');
    }
  });

  it('indexes every card the two tabs render', () => {
    // Read the titles off the source rather than restating them, so a card added without an index
    // entry fails here instead of quietly becoming unsearchable.
    const files = [
      'Control.tsx', 'DeviceInject.tsx', 'DeviceLock.tsx', 'DeviceEventCatch.tsx',
      'DeviceClip.tsx', 'DeviceLed.tsx', 'DeviceOptions.tsx', 'DeviceInfo.tsx', 'Device.tsx',
    ];
    const titles = new Set<string>();
    for (const f of files) {
      const src = readFileSync(`src/app/pages/dashboard/${f}`, 'utf8');
      for (const m of src.matchAll(/CardHeader\s+title="([^"]+)"/g)) titles.add(m[1]);
      // Options nests its controls as <Section title="...">, not as their own CardHeader. Only the
      // anchored ones are addressable, and those are exactly the ones an index entry can point at:
      // without this the oracle could not see Render, Emit rate, Bearing, Movement riding,
      // Imperfect clone or Box name, and the comment above would be false for six of them.
      for (const m of src.matchAll(
        /<div id="[^"]+" data-search-target>\s*<Section\s+title="([^"]+)"/g,
      )) {
        titles.add(m[1]);
      }
    }
    // Cards that are pure connection or progress state, not a feature to search for.
    const notFeatures = new Set([
      'Controls', 'Your box', 'Status', 'Installing', 'Flashing',
      'Browser not supported', 'Page not secure',
    ]);
    const missing = [...titles].filter((t) => !notFeatures.has(t) && find(t).length === 0);
    expect(missing).toEqual([]);
  });

  it('finds each card by the words on its own controls', () => {
    const cases: [string, string][] = [
      ['consume', 'Clip playback'],
      ['mark complete', 'Clip playback'],
      ['replayable', 'Clip playback'],
      ['autolock', 'Clip playback'],
      ['trigger', 'Clip playback'],
      ['mask', 'Injection'],
      ['force release', 'Injection'],
      ['drag', 'Injection'],
      ['stuck key', 'Injection'],
      ['every axis', 'Input locks'],
      ['blanket', 'Input locks'],
      ['timestamp', 'Input catch'],
      ['clock domain', 'Input catch'],
      ['capture', 'Input catch'],
      ['reset', 'Safety clear'],
      ['nkro', 'Capabilities'],
      ['report rate', 'Performance'],
    ];
    for (const [term, label] of cases) {
      expect(find(term).map((e) => e.label), term).toContain(label);
    }
  });

  it('finds the catch rework by the names it introduced', () => {
    // The error names are what a user pastes in after seeing one, and the existing error entries
    // already index their constants, so these follow that convention rather than adding entries.
    const all = allEntries.map(haystack).join(' \n ');
    const introduced = [
      'catchtablefull', 'emptysubscription', 'capturenotapplicable', 'notaninputfilter',
      'wildcardnotinput', 'halfedgeinputfilter', 'reservedid',
      'medius_status_err_catch_table_full', 'err_catch_table_full', 'catchtablefullerror',
      'is_connected', 'timestamped', 'clockdomain', 'ts_us', 'input_events', 'watch_axes',
      'capture', 'timeline', 'inputstream',
    ];
    expect(introduced.filter((t) => !all.includes(t))).toEqual([]);
  });

  it('keeps the old name for the wire field the spec still uses', () => {
    // The crate renamed the concept to Capture, but the protocol byte is still snaplen, so the
    // native page needs the old name and the crate page keeps it as a bridge.
    const all = allEntries.map(haystack).join(' \n ');
    expect(all).toContain('snaplen');
  });

  it('has no duplicate labels within the group', () => {
    const labels = dash.map((e) => e.label);
    expect(labels).toEqual([...new Set(labels)]);
  });
});
