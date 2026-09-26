export const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
} as const;

export const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;

// Buttons.
export const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

// Chips.
export const chips = { display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' } as const;

// An input and its buttons on one baseline.
export const controls = {
  display: 'flex',
  gap: 'var(--g-spacing-sm)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-end',
} as const;

// Label left, value right.
export const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;

// Gap between card sections.
export const section = { 'margin-top': 'var(--g-spacing)' } as const;

export const status = { 'margin-top': 'var(--g-spacing-sm)' } as const;

// One column of a two-column card.
export const col = {
  flex: '1 1 420px',
  'min-width': '0',
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
} as const;

// Checkbox renders inline, so a bare row runs one label into the next box.
export const checkColumn = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'align-items': 'flex-start',
} as const;

export const columns = {
  display: 'flex',
  gap: 'var(--g-spacing)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-start',
} as const;
