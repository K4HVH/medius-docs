import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Action, type KbdCaps } from '../../../dashboard/protocol';
import { useDashboard } from './context';

// A few common HID keycodes (Keyboard/Keypad usage page). 0xE0-0xE7 are modifiers.
const KEYS: { label: string; usage: number }[] = [
  { label: 'A', usage: 0x04 },
  { label: 'B', usage: 0x05 },
  { label: 'C', usage: 0x06 },
  { label: 'Enter', usage: 0x28 },
  { label: 'Escape', usage: 0x29 },
  { label: 'Left Shift', usage: 0xe1 },
  { label: 'Left Ctrl', usage: 0xe0 },
];

// A few common 16-bit Consumer (media) usages.
const MEDIA: { label: string; usage: number }[] = [
  { label: 'Play / Pause', usage: 0xcd },
  { label: 'Mute', usage: 0xe2 },
  { label: 'Volume Up', usage: 0xe9 },
  { label: 'Volume Down', usage: 0xea },
];

const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
} as const;

const grid = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: 'var(--g-spacing-sm)',
} as const;

const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;
const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;

const Row = (props: { label: string; children: unknown }) => (
  <div style={field}>
    <span style={muted}>{props.label}</span>
    <span>{props.children as never}</span>
  </div>
);

const DeviceKeyboard = () => {
  const dash = useDashboard();
  const kbdAttached = () => dash.health()?.kbdAttached === true;

  // Read the keyboard capabilities once a keyboard is bound. Re-reads when the bound state flips.
  const [caps, setCaps] = createSignal<KbdCaps | null>(null);
  createEffect(() => {
    const link = dash.link();
    if (!kbdAttached() || !link) {
      setCaps(null);
      return;
    }
    let live = true;
    link
      .queryKbdCaps()
      .then((c) => {
        if (live && dash.link() === link) setCaps(c);
      })
      .catch(() => {});
    onCleanup(() => {
      live = false;
    });
  });

  // Hold the key down while the pointer is held, release on up or leave (matches a real key press).
  const keyHold = (usage: number) => ({
    onPointerDown: () => void dash.link()?.key(usage, Action.Press),
    onPointerUp: () => void dash.link()?.key(usage, Action.SoftRelease),
    onPointerLeave: () => void dash.link()?.key(usage, Action.SoftRelease),
  });

  const mediaHold = (usage: number) => ({
    onPointerDown: () => void dash.link()?.consumer(usage, Action.Press),
    onPointerUp: () => void dash.link()?.consumer(usage, Action.SoftRelease),
    onPointerLeave: () => void dash.link()?.consumer(usage, Action.SoftRelease),
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Keyboard" subtitle="Type onto the cloned keyboard" />
        <Show
          when={kbdAttached()}
          fallback={<p style={muted}>No keyboard is attached to the box.</p>}
        >
          <p>
            Press and hold a key to inject it on top of the real typing. Keys release when you let go.
            Media keys need a board that reports them. Injection clears on its own if the dashboard
            disconnects.
          </p>
          <div style={label}>Keys</div>
          <div style={grid}>
            <For each={KEYS}>
              {(k) => (
                <Button variant="secondary" {...keyHold(k.usage)}>
                  {k.label}
                </Button>
              )}
            </For>
          </div>
          <div style={{ 'margin-top': 'var(--g-spacing)' }}>
            <div style={label}>Media</div>
            <div style={grid}>
              <For each={MEDIA}>
                {(m) => (
                  <Button variant="secondary" {...mediaHold(m.usage)}>
                    {m.label}
                  </Button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Card>

      <Show when={kbdAttached()}>
        <Card>
          <CardHeader title="Your keyboard" subtitle="What the box detected on the cloned keyboard" />
          <Show when={caps()} fallback={<p style={muted}>Reading...</p>}>
            {(c) => (
              <>
                <Row label="Key slots">
                  {c().nkro ? 'NKRO bitmap' : `${c().nKeys} keys`}
                </Row>
                <Row label="Media keys">
                  <Show when={c().hasConsumer} fallback={<Chip variant="neutral">No</Chip>}>
                    <Chip variant="success">Yes</Chip>
                  </Show>
                </Row>
                <Row label="Report id">{c().hasReportId ? 'Yes' : 'No'}</Row>
              </>
            )}
          </Show>
        </Card>
      </Show>
    </Show>
  );
};

export default DeviceKeyboard;
