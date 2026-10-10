import { IndexRow } from '../../shell/IndexRow';
import { LINKS } from '../../site';
import { figureText } from '../../data/homeFigures';

export function IndexRows(props: { discord?: number }) {
  return (
    <nav class="index frame" aria-label="Index">
      <p class="label">Index</p>
      <IndexRow href="/dashboard/setup" title="Install" tag="Flash a box from the browser" />
      <IndexRow href="/dashboard" title="Dashboard" tag="Update and configure a box" />
      <IndexRow href="/native" title="Developers" tag="Rust, Python, C, C++" />
      <IndexRow
        href={LINKS.discord}
        title="Discord"
        external
        tag={<span data-fill="vital-discord">{props.discord ? figureText('discord', props.discord) : ''}</span>}
      />
    </nav>
  );
}
