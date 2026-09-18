// Buffered clip playback: build a clip, load it into the box's ring, and drive the engine.
//
// A clip plays on any clone. With a mouse cloned a tick is one native frame, not a millisecond; with
// none it is the emit rate OPTION(EMIT) fixes, else 1 ms. Everything below is refused by the box
// while no clone is up. The engine is soft state on a 1 s dead-man switch, which the clip status poll
// doubles as the keepalive for. Raw report and transfer ticks play only under imperfect clones, so
// they are offered only while it is on.

import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Checkbox } from '../../../components/inputs/Checkbox';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import {
  type ClipEntry,
  type ClipEntryFault,
  type ClipStatus,
  type ClipTrigger,
  type ClipTriggerAction,
  type Usage,
  Action,
  BUTTONS,
  CLIP_COND_ANY_CLASS,
  CLIP_COND_ANY_ID,
  CLIP_EDGES_MAX,
  CLIP_ENTRY_MAX,
  CLIP_LOCK_AIM,
  CLIP_LOCK_ALL,
  CLIP_LOCK_BUTTONS,
  CLIP_LOCK_KEYS,
  CLIP_LOCK_MEDIA,
  CLIP_LOCK_WHEEL,
  CLIP_RAW_MAX,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  CLIP_TRIG_MAX,
  CLIP_VERBS,
  ClipOp,
  ClipState,
  Direction,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  KEYS,
  MEDIA,
  RenderMode,
  clipEntryFault,
  clipOpName,
  clipStateLabel,
  encodeClipEntry,
  isTriggerAction,
  sameTrigger,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { UsagePicker, type PickerClass } from './UsagePicker';
import { Section } from './Section';
import { checkColumn, chips, label, muted, row, section } from './ui';
import {
  RAW_DIR_BLURB,
  SETUP_DEFAULT,
  SETUP_FIELDS,
  decodeSetup,
  displayName,
  outDataBlurb,
  parseHex,
  parseNum,
} from './hex';

const CLASSES: PickerClass[] = [
  { value: INJ_BTN, label: 'Button', table: BUTTONS },
  { value: INJ_KEY, label: 'Key', table: KEYS },
  { value: INJ_MEDIA, label: 'Media', table: MEDIA },
];

// Triggers reach further than clip entries do: the box accepts a whole-class binding and a
// whole-of-everything binding, and the list below already names them.
const TRIGGER_CLASSES: PickerClass[] = [
  { ...CLASSES[0], blanket: CLIP_COND_ANY_ID, blanketLabel: 'Any button' },
  { ...CLASSES[1], blanket: CLIP_COND_ANY_ID, blanketLabel: 'Any key' },
  { ...CLASSES[2], blanket: CLIP_COND_ANY_ID, blanketLabel: 'Any media key' },
  {
    value: CLIP_COND_ANY_CLASS,
    label: 'Anything',
    table: [],
    blanket: CLIP_COND_ANY_ID,
    blanketLabel: 'Any input at all',
  },
];

const SCOPES: { bit: number; name: string }[] = [
  { bit: CLIP_LOCK_AIM, name: 'Aim (X and Y)' },
  { bit: CLIP_LOCK_WHEEL, name: 'Wheel and pan' },
  { bit: CLIP_LOCK_BUTTONS, name: 'Buttons' },
  { bit: CLIP_LOCK_KEYS, name: 'Keys' },
  { bit: CLIP_LOCK_MEDIA, name: 'Media' },
];

const OPS: { op: ClipOp; name: string }[] = CLIP_VERBS.map((op) => ({
  op,
  name: displayName(clipOpName(op)),
}));

const ACTIONS = [
  { value: String(Action.Press), label: 'Press' },
  { value: String(Action.SoftRelease), label: 'Release' },
  { value: String(Action.ForceRelease), label: 'Mask' },
];

const RAW_DIRS = [
  { value: String(Direction.Positive), label: 'In' },
  { value: String(Direction.Negative), label: 'Out' },
];

// What the codec refused an entry for, in the words of the fields on this card.
const FAULT_TEXT: Record<ClipEntryFault, string> = {
  gap: 'A wait must be 1 to 65535 ticks.',
  edges: `A tick must carry at most ${CLIP_EDGES_MAX} buttons or keys.`,
  'raw-count': `A tick must carry at most ${CLIP_RAW_MAX} raw reports.`,
  empty: 'A tick must carry at least one field.',
  'raw-direction': 'Direction must be In or Out.',
  'transfer-data': 'Out data must be wLength bytes, and blank for a request that reads.',
  'too-long': `A tick must encode to at most ${CLIP_ENTRY_MAX} bytes.`,
};

const entryText = (e: ClipEntry): string => {
  if (e.kind === 'gap') return `wait ${e.ticks}`;
  const parts: string[] = [];
  if (e.xy) parts.push(`move ${e.xy.dx},${e.xy.dy}`);
  if (e.wheel !== undefined) parts.push(`wheel ${e.wheel}`);
  if (e.pan !== undefined) parts.push(`pan ${e.pan}`);
  for (const ed of e.edges ?? []) {
    const verb = ed.action === Action.Press ? 'press' : ed.action === Action.ForceRelease ? 'mask' : 'release';
    parts.push(`${verb} ${usageName(ed.cls, ed.id)}`);
  }
  for (const r of e.raw ?? []) {
    parts.push(`raw ${r.dir === Direction.Negative ? 'out' : 'in'} ${r.ep}, ${r.bytes.length} B`);
  }
  for (const t of e.transfers ?? []) {
    parts.push(`transfer ${t.setup.bmRequestType & 0x80 ? 'in' : 'out'} ${t.ep}, ${t.setup.wLength} B`);
  }
  return parts.join(' + ');
};

const triggerText = (t: ClipTrigger): string => {
  const who =
    t.cls === CLIP_COND_ANY_CLASS
      ? 'any input'
      : t.id === CLIP_COND_ANY_ID
        ? `any ${CLASSES.find((c) => c.value === t.cls)?.label.toLowerCase() ?? 'input'}`
        : usageName(t.cls, t.id);
  const edge = t.edge === Direction.Positive ? 'press' : t.edge === Direction.Negative ? 'release' : 'both edges';
  const op = OPS.find((o) => o.op === t.action)?.name ?? `op ${t.action}`;
  const locks = t.consume && t.edge !== Direction.Negative;
  return `${who} ${edge} -> ${op}${locks ? ' (consume)' : ''}`;
};

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const bytesOf = (entries: ClipEntry[]): number =>
  entries.reduce((n, e) => n + (encodeClipEntry(e)?.length ?? 0), 0);

const DeviceClip = () => {
  const dash = useDashboard();
  const clip = dash.poll('clip');
  const health = () => dash.health();
  const moveRide = dash.poll('moveRide');
  const render = dash.poll('render');
  const imperfect = dash.poll('imperfect');
  const ready = () => health()?.cloneConfigured === true;
  const allowed = () => imperfect()?.allowed === true;

  const [draft, setDraft] = createSignal<ClipEntry[]>([]);
  const [kind, setKind] = createSignal('move');
  const [dx, setDx] = createSignal(10);
  const [dy, setDy] = createSignal(0);
  const [dz, setDz] = createSignal(1);
  const [dpan, setDpan] = createSignal(1);
  const [gap, setGap] = createSignal(10);
  const [edgeUsage, setEdgeUsage] = createSignal<Usage>({ cls: INJ_BTN, id: 0 });
  const [edgeAction, setEdgeAction] = createSignal(String(Action.Press));
  const [rawEp, setRawEp] = createSignal(1);
  const [rawDir, setRawDir] = createSignal(String(Direction.Positive));
  const [rawBytes, setRawBytes] = createSignal('');
  const [xferEp, setXferEp] = createSignal(0);
  const [setup, setSetup] = createSignal<Record<string, string>>(SETUP_DEFAULT);
  const [outData, setOutData] = createSignal('');
  const setupType = () => parseNum(setup().type);
  // The two gated kinds leave the picker with the opt-in, so a kind picked while it was on falls back.
  const gated = (k: string) => k === 'raw' || k === 'transfer';
  const kindNow = () => (gated(kind()) && !allowed() ? 'move' : kind());

  const [trigUsage, setTrigUsage] = createSignal<Usage>({
    cls: TRIGGER_CLASSES[0].value,
    id: TRIGGER_CLASSES[0].table[0].id,
  });
  const [trigEdge, setTrigEdge] = createSignal(String(Direction.Positive));
  const [trigOp, setTrigOp] = createSignal(String(ClipOp.Toggle));
  const [trigConsume, setTrigConsume] = createSignal(false);

  // The four counters are boot-lifetime and never reset by the box, so an absolute reading says
  // nothing about this clip. Baseline them and show the difference.
  const [base, setBase] = createSignal<ClipStatus | null>(null);
  const rebaseline = () => setBase(clip() ?? null);
  // Baseline on the very first status, so a box that has been used by someone else does not open
  // with their lifetime totals under a caption claiming they belong to this clip.
  createEffect(() => {
    const c = clip();
    if (c && base() === null) setBase(c);
  });
  const delta = (pick: (s: ClipStatus) => number): number => {
    const now = clip();
    if (!now) return 0;
    const b = base();
    // A box reboot resets the counters, so a negative difference means the baseline is stale.
    return b ? Math.max(0, pick(now) - pick(b)) : pick(now);
  };

  const state = () => clip()?.state ?? ClipState.Idle;
  const loaded = () => (clip()?.totalBytes ?? 0) > 0;
  const finalized = () => clip()?.finalized === true;

  // What we asked the box for, held until the box agrees. Reading the poll directly made two quick
  // clicks race (the second read the pre-first value and dropped the first bit), and left the
  // checkbox showing a state the box had refused.
  const [scopeEdit, setScopeEdit] = createSignal<number | null>(null);
  const scope = () => scopeEdit() ?? (clip()?.autolock ?? 0) & CLIP_LOCK_ALL;
  createEffect(() => {
    const want = scopeEdit();
    if (want !== null && ((clip()?.autolock ?? 0) & CLIP_LOCK_ALL) === want) setScopeEdit(null);
  });

  const [flagEdit, setFlagEdit] = createSignal<{ loop?: boolean; retain?: boolean; ride?: boolean }>(
    {},
  );
  const loopOn = () => flagEdit().loop ?? clip()?.loop === true;
  const retainOn = () => flagEdit().retain ?? clip()?.retain === true;
  const rideOn = () => flagEdit().ride ?? clip()?.ride === true;
  // Rendering takes the clip's cursor motion, so the clip's own ride setting then covers only the
  // wheel and pan.
  const rendered = () =>
    render()?.ready === true && (render()?.mode ?? RenderMode.Off) !== RenderMode.Off;
  const riding = () => (moveRide() ?? 0) > 0;
  const cursorRides = () => riding() && (rendered() ? render()?.full !== true : rideOn());
  const wheelRides = () => riding() && rideOn();
  createEffect(() => {
    const c = clip();
    if (!c) return;
    const e = flagEdit();
    const next = { ...e };
    if (e.loop !== undefined && c.loop === e.loop) delete next.loop;
    if (e.retain !== undefined && c.retain === e.retain) delete next.retain;
    if (e.ride !== undefined && c.ride === e.ride) delete next.ride;
    if (Object.keys(next).length !== Object.keys(e).length) setFlagEdit(next);
  });

  const cmd = createCommand(() => dash.refreshPoll('clip'));
  const busy = cmd.busy;
  const err = cmd.error;

  const ctrl = (op: ClipOp) =>
    cmd.run(async () => {
      // Re-baselined at the clear, not nulled: the box never resets these counters, so "since this
      // clip" means since this moment.
      if (op === ClipOp.Clear) rebaseline();
      await dash.link()!.clipCtrl(op);
    });

  // The entry the pickers describe, or what is wrong with them.
  const pickedEntry = (): ClipEntry | string => {
    const k = kindNow();
    if (k === 'move') return { kind: 'tick', xy: { dx: dx(), dy: dy() } };
    if (k === 'wheel') return { kind: 'tick', wheel: dz() };
    if (k === 'pan') return { kind: 'tick', pan: dpan() };
    if (k === 'gap') return { kind: 'gap', ticks: gap() };
    if (k === 'raw') {
      const bytes = parseHex(rawBytes());
      if (bytes === null) return 'Bytes must be hex.';
      if (bytes.length === 0) return 'Enter the bytes to put on the endpoint.';
      return { kind: 'tick', raw: [{ ep: rawEp(), dir: Number(rawDir()) as Direction, bytes }] };
    }
    if (k === 'transfer') {
      const fields = SETUP_FIELDS.map((f) => parseNum(setup()[f.key]));
      if (fields.some((f) => f === null)) return 'Every setup field must be a number.';
      const out = parseHex(outData());
      if (out === null) return 'Out data must be hex.';
      const [bmRequestType, bRequest, wValue, wIndex, wLength] = fields as number[];
      return {
        kind: 'tick',
        transfers: [{ ep: xferEp(), setup: { bmRequestType, bRequest, wValue, wIndex, wLength }, out }],
      };
    }
    const u = edgeUsage();
    return { kind: 'tick', edges: [{ cls: u.cls, id: u.id, action: Number(edgeAction()) as Action }] };
  };

  // Refused here, where the fields are, since the box faults the whole clip on an entry it cannot read.
  const addEntry = () => {
    const picked = pickedEntry();
    const fault = typeof picked === 'string' ? null : clipEntryFault(picked);
    const entry = fault ? FAULT_TEXT[fault] : picked;
    if (typeof entry === 'string') {
      cmd.run(() => Promise.reject(new Error(entry)));
      return;
    }
    cmd.clear();
    setDraft((d) => [...d, entry]);
  };

  const append = () =>
    cmd.run(async () => {
      const entries = draft();
      if (entries.length === 0) return;
      await dash.link()!.clipAppend(entries);
      setDraft([]);
      rebaseline();
    });

  const setScope = (bit: number, on: boolean) => {
    // Masked to the defined bits: the box coerces the value the same way, so sending anything else
    // would make the readback disagree with what we asked for.
    const next = ((on ? scope() | bit : scope() & ~bit) & CLIP_LOCK_ALL) >>> 0;
    setScopeEdit(next);
    cmd.run(() => dash.link()!.clipSet(CLIP_SET_AUTOLOCK, next));
  };

  const setFlag = (id: number, on: boolean) => {
    // Loop only wraps a replayable clip, so it cannot outlive the setting it depends on. The box
    // keeps the two independently: leaving loop set would hold a flag nothing on screen shows, and
    // it would take effect again the moment replayable came back.
    const dropLoop = id === CLIP_SET_RETAIN && !on && loopOn();
    const field =
      id === CLIP_SET_LOOP ? 'loop' : id === CLIP_SET_RETAIN ? 'retain' : id === CLIP_SET_RIDE ? 'ride' : null;
    if (field === null) return;   // not a boolean setting; autolock has its own optimistic path
    setFlagEdit((e) => ({
      ...e,
      [field]: on,
      ...(dropLoop ? { loop: false } : {}),
    }));
    cmd.run(async () => {
      await dash.link()!.clipSet(id, on ? 1 : 0);
      if (dropLoop) await dash.link()!.clipSet(CLIP_SET_LOOP, 0);
    });
  };

  const addTrigger = () =>
    cmd.run(async () => {
      const u = trigUsage();
      const action = Number(trigOp());
      // The radio only offers bindable ops, but the value arrives as a string: a binding the box
      // will not store is one it discards with no reply, so refuse it here instead.
      if (!isTriggerAction(action)) throw new Error('that verb cannot be bound to an input');
      await dash.link()!.clipTrigger({
        cls: u.cls,
        id: u.id,
        edge: Number(trigEdge()) as Direction,
        action,
        consume: trigConsume(),
      });
    });

  const removeTrigger = (t: ClipTrigger) => cmd.run(() => dash.link()!.clipUntrigger(t));

  // The box keys a binding on (class, id, edge) and overwrites in place, so a full table still
  // accepts a rebind of an address it already holds.
  const replacing = createMemo(() => {
    const u = trigUsage();
    const want = {
      cls: u.cls,
      id: u.id,
      edge: Number(trigEdge()) as Direction,
      action: ClipOp.Start as ClipTriggerAction,
      consume: false,
    };
    return (clip()?.triggers ?? []).some((t) => sameTrigger(t, want));
  });
  const trigFull = createMemo(
    () => (clip()?.triggers.length ?? 0) >= CLIP_TRIG_MAX && !replacing(),
  );

  const completeWhy = (): string | null => {
    if (finalized()) return 'Already marked complete.';
    if (!retainOn()) return 'Only a replayable clip can be marked complete. Turn on Replayable before sending the first tick.';
    if (!loaded()) return 'Send at least one tick first.';
    return null;
  };

  const draftBytes = createMemo(() => bytesOf(draft()));
  // Only once the ring size is known. Treating "no status yet" as "will not fit" disabled Send and
  // warned about a ring nobody had measured.
  const wontFit = createMemo(() => {
    const c = clip();
    return c ? draftBytes() > c.freeBytes : false;
  });

  // Removing the fully-wild binding is byte-identical to the clear-all sentinel, so the box wipes
  // every binding rather than that one. The note below states it.
  const isWildcard = (t: ClipTrigger) =>
    t.cls === CLIP_COND_ANY_CLASS && t.id === CLIP_COND_ANY_ID && t.edge === Direction.Both;

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="clip-playback" data-search-target>
        <Card>
          <CardHeader title="Clip playback" subtitle="Load a clip into the box and play it back" />

          <Show when={ready()} fallback={<p style={muted}>Clips need a cloned device. Plug one into USB3.</p>}>
            <Show when={render() && (cursorRides() || wheelRides())}>
              <div class="callout callout--warning">
                {cursorRides() && rendered()
                  ? 'Movement riding is on and the box is rendering motion, so '
                  : 'Movement riding is on, so '}
                {cursorRides() && wheelRides()
                  ? 'clip motion is'
                  : cursorRides()
                    ? "the clip's cursor motion is"
                    : "the clip's wheel and pan motion is"}{' '}
                only emitted alongside a real mouse move. Button, key and media ticks still play.
              </div>
            </Show>

            <Section title="Engine" first>
            <div style={chips}>
              <Chip
                variant={
                  state() === ClipState.Playing
                    ? 'success'
                    : state() === ClipState.Faulted
                      ? 'error'
                      : state() === ClipState.Paused
                        ? 'warning'
                        : 'neutral'
                }
              >
                {clipStateLabel(state())}
              </Chip>
              <Chip variant="neutral">{clip()?.totalBytes ?? 0} B loaded</Chip>
              <Chip variant="neutral">{clip()?.freeBytes ?? 0} B free</Chip>
              <Show when={finalized()}>
                <Chip variant="neutral">Complete</Chip>
              </Show>
              <Show when={clip()?.retain}>
                <Chip variant="neutral">
                  {clip()!.totalBytes > 0
                    ? `${Math.round(((clip()!.played ?? 0) / clip()!.totalBytes) * 100)}% played`
                    : 'not started'}
                </Chip>
              </Show>
              <Chip variant={delta((s) => s.ticks) > 0 ? 'info' : 'neutral'}>
                {plural(delta((s) => s.ticks), 'tick')}
              </Chip>
              <Show when={delta((s) => s.underruns) > 0}>
                <Chip variant="warning">{plural(delta((s) => s.underruns), 'underrun')}</Chip>
              </Show>
              <Show when={delta((s) => s.overruns) > 0}>
                <Chip variant="error">{plural(delta((s) => s.overruns), 'overrun')}</Chip>
              </Show>
              <Show when={delta((s) => s.seqGaps) > 0}>
                <Chip variant="error">{plural(delta((s) => s.seqGaps), 'lost append')}</Chip>
              </Show>
              <Show when={delta((s) => s.xfers) > 0}>
                <Chip variant="info">{plural(delta((s) => s.xfers), 'transfer')}</Chip>
              </Show>
              <Show when={delta((s) => s.xferErrs) > 0}>
                <Chip variant="error">{plural(delta((s) => s.xferErrs), 'failed transfer')}</Chip>
              </Show>
              <Show when={delta((s) => s.gated) > 0}>
                <Chip variant="warning">{plural(delta((s) => s.gated), 'discarded item')}</Chip>
              </Show>
            </div>
            <p style={{ ...muted, 'margin-top': '4px' }}>Counts are since this clip was loaded.</p>

            <Show when={state() === ClipState.Faulted}>
              <div class="callout callout--danger" role="alert">
                An append was lost or the ring overran, so the stream may be misaligned and the box
                stopped it. Clear is the only way to recover, and it discards the clip.
              </div>
            </Show>

            <Show when={(clip()?.held.length ?? 0) > 0}>
              <div style={section}>
                <div style={label}>Held by injection now</div>
                <div style={chips}>
                  <For each={clip()?.held ?? []}>
                    {(u) => <Chip variant="warning">{usageName(u.cls, u.id)}</Chip>}
                  </For>
                </div>
              </div>
            </Show>

            <div style={{ ...section, ...row }}>
              <For each={OPS}>
                {(o) => (
                  <Button
                    variant={o.op === ClipOp.Start ? 'primary' : 'secondary'}
                    disabled={busy() || (o.op === ClipOp.Start && !loaded())}
                    onClick={() => ctrl(o.op)}
                  >
                    {o.name}
                  </Button>
                )}
              </For>
              <Button variant="danger" disabled={busy()} onClick={() => ctrl(ClipOp.Clear)}>
                Clear
              </Button>
            </div>
            <p style={muted}>
              Start on a paused clip resumes it rather than replaying from the beginning.
            </p>

            </Section>

            <Section title="Settings">
            <div style={checkColumn}>
              <Checkbox
                label="Replayable (keep the clip after playing it)"
                checked={retainOn()}
                disabled={busy() || loaded()}
                title={loaded() ? 'Only changeable while the ring is empty. Clear the clip first.' : ''}
                onChange={(on) => setFlag(CLIP_SET_RETAIN, on)}
              />
            </div>
            <div style={checkColumn}>
              <Checkbox
                label="Loop"
                checked={loopOn()}
                disabled={busy() || !retainOn()}
                onChange={(on) => setFlag(CLIP_SET_LOOP, on)}
              />
            </div>
            <div style={checkColumn}>
              <Checkbox
                label={rendered() ? 'Wheel and pan motion rides a real report' : 'Motion rides a real report'}
                checked={rideOn()}
                disabled={busy()}
                onChange={(on) => setFlag(CLIP_SET_RIDE, on)}
              />
            </div>

            <div style={section}>
              <div style={label}>Lock these inputs while a clip plays</div>
              <div style={checkColumn}>
                <For each={SCOPES}>
                  {(s) => (
                    <Checkbox
                      label={s.name}
                      checked={(scope() & s.bit) !== 0}
                      disabled={busy()}
                      onChange={(on) => setScope(s.bit, on)}
                    />
                  )}
                </For>
              </div>
              <p style={{ ...muted, 'margin-top': '4px' }}>Applied at the next start, not to a clip already playing.</p>
            </div>

            </Section>

            <Section title="Build">
            <div style={label}>Add a tick</div>
            <RadioGroup
              name="clip-kind"
              value={kindNow()}
              onChange={setKind}
              options={[
                { value: 'move', label: 'Move' },
                { value: 'wheel', label: 'Wheel' },
                { value: 'pan', label: 'Pan' },
                { value: 'gap', label: 'Wait' },
                { value: 'edge', label: 'Button or key' },
                ...(allowed()
                  ? [
                      { value: 'raw', label: 'Raw report' },
                      { value: 'transfer', label: 'Control transfer' },
                    ]
                  : []),
              ]}
            />
            <Show when={!allowed()}>
              <p style={{ ...muted, 'margin-top': '4px' }}>
                Raw report and control transfer ticks need imperfect clones, on the Device tab.
              </p>
            </Show>
            <div style={{ ...section, ...row, 'align-items': 'flex-end' }}>
              <Show when={kindNow() === 'move'}>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="dx" value={dx()} min={-32768} max={32767} onChange={(v) => setDx(v ?? 0)} />
                </div>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="dy" value={dy()} min={-32768} max={32767} onChange={(v) => setDy(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'wheel'}>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="Detents" value={dz()} min={-32768} max={32767} onChange={(v) => setDz(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'pan'}>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="Detents" value={dpan()} min={-32768} max={32767} onChange={(v) => setDpan(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'gap'}>
                <div style={{ 'max-width': '9rem' }}>
                  <NumberInput label="Ticks" value={gap()} min={1} max={65535} onChange={(v) => setGap(v ?? 1)} />
                </div>
              </Show>
              <Show when={kindNow() === 'raw'}>
                <div style={{ 'max-width': '9rem' }}>
                  <NumberInput
                    name="clip-raw-ep"
                    label="Endpoint number"
                    value={rawEp()}
                    min={0}
                    max={15}
                    onChange={(v) => setRawEp(v ?? 0)}
                  />
                </div>
                <div style={{ flex: '1 1 240px' }}>
                  <TextField
                    name="clip-raw-bytes"
                    label="Bytes (hex)"
                    value={rawBytes()}
                    onInput={setRawBytes}
                    placeholder="e.g. 01 00 05 00"
                  />
                </div>
              </Show>
              <Show when={kindNow() === 'transfer'}>
                <div style={{ 'max-width': '9rem' }}>
                  <NumberInput
                    name="clip-xfer-ep"
                    label="Endpoint number"
                    value={xferEp()}
                    min={0}
                    max={15}
                    onChange={(v) => setXferEp(v ?? 0)}
                  />
                </div>
                <For each={SETUP_FIELDS}>
                  {(f) => (
                    <div style={{ 'max-width': '9rem' }}>
                      <TextField
                        name={`clip-xfer-${f.key}`}
                        label={f.label}
                        value={setup()[f.key]}
                        onInput={(v) => setSetup((prev) => ({ ...prev, [f.key]: v }))}
                        placeholder={f.placeholder}
                      />
                    </div>
                  )}
                </For>
              </Show>
              <Button variant="secondary" onClick={addEntry}>
                Add
              </Button>
            </div>
            <Show when={kindNow() === 'raw'}>
              <div style={section}>
                <div style={label}>Direction</div>
                <RadioGroup name="clip-raw-dir" value={rawDir()} onChange={setRawDir} options={RAW_DIRS} />
                <p style={{ ...muted, 'margin-top': '4px' }}>{RAW_DIR_BLURB[Number(rawDir())]}</p>
              </div>
            </Show>
            <Show when={kindNow() === 'transfer'}>
              <p style={{ ...muted, 'margin-top': '4px' }}>
                <Show when={setupType() !== null} fallback="bmRequestType must be a number.">
                  {decodeSetup(setupType()!, parseNum(setup().req))}
                </Show>
              </p>
              <div style={section}>
                <TextField
                  name="clip-xfer-out"
                  label="Out data (hex)"
                  value={outData()}
                  onInput={setOutData}
                  placeholder="e.g. 00 01"
                />
                <p style={{ ...muted, 'margin-top': '4px' }}>{outDataBlurb(setupType())}</p>
              </div>
            </Show>
            <Show when={kindNow() === 'edge'}>
              <UsagePicker name="clip-edge" classes={CLASSES} value={edgeUsage()} onChange={setEdgeUsage} />
              <div style={section}>
                <div style={label}>Action</div>
                <RadioGroup name="clip-edge-action" value={edgeAction()} onChange={setEdgeAction} options={ACTIONS} />
              </div>
            </Show>

            <div style={section}>
              <div style={label}>
                Not yet sent ({plural(draft().length, 'tick')}, {draftBytes()} B)
              </div>
              <Show when={draft().length > 0} fallback={<p style={muted}>Nothing built yet.</p>}>
                <div style={chips}>
                  <For each={draft()}>
                    {(e, i) => (
                      <Chip variant="info" onRemove={() => setDraft((d) => d.filter((_, j) => j !== i()))}>
                        {entryText(e)}
                      </Chip>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={finalized()}>
                <div class="callout callout--warning">
                  This clip is marked complete, so the box drops anything more sent to it. Clear it to
                  load a different one.
                </div>
              </Show>
              <Show when={wontFit()}>
                <div class="callout callout--warning">
                  More than the ring has free. A long clip goes out as several frames, so the box
                  would take the first few, drop the one that overflows, and fault with a partial clip
                  loaded.
                </div>
              </Show>
              <div style={{ ...section, ...row }}>
                <Button
                  variant="primary"
                  disabled={busy() || draft().length === 0 || wontFit() || finalized()}
                  onClick={append}
                >
                  Send to box
                </Button>
                <Button variant="subtle" disabled={draft().length === 0} onClick={() => setDraft([])}>
                  Discard
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy() || completeWhy() !== null}
                  title={completeWhy() ?? 'Set the clip end so playback stops or loops there'}
                  onClick={() => ctrl(ClipOp.Finalize)}
                >
                  Mark complete
                </Button>
              </div>
            </div>

            </Section>

            <Section title="Triggers">
            <p style={muted}>
              Up to {CLIP_TRIG_MAX} bindings.
            </p>
            <Show when={(clip()?.triggers.length ?? 0) > 0} fallback={<p>No triggers bound.</p>}>
              <div style={chips}>
                <For each={clip()?.triggers ?? []}>
                  {(t) => (
                    <Chip variant="info" onRemove={() => removeTrigger(t)}>
                      {triggerText(t)}
                    </Chip>
                  )}
                </For>
              </div>
              <Show when={(clip()?.triggers ?? []).some(isWildcard)}>
                <p style={muted}>
                  Removing the any-input binding clears every trigger: the box reads that exact address
                  as its clear-all.
                </p>
              </Show>
            </Show>

            <div style={section}>
              <UsagePicker
                name="clip-trigger"
                classes={TRIGGER_CLASSES}
                value={trigUsage()}
                onChange={setTrigUsage}
              />
              <div style={section}>
                <div style={label}>Edge</div>
                <RadioGroup
                  name="clip-trig-edge"
                  value={trigEdge()}
                  onChange={setTrigEdge}
                  options={[
                    { value: String(Direction.Positive), label: 'Press' },
                    { value: String(Direction.Negative), label: 'Release' },
                    { value: String(Direction.Both), label: 'Both' },
                  ]}
                />
              </div>
              <div style={section}>
                <div style={label}>Runs</div>
                <RadioGroup
                  name="clip-trig-op"
                  value={trigOp()}
                  onChange={setTrigOp}
                  options={OPS.map((o) => ({ value: String(o.op), label: o.name }))}
                />
              </div>
              <div style={section}>
                <Checkbox
                  label="Consume the trigger"
                  checked={trigConsume()}
                  onChange={setTrigConsume}
                />
              </div>
              <div style={{ ...section, ...row }}>
                <Button variant="secondary" disabled={busy() || trigFull()} onClick={addTrigger}>
                  {replacing() ? 'Replace' : 'Bind'}
                </Button>
              </div>
              <Show when={trigFull()}>
                <p style={muted}>All {CLIP_TRIG_MAX} slots are used. Remove one first.</p>
              </Show>
              <Show when={replacing()}>
                <p style={muted}>
                  Already bound; binding again replaces it and re-arms every trigger's edge detector.
                </p>
              </Show>
            </div>

            </Section>

            <Show when={err()}>
              <div class="callout callout--danger" role="alert">
                {err()}
              </div>
            </Show>
          </Show>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceClip;
