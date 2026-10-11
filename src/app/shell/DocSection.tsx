import { For, Show, type JSX } from 'solid-js';
import { CopyLink } from './CopyLink';

// An identifier ("MediusCountersSnapshot") as its words, so a narrow screen breaks it between them.
const words = (title: string) => (/\s/.test(title) ? [title] : title.split(/(?<=[a-z0-9])(?=[A-Z])/));

// One section of a docs page: a ruled h2 with an optional caption. The rule lights while it is read.
export function DocSection(props: { id?: string; title: string; caption?: string; hidden?: boolean; children?: JSX.Element }) {
  return (
    <section class="doc-section" id={props.id} data-search-target={props.id ? '' : undefined} hidden={props.hidden}>
      <h2 class="doc-h2" aria-label={props.title}>
        <span class="doc-t">
          <For each={words(props.title)}>{(w, i) => (i() ? [<wbr />, w] : w)}</For>
          <Show when={props.id}>{(id) => <CopyLink id={id()} label={props.title} />}</Show>
        </span>
        <Show when={props.caption}>
          <span class="doc-caption caps">{props.caption}</span>
        </Show>
      </h2>
      {props.children}
    </section>
  );
}
