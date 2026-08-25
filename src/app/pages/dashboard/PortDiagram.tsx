import { For, Show } from 'solid-js';

export type PortId = 'usb1' | 'usb2' | 'usb3';

// Download mode needs the button on the same side as the cable going in. Said that way it needs no
// left/right and no chip names: the diagram lights the socket, and the button is the one beside it.
export const holdButton = (id: PortId) =>
  `Hold the button next to ${id.toUpperCase()} down while you plug ${id.toUpperCase()} in`;

const PORTS: { id: PortId; label: string; sub: string }[] = [
  { id: 'usb1', label: 'USB1', sub: 'Game PC' },
  { id: 'usb2', label: 'USB2', sub: 'Control PC' },
  { id: 'usb3', label: 'USB3', sub: 'Mouse' },
];

// A compact picture of the box: `plug` ports light green ("plug in here"), `other` ports light
// amber (they belong on a different computer), `mouse` ports light blue, `out` ports light red
// ("unplug"), the rest dimmed, plus an optional hold-both-buttons badge. `where` renames a port for
// the machine it ends up on. The diagram carries the instruction; words don't.
export const PortDiagram = (props: {
  plug?: PortId[];
  other?: PortId[];
  out?: PortId[];
  mouse?: PortId[];
  boot?: PortId;
  where?: Partial<Record<PortId, string>>;
}) => {
  const isPlug = (id: PortId) => props.plug?.includes(id) ?? false;
  const isMouse = (id: PortId) => props.mouse?.includes(id) ?? false;
  const isOut = (id: PortId) => props.out?.includes(id) ?? false;
  const isOther = (id: PortId) => props.other?.includes(id) ?? false;
  const lit = (id: PortId) => isPlug(id) || isMouse(id) || isOut(id) || isOther(id);
  const accent = (id: PortId) =>
    isOut(id)
      ? 'var(--color-danger)'
      : isOther(id)
        ? 'var(--color-warning)'
        : isMouse(id)
          ? 'var(--color-primary)'
          : 'var(--color-success)';
  // "here" means this socket on the box, not this computer, and readers take it the other way.
  // The notes say what the socket needs; `where` says which machine the cable runs to.
  const note = (id: PortId) =>
    isOut(id)
      ? 'must be empty'
      : isOther(id)
        ? 'not this computer'
        : isPlug(id)
          ? 'plug in'
          : isMouse(id)
            ? 'your mouse'
            : 'nothing here';
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
            'font-size': '0.95em',
            'font-weight': '700',
            color: 'var(--g-text-secondary)',
            'margin-bottom': 'var(--g-spacing-sm)',
          }}
        >
          The three sockets on your box
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
                  border: `2px solid ${lit(p.id) ? accent(p.id) : 'var(--g-border-color-subtle)'}`,
                  background: lit(p.id)
                    ? `color-mix(in srgb, ${accent(p.id)} 14%, transparent)`
                    : 'transparent',
                  opacity: lit(p.id) ? '1' : '0.5',
                }}
              >
                <div
                  style={{
                    'font-weight': '700',
                    'text-decoration': isOut(p.id) ? 'line-through' : 'none',
                  }}
                >
                  {p.label}
                </div>
                <div style={{ 'font-size': '0.8em', color: 'var(--g-text-muted)' }}>
                  {props.where?.[p.id] ?? p.sub}
                </div>
                <div
                  style={{
                    'margin-top': '4px',
                    'font-size': '0.8em',
                    'font-weight': '600',
                    color: lit(p.id) ? accent(p.id) : 'var(--g-text-muted)',
                  }}
                >
                  {note(p.id)}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
      <Show when={props.boot}>
        {(id) => (
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
            {holdButton(id())}.
          </div>
        )}
      </Show>
    </div>
  );
};
