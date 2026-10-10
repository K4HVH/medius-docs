import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { type FirmwareRelease, latestReleases, releasesInHand } from '../../../dashboard/firmware';
import { type Block, type CommitGroup, groupCommits, inlineRuns, parseBlocks, splitRelease } from '../../../dashboard/firmware/notes';
import { PageHeader } from '../../shell/PageHeader';
import { itemFor } from '../../items';
import { arrive, armReveals, fontsReady, inOrder, turnIn } from '../../shell/motion';
import { openingAt } from '../../shell/scrollPlace';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const Text = (props: { text: string }) => (
  <For each={inlineRuns(props.text)}>
    {(run) =>
      run.href ? (
        <a href={run.href} target="_blank" rel="noreferrer">{run.text}</a>
      ) : run.strong ? (
        <strong>{run.text}</strong>
      ) : run.code ? (
        <code>{run.text}</code>
      ) : (
        run.text
      )
    }
  </For>
);

const Blocks = (props: { blocks: Block[] }) => (
  <For each={props.blocks}>
    {(b) =>
      b.kind === 'heading' ? (
        <p class="sublabel">{b.text}</p>
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

const Groups = (props: { groups: CommitGroup[] }) => (
  <div class="cmts">
    <For each={props.groups}>
      {(g) => (
        <>
          <Show when={g.repo}>
            <p class="sublabel">{g.repo}</p>
          </Show>
          <ol>
            <For each={g.commits}>
              {(c) => (
                <li>
                  {c.subject}
                  <Show when={c.hash}>
                    <code>{c.hash}</code>
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </>
      )}
    </For>
  </div>
);

const Chevron = () => (
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
    <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" />
  </svg>
);

const Release = (props: { release: FirmwareRelease; open: boolean }) => {
  // Drawn again only when the notes change, not when a fetch brings the same release anew.
  const notes = createMemo(() => props.release.notes);
  const parts = createMemo(() => splitRelease(notes()));
  const grouped = () => groupCommits(parts().commits);
  // A release from before written notes is its commit list alone, shown as one.
  const old = () => (parts().commits ? null : groupCommits(parts().notes));
  const [open, setOpen] = createSignal(props.open);
  const body = `commits-${props.release.tag}`;
  return (
    <section id={props.release.tag} class="rel">
      <div class="rel-l">
        <h2>{props.release.tag}</h2>
        <time class="caps" datetime={props.release.publishedAt}>
          {fmtDate(props.release.publishedAt)}
        </time>
        <Show when={props.release.prerelease}>
          <Chip variant="warning">Pre-release</Chip>
        </Show>
      </div>
      <div class="rel-r">
        <Show
          when={old()}
          fallback={
            <Show when={parts().notes} fallback={<p class="mut">No notes.</p>}>
              <Blocks blocks={parseBlocks(parts().notes)} />
            </Show>
          }
        >
          {(g) => <Groups groups={g()} />}
        </Show>
        <Show when={parts().commits}>
          <div class="more" classList={{ open: open() }}>
            <Button
              variant="secondary"
              icon={Chevron}
              aria-expanded={open()}
              aria-controls={body}
              onClick={() => setOpen(!open())}
            >
              {open() ? 'Hide commits' : 'Show commits'}
            </Button>
            <div class="body" id={body}>
              <div>
                <Show when={grouped()} fallback={<Blocks blocks={parseBlocks(parts().commits)} />}>
                  {(g) => <Groups groups={g()} />}
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
};

// The releases server/fill.ts embedded in the page, so the first render already has them; by a link, the
// ones fetched beside the page's code.
const embedded = (): FirmwareRelease[] | undefined => {
  try {
    const el = document.getElementById('releases-data');
    return el ? (JSON.parse(el.textContent ?? '') as FirmwareRelease[]) : undefined;
  } catch {
    return undefined;
  }
};

const Changelog = () => {
  const seed = embedded() ?? releasesInHand();
  const [releases] = createResource(latestReleases, { initialValue: seed });
  // A failed resource throws on every read, so it is read through this; a failed refresh keeps what
  // the server embedded.
  const list = (): FirmwareRelease[] | undefined => {
    try {
      return releases();
    } catch {
      return seed;
    }
  };
  // Each release drawn once, by its tag: a fetch that brings the list again redraws none of them.
  const byTag = createMemo(() => new Map((list() ?? []).map((r) => [r.tag, r])));
  const tags = createMemo(() => [...byTag().keys()], [], { equals: (a, b) => a.length === b.length && a.every((t, i) => t === b[i]) });
  // A link to one release (its address, or the changelog's #tag) lands on it with its commits open.
  const location = useLocation();
  const hashed = itemFor(location.pathname)?.target ?? decodeURIComponent(location.hash.slice(1));
  let rels: HTMLDivElement | undefined;
  let armed = false;
  let dispose = () => {};
  onCleanup(() => dispose());
  // Releases the fetch brought after the page arrived arrive themselves. The sections below the screen
  // rise as they come into view, armed after any jump to a release so the one landed on is never held back.
  createEffect(() => {
    if (armed || !list()?.length) return;
    armed = true;
    if (rels && !rels.querySelector(':scope > .rb'))
      arrive(rels, inOrder([...rels.children] as HTMLElement[], turnIn(rels), 55));
    const land = (frames: number) =>
      requestAnimationFrame(() => {
        const section = hashed ? document.getElementById(hashed) : null;
        if (hashed && !section && frames > 0) return land(frames - 1);
        // Unless Back or a reload put the page where it was.
        if (openingAt() === null) section?.scrollIntoView({ block: 'start' });
        if (rels) void fontsReady().then(() => (dispose = armReveals(rels!, '.rel')));
      });
    land(30);
  });
  return (
    <>
      <PageHeader />
      <div id="changelog">
        <Switch fallback={<p class="mut">No releases yet.</p>}>
          <Match when={list()?.length}>
            <div class="rels" ref={rels}>
              <For each={tags()}>{(tag) => <Release release={byTag().get(tag)!} open={tag === hashed} />}</For>
            </div>
          </Match>
          <Match when={releases.error}>
            <div class="callout callout--warning">Could not load the changelog.</div>
          </Match>
          <Match when={releases.loading}>
            <div data-fill="changelog" data-search-skip><p class="mut">Loading...</p></div>
          </Match>
        </Switch>
      </div>
    </>
  );
};

export default Changelog;
