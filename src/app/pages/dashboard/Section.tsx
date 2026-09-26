// A rule above each later section: at even spacing, a section's last readout read as part of the
// next section's title.

import type { JSX } from 'solid-js';

const first = { 'margin-top': 'var(--g-spacing-sm)' } as const;

// Even split above and below: a filled chip's hard edge makes the gap above read larger than it is.
const gap = 'calc(var(--g-spacing) + var(--g-spacing-xs))';

const later = {
  'margin-top': gap,
  'padding-top': gap,
  'border-top': '1px solid var(--g-border-color)',
} as const;

// Drops the label's half-leading so the visible gap matches the padding; uppercase has no
// descenders.
const heading = { 'line-height': '1' } as const;

export const Section = (props: { title: string; first?: boolean; children: JSX.Element }) => (
  <div style={props.first ? first : later}>
    <div class="api-response-label" style={heading}>
      {props.title}
    </div>
    {props.children}
  </div>
);
