import { For, Show, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type UsageSnapshot,
  CatchClass,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  snapshotClass,
  usageHeld,
} from '../../../dashboard/protocol';
import type { InputEventEntry } from './context';
import { useDashboard } from './context';

const PRESETS: Record<string, number> = {
  all: CatchClass.All,
  buttons: CatchClass.Buttons,
  motion: CatchClass.Motion | CatchClass.Wheel,
  keys: CatchClass.Keys | CatchClass.Media,
};

const BUTTON_NAMES = ['Left', 'Right', 'Middle', 'Side 1', 'Side 2'];

// A usages snapshot carries one class; name the log line by that class.
const CLASS_NAMES: Record<number, string> = {
  [INJ_BTN]: 'buttons',
  [INJ_KEY]: 'keys',
  [INJ_MEDIA]: 'media',
};

// One line of the event log, per CATCH event kind.
const eventLine = (e: InputEventEntry): string => {
  if (e.ev.kind === 'motion') {
    const m = e.ev.motion;
    return `#${e.seq} motion dx=${m.dx} dy=${m.dy} dz=${m.dz}`;
  }
  const snap = e.ev.snapshot;
  const cls = snapshotClass(snap);
  const name = (cls !== null && CLASS_NAMES[cls]) || 'usages';
  const ids = snap.usages.map((u) => `0x${u.id.toString(16)}`).join(' ') || '(none)';
  return `#${e.seq} ${name} [${ids}]`;
};

const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
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
  // The most recent button snapshot, for the "buttons held now" readout. An all-released snapshot
  // has no class byte (n=0), so treat an empty snapshot as a button clear only when buttons are
  // subscribed; otherwise it might be a key or media release.
  const latestButtons = (): UsageSnapshot | null => {
    const watchingButtons = (PRESETS[preset()] & CatchClass.Buttons) !== 0;
    const e = events();
    for (let i = e.length - 1; i >= 0; i--) {
      const ev = e[i].ev;
      if (ev.kind !== 'usages') continue;
      const cls = snapshotClass(ev.snapshot);
      if (cls === INJ_BTN || (cls === null && watchingButtons)) return ev.snapshot;
    }
    return null;
  };
  const held = () => {
    const snap = latestButtons();
    return snap ? BUTTON_NAMES.filter((_, i) => usageHeld(snap, INJ_BTN, i)) : [];
  };

  // Per-class counts, so the motion / buttons / keys / media asymmetry shows at a glance. A keyboard
  // that never binds reads media events but zero key events; that count makes the gap obvious.
  const kindCounts = () => {
    const c = { motion: 0, buttons: 0, keys: 0, media: 0 };
    for (const e of events()) {
      if (e.ev.kind === 'motion') {
        c.motion++;
        continue;
      }
      const cls = snapshotClass(e.ev.snapshot);
      if (cls === INJ_BTN) c.buttons++;
      else if (cls === INJ_KEY) c.keys++;
      else if (cls === INJ_MEDIA) c.media++;
    }
    return c;
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input catch" subtitle="Watch the physical mouse and keyboard live" />
        <p>
          The box streams the real input as it happens, even for inputs you've locked: mouse buttons,
          wheel, and movement, plus keyboard and media keys. Move, click, or type to see events. The
          stream stops on its own if the dashboard disconnects.
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
          <Show when={latestButtons()}>
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
            <div style={label}>Events by kind</div>
            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' }}>
              <Chip variant={kindCounts().motion > 0 ? 'info' : 'neutral'}>
                Motion {kindCounts().motion}
              </Chip>
              <Chip variant={kindCounts().buttons > 0 ? 'info' : 'neutral'}>
                Buttons {kindCounts().buttons}
              </Chip>
              <Chip variant={kindCounts().keys > 0 ? 'info' : 'neutral'}>
                Keys {kindCounts().keys}
              </Chip>
              <Chip variant={kindCounts().media > 0 ? 'info' : 'neutral'}>
                Media {kindCounts().media}
              </Chip>
            </div>
          </div>
          <div style={{ 'margin-top': 'var(--g-spacing)' }}>
            <div style={label}>
              Recent events ({events().length} received, {dropped()} dropped by the box)
            </div>
            <Show when={events().length > 0} fallback={<p>Move, click, or type...</p>}>
              <div class="diagram" style={{ 'max-height': '11rem', overflow: 'auto' }}>
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
