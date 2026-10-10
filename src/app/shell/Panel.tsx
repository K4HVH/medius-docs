import { Show, type JSX } from 'solid-js';

// Dashboard panels in two columns; one column in a narrow page.
export function Panels(props: { children: JSX.Element }) {
  return <div class="panels">{props.children}</div>;
}

// Panels stacked in one column of the two.
export function Stack(props: { children: JSX.Element; wide?: boolean }) {
  return (
    <div class="stack" classList={{ wide: props.wide }}>
      {props.children}
    </div>
  );
}

// One block of a dashboard page: the docs section heading and its rule, then the content. A tab holding
// one panel gives it no title: the tab names it. `aside` sits at the heading's right (a count, a button).
export function Panel(props: {
  id?: string;
  title?: string;
  // Shown only in one state of the box (an old firmware, events streaming), so never a search result: a
  // link to it would land where it is not.
  transient?: boolean;
  aside?: JSX.Element;
  wide?: boolean;
  class?: string;
  children?: JSX.Element;
}) {
  return (
    <div
      class={`pn${props.class ? ` ${props.class}` : ''}`}
      classList={{ wide: props.wide }}
      id={props.id}
      data-search-target={props.id && !props.transient ? '' : undefined}
    >
      <Show when={props.title}>
        <div class="ph">
          <h2>{props.title}</h2>
          {props.aside}
        </div>
      </Show>
      <div class="pb">{props.children}</div>
    </div>
  );
}
