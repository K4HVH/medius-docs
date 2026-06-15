import { For, Show } from 'solid-js';

export type PortId = 'usb1' | 'usb2' | 'usb3';

const PORTS: { id: PortId; label: string; sub: string }[] = [
  { id: 'usb1', label: 'USB1', sub: 'Game PC' },
  { id: 'usb2', label: 'USB2', sub: 'Control' },
  { id: 'usb3', label: 'USB3', sub: 'Mouse' },
];

// A compact picture of the box: ports to plug are lit, the rest dimmed, plus an
// optional "hold BOOT" badge. The diagram carries the instruction; words don't.
export const PortDiagram = (props: { plug: PortId[]; boot?: 'main' | 'mouse' }) => {
  const on = (id: PortId) => props.plug.includes(id);
  return (
    <div style={{ margin: 'var(--g-spacing) 0' }}>
      <div
        style={{
          border: '1px solid var(--g-border-color)',
          'border-radius': 'var(--g-radius)',
          padding: 'var(--g-spacing-sm)',
        }}
      >
        <div
          style={{
            'font-size': '0.7em',
            color: 'var(--g-text-muted)',
            'margin-bottom': 'var(--g-spacing-sm)',
            'text-transform': 'uppercase',
            'letter-spacing': '0.06em',
          }}
        >
          Your box
        </div>
        <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)' }}>
          <For each={PORTS}>
            {(p) => (
              <div
                style={{
                  flex: '1',
                  'text-align': 'center',
                  padding: 'var(--g-spacing-sm)',
                  'border-radius': 'var(--g-radius)',
                  border: `2px solid ${on(p.id) ? 'var(--color-success)' : 'var(--g-border-color-subtle)'}`,
                  background: on(p.id)
                    ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
                    : 'transparent',
                  opacity: on(p.id) ? '1' : '0.5',
                }}
              >
                <div style={{ 'font-weight': '700' }}>{p.label}</div>
                <div style={{ 'font-size': '0.8em', color: 'var(--g-text-secondary)' }}>{p.sub}</div>
                <div
                  style={{
                    'margin-top': '4px',
                    'font-size': '0.8em',
                    'font-weight': '600',
                    color: on(p.id) ? 'var(--color-success)' : 'var(--g-text-muted)',
                  }}
                >
                  {on(p.id) ? 'plug into PC' : 'leave out'}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
      <Show when={props.boot}>
        <div
          style={{
            'margin-top': 'var(--g-spacing-sm)',
            padding: 'var(--g-spacing-sm)',
            'border-radius': 'var(--g-radius)',
            border: '1px solid var(--color-warning)',
            background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)',
            'text-align': 'center',
            'font-weight': '600',
          }}
        >
          Hold the {props.boot === 'mouse' ? 'mouse-side' : 'main'} chip's BOOT button while plugging in
        </div>
      </Show>
    </div>
  );
};
