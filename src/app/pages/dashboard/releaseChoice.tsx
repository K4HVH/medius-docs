import { createResource, createSignal } from 'solid-js';
import { type FirmwareRelease, fetchReleases, olderReleases } from '../../../dashboard/firmware';
import { releaseDay } from '../../../dashboard/firmware/notes';
import { Select } from '../../shell/Select';

// The release a flash by hand takes: the latest, or an older one picked by its version.
export function createReleaseChoice(older: () => boolean) {
  const [releases] = createResource(fetchReleases);
  // A rejected resource re-throws on every read, render included, and there is no ErrorBoundary:
  // one unguarded read freezes the page.
  const list = () => {
    try {
      return releases();
    } catch {
      return undefined;
    }
  };
  const earlier = () => olderReleases(list());
  const [tag, setTag] = createSignal<string | null>(null);
  const release = (): FirmwareRelease | null =>
    older() ? (earlier().find((r) => r.tag === tag()) ?? earlier()[0] ?? null) : (list()?.[0] ?? null);
  // The release a missing image was looked for in.
  const where = () => (older() ? (release()?.tag ?? 'that release') : 'the latest release');

  const VersionField = (p: { disabled: boolean }) => (
    <div class="labelled">
      <span class="field-l">Version</span>
      <Select
        label="Version"
        options={earlier().map((r) => ({ value: r.tag, label: r.tag, note: releaseDay(r.publishedAt) }))}
        value={release()?.tag}
        disabled={p.disabled}
        onChange={setTag}
      />
    </div>
  );

  return { releases, release, earlier, where, VersionField };
}
