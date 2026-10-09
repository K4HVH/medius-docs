import { Show, type JSX } from 'solid-js';

// One section of a docs page: a ruled h2 with an optional caption. The rule lights while it is read.
export function DocSection(props: { id?: string; title: string; caption?: string; hidden?: boolean; children?: JSX.Element }) {
  return (
    <section class="doc-section" id={props.id} data-search-target={props.id ? '' : undefined} hidden={props.hidden}>
      <h2 class="doc-h2">
        {props.title}
        <Show when={props.caption}>
          <span class="doc-caption caps">{props.caption}</span>
        </Show>
      </h2>
      {props.children}
    </section>
  );
}
