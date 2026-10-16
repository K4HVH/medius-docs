import { For, Show, type JSX } from 'solid-js';
import { CopyLink } from './CopyLink';

// A title split into words, or an identifier split at its capitals ("MediusCountersSnapshot") or after its
// underscores ("allow_imperfect_clones"), so a narrow screen can break it between the parts.
const words = (title: string) => (/\s/.test(title) ? title.split(/(?<=\s)/) : title.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=_)(?=.)/));

// One section of a docs page: a ruled h2 with an optional caption. The rule lights while the section is read.
export function DocSection(props: { id?: string; title: string; caption?: string; aside?: JSX.Element; hidden?: boolean; children?: JSX.Element }) {
  return (
    <section class="doc-section" id={props.id} data-search-target={props.id ? '' : undefined} hidden={props.hidden}>
      <h2 class="doc-h2" aria-label={props.title}>
        <span class="doc-t">
          <For each={words(props.title).slice(0, -1)}>{(w) => [w, <wbr />]}</For>
          <Show when={props.id} fallback={words(props.title).at(-1)}>
            {(id) => (
              <span class="doc-last">
                {words(props.title).at(-1)}
                <CopyLink id={id()} label={props.title} glued />
              </span>
            )}
          </Show>
        </span>
        <Show when={props.caption}>
          <span class="doc-caption caps">{props.caption}</span>
        </Show>
        {props.aside}
      </h2>
      {props.children}
    </section>
  );
}
