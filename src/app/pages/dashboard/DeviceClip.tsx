// Buffered clip playback: build a clip, load it into the box's ring, and drive the engine.
//
// The clip is clocked by the cloned mouse's own report tick, so a tick here is one native report,
// not a millisecond, and everything below is refused by the box when no mouse is cloned. The engine
// is soft state on a 1 s dead-man switch, which the clip status poll doubles as the keepalive for.

import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Checkbox } from '../../../components/inputs/Checkbox';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type ClipEntry,
  type ClipStatus,
  type ClipTrigger,
  type ClipTriggerAction,
  type Usage,
  Action,
  BUTTONS,
  CLIP_COND_ANY_CLASS,
  CLIP_COND_ANY_ID,
  CLIP_LOCK_AIM,
  CLIP_LOCK_ALL,
  CLIP_LOCK_BUTTONS,
  CLIP_LOCK_KEYS,
  CLIP_LOCK_MEDIA,
  CLIP_LOCK_WHEEL,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  CLIP_TRIG_MAX,
  ClipOp,
  ClipState,
  Direction,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  KEYS,
  MEDIA,
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
import { checkColumn, chips, group, label, muted, row } from './ui';

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
  { bit: CLIP_LOCK_WHEEL, name: 'Wheel' },
  { bit: CLIP_LOCK_BUTTONS, name: 'Buttons' },
  { bit: CLIP_LOCK_KEYS, name: 'Keys' },
  { bit: CLIP_LOCK_MEDIA, name: 'Media' },
];

const OPS: { op: ClipOp; name: string }[] = [
  { op: ClipOp.Start, name: 'Start' },
  { op: ClipOp.Stop, name: 'Stop' },
  { op: ClipOp.Pause, name: 'Pause' },
  { op: ClipOp.Resume, name: 'Resume' },
  { op: ClipOp.Restart, name: 'Restart' },
  { op: ClipOp.Toggle, name: 'Toggle' },
];

const ACTIONS = [
  { value: String(Action.Press), label: 'Press' },
  { value: String(Action.SoftRelease), label: 'Release' },
  { value: String(Action.ForceRelease), label: 'Mask' },
];

const entryText = (e: ClipEntry): string => {
  if (e.kind === 'gap') return `wait ${e.ticks}`;
  const parts: string[] = [];
  if (e.xy) parts.push(`move ${e.xy.dx},${e.xy.dy}`);
  if (e.wheel !== undefined) parts.push(`wheel ${e.wheel}`);
  for (const ed of e.edges ?? []) {
    const verb = ed.action === Action.Press ? 'press' : ed.action === Action.ForceRelease ? 'mask' : 'release';
    parts.push(`${verb} ${usageName(ed.cls, ed.id)}`);
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
  const ready = () => health()?.cloneConfigured === true;

  const [draft, setDraft] = createSignal<ClipEntry[]>([]);
  const [kind, setKind] = createSignal('move');
  const [dx, setDx] = createSignal(10);
  const [dy, setDy] = createSignal(0);
  const [dz, setDz] = createSignal(1);
  const [gap, setGap] = createSignal(10);
  const [edgeUsage, setEdgeUsage] = createSignal<Usage>({ cls: INJ_BTN, id: 0 });
  const [edgeAction, setEdgeAction] = createSignal(String(Action.Press));

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

  const addEntry = () => {
    const k = kind();
    if (k === 'move') setDraft((d) => [...d, { kind: 'tick', xy: { dx: dx(), dy: dy() } }]);
    else if (k === 'wheel') setDraft((d) => [...d, { kind: 'tick', wheel: dz() }]);
    else if (k === 'gap') setDraft((d) => [...d, { kind: 'gap', ticks: gap() }]);
    else {
      const u = edgeUsage();
      setDraft((d) => [
        ...d,
        { kind: 'tick', edges: [{ cls: u.cls, id: u.id, action: Number(edgeAction()) as Action }] },
      ]);
    }
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
  // every binding rather than that one. Say so instead of letting it surprise someone.
  const isWildcard = (t: ClipTrigger) =>
    t.cls === CLIP_COND_ANY_CLASS && t.id === CLIP_COND_ANY_ID && t.edge === Direction.Both;

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Clip playback" subtitle="Load a clip into the box and play it back" />

        <Show when={ready()} fallback={<p style={muted}>The box refuses every clip command without a cloned mouse, because a clip is clocked by the mouse's report rate.</p>}>
          <Show when={(moveRide() ?? 0) > 0 && rideOn()}>
            <div class="callout callout--warning">
              Movement riding is on and this clip is set to ride it, so clip motion is only emitted
              alongside a real mouse move. Button and key ticks still play.
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
              <Chip variant="neutral">Finalized</Chip>
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
          </div>
          <p style={muted}>Counts are since this clip was loaded.</p>

          <Show when={state() === ClipState.Faulted}>
            <div class="callout callout--danger" role="alert">
              An append was lost or the ring overran, so the stream may be misaligned and the box
              stopped it. Clear is the only way to recover, and it discards the clip.
            </div>
          </Show>

          <Show when={(clip()?.held.length ?? 0) > 0}>
            <div style={group}>
              <div style={label}>Held by injection now</div>
              <div style={chips}>
                <For each={clip()?.held ?? []}>
                  {(u) => <Chip variant="warning">{usageName(u.cls, u.id)}</Chip>}
                </For>
              </div>
            </div>
          </Show>

          <div style={{ ...row }}>
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
              label="Motion rides a real report (only matters with movement riding on)"
              checked={rideOn()}
              disabled={busy()}
              onChange={(on) => setFlag(CLIP_SET_RIDE, on)}
            />
          </div>

          <div style={group}>
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
            <p style={muted}>Applied at the next start, not to a clip already playing.</p>
          </div>

          </Section>

          <Section title="Build">
          <div style={label}>Add a tick</div>
          <RadioGroup
            name="clip-kind"
            value={kind()}
            onChange={setKind}
            options={[
              { value: 'move', label: 'Move' },
              { value: 'wheel', label: 'Wheel' },
              { value: 'gap', label: 'Wait' },
              { value: 'edge', label: 'Button or key' },
            ]}
          />
          <div style={{ ...row, 'align-items': 'flex-end' }}>
            <Show when={kind() === 'move'}>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput label="dx" value={dx()} min={-32768} max={32767} onChange={(v) => setDx(v ?? 0)} />
              </div>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput label="dy" value={dy()} min={-32768} max={32767} onChange={(v) => setDy(v ?? 0)} />
              </div>
            </Show>
            <Show when={kind() === 'wheel'}>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput label="Detents" value={dz()} min={-32768} max={32767} onChange={(v) => setDz(v ?? 0)} />
              </div>
            </Show>
            <Show when={kind() === 'gap'}>
              <div style={{ 'max-width': '9rem' }}>
                <NumberInput label="Ticks" value={gap()} min={1} max={65535} onChange={(v) => setGap(v ?? 1)} />
              </div>
            </Show>
            <Button variant="secondary" onClick={addEntry}>
              Add
            </Button>
          </div>
          <Show when={kind() === 'edge'}>
            <UsagePicker name="clip-edge" classes={CLASSES} value={edgeUsage()} onChange={setEdgeUsage} />
            <div style={group}>
              <div style={label}>Action</div>
              <RadioGroup name="clip-edge-action" value={edgeAction()} onChange={setEdgeAction} options={ACTIONS} />
            </div>
          </Show>

          <div style={group}>
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
                This clip is finalized, so the box drops anything more that is sent to it. Clear it
                to load a different one.
              </div>
            </Show>
            <Show when={wontFit()}>
              <div class="callout callout--warning">
                More than the ring has free. A long clip goes out as several frames, so the box
                would take the first few, drop the one that overflows, and fault with a partial clip
                loaded.
              </div>
            </Show>
            <div style={{ ...row }}>
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

          <div style={group}>
            <UsagePicker
              name="clip-trigger"
              classes={TRIGGER_CLASSES}
              value={trigUsage()}
              onChange={setTrigUsage}
            />
            <div style={group}>
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
            <div style={group}>
              <div style={label}>Runs</div>
              <RadioGroup
                name="clip-trig-op"
                value={trigOp()}
                onChange={setTrigOp}
                options={OPS.map((o) => ({ value: String(o.op), label: o.name }))}
              />
            </div>
            <div style={group}>
              <Checkbox
                label="Consume the trigger"
                checked={trigConsume()}
                onChange={setTrigConsume}
              />
            </div>
            <div style={{ ...row }}>
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
    </Show>
  );
};

export default DeviceClip;
