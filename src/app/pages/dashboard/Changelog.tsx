import { For, Match, Show, Switch, createResource } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import { type FirmwareRelease, fetchReleases } from '../../../dashboard/firmware';
import { type Block, linkify, parseBlocks, splitRelease } from '../../../dashboard/firmware/notes';
import '../../../styles/docs.css';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const Text = (props: { text: string }) => (
  <For each={linkify(props.text)}>
    {(run) => (run.href ? <a href={run.href} target="_blank" rel="noreferrer">{run.text}</a> : run.text)}
  </For>
);

const Blocks = (props: { blocks: Block[] }) => (
  <For each={props.blocks}>
    {(b) =>
      b.kind === 'heading' ? (
        <div class="release__heading">{b.text}</div>
      ) : b.kind === 'list' ? (
        <ul>
          <For each={b.items}>{(it) => <li><Text text={it} /></li>}</For>
        </ul>
      ) : (
        <p><Text text={b.text} /></p>
      )
    }
  </For>
);

const Release = (props: { release: FirmwareRelease }) => {
  const parts = () => splitRelease(props.release.notes);
  return (
    <section id={props.release.tag} class="release">
      <div class="release__title">
        <h4>{props.release.tag}</h4>
        <Show when={props.release.prerelease}>
          <Chip variant="warning">Pre-release</Chip>
        </Show>
        <span class="release__date">{fmtDate(props.release.publishedAt)}</span>
      </div>
      <Show when={parts().notes} fallback={<p class="release__date">No notes.</p>}>
        <Blocks blocks={parseBlocks(parts().notes)} />
      </Show>
      <Show when={parts().commits}>
        <details>
          <summary>Show commits</summary>
          <Blocks blocks={parseBlocks(parts().commits)} />
        </details>
      </Show>
    </section>
  );
};

const Changelog = () => {
  const [releases] = createResource(fetchReleases);
  return (
    <div id="changelog" data-search-target>
      <Card>
        <CardHeader title="Changelog" subtitle="Firmware releases" />
        <Switch>
          <Match when={releases.loading}>
            <div data-fill="changelog"><p>Loading...</p></div>
          </Match>
          <Match when={releases.error}>
            <div class="callout callout--warning">Could not load the changelog.</div>
          </Match>
          <Match when={releases()?.length === 0}>
            <p>No releases yet.</p>
          </Match>
          <Match when={releases()}>
            <div class="releases">
              <For each={releases()}>{(r) => <Release release={r} />}</For>
            </div>
          </Match>
        </Switch>
      </Card>
    </div>
  );
};

export default Changelog;
