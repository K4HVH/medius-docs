import { For, Match, Show, Switch, createResource } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import { type FirmwareRelease, fetchReleases } from '../../../dashboard/firmware';
import '../../../styles/docs.css';

const muted = { color: 'var(--g-text-secondary)', 'margin-top': 'var(--g-spacing-xs)' } as const;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Release notes are a commit list (lines like "- subject (hash)"). Render bullet
// lines as a list and anything else as a line of text.
type Block = { kind: 'list'; items: string[] } | { kind: 'text'; text: string };

const Notes = (props: { notes: string }) => {
  const blocks = (): Block[] => {
    const acc: Block[] = [];
    for (const raw of props.notes.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^[-*]\s+(.*)$/);
      if (m) {
        const last = acc[acc.length - 1];
        if (last && last.kind === 'list') last.items.push(m[1]);
        else acc.push({ kind: 'list', items: [m[1]] });
      } else {
        acc.push({ kind: 'text', text: line.replace(/^#+\s*/, '') });
      }
    }
    return acc;
  };
  return (
    <For each={blocks()}>
      {(b) =>
        b.kind === 'list' ? (
          <ul style={{ margin: 'var(--g-spacing-xs) 0', 'padding-left': 'var(--g-spacing)' }}>
            <For each={b.items}>{(it) => <li>{it}</li>}</For>
          </ul>
        ) : (
          <p>{b.text}</p>
        )
      }
    </For>
  );
};

const Release = (props: { release: FirmwareRelease }) => (
  <div style={{ 'padding-bottom': 'var(--g-spacing)' }}>
    <div style={{ display: 'flex', 'align-items': 'baseline', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
      <strong style={{ 'font-size': 'var(--font-size-lg)' }}>{props.release.tag}</strong>
      <Show when={props.release.prerelease}>
        <Chip variant="warning">pre-release</Chip>
      </Show>
      <span style={muted}>{fmtDate(props.release.publishedAt)}</span>
    </div>
    <Show
      when={props.release.notes.trim()}
      fallback={<p style={muted}>No notes for this release.</p>}
    >
      <Notes notes={props.release.notes} />
    </Show>
  </div>
);

const Changelog = () => {
  const [releases] = createResource(fetchReleases);
  return (
    <Card>
      <CardHeader title="Changelog" subtitle="Firmware release history" />
      <Switch>
        <Match when={releases.loading}>
          <p>Loading...</p>
        </Match>
        <Match when={releases.error}>
          <div class="callout callout--warning">Could not load the changelog.</div>
        </Match>
        <Match when={releases()?.length === 0}>
          <p>No releases yet.</p>
        </Match>
        <Match when={releases()}>
          <For each={releases()}>{(r) => <Release release={r} />}</For>
        </Match>
      </Switch>
    </Card>
  );
};

export default Changelog;
