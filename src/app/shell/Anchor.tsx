import { Show, type JSX } from 'solid-js';
import { CopyLink } from './CopyLink';

// A marked block inside a docs section: a label, its link icon and what it holds, which search and links
// can name by its id.
export function Anchor(props: { id: string; label: string; aside?: JSX.Element; children?: JSX.Element }) {
  const label = () => [props.label, <CopyLink id={props.id} label={props.label} />];
  return (
    <div id={props.id} data-search-target>
      <div class="api-response-label">
        <Show when={props.aside} fallback={label()}>
          <span>{label()}</span>
          {props.aside}
        </Show>
      </div>
      {props.children}
    </div>
  );
}
