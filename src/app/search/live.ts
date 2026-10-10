import type { FirmwareRelease } from '../../dashboard/firmware/client';
import { inlineRuns, parseBlocks, splitRelease } from '../../dashboard/firmware/notes';
import { KIND_LABEL, VERDICT_LABEL, type CompatEntry } from '../data/compatibility';
import { withIds } from '../data/compatMerge';
import type { IndexEntry, SearchIndex } from './types';

// The entries only the server knows: each firmware release, and each device on the Devices page with
// the owner reports and the stats merged. The site build has neither, so a release published today is
// found today.

const plain = (md: string) => inlineRuns(md).map((r) => r.text).join('');

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function liveEntries(sources: { releases: readonly FirmwareRelease[] | null; devices: readonly CompatEntry[] }): IndexEntry[] {
  const releases = (sources.releases ?? []).map((r): IndexEntry => ({
    path: `/dashboard/changelog#${r.tag}`,
    title: r.tag,
    kind: 'release',
    section: 'Dashboard',
    crumb: 'Changelog',
    caption: day(r.publishedAt),
    // The notes' headings (Changes, Notes) say nothing a search could use.
    text: parseBlocks(splitRelease(r.notes).notes)
      .flatMap((b) => (b.kind === 'list' ? b.items : b.kind === 'text' ? [b.text] : []))
      .map(plain)
      .join('\n'),
  }));
  const devices = withIds(sources.devices).map((d): IndexEntry => ({
    path: `/guide/compatibility#${d.id}`,
    title: d.name,
    kind: 'device',
    section: 'Guide',
    crumb: 'Devices',
    caption: VERDICT_LABEL[d.verdict],
    text: [KIND_LABEL[d.kind], d.note, d.vidpid !== d.name ? d.vidpid : undefined, d.reported ? `Reported on ${d.reported}` : undefined]
      .filter(Boolean)
      .join('\n'),
  }));
  return [...releases, ...devices];
}

// The built index with the live entries added, each replacing a built entry at its address.
export function mergeLive(index: SearchIndex, live: IndexEntry[]): SearchIndex {
  const fresh = new Set(live.map((e) => e.path));
  return { ...index, entries: [...index.entries.filter((e) => !fresh.has(e.path)), ...live] };
}
