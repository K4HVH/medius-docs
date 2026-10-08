import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Arrow, ArrowOut } from './Arrow';

// A ruled link row: the name on the left, a short tag and an arrow on the right.
export function IndexRow(props: { href: string; title: string; tag?: string; external?: boolean }) {
  const inner = () => (
    <>
      <h3>{props.title}</h3>
      <span class="go-r">
        <Show when={props.tag}>
          <span>{props.tag}</span>
        </Show>
        <Show when={props.external} fallback={<Arrow size={24} />}>
          <ArrowOut size={24} />
        </Show>
      </span>
    </>
  );
  return (
    <Show
      when={props.external}
      fallback={
        <A class="go" href={props.href} end activeClass="" inactiveClass="">
          {inner()}
        </A>
      }
    >
      <a class="go" href={props.href} target="_blank" rel="noreferrer">
        {inner()}
      </a>
    </Show>
  );
}
