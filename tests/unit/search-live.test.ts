import { describe, expect, it } from 'vitest';
import { liveEntries, mergeLive } from '../../src/app/search/live';
import { withIds } from '../../src/app/data/compatMerge';
import type { FirmwareRelease } from '../../src/dashboard/firmware/client';
import type { IndexEntry, SearchIndex } from '../../src/app/search/types';

const release = (tag: string, notes: string): FirmwareRelease => ({
  tag,
  name: tag,
  publishedAt: '2026-10-02T10:00:00Z',
  prerelease: false,
  notes,
  assets: [],
});

describe('liveEntries', () => {
  it('makes a release an entry on its changelog anchor, its notes as plain text without their headings or the commits', () => {
    const [r] = liveEntries({
      releases: [release('v3.4.4', '## Changes\n- Fixed the **Logitech** delay with `wire rate`\n<!-- commits -->\n## Commits\n- abc fix')],
      devices: [],
    });
    expect(r).toMatchObject({ path: '/dashboard/changelog#v3.4.4', title: 'v3.4.4', kind: 'release', section: 'Dashboard', crumb: 'Changelog', caption: '2 Oct 2026' });
    expect(r.text).toBe('Fixed the Logitech delay with wire rate');
  });

  it('makes a device an entry on its row, its verdict as caption', () => {
    const [d] = liveEntries({
      releases: null,
      devices: [{ name: 'G502 X LIGHTSPEED', kind: 'mouse', verdict: 'works', vidpid: '046d:c098', reported: 'v3.2.0', note: 'Needs nothing' }],
    });
    expect(d).toMatchObject({ path: '/guide/compatibility#device-g502-x-lightspeed', title: 'G502 X LIGHTSPEED', kind: 'device', section: 'Guide', crumb: 'Devices', caption: 'Supported' });
    expect(d.text).toBe('Mouse\nNeeds nothing\n046d:c098\nReported on v3.2.0');
  });
});

describe('withIds', () => {
  it('gives each row an id from its name, and rows that share a name their ids too', () => {
    const rows = withIds([
      { name: 'Receiver', kind: 'mouse', verdict: 'works', vidpid: '1234:0001' },
      { name: 'Receiver', kind: 'keyboard', verdict: 'works', vidpid: '1234:0002' },
      { name: 'Ace 68 Pro', kind: 'keyboard', verdict: 'doesnt' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['device-receiver-1234-0001', 'device-receiver-1234-0002', 'device-ace-68-pro']);
  });

  it('gives a row the same id whatever order the rows come in', () => {
    const a = { name: 'USB Receiver', kind: 'mouse' as const, verdict: 'works' as const, vidpid: '046d:c547' };
    const b = { name: 'USB Receiver', kind: 'mouse' as const, verdict: 'works' as const, vidpid: '046d:c539' };
    const one = Object.fromEntries(withIds([a, b]).map((r) => [r.vidpid, r.id]));
    const two = Object.fromEntries(withIds([b, a]).map((r) => [r.vidpid, r.id]));
    expect(one).toEqual(two);
    expect(withIds([b]).map((r) => r.id)).toEqual(['device-usb-receiver']);
  });
});

describe('mergeLive', () => {
  it('adds the live entries, each replacing a built one at the same address', () => {
    const built: SearchIndex = {
      version: 1,
      built: 'x',
      entries: [
        { path: '/guide', title: 'Start here', kind: 'page', section: 'Guide', crumb: '', text: '' },
        { path: '/dashboard/changelog#v1.0.0', title: 'old', kind: 'anchor', section: 'Dashboard', crumb: '', text: '' },
      ],
    };
    const live: IndexEntry[] = [{ path: '/dashboard/changelog#v1.0.0', title: 'v1.0.0', kind: 'release', section: 'Dashboard', crumb: 'Changelog', text: '' }];
    const merged = mergeLive(built, live);
    expect(merged.entries.map((e) => e.title)).toEqual(['Start here', 'v1.0.0']);
    expect(built.entries[1].title).toBe('old');
  });
});
