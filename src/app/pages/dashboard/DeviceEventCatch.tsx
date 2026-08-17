// Watch the traffic the box carries, live.
//
// The presets are the common subscriptions; the custom builder reaches the rest of the table, which
// the presets alone could not (one endpoint rather than a class, one direction, a capture length
// other than the hardcoded 16). Every event carries a box timestamp and the clock that stamped it,
// and both are shown: they are the only way to see the spacing between reports, and this is the one
// client a person reads timing off by eye.

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Combobox } from '../../../components/inputs/Combobox';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type CatchFilter,
  type CatchEntry,
  type UsageSnapshot,
  BusEventKind,
  CATCH_ID_ANY,
  CATCH_TABLE_MAX,
  CatchClass,
  ClockDomain,
  Direction,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  Out,
  filterTraffic,
  filterTrafficClass,
  filterWatch,
  filterWatchAxes,
  filterWatchClass,
  sameFilter,
  snapshotClass,
  trafficTruncated,
  usageHeld,
  usageName,
} from '../../../dashboard/protocol';
import type { InputEventEntry } from './context';
import { useDashboard } from './context';
import { chips, label, muted, row, section } from './ui';

// Each preset is one table entry per class it covers. The byte-oriented ones cap the capture: a HID
// or vendor packet runs to 64 bytes and the control link is shared with everything else here, so
// capturing every byte of a busy endpoint costs more link than a browser log can use.
const PRESETS: Record<string, CatchFilter[]> = {
  input: [
    filterWatchAxes(),
    filterWatchClass(CatchClass.Button),
    filterWatchClass(CatchClass.Key),
    filterWatchClass(CatchClass.Media),
  ],
  buttons: [filterWatchClass(CatchClass.Button)],
  motion: [filterWatchAxes()],
  keys: [filterWatchClass(CatchClass.Key), filterWatchClass(CatchClass.Media)],
  traffic: [
    filterTrafficClass(CatchClass.HidIn, 16),
    filterTrafficClass(CatchClass.HidOut, 16),
    filterTrafficClass(CatchClass.VendorInterrupt, 16),
    filterTrafficClass(CatchClass.Control, 16),
  ],
  bus: [filterTrafficClass(CatchClass.Bus)],
};

const BUTTON_NAMES = ['Left', 'Right', 'Middle', 'Side 1', 'Side 2'];

const CLASS_NAMES: Record<number, string> = {
  [CatchClass.Button]: 'buttons',
  [CatchClass.Key]: 'keys',
  [CatchClass.Media]: 'media',
  [CatchClass.Axis]: 'movement',
  [CatchClass.HidIn]: 'hid-in',
  [CatchClass.HidOut]: 'hid-out',
  [CatchClass.VendorInterrupt]: 'vendor-interrupt',
  [CatchClass.VendorBulk]: 'vendor-bulk',
  [CatchClass.Control]: 'control',
  [CatchClass.Emit]: 'emit',
  [CatchClass.Bus]: 'bus',
  [CatchClass.Any]: 'everything',
};

// Classes 0 to 3 carry a decoded input event and no bytes, so no capture length applies to them.
const isInputClass = (cls: number) =>
  cls === CatchClass.Button ||
  cls === CatchClass.Key ||
  cls === CatchClass.Media ||
  cls === CatchClass.Axis;

// What the id means, per class. A picker that just says "id" invites an endpoint number where an
// interface number belongs.
const ID_MEANING: Record<number, string> = {
  [CatchClass.Button]: 'button id',
  [CatchClass.Key]: 'HID keycode',
  [CatchClass.Media]: 'Consumer usage',
  [CatchClass.Axis]: 'axis (0 X, 1 Y, 2 wheel)',
  [CatchClass.HidIn]: 'interface number',
  [CatchClass.HidOut]: 'endpoint address',
  [CatchClass.VendorInterrupt]: 'endpoint address',
  [CatchClass.VendorBulk]: 'endpoint address',
  [CatchClass.Control]: 'endpoint number (0 is EP0)',
  [CatchClass.Emit]: 'endpoint address',
  [CatchClass.Bus]: 'no id',
  [CatchClass.Any]: 'no id',
};

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

const SNAP_NAMES: Record<number, string> = {
  [INJ_BTN]: 'buttons',
  [INJ_KEY]: 'keys',
  [INJ_MEDIA]: 'media',
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

// The flags byte is class-specific, so decode it per class: a STALLed control transaction reading
// 0xfd tells you nothing without the table beside you.
const trafficFlags = (cls: CatchClass, flags: number): string => {
  if (cls === CatchClass.VendorBulk) {
    const bits: string[] = [];
    if (flags & 0x01) bits.push('end');
    if (flags & 0x02) bits.push('zlp');
    return bits.length ? ` ${bits.join('+')}` : '';
  }
  if (cls === CatchClass.Control) {
    if (flags === 0xfd) return ' STALL';
    if (flags === 0xfe) return ' NAK';
    return '';
  }
  return '';
};

// One log line per event kind. Every variant needs a branch: an unhandled one would fall through to
// another kind's fields and render nonsense rather than failing.
const eventBody = (e: InputEventEntry): string => {
  if (e.ev.kind === 'motion') {
    const m = e.ev.motion;
    return `motion dx=${m.dx} dy=${m.dy} dz=${m.dz}`;
  }
  if (e.ev.kind === 'traffic') {
    const t = e.ev.traffic;
    const name = CLASS_NAMES[t.cls] ?? `class ${t.cls}`;
    if (t.cls === CatchClass.Bus) {
      const kind = BUS_KINDS[t.flags as BusEventKind] ?? `kind ${t.flags}`;
      return `bus ${kind} ${hex(t.bytes)}`.trimEnd();
    }
    // bytes.length short of trueLen means the capture cut it, not that the packet was short.
    const cut = trafficTruncated(t) ? ` (+${t.trueLen - t.bytes.length} cut)` : '';
    const arrow = t.dir === Out ? 'out' : 'in';
    return `${name} ${arrow} 0x${t.id.toString(16)}${trafficFlags(t.cls, t.flags)} [${hex(t.bytes)}]${cut}`;
  }
  const snap = e.ev.snapshot;
  const cls = snapshotClass(snap);
  const name = (cls !== null && SNAP_NAMES[cls]) || 'usages';
  const ids = snap.usages.map((u) => usageName(u.cls, u.id)).join(' ') || '(none)';
  return `${name} [${ids}]`;
};

const eventTs = (e: InputEventEntry): number =>
  e.ev.kind === 'motion' ? e.ev.motion.tsUs : e.ev.kind === 'traffic' ? e.ev.traffic.tsUs : e.ev.snapshot.tsUs;

const eventClk = (e: InputEventEntry): ClockDomain =>
  e.ev.kind === 'motion' ? e.ev.motion.clk : e.ev.kind === 'traffic' ? e.ev.traffic.clk : e.ev.snapshot.clk;

const covers = (filters: CatchFilter[], cls: CatchClass): boolean =>
  filters.some((f) => f.cls === cls || f.cls === CatchClass.Any);

const ms = (us: number): string => (us / 1000).toFixed(3);

const CLASS_OPTIONS = Object.entries(CLASS_NAMES).map(([v, name]) => ({
  value: v,
  label: `${name} (${v === String(CatchClass.Any) ? 'any' : v})`,
}));

const DeviceEventCatch = () => {
  const dash = useDashboard();
  const [mode, setMode] = createSignal('preset');
  const [preset, setPreset] = createSignal('input');
  const [custom, setCustom] = createSignal<CatchFilter[]>([]);
  const [streaming, setStreaming] = createSignal(false);
  // What the box is actually subscribed to, which matches the picker only between a Watch and the
  // next Stop. Reading the picker instead would let a click silently change how events already on
  // screen are interpreted.
  const [active, setActive] = createSignal<CatchFilter[]>([]);

  // The custom entry under construction.
  const [cls, setCls] = createSignal(CatchClass.HidIn as number);
  const [anyId, setAnyId] = createSignal('any');
  const [id, setId] = createSignal(0);
  const [dir, setDir] = createSignal(String(Direction.Both));
  const [capture, setCapture] = createSignal(16);

  const catchState = () => (streaming() ? state() : null);
  const state = dash.poll('catch');
  // The table the box accepted, read back once immediately after subscribing. The polled value
  // cannot answer this: a tick already in flight when Watch is pressed lands with the previous
  // (empty) table, and every entry would read as refused for one interval.
  const [accepted, setAccepted] = createSignal<CatchEntry[] | null>(null);
  const [droppedByBox, setDroppedByBox] = createSignal(false);

  const chosen = (): CatchFilter[] => (mode() === 'preset' ? PRESETS[preset()] : custom());

  // Bumped by stop and by unmount, so a start still awaiting its frames knows the card has moved on.
  let generation = 0;

  const start = async () => {
    const gen = ++generation;
    const filters = chosen();
    if (filters.length === 0) return;
    dash.clearInputEvents();
    setAccepted(null);
    setDroppedByBox(false);
    setActive(filters);
    setStreaming(true);
    await dash.link()?.uncatch();
    for (const f of filters) {
      if (gen !== generation) return;
      await dash.link()?.catch(f);
    }
    if (gen !== generation) return;
    const confirmed = await dash.link()?.queryCatch();
    if (gen !== generation || !confirmed) return;
    setAccepted(confirmed.entries);
    dash.refreshPoll('catch');
  };

  const stop = async () => {
    generation++;
    setStreaming(false);
    setActive([]);
    setAccepted(null);
    await dash.link()?.uncatch();
    dash.refreshPoll('catch');
  };

  onCleanup(() => {
    generation++;
    if (streaming()) void dash.link()?.uncatch()?.catch(() => {});
  });

  const addCustom = () => {
    const c = cls();
    const wildcard = anyId() === 'any' || c === CatchClass.Bus || c === CatchClass.Any;
    const d = Number(dir()) as Direction;
    const f: CatchFilter = isInputClass(c)
      ? wildcard
        ? { ...filterWatchClass(c as CatchClass), dir: d }
        : { ...filterWatch(c as CatchClass, id()), dir: d }
      : wildcard
        ? { ...filterTrafficClass(c as CatchClass, capture()), dir: d }
        : { ...filterTraffic(c as CatchClass, id(), capture()), dir: d };
    setCustom((prev) => (prev.some((p) => sameFilter(p, f)) ? prev : [...prev, f]));
  };

  const describe = (f: CatchFilter): string => {
    const name = CLASS_NAMES[f.cls] ?? `class ${f.cls}`;
    const where = f.id === CATCH_ID_ANY ? 'any' : `0x${f.id.toString(16)}`;
    const d = f.dir === Direction.Both ? '' : f.dir === Direction.Positive ? ' in/press' : ' out/release';
    const cap = isInputClass(f.cls) || f.capture === 0 ? '' : ` first ${f.capture}B`;
    return `${name} ${where}${d}${cap}`;
  };

  const events = () => dash.inputEvents();

  // Refused entries are invisible except by absence from the returned table, so reconcile what we
  // asked for against what the box accepted. Only a full table raises a flag; an unknown class, a
  // bad direction, and a wildcard class carrying a real id are all refused silently.
  const refused = createMemo(() => {
    const table = accepted();
    if (!table || !streaming()) return [];
    return active().filter((f) => !table.some((e) => sameFilter(e, f)));
  });

  // The box clears the whole table after a second without a control frame, which a backgrounded
  // tab can cause. Reported as what it is, rather than leaving a Stop button over a dead stream.
  let sawOn = false;
  createEffect(() => {
    const on = dash.health()?.catchOn;
    if (on === true) {
      sawOn = true;
      return;
    }
    if (on === false && sawOn) {
      sawOn = false;
      if (streaming()) {
        setStreaming(false);
        setActive([]);
        setAccepted(null);
        setDroppedByBox(true);
      }
    }
  });

  const entryDrops = createMemo(() =>
    (catchState()?.entries ?? []).reduce((n, e) => n + e.dropped, 0),
  );

  // Stamps are only comparable inside one clock domain, so each domain gets its own baseline. The
  // smallest stamp in the buffer, not the first seen: the box drains four priority queues, so
  // events arrive out of tap order and the first one through is often not the earliest.
  const origins = createMemo(() => {
    const o: Record<number, number> = {};
    for (const e of events()) {
      const d = eventClk(e);
      const t = eventTs(e);
      if (o[d] === undefined || t < o[d]) o[d] = t;
    }
    return o;
  });

  const latestButtons = createMemo((): UsageSnapshot | null => {
    const watchingButtons = covers(active(), CatchClass.Button);
    const e = events();
    for (let i = e.length - 1; i >= 0; i--) {
      const ev = e[i].ev;
      if (ev.kind !== 'usages') continue;
      const c = snapshotClass(ev.snapshot);
      // An all-released snapshot carries no class byte, so treat an empty one as a button clear
      // only when buttons are subscribed; otherwise it might be a key or media release.
      if (c === INJ_BTN || (c === null && watchingButtons)) return ev.snapshot;
    }
    return null;
  });

  const held = createMemo(() => {
    const snap = latestButtons();
    return snap ? BUTTON_NAMES.filter((_, i) => usageHeld(snap, INJ_BTN, i)) : [];
  });

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
      const k = snapshotClass(e.ev.snapshot);
      if (k === INJ_BTN) c.buttons++;
      else if (k === INJ_KEY) c.keys++;
      else if (k === INJ_MEDIA) c.media++;
    }
    return c;
  });

  const clockLine = createMemo(() => {
    const c = catchState()?.clock;
    if (!c || c.ageMs === null) return 'Cross-chip clock not measured yet.';
    return `Host clock leads the device clock by ${ms(c.offsetUs)} ms, +/- ${ms(c.delayUs)} ms, measured ${c.ageMs} ms ago.`;
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input catch" subtitle="Watch the traffic the box carries, live" />
        <p>
          The box streams what it carries as it happens, including inputs you have locked, down to
          the raw endpoint bytes, the proxied control transactions, and the bus lifecycle. The stream
          stops on its own if the dashboard disconnects.
        </p>

        <div style={label}>How to choose</div>
        <RadioGroup
          name="catch-mode"
          value={mode()}
          onChange={setMode}
          disabled={streaming()}
          options={[
            { value: 'preset', label: 'Presets' },
            { value: 'custom', label: 'Build a table' },
          ]}
        />

        <Show when={mode() === 'preset'}>
          <div style={section}>
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
          </div>
        </Show>

        <Show when={mode() === 'custom'}>
          <div style={section}>
            <div style={label}>Class</div>
            <Combobox
              value={String(cls())}
              onChange={(v) => setCls(Number(Array.isArray(v) ? v[0] : v))}
              options={CLASS_OPTIONS}
            />
            <p style={{ ...muted, 'margin-top': '4px' }}>The id is {ID_MEANING[cls()] ?? 'class specific'}.</p>
          </div>
          <Show when={cls() !== CatchClass.Bus && cls() !== CatchClass.Any}>
            <div style={section}>
              <div style={label}>Which id</div>
              <RadioGroup
                name="catch-anyid"
                value={anyId()}
                onChange={setAnyId}
                options={[
                  { value: 'any', label: 'Every id' },
                  { value: 'one', label: 'Just one' },
                ]}
              />
              <Show when={anyId() === 'one'}>
                <div style={{ 'max-width': '9rem', 'margin-top': 'var(--g-spacing-sm)' }}>
                  <NumberInput label="Id" value={id()} min={0} max={65534} onChange={(v) => setId(v ?? 0)} />
                </div>
              </Show>
            </div>
          </Show>
          <div style={section}>
            <div style={label}>Direction</div>
            <RadioGroup
              name="catch-dir"
              value={dir()}
              onChange={setDir}
              options={[
                { value: String(Direction.Both), label: 'Both' },
                { value: String(Direction.Positive), label: isInputClass(cls()) ? 'Press' : 'In' },
                { value: String(Direction.Negative), label: isInputClass(cls()) ? 'Release' : 'Out' },
              ]}
            />
          </div>
          <Show when={!isInputClass(cls())}>
            <div style={section}>
              <div style={label}>Capture</div>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput
                  label="Bytes (0 = all)"
                  value={capture()}
                  min={0}
                  max={255}
                  onChange={(v) => setCapture(v ?? 0)}
                />
              </div>
            </div>
          </Show>
          <div style={{ ...section, ...row }}>
            <Button variant="secondary" disabled={streaming()} onClick={addCustom}>
              Add entry
            </Button>
            <Button variant="subtle" disabled={streaming()} onClick={() => setCustom([])}>
              Clear
            </Button>
          </div>
          <div style={section}>
            <div style={label}>
              Table ({custom().length} of {CATCH_TABLE_MAX})
            </div>
            <Show when={custom().length > 0} fallback={<p style={muted}>No entries yet.</p>}>
              <div style={chips}>
                <For each={custom()}>
                  {(f) => (
                    <Chip
                      variant="info"
                      onRemove={
                        streaming()
                          ? undefined
                          : () => setCustom((prev) => prev.filter((p) => !sameFilter(p, f)))
                      }
                    >
                      {describe(f)}
                    </Chip>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <div style={{ ...section, ...row }}>
          <Show
            when={!streaming()}
            fallback={
              <Button variant="secondary" onClick={() => void stop().catch(() => {})}>
                Stop
              </Button>
            }
          >
            <Button
              variant="primary"
              disabled={chosen().length === 0}
              onClick={() => void start().catch(() => {})}
            >
              Watch
            </Button>
          </Show>
        </div>

        <Show when={droppedByBox()}>
          <div class="callout callout--warning" style={section}>
            The box cleared the subscription. It does that after one second with no control frame, which
            a backgrounded tab can cause. Press Watch to start again.
          </div>
        </Show>

        <Show when={streaming()}>
          <Show when={refused().length > 0}>
            <div class="callout callout--warning" style={section}>
              The box refused {refused().length} of {active().length} entries:{' '}
              {refused().map(describe).join(', ')}.{' '}
              <Show
                when={catchState()?.tableFull}
                fallback={<>It does not know that address on this firmware.</>}
              >
                Its {CATCH_TABLE_MAX}-entry table is full.
              </Show>
            </div>
          </Show>

          <Show when={latestButtons()}>
            <div style={section}>
              <div style={label}>Buttons held now</div>
              <Show when={held().length > 0} fallback={<p>Nothing held.</p>}>
                <div style={chips}>
                  <For each={held()}>{(name) => <Chip variant="warning">{name}</Chip>}</For>
                </div>
              </Show>
            </div>
          </Show>

          <div style={section}>
            <div style={label}>Events by kind</div>
            <div style={chips}>
              <Chip variant={kindCounts().motion > 0 ? 'info' : 'neutral'}>Motion {kindCounts().motion}</Chip>
              <Chip variant={kindCounts().buttons > 0 ? 'info' : 'neutral'}>Buttons {kindCounts().buttons}</Chip>
              <Chip variant={kindCounts().keys > 0 ? 'info' : 'neutral'}>Keys {kindCounts().keys}</Chip>
              <Chip variant={kindCounts().media > 0 ? 'info' : 'neutral'}>Media {kindCounts().media}</Chip>
              <Chip variant={kindCounts().traffic > 0 ? 'info' : 'neutral'}>Traffic {kindCounts().traffic}</Chip>
            </div>
          </div>

          <div style={section}>
            <div style={label}>Clock</div>
            <p style={muted}>{clockLine()}</p>
          </div>

          <div style={section}>
            <div style={label}>
              Recent events ({events().length} received, {catchState()?.dropped ?? 0} dropped by the
              box, {entryDrops()} of those charged to an entry)
            </div>
            <Show when={events().length > 0} fallback={<p>Move, click, or type...</p>}>
              <pre class="diagram" style={{ 'max-height': '14rem', overflow: 'auto', margin: 0 }}>
                {events()
                  .slice(-14)
                  .reverse()
                  .map((e) => {
                    const d = eventClk(e);
                    const base = origins()[d];
                    const rel = base === undefined ? 0 : (eventTs(e) - base) / 1000;
                    const tag = d === ClockDomain.Device ? 'D' : 'H';
                    return `#${e.seq} ${tag}+${rel.toFixed(3)}ms  ${eventBody(e)}`;
                  })
                  .join('\n')}
              </pre>
            </Show>
            <p style={{ ...muted, 'margin-top': '4px' }}>
              H is the host chip's clock, D the device chip's. Times are from the earliest event held
              in that clock, and only comparable within one of them.
            </p>
          </div>
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceEventCatch;
