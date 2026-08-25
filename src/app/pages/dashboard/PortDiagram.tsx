import { For, Show } from 'solid-js';

export type PortId = 'usb1' | 'usb2' | 'usb3';

const LABEL: Record<PortId, string> = { usb1: 'USB1', usb2: 'USB2', usb3: 'USB3' };
const ORDER: PortId[] = ['usb1', 'usb2', 'usb3'];

export const holdButton = (id: PortId) =>
  `Hold the button next to ${LABEL[id]} down while you plug ${LABEL[id]} in`;

type Tone = 'connect' | 'device' | 'clear' | 'idle';

const COLOUR: Record<Tone, string> = {
  connect: 'var(--color-success)',
  // The mouse or keyboard is not a computer, so it does not read as one of the other two.
  device: 'var(--color-primary)',
  clear: 'var(--color-danger)',
  idle: 'var(--g-border-color-subtle)',
};

interface Cell {
  tone: Tone;
  sub: string;
  note: string;
}

const Ports = (props: { cells: Record<PortId, Cell>; badge?: string }) => (
  <div style={{ 'margin-bottom': 'var(--g-spacing)' }}>
    <div
      style={{
        border: '1px solid var(--g-border-color)',
        'border-radius': 'var(--g-radius)',
        padding: 'var(--g-spacing-sm)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)' }}>
        <For each={ORDER}>
          {(id) => {
            const c = () => props.cells[id];
            const on = () => c().tone !== 'idle';
            return (
              <div
                style={{
                  flex: '1',
                  'text-align': 'center',
                  padding: 'var(--g-spacing-sm)',
                  'border-radius': 'var(--g-radius)',
                  border: `2px solid ${COLOUR[c().tone]}`,
                  background: on()
                    ? `color-mix(in srgb, ${COLOUR[c().tone]} 14%, transparent)`
                    : 'transparent',
                  opacity: on() ? '1' : '0.5',
                }}
              >
                <div
                  style={{
                    'font-weight': '700',
                    'text-decoration': c().tone === 'clear' ? 'line-through' : 'none',
                  }}
                >
                  {LABEL[id]}
                </div>
                <div style={{ 'font-size': '0.8em', color: 'var(--g-text-muted)' }}>{c().sub}</div>
                <div
                  style={{
                    'margin-top': '4px',
                    'font-size': '0.8em',
                    'font-weight': '600',
                    color: on() ? COLOUR[c().tone] : 'var(--g-text-muted)',
                  }}
                >
                  {c().note}
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
    <Show when={props.badge}>
      {(text) => (
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
          {text()}
        </div>
      )}
    </Show>
  </div>
);

const cells = (f: (id: PortId) => Cell): Record<PortId, Cell> => ({
  usb1: f('usb1'),
  usb2: f('usb2'),
  usb3: f('usb3'),
});

/**
 * Writing firmware to one chip. The cable goes into the machine running this page, whatever that
 * socket does afterwards, and every other cable has to be out — a chip already powered through
 * another port does not come up in download mode, and USB1 with USB3 can kill the computer.
 */
export const InstallPorts = (props: { socket: PortId }) => (
  <Ports
    badge={`${holdButton(props.socket)}.`}
    cells={cells((id) =>
      id === props.socket
        ? { tone: 'connect', sub: 'This device', note: 'plug in' }
        : { tone: 'clear', sub: '', note: 'unplug' },
    )}
  />
);

/** Getting one cable out, and nothing else. */
export const ClearPort = (props: { socket: PortId }) => (
  <Ports
    cells={cells((id) =>
      id === props.socket
        ? { tone: 'clear', sub: '', note: 'unplug' }
        : { tone: 'idle', sub: '', note: '' },
    )}
  />
);

/**
 * Where the three cables live once it is installed. USB2 is the one that has to reach the machine
 * you are reading this on, or there is nothing here to connect to.
 */
export const WiringPorts = () => (
  <Ports
    cells={{
      usb1: { tone: 'connect', sub: 'Game PC', note: 'plug in' },
      usb2: { tone: 'connect', sub: 'This device', note: 'plug in' },
      usb3: { tone: 'device', sub: 'Mouse/keyboard', note: 'plug in' },
    }}
  />
);
