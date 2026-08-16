import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type CatchFilter,
  type UsageSnapshot,
  BusEventKind,
  CatchClass,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  LockDirection,
  TRAFFIC_BULK_END,
  TRAFFIC_BULK_ZLP,
  TRAFFIC_CONTROL_NAK,
  TRAFFIC_CONTROL_STALL,
  filterClass,
  sameFilter,
  snapshotClass,
  trafficTruncated,
  usageHeld,
} from '../../../dashboard/protocol';
import type { InputEventEntry } from './context';
import { useDashboard } from './context';

// Each preset is one CATCH table entry per class it covers. The byte-oriented presets carry a
// snaplen: a HID or vendor packet runs to 64 bytes and the control link is 4 Mbaud, so capturing
// every byte of a busy endpoint costs more link than the events are worth in a browser log.
const PRESETS: Record<string, CatchFilter[]> = {
  input: [
    filterClass(CatchClass.Axis),
    filterClass(CatchClass.Button),
    filterClass(CatchClass.Key),
    filterClass(CatchClass.Media),
  ],
  buttons: [filterClass(CatchClass.Button)],
  motion: [filterClass(CatchClass.Axis)],
  keys: [filterClass(CatchClass.Key), filterClass(CatchClass.Media)],
  traffic: [
    filterClass(CatchClass.HidIn, 16),
    filterClass(CatchClass.HidOut, 16),
    filterClass(CatchClass.VendIntr, 16),
    filterClass(CatchClass.Control, 16),
  ],
  bus: [filterClass(CatchClass.Bus)],
};

const BUTTON_NAMES = ['Left', 'Right', 'Middle', 'Side 1', 'Side 2'];

// A usages snapshot carries one class; name the log line by that class.
const CLASS_NAMES: Record<number, string> = {
  [INJ_BTN]: 'buttons',
  [INJ_KEY]: 'keys',
  [INJ_MEDIA]: 'media',
};

// Every address class, for naming a refused subscription. The traffic subset below is what a
// TRAFFIC_EVENT can actually carry.
const CATCH_CLASS_NAMES: Record<number, string> = {
  [CatchClass.Button]: 'buttons',
  [CatchClass.Key]: 'keys',
  [CatchClass.Media]: 'media',
  [CatchClass.Axis]: 'movement',
  [CatchClass.HidIn]: 'hid-in',
  [CatchClass.HidOut]: 'hid-out',
  [CatchClass.VendIntr]: 'vend-intr',
  [CatchClass.VendBulk]: 'vend-bulk',
  [CatchClass.Control]: 'control',
  [CatchClass.Emit]: 'emit',
  [CatchClass.Bus]: 'bus',
  [CatchClass.Any]: 'everything',
};

const TRAFFIC_CLASS_NAMES: Record<number, string> = {
  [CatchClass.HidIn]: 'hid-in',
  [CatchClass.HidOut]: 'hid-out',
  [CatchClass.VendIntr]: 'vend-intr',
  [CatchClass.VendBulk]: 'vend-bulk',
  [CatchClass.Control]: 'control',
  [CatchClass.Emit]: 'emit',
  [CatchClass.Bus]: 'bus',
};

// Keyed on the enum rather than positional, so a kind added to BusEventKind cannot silently shift
// every label after it.
const BUS_KINDS: Record<BusEventKind, string> = {
  [BusEventKind.Reset]: 'reset',
  [BusEventKind.Suspend]: 'suspend',
  [BusEventKind.Resume]: 'resume',
  [BusEventKind.Configured]: 'configured',
  [BusEventKind.Deconfigured]: 'deconfigured',
  [BusEventKind.SetInterface]: 'set-interface',
  [BusEventKind.DeviceAttached]: 'dev-attached',
  [BusEventKind.DeviceDetached]: 'dev-detached',
  [BusEventKind.CloneUp]: 'clone-up',
  [BusEventKind.CloneDown]: 'clone-down',
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

// The flags byte is class-specific, so decode it per class instead of printing the raw number: a
// STALLed control transaction reading `0xfd` tells you nothing without the table beside you.
const trafficFlags = (cls: CatchClass, flags: number): string => {
  if (cls === CatchClass.VendBulk) {
    const bits = [];
    if (flags & TRAFFIC_BULK_END) bits.push('end');
    if (flags & TRAFFIC_BULK_ZLP) bits.push('zlp');
    return bits.length ? ` ${bits.join('+')}` : '';
  }
  if (cls === CatchClass.Control) {
    if (flags === TRAFFIC_CONTROL_STALL) return ' STALL';
    if (flags === TRAFFIC_CONTROL_NAK) return ' NAK';
    return '';
  }
  return '';
};

// One line of the event log, per CATCH event kind. Every variant needs a branch here: an unhandled
// one would fall through to another kind's fields and render nonsense rather than failing.
const eventLine = (e: InputEventEntry): string => {
  if (e.ev.kind === 'motion') {
    const m = e.ev.motion;
    return `#${e.seq} motion dx=${m.dx} dy=${m.dy} dz=${m.dz}`;
  }
  if (e.ev.kind === 'traffic') {
    const t = e.ev.traffic;
    const name = TRAFFIC_CLASS_NAMES[t.cls] ?? `class ${t.cls}`;
    const arrow = t.dir === LockDirection.Negative ? 'out' : 'in';
    if (t.cls === CatchClass.Bus) {
      const kind = BUS_KINDS[t.flags as BusEventKind] ?? `kind ${t.flags}`;
      return `#${e.seq} bus ${kind} ${hex(t.bytes)}`.trimEnd();
    }
    // bytes.length short of true_len means snaplen cut the capture, not that the packet was short.
    const cut = trafficTruncated(t) ? ` (+${t.trueLen - t.bytes.length} cut)` : '';
    const id = `0x${t.id.toString(16)}`;
    return `#${e.seq} ${name} ${arrow} ${id}${trafficFlags(t.cls, t.flags)} [${hex(t.bytes)}]${cut}`;
  }
  const snap = e.ev.snapshot;
  const cls = snapshotClass(snap);
  const name = (cls !== null && CLASS_NAMES[cls]) || 'usages';
  const ids = snap.usages.map((u) => `0x${u.id.toString(16)}`).join(' ') || '(none)';
  return `#${e.seq} ${name} [${ids}]`;
};

const covers = (filters: CatchFilter[], cls: CatchClass): boolean =>
  filters.some((f) => f.cls === cls || f.cls === CatchClass.Any);

const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
} as const;


const DeviceEventCatch = () => {
  const dash = useDashboard();
  const [preset, setPreset] = createSignal('input');
  // What the box is actually subscribed to, which is only the same as `preset` between a Watch and
  // the next Stop. Reading the displayed preset instead would let a radio click silently change how
  // events already on screen are interpreted.
  const [active, setActive] = createSignal<CatchFilter[]>([]);
  const [streaming, setStreaming] = createSignal(false);
  const [dropped, setDropped] = createSignal(0);
  const [tableFull, setTableFull] = createSignal(false);
  const [refused, setRefused] = createSignal<CatchFilter[]>([]);
  const [entryDrops, setEntryDrops] = createSignal(0);

  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stopKeepalive = () => {
    if (keepalive !== null) {
      clearInterval(keepalive);
      keepalive = null;
    }
  };

  // Bumped by stop() and by unmount, so a start() still awaiting its frames knows not to install a
  // keepalive on a component that has gone away.
  let generation = 0;

  const start = async () => {
    const gen = ++generation;
    const filters = PRESETS[preset()];
    dash.clearInputEvents();
    setDropped(0);
    setEntryDrops(0);
    setTableFull(false);
    setRefused([]);
    setActive(filters);
    setStreaming(true);
    // Clear whatever was subscribed before, then add this preset's entries one frame each.
    await dash.link()?.uncatch();
    for (const f of filters) {
      if (gen !== generation) return;
      await dash.link()?.catch(f);
    }
    if (gen !== generation) return;
    // An EVENT is box->PC, so it doesn't feed the box's ~1 s silence auto-clear; poll faster than that
    // to hold the subscription alive and refresh the box-side drop counts.
    stopKeepalive();
    keepalive = setInterval(() => {
      void dash
        .link()
        ?.queryCatch()
        .then((c) => {
          setDropped(c.dropped);
          setTableFull(c.tableFull);
          setEntryDrops(c.entries.reduce((n, e) => n + e.dropped, 0));
          // Only a full table raises a flag. An unknown class, a bad direction, and a wildcard class
          // carrying a real id are all refused silently, so absence from the returned table is the
          // only way to see them.
          setRefused(filters.filter((f) => !c.entries.some((e) => sameFilter(e, f))));
        })
        .catch(() => {});
    }, 400);
  };

  const stop = async () => {
    generation++;
    stopKeepalive();
    setStreaming(false);
    setActive([]);
    await dash.link()?.uncatch();
  };

  onCleanup(() => {
    generation++;
    stopKeepalive();
    if (streaming()) void dash.link()?.uncatch()?.catch(() => {});
  });

  const events = () => dash.inputEvents();
  // The most recent button snapshot, for the "buttons held now" readout. An all-released snapshot
  // has no class byte (n=0), so treat an empty snapshot as a button clear only when buttons are
  // subscribed; otherwise it might be a key or media release. Memoised because the buffer holds 200
  // entries and a raw-endpoint subscription refills it thousands of times a second.
  const latestButtons = createMemo((): UsageSnapshot | null => {
    const watchingButtons = covers(active(), CatchClass.Button);
    const e = events();
    for (let i = e.length - 1; i >= 0; i--) {
      const ev = e[i].ev;
      if (ev.kind !== 'usages') continue;
      const cls = snapshotClass(ev.snapshot);
      if (cls === INJ_BTN || (cls === null && watchingButtons)) return ev.snapshot;
    }
    return null;
  });
  const held = createMemo(() => {
    const snap = latestButtons();
    return snap ? BUTTON_NAMES.filter((_, i) => usageHeld(snap, INJ_BTN, i)) : [];
  });

  // Per-class counts, so the motion / buttons / keys / media asymmetry shows at a glance. A keyboard
  // that never binds reads media events but zero key events; that count makes the gap obvious.
  const kindCounts = createMemo(() => {
    const c = { motion: 0, buttons: 0, keys: 0, media: 0, traffic: 0 };
    for (const e of events()) {
      if (e.ev.kind === 'motion') {
        c.motion++;
        continue;
      }
      if (e.ev.kind === 'traffic') {
        c.traffic++;
        continue;
      }
      const cls = snapshotClass(e.ev.snapshot);
      if (cls === INJ_BTN) c.buttons++;
      else if (cls === INJ_KEY) c.keys++;
      else if (cls === INJ_MEDIA) c.media++;
    }
    return c;
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input catch" subtitle="Watch the traffic the box carries, live" />
        <p>
          The box streams the traffic it carries as it happens, even for inputs you've locked: mouse
          buttons, wheel, and movement, plus keyboard and media keys. It also reaches the bytes
          underneath, the HID and vendor endpoints, the proxied control transactions, and the bus
          lifecycle. Move, click, or type to see events. The stream stops on its own if the dashboard
          disconnects.
        </p>
        <div style={label}>What to watch</div>
        <RadioGroup
          name="catch-preset"
          value={preset()}
          onChange={setPreset}
          disabled={streaming()}
          options={[
            { value: 'input', label: 'All input' },
            { value: 'buttons', label: 'Buttons only' },
            { value: 'motion', label: 'Movement + wheel' },
            { value: 'keys', label: 'Keyboard + media' },
            { value: 'traffic', label: 'Raw endpoints' },
            { value: 'bus', label: 'Bus events' },
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
              <Button variant="secondary" onClick={() => void stop().catch(() => {})}>
                Stop
              </Button>
            }
          >
            <Button variant="primary" onClick={() => void start().catch(() => {})}>
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
              <Chip variant={kindCounts().traffic > 0 ? 'info' : 'neutral'}>
                Traffic {kindCounts().traffic}
              </Chip>
            </div>
          </div>
          <Show when={refused().length > 0}>
            <p>
              The box refused {refused().length} of {active().length} subscriptions:{' '}
              {refused()
                .map((f) => CATCH_CLASS_NAMES[f.cls] ?? `class ${f.cls}`)
                .join(', ')}
              .{' '}
              <Show
                when={tableFull()}
                fallback={<>The box does not know that address on this firmware.</>}
              >
                Its 32-entry table is full. Stop and start again to clear it.
              </Show>
            </p>
          </Show>
          <div style={{ 'margin-top': 'var(--g-spacing)' }}>
            <div style={label}>
              Recent events ({events().length} received, {dropped()} dropped by the box,{' '}
              {entryDrops()} of those attributed to a subscription)
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
