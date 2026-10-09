import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { type SearchEntry, entries as allEntries } from '../../src/app/searchIndex';

// The dashboard is excluded from the doc routes, so it never reaches the markdown twins, llms.txt
// or the MCP surface.

type Entry = SearchEntry;

const dash = allEntries.filter((e) => e.group === 'Dashboard');

// Every term a card can be reached by: its own label, its description, and its keywords.
const haystack = (e: Entry) => [e.label, e.description ?? '', ...(e.keywords ?? [])].join(' | ').toLowerCase();

const find = (term: string): Entry[] => dash.filter((e) => haystack(e).includes(term.toLowerCase()));

describe('dashboard search index', () => {
  it('points every card at the tab it actually lives on', () => {
    const onControl = ['Injection', 'Input locks', 'Transforms', 'Input catch', 'Clip playback', 'Status light', 'Safety clear'];
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

  // Read off the source rather than restated, so a panel added without an index entry fails here instead
  // of quietly becoming unsearchable, and an entry whose anchor went away fails too.
  const PAGES: Record<string, string[]> = {
    '/dashboard': ['Device.tsx', 'DeviceInfo.tsx', 'DeviceOptions.tsx', 'DeviceFactoryReset.tsx', 'UpdateOnlyCard.tsx', 'ConnectPanel.tsx'],
    '/dashboard/control': [
      'Control.tsx', 'DeviceInject.tsx', 'DeviceLock.tsx', 'DeviceTransform.tsx', 'DeviceEventCatch.tsx', 'DeviceClip.tsx',
      'DeviceLed.tsx', 'DeviceRewrite.tsx', 'DevicePatch.tsx', 'DeviceRaw.tsx', 'DeviceTransfer.tsx', 'UpdateOnlyCard.tsx',
    ],
    '/dashboard/update': ['Update.tsx', 'Advanced.tsx', 'AdvancedUsb2.tsx'],
    '/dashboard/setup': ['Setup.tsx'],
  };
  const source = (path: string) => PAGES[path].map((f) => readFileSync(`src/app/pages/dashboard/${f}`, 'utf8')).join('\n');
  const panelTitles = (src: string) =>
    [...src.matchAll(/<Panel\b[^>]*>/g)].map((m) => /\btitle="([^"]+)"/.exec(m[0])?.[1]).filter((t): t is string => !!t);
  const anchors = (src: string) =>
    new Set([...src.matchAll(/\bid="([a-z0-9-]+)"/g), ...src.matchAll(/\{ key: '([a-z0-9-]+)', label:/g)].map((m) => m[1]));

  it('indexes every panel the dashboard renders', () => {
    // Panels that are pure connection or progress state, not a feature to search for.
    const notFeatures = new Set(['Your box', 'Status']);
    const missing = Object.keys(PAGES)
      .flatMap((p) => panelTitles(source(p)))
      .filter((t) => !notFeatures.has(t) && find(t).length === 0);
    expect(missing).toEqual([]);
  });

  it('lands every dashboard anchor on a panel or a tab that is there', () => {
    const dangling = dash
      .filter((e) => e.path.includes('#') && PAGES[e.path.split('#')[0]])
      .filter((e) => !anchors(source(e.path.split('#')[0])).has(e.path.split('#')[1]))
      .map((e) => e.path);
    expect(dangling).toEqual([]);
  });

  it('finds each card by the words on its own controls', () => {
    const cases: [string, string][] = [
      ['consume', 'Clip playback'],
      ['test firmware', 'Manual flash'],
      ['flash over usb2', 'Manual flash'],
      ['newer protocol', 'Newer firmware'],
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
