// The builder reaches what presets can't: one endpoint, one direction, another capture length. Each
// event shows its box stamp and clock, the only view of report spacing.

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import {
  type CatchFilter,
  type CatchEntry,
  type TrafficEvent,
  type UsageSnapshot,
  BusEventKind,
  CATCH_ID_ANY,
  CATCH_TABLE_MAX,
  CatchClass,
  ClockDomain,
  ControlStatus,
  Direction,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  Out,
  TRAFFIC_BULK_END,
  filterTraffic,
  filterTrafficClass,
  filterWatch,
  filterWatchAxes,
  filterWatchClass,
  sameFilter,
  snapshotClass,
  trafficControlStatus,
  trafficData,
  trafficRuleActed,
  trafficZlp,
  trafficSetup,
  trafficTransferStatus,
  trafficTruncated,
  transferStatusName,
  usageHeld,
  usageName,
} from '../../../dashboard/protocol';
import type { InputEventEntry } from './context';
import { useDashboard } from './context';
import { createCommand } from './action';
import { LogBox, logText } from '../../shell/LogBox';
import { Panel, Panels, Stack } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';
import { Select } from '../../shell/Select';

// Byte presets cap capture at 16: every byte of a busy endpoint costs more shared control link than
// a browser log can use.
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
    filterTrafficClass(CatchClass.ClipTransfer, 16),
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
  [CatchClass.ClipTransfer]: 'clip-transfer',
  [CatchClass.Any]: 'everything',
};

// Classes 0 to 3 carry decoded events, no bytes, so no capture length.
const isInputClass = (cls: number) =>
  cls === CatchClass.Button ||
  cls === CatchClass.Key ||
  cls === CatchClass.Media ||
  cls === CatchClass.Axis;

// A bare "id" invites an endpoint number where an interface number belongs.
const ID_MEANING: Record<number, string> = {
  [CatchClass.Button]: 'button id',
  [CatchClass.Key]: 'HID keycode',
  [CatchClass.Media]: 'Consumer usage',
  [CatchClass.Axis]: 'axis (0 X, 1 Y, 2 wheel, 3 pan)',
  [CatchClass.HidIn]: 'interface number',
  [CatchClass.HidOut]: 'endpoint number',
  [CatchClass.VendorInterrupt]: 'endpoint number',
  [CatchClass.VendorBulk]: 'endpoint number',
  [CatchClass.Control]: 'endpoint number (0 is EP0)',
  [CatchClass.Emit]: 'endpoint number',
  [CatchClass.Bus]: 'no id',
  [CatchClass.ClipTransfer]: 'endpoint number (0 is EP0)',
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

// The game PC's handshake, named unless it was a plain completion.
const CONTROL_WORDS: Record<ControlStatus, string> = {
  [ControlStatus.Ok]: '',
  [ControlStatus.Stall]: ' STALL',
  [ControlStatus.Nak]: ' NAK',
  [ControlStatus.Other]: ' handshake 3',
};

// Flags are per class: control keeps its handshake in the low two bits beside the rule bit, and a clip
// transfer's whole byte is its status, always named, OK included.
const trafficFlags = (t: TrafficEvent): string => {
  let out = '';
  const bits: string[] = [];
  if (t.cls === CatchClass.VendorBulk && t.flags & TRAFFIC_BULK_END) bits.push('end');
  if (trafficZlp(t)) bits.push('zlp');
  if (bits.length) out = ` ${bits.join('+')}`;
  const handshake = trafficControlStatus(t);
  if (handshake !== null) out = CONTROL_WORDS[handshake];
  const status = trafficTransferStatus(t);
  if (status !== null) out = ` ${transferStatusName(status).toUpperCase()}`;
  return trafficRuleActed(t) ? `${out} RULE` : out;
};

// Setup and data stage as two groups; a capture that cut the setup short shows one.
const trafficBytes = (t: TrafficEvent): string => {
  const setup = trafficSetup(t);
  if (!setup) return `[${hex(t.bytes)}]`;
  const data = trafficData(t);
  return data.length ? `[${hex(setup)}] [${hex(data)}]` : `[${hex(setup)}]`;
};

// Every event kind needs a branch, or it falls through to another kind's fields.
const eventBody = (e: InputEventEntry): string => {
  if (e.ev.kind === 'motion') {
    const m = e.ev.motion;
    return `motion dx=${m.dx} dy=${m.dy} dz=${m.dz} dpan=${m.dpan}`;
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
    return `${name} ${arrow} 0x${t.id.toString(16)}${trafficFlags(t)} ${trafficBytes(t)}${cut}`;
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
  // The box's live subscription; the picker matches it only between Watch and Stop.
  const [active, setActive] = createSignal<CatchFilter[]>([]);

  // The custom entry under construction.
  const [cls, setCls] = createSignal(CatchClass.HidIn as number);
  const [anyId, setAnyId] = createSignal('any');
  const [id, setId] = createSignal(0);
  const [dir, setDir] = createSignal(String(Direction.Both));
  const [capture, setCapture] = createSignal(16);

  const catchState = () => (streaming() ? state() : null);
  const state = dash.poll('catch');
  // Read once after subscribing: a poll in flight at Watch lands the previous empty table, which reads
  // every entry as refused.
  const [accepted, setAccepted] = createSignal<CatchEntry[] | null>(null);
  const [droppedByBox, setDroppedByBox] = createSignal(false);

  const chosen = (): CatchFilter[] => (mode() === 'preset' ? PRESETS[preset()] : custom());

  // Bumped by stop and unmount, so a pending start can tell it is stale.
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
    // The box took every entry; a lost confirmation leaves the stream running unconfirmed.
    const confirmed = await dash.link()?.queryCatch().catch(() => null);
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

  // A refused subscription goes back to Watch, so the log isn't left waiting on nothing, and drops
  // any entries the box took before it refused one.
  const cmd = createCommand();
  const watch = () =>
    cmd.run(() => {
      // start() takes the next generation; a Stop or Watch since then owns the state.
      const mine = generation + 1;
      return start().catch((e: unknown) => {
        if (generation !== mine) return;
        generation++;
        setStreaming(false);
        setActive([]);
        void dash.link()?.uncatch()?.catch(() => {});
        throw e;
      });
    });

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

  // A refusal shows only as absence from the returned table. Only a full table raises a flag; an
  // unknown class, a bad direction and a real id on a wildcard class get no reply.
  const refused = createMemo(() => {
    const table = accepted();
    if (!table || !streaming()) return [];
    return active().filter((f) => !table.some((e) => sameFilter(e, f)));
  });

  // The box clears the table after 1 s without a control frame.
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

  // One baseline per clock domain, from its smallest stamp since Watch: the box drains four priority
  // queues, so events arrive out of tap order. Events leaving the top of the log don't move it.
  const baseline = createMemo(
    (prev: { at: Record<number, number>; moved: number }) => {
      const list = events();
      if (!list.length) return { at: {}, moved: prev.moved };
      const at = { ...prev.at };
      let moved = prev.moved;
      for (const e of list) {
        const d = eventClk(e);
        const t = eventTs(e);
        if (at[d] === undefined) at[d] = t;
        else if (t < at[d]) {
          at[d] = t;
          moved++;
        }
      }
      return { at, moved };
    },
    { at: {}, moved: 0 },
  );

  // A line keeps the text it was drawn with, so each is formatted once; a baseline moved back
  // formats them all again, and the log is drawn again.
  const moved = createMemo(() => baseline().moved);
  // Where the clipboard is refused, the log's text is selected for the reader to copy.
  const [copied, setCopied] = createSignal(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));
  const copyLog = () => {
    const pick = () => getSelection()?.selectAllChildren(document.querySelector('#catch-events .lg')!);
    if (!navigator.clipboard) return pick();
    navigator.clipboard.writeText(logText(logRows())).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), 1200);
    }, pick);
  };
  let linesAt = -1;
  let lines = new WeakMap<InputEventEntry, string[]>();
  const logRows = (): string[][] => {
    const { at, moved: m } = baseline();
    if (m !== linesAt) {
      linesAt = m;
      lines = new WeakMap();
    }
    return events().map((e) => {
      let line = lines.get(e);
      if (!line) {
        const d = eventClk(e);
        const rel = at[d] === undefined ? 0 : (eventTs(e) - at[d]) / 1000;
        line = [`#${e.seq}`, `${d === ClockDomain.Device ? 'D' : 'H'}+${rel.toFixed(3)}ms`, eventBody(e)];
        lines.set(e, line);
      }
      return line;
    });
  };

  const latestButtons = createMemo((): UsageSnapshot | null => {
    const watchingButtons = covers(active(), CatchClass.Button);
    const e = events();
    for (let i = e.length - 1; i >= 0; i--) {
      const ev = e[i].ev;
      if (ev.kind !== 'usages') continue;
      const c = snapshotClass(ev.snapshot);
      // An all-released snapshot has no class byte: a button clear only while buttons are subscribed.
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
    if (!c || c.ageMs === null) return 'Cross-chip clock not measured.';
    return `The mouse-side chip's clock leads the main chip's by ${ms(c.offsetUs)} ms, +/- ${ms(c.delayUs)} ms, measured ${c.ageMs} ms ago.`;
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Panels>
        <Stack>
          <Panel id="input-catch" title="Watch">
            <div class="labelled">
              <span class="field-l">Mode</span>
              <Segmented
                name="catch-mode"
                label="Mode"
                value={mode()}
                onChange={setMode}
                disabled={streaming()}
                options={[
                  { value: 'preset', label: 'Presets' },
                  { value: 'custom', label: 'Custom table' },
                ]}
              />
            </div>

            <Show when={mode() === 'preset'}>
              <div class="labelled">
                <span class="field-l">Preset</span>
                <Select
                  label="Preset"
                  value={preset()}
                  onChange={setPreset}
                  disabled={streaming()}
                  options={[
                    { value: 'input', label: 'All input' },
                    { value: 'buttons', label: 'Buttons' },
                    { value: 'motion', label: 'Movement, wheel, pan' },
                    { value: 'keys', label: 'Keyboard + media' },
                    { value: 'traffic', label: 'Raw endpoints' },
                    { value: 'bus', label: 'Bus events' },
                  ]}
                />
              </div>
            </Show>

            <Show when={mode() === 'custom'}>
              <div class="labelled">
                <span class="field-l">Class</span>
                <Select
                  label="Class"
                  value={String(cls())}
                  onChange={(v) => setCls(Number(v))}
                  options={CLASS_OPTIONS}
                  filter="Filter by name or id"
                />
              </div>
              <p class="mut">The id is {ID_MEANING[cls()] ?? 'class specific'}.</p>
              <Show when={cls() !== CatchClass.Bus && cls() !== CatchClass.Any}>
                <div class="labelled">
                  <span class="field-l">Id</span>
                  <Segmented
                    name="catch-anyid"
                    label="Id"
                    value={anyId()}
                    onChange={setAnyId}
                    options={[
                      { value: 'any', label: 'Every id' },
                      { value: 'one', label: 'One id' },
                    ]}
                  />
                  <Show when={anyId() === 'one'}>
                    <div class="fw-s">
                      <NumberInput label="Id" value={id()} min={0} max={65534} precision={0} onChange={(v) => setId(v ?? 0)} />
                    </div>
                  </Show>
                </div>
              </Show>
              <div class="labelled">
                <span class="field-l">Direction</span>
                <Segmented
                  name="catch-dir"
                  label="Direction"
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
                <div class="labelled">
                  <span class="field-l">Capture</span>
                  <div class="fw-s">
                    <NumberInput
                      label="Bytes (0 = all)"
                      value={capture()}
                      min={0}
                      max={255}
                      precision={0}
                      onChange={(v) => setCapture(v ?? 0)}
                    />
                  </div>
                </div>
              </Show>
              <div class="acts">
                <Button variant="secondary" disabled={streaming()} onClick={addCustom}>
                  Add entry
                </Button>
                <Button variant="subtle" disabled={streaming()} onClick={() => setCustom([])}>
                  Clear
                </Button>
              </div>
              <p class="sublabel">
                Table ({custom().length} of {CATCH_TABLE_MAX})
              </p>
              <Show when={custom().length > 0} fallback={<p class="mut">No entries.</p>}>
                <div class="chips">
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
            </Show>

            <div class="acts">
              <Show
                when={!streaming()}
                fallback={
                  <Button variant="secondary" onClick={() => cmd.run(stop)}>
                    Stop
                  </Button>
                }
              >
                <Button
                  variant="primary"
                  disabled={chosen().length === 0 || cmd.busy()}
                  onClick={watch}
                >
                  Watch
                </Button>
              </Show>
            </div>

            <Show when={cmd.error()}>
              {(msg) => (
                <div class="callout callout--danger" role="alert">
                  {msg()}
                </div>
              )}
            </Show>

            <Show when={droppedByBox()}>
              <div class="callout callout--warning">
                The box cleared the subscription after 1 s with no control frame, which a backgrounded tab
                can cause. Press Watch to restart.
              </div>
            </Show>

            <Show when={streaming() && refused().length > 0}>
              <div class="callout callout--warning">
                The box refused {refused().length} of {active().length} {active().length === 1 ? 'entry' : 'entries'}:{' '}
                {refused().map(describe).join(', ')}.{' '}
                <Show
                  when={catchState()?.tableFull}
                  fallback={<>This firmware doesn't know {refused().length === 1 ? 'that address' : 'those addresses'}.</>}
                >
                  The {CATCH_TABLE_MAX}-entry table is full.
                </Show>
              </div>
            </Show>
          </Panel>

          <Show when={streaming() && latestButtons()}>
            <Panel id="catch-held" title="Held buttons" transient>
              <Show when={held().length > 0} fallback={<p data-search-skip>Nothing held.</p>}>
                <div class="chips">
                  <For each={held()}>{(name) => <Chip variant="warning">{name}</Chip>}</For>
                </div>
              </Show>
            </Panel>
          </Show>

          <Panel id="catch-kinds" title="Events by kind">
            <div class="chips">
              <Chip variant={kindCounts().motion > 0 ? 'info' : 'neutral'}>Motion {kindCounts().motion}</Chip>
              <Chip variant={kindCounts().buttons > 0 ? 'info' : 'neutral'}>Buttons {kindCounts().buttons}</Chip>
              <Chip variant={kindCounts().keys > 0 ? 'info' : 'neutral'}>Keys {kindCounts().keys}</Chip>
              <Chip variant={kindCounts().media > 0 ? 'info' : 'neutral'}>Media {kindCounts().media}</Chip>
              <Chip variant={kindCounts().traffic > 0 ? 'info' : 'neutral'}>Traffic {kindCounts().traffic}</Chip>
            </div>
          </Panel>
        </Stack>

        <Stack>
          <Panel id="catch-events" title="Recent events">
            <div class="acts">
              <Button variant="secondary" disabled={events().length === 0} onClick={copyLog}>
                {copied() ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <LogBox
              rows={logRows}
              added={dash.inputEventsAdded}
              version={moved}
              empty={streaming() ? 'Move, click, or type...' : ''}
              label="Recent events"
              cols="5ch 13ch minmax(0,1fr)"
            />
            <Show when={streaming()}>
              <p class="mut">
                {events().length} received, {catchState()?.dropped ?? 0} dropped by the box, {entryDrops()}{' '}
                charged to entries
              </p>
            </Show>
            <p class="mut">H is the mouse-side chip's clock, D the main chip's.</p>
            <Show when={events().some((e) => e.ev.kind === 'traffic' && trafficRuleActed(e.ev.traffic))}>
              <p class="mut">RULE marks a packet a rewrite rule changed, dropped, answered or refused.</p>
            </Show>
          </Panel>

          <Panel id="catch-clock" title="Clock">
            <p class="mut">{clockLine()}</p>
          </Panel>
        </Stack>
      </Panels>
    </Show>
  );
};

export default DeviceEventCatch;
