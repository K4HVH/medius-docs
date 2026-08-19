// Style objects the dashboard cards share. Previously each card carried its own copy of `label`
// and open-coded the same flex rows, so a spacing change meant editing five files.

export const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': 'var(--g-spacing-xs)',
} as const;

// Vertical rhythm is owned by the container, never by the child. A block that carries its own
// margin-top is a block someone can forget to give one, which is how the riding checkbox ended up
// tight against the buttons above it and a full gap below.
//
// Two levels only, the same two the reference pages use: one standard gap between blocks, and one
// extra-small gap binding a label to the control it names.
export const stack = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
} as const;

export const group = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing-xs)',
  'align-items': 'stretch',
} as const;

export const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;

// A row of buttons.
export const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

// A row of chips.
export const chips = { display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' } as const;

// An input and its buttons sharing one baseline.
export const controls = {
  display: 'flex',
  gap: 'var(--g-spacing-sm)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-end',
} as const;

// Label-left, value-right.
export const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;

// Kept as no-ops so a stray spread cannot re-introduce a hand-applied margin. Both gaps are the
// container's now.
export const section = {} as const;

export const status = {} as const;

// One column of the two-column card layout. The basis is wider than the Device tab's because
// these cards carry dense control rows: at 340px two columns still fit on a tablet and every
// button row wraps three deep.
export const col = {
  flex: '1 1 420px',
  'min-width': '0',
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
} as const;

// A vertical stack of checkboxes. Checkbox renders inline, so a bare row of them runs together
// with no gap between the label of one and the box of the next.
export const checkColumn = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing-xs)',
  'align-items': 'flex-start',
} as const;

export const columns = {
  display: 'flex',
  gap: 'var(--g-spacing)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-start',
} as const;
