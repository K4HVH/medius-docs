// The site's arrows, drawn so they sit on the cap height of the text beside them.
export const Arrow = (props: { size?: number }) => (
  <svg class="arr" viewBox="0 0 16 16" width={props.size ?? 14} height={props.size ?? 14} aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" />
  </svg>
);

export const ArrowOut = (props: { size?: number }) => (
  <svg class="arr ne" viewBox="0 0 24 24" width={props.size ?? 14} height={props.size ?? 14} aria-hidden="true">
    <path d="M6 18 18 6M9 6h9v9" fill="none" stroke="currentColor" stroke-width="1.5" />
  </svg>
);
