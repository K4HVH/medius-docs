import type { JSX } from 'solid-js';
import { CopyLink } from './CopyLink';

// A marked block inside a docs section: a label, its link icon and its content. Search and links name it by
// its id.
export function Anchor(props: { id: string; label: string; children?: JSX.Element }) {
  return (
    <div id={props.id} data-search-target>
      <div class="api-response-label">
        {props.label}
        <CopyLink id={props.id} label={props.label} />
      </div>
      {props.children}
    </div>
  );
}
