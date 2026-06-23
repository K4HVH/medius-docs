import { For, Show, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { CatchClass, mouseReportPressed } from '../../../dashboard/protocol';
import type { InputEventEntry } from './context';
import { useDashboard } from './context';

const PRESETS: Record<string, number> = {
  all: CatchClass.All,
  buttons: CatchClass.Buttons,
  motion: CatchClass.Motion | CatchClass.Wheel,
  keys: CatchClass.Keys,
};

const BUTTON_NAMES = ['Left', 'Right', 'Middle', 'Side 1', 'Side 2'];

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

// One line of the event log, per CATCH event kind.
const eventLine = (e: InputEventEntry): string => {
  if (e.ev.kind === 'mouse') {
    const r = e.ev.report;
    return `#${e.seq} mouse btns=0x${hex2(r.buttons)} dx=${r.dx} dy=${r.dy} wheel=${r.wheel}`;
  }
  if (e.ev.kind === 'keyboard') {
    const r = e.ev.report;
    const keys = r.keys.map(hex2).join(' ') || '(none)';
    return `#${e.seq} keys mod=0x${hex2(r.modifiers)} [${keys}]`;
  }
  const usages = e.ev.report.usages.map((u) => `0x${u.toString(16)}`).join(' ') || '(none)';
  return `#${e.seq} media [${usages}]`;
};

const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
} as const;

const mono = {
  'font-family': 'var(--g-font-mono, monospace)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'line-height': '1.5',
  'max-height': '11rem',
  overflow: 'auto',
} as const;

const DeviceEventCatch = () => {
  const dash = useDashboard();
  const [preset, setPreset] = createSignal('all');
  const [streaming, setStreaming] = createSignal(false);
  const [dropped, setDropped] = createSignal(0);

  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stopKeepalive = () => {
    if (keepalive !== null) {
      clearInterval(keepalive);
      keepalive = null;
    }
  };

  const start = async () => {
    dash.clearInputEvents();
    setDropped(0);
    await dash.link()?.catch(PRESETS[preset()]);
    setStreaming(true);
    // An EVENT is box->PC, so it doesn't feed the box's ~1 s silence auto-clear; poll faster than that
    // to hold the subscription alive and refresh the box-side drop count.
    stopKeepalive();
    keepalive = setInterval(() => {
      void dash
        .link()
        ?.queryCatch()
        .then((c) => setDropped(c.dropped))
        .catch(() => {});
    }, 400);
  };

  const stop = async () => {
    stopKeepalive();
    setStreaming(false);
    await dash.link()?.uncatch();
  };

  onCleanup(() => {
    stopKeepalive();
    if (streaming()) void dash.link()?.uncatch();
  });

  const events = () => dash.inputEvents();
  // The most recent mouse snapshot, for the "buttons held now" readout.
  const latestMouse = () => {
    const e = events();
    for (let i = e.length - 1; i >= 0; i--) {
      const ev = e[i].ev;
      if (ev.kind === 'mouse') return ev.report;
    }
    return null;
  };
  const held = () => {
    const r = latestMouse();
    return r ? BUTTON_NAMES.filter((_, i) => mouseReportPressed(r, i)) : [];
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input catch" subtitle="Watch the physical mouse and keyboard live" />
        <p>
          Subscribe and the box streams the real input (mouse buttons, wheel, and movement, plus
          keyboard and media keys) as it happens, even for inputs you've locked. Move, click, or type
          to see events. The stream stops on its own if the dashboard disconnects.
        </p>
        <div style={label}>What to watch</div>
        <RadioGroup
          name="catch-preset"
          value={preset()}
          onChange={setPreset}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'buttons', label: 'Buttons only' },
            { value: 'motion', label: 'Movement + wheel' },
            { value: 'keys', label: 'Keyboard + media' },
          ]}
        />
        <div
          style={{
            display: 'flex',
            gap: 'var(--g-spacing-sm)',
            'flex-wrap': 'wrap',
            'margin-top': 'var(--g-spacing)',
          }}
        >
          <Show
            when={!streaming()}
            fallback={
              <Button variant="secondary" onClick={() => void stop()}>
                Stop
              </Button>
            }
          >
            <Button variant="primary" onClick={() => void start()}>
              Watch
            </Button>
          </Show>
        </div>
        <Show when={streaming()}>
          <Show when={latestMouse()}>
            <div style={{ 'margin-top': 'var(--g-spacing)' }}>
              <div style={label}>Buttons held now</div>
              <Show when={held().length > 0} fallback={<p>Nothing held.</p>}>
                <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' }}>
                  <For each={held()}>{(name) => <Chip variant="warning">{name}</Chip>}</For>
                </div>
              </Show>
            </div>
          </Show>
          <div style={{ 'margin-top': 'var(--g-spacing)' }}>
            <div style={label}>
              Recent events ({events().length} received, {dropped()} dropped by the box)
            </div>
            <Show when={events().length > 0} fallback={<p>Move, click, or type...</p>}>
              <div style={mono}>
                <For each={events().slice(-12).reverse()}>
                  {(e) => <div>{eventLine(e)}</div>}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceEventCatch;
