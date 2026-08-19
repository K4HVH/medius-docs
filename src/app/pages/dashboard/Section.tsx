// One labelled section inside a card.
//
// The label alone was not enough separation: the space above a heading matched the space between a
// control and its status chip, so a section's last readout looked like it belonged to the next
// section's title. The rule makes the boundary unmissable, and the space around it is the largest
// gap on the card.

import type { JSX } from 'solid-js';
import { stack } from './ui';

const first = { 'margin-top': 'var(--g-spacing-sm)' } as const;

// Matched above and below. The usual rule is more space above a heading than below it, but the
// element a section ends on is often a filled chip, whose hard edge makes the gap above read as
// larger than it measures; against that, an even split is what looks even.
const gap = 'calc(var(--g-spacing) + var(--g-spacing-xs))';

const later = {
  'margin-top': gap,
  'padding-top': gap,
  'border-top': '1px solid var(--g-border-color)',
} as const;

// The label's own line box carries half-leading above its caps, which lands the visible text a few
// pixels lower than the padding says. Collapsing it to the cap height makes the measured gap and
// the seen gap the same number. The text is uppercased, so nothing descends out of the box.
const heading = { 'line-height': '1' } as const;

// The body owns the gap between its blocks, so no child carries a margin of its own.
export const Section = (props: { title: string; first?: boolean; children: JSX.Element }) => (
  <div style={props.first ? first : later}>
    <div class="api-response-label" style={heading}>
      {props.title}
    </div>
    <div style={stack}>{props.children}</div>
  </div>
);
