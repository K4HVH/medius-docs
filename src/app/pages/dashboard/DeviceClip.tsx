// Buffered clip playback: build a clip, load it into the box's ring, and drive the engine.
//
// A clip plays on any clone. With a mouse cloned a tick is one native frame, not a millisecond; with
// none it is the emit rate OPTION(EMIT) fixes, else 1 ms. Everything below is refused by the box
// while no clone is up. The engine is soft state on a 1 s dead-man switch, which the clip status poll
// doubles as the keepalive for. Raw report and transfer ticks play only under imperfect clones, so
// they are offered only while it is on. A trigger is an input edge or a packet on a traffic surface;
// only a packet trigger that consumes needs the opt-in, so one that watches binds without it.

import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
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
  type ClipPacketTrigger,
  type ClipPacketTriggerFault,
  type ClipStatus,
  type ClipTrigger,
  type ClipTriggerAction,
  type Usage,
  Action,
  BUTTONS,
  CATCH_ID_ANY,
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
  CLIP_PKT_MATCH_MAX,
  CLIP_PKT_MATCH_POOL,
  CLIP_PKT_TRIG_MAX,
  CLIP_RAW_MAX,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_SET_RIDE,
  CLIP_TRIG_MAX,
  CLIP_VERBS,
  CatchClass,
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
  clipPacketDirOk,
  clipPacketTriggerFault,
  clipStateLabel,
  encodeClipEntry,
  isTriggerAction,
  rewriteClassName,
  samePacketTrigger,
  sameTrigger,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { UsagePicker, type PickerClass } from './UsagePicker';
import { Section } from './Section';
import { checkColumn, chips, label, muted, row, section, status } from './ui';
import {
  RAW_DIR_BLURB,
  SETUP_DEFAULT,
  SETUP_FIELDS,
  TRAFFIC_CLASS_BLURB,
  TRAFFIC_CLASS_OPTIONS,
  decodeSetup,
  displayName,
  outDataBlurb,
  parseHex,
  parseMatchMask,
  parseNum,
  toHex,
  trafficDirWord,
  trafficIdLabel,
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

// Why the box would refuse a packet trigger, in the words of the fields on this card.
const PKT_FAULT_TEXT: Record<ClipPacketTriggerFault, string> = {
  class: 'Class must be one of the six traffic surfaces.',
  direction: 'Direction must be Both, In or Out.',
  verb: 'That verb cannot be bound to a trigger.',
  'mask-length': 'Match and mask must be the same length.',
  'match-length': `Match and mask must be at most ${CLIP_PKT_MATCH_MAX} bytes.`,
  'class-direction': 'Direction must be one the class carries.',
  'match-outside-mask': 'Every bit set in the match must be set in the mask too, or no packet can match.',
  'consume-control': 'Consume needs a class other than Control.',
  'consume-opt-in': 'Consume needs imperfect clones, on the Device tab.',
  'run-stream': 'Once per run needs a class other than Control, one id, and In or Out.',
  'run-selector': 'The match must be longer than the selector.',
  'run-condition': 'The mask must keep at least one bit past the selector, or the run never ends.',
  selector: 'A selector needs Once per run.',
  full: `All ${CLIP_PKT_TRIG_MAX} packet trigger slots are used. Remove one first.`,
  pool: `Packet triggers share ${CLIP_PKT_MATCH_POOL} match bytes. Remove one or shorten the match.`,
};

// A packet trigger's chip names what it runs, then the class and id it watches, the way a rewrite
// rule's does. A chip is capped at 250px and ellipsises past it, so the direction and the match stay
// out of the name and in the line below.
const packetName = (t: ClipPacketTrigger): string => {
  const op = OPS.find((o) => o.op === t.action)?.name ?? `op ${t.action}`;
  return `${op} ${rewriteClassName(t.cls)} ${t.id === CATCH_ID_ANY ? 'any' : t.id}`;
};

// A packet trigger read back in words: where it watches, what it matches, then what it does.
const packetText = (t: ClipPacketTrigger): string => {
  const unit = t.cls === CatchClass.HidIn ? 'interface' : 'endpoint';
  const where = t.id === CATCH_ID_ANY ? `every ${unit}` : `${unit} ${t.id}`;
  const dir = t.dir === Direction.Both ? 'both directions' : trafficDirWord(t.dir);
  const what = t.match.length > 0 ? `bytes ${toHex(t.match)} under ${toHex(t.mask)}` : 'every packet';
  const does = [
    clipOpName(t.action),
    ...(t.oncePerRun ? [`once per run (selector ${t.selectorLen})`] : []),
    ...(t.consume ? ['consumes the packet'] : []),
  ];
  return `${displayName(rewriteClassName(t.cls))}, ${where}, ${dir}, ${what}: ${does.join(', ')}`;
};

// The one way a report class travels, which takes the other direction off its picker.
const DIR_WHY: Record<number, string> = {
  [CatchClass.HidIn]: 'Every HID in report travels In.',
  [CatchClass.HidOut]: 'Every HID out report travels Out.',
  [CatchClass.Emit]: 'Every emitted report travels In.',
};

// Why the box did not take a packet trigger it was sent, read from the first status after the bind;
// null when it holds that key with the verb and flags that went out. A key it already held takes no
// slot and no pool bytes, so only the opt-in refuses an overwrite.
const bindRefusal = (t: ClipPacketTrigger, c: ClipStatus): string | null => {
  const held = c.packetTriggers.find((h) => samePacketTrigger(h, t));
  if (
    held &&
    held.action === t.action &&
    held.consume === t.consume &&
    held.oncePerRun === t.oncePerRun &&
    held.selectorLen === t.selectorLen
  ) {
    return null;
  }
  const room = clipPacketTriggerFault(t, { imperfect: true, held: c.packetTriggers });
  const why =
    room === 'full' || room === 'pool'
      ? PKT_FAULT_TEXT[room]
      : t.consume
        ? 'It refuses a consuming trigger while imperfect clones are off.'
        : null;
  return why ? `The box did not take this trigger. ${why}` : 'The box did not take this trigger.';
};

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

// The box counts a packet trigger's hits in 16 bits and holds the count at the top.
const HITS_MAX = 0xffff;
const hitsText = (hits: number): string => (hits >= HITS_MAX ? `${HITS_MAX}+ hits` : plural(hits, 'hit'));

const bytesOf = (entries: ClipEntry[]): number =>
  entries.reduce((n, e) => n + (encodeClipEntry(e)?.length ?? 0), 0);

const DeviceClip = () => {
  const dash = useDashboard();
  const clip = dash.poll('clip');
  const clipUnreadable = dash.pollUnreadable('clip');
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

  const [trigKind, setTrigKind] = createSignal('input');
  const [pktClass, setPktClass] = createSignal(TRAFFIC_CLASS_OPTIONS[0].value);
  const [pktAnyId, setPktAnyId] = createSignal('one');
  const [pktId, setPktId] = createSignal(0);
  const [pktDir, setPktDir] = createSignal(String(Direction.Both));
  const [pktMatch, setPktMatch] = createSignal('');
  const [pktMask, setPktMask] = createSignal('');
  const [pktConsume, setPktConsume] = createSignal(false);
  const [pktOnce, setPktOnce] = createSignal(false);
  const [pktSelector, setPktSelector] = createSignal(0);
  const pktCls = () => Number(pktClass());
  // Picking a class can strand a direction it never carries; fall back to Both, which every class
  // takes, the way the rewrite editor falls back to Pass.
  const choosePktClass = (v: string) => {
    setPktClass(v);
    if (!clipPacketDirOk(Number(v), Number(pktDir()) as Direction)) setPktDir(String(Direction.Both));
  };
  const pktDirOptions = () =>
    [
      { dir: Direction.Both, label: 'Both' },
      { dir: Direction.Positive, label: 'In' },
      { dir: Direction.Negative, label: 'Out' },
    ].map((o) => ({ value: String(o.dir), label: o.label, disabled: !clipPacketDirOk(pktCls(), o.dir) }));
  const packets = () => clip()?.packetTriggers ?? [];
  // Consuming drops traffic, which needs the opt-in, and a drop has no meaning on a control request.
  // A box ticked while it could apply falls back with whichever of the two took it away.
  const consumeWhy = (): string | null => {
    if (pktCls() === CatchClass.Control) return 'A control request always reaches the device, so there is nothing to consume.';
    if (!allowed()) return 'Consuming a packet needs imperfect clones, on the Device tab. Watching one does not.';
    return null;
  };
  const consumeNow = () => pktConsume() && consumeWhy() === null;
  // When the verb runs and what becomes of the packet, as the two checkboxes are set.
  const pktBlurb = () => {
    const when = pktOnce()
      ? 'The verb runs on the first of a run of matching packets. The selector is the leading match bytes that pick the stream, such as a report ID.'
      : 'The verb runs on every matching packet.';
    const packet = consumeNow() ? 'A matched packet is not delivered.' : 'A matched packet is left untouched.';
    return `${when} ${packet}`;
  };

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

  const addTrigger = () => {
    setSentPacket(null);
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
  };

  const removeTrigger = (t: ClipTrigger) => {
    setSentPacket(null);
    cmd.run(() => dash.link()!.clipUntrigger(t));
  };

  // The packet trigger the fields describe, or what is wrong with them.
  const pickedPacket = (): ClipPacketTrigger | string => {
    const head = parseMatchMask(pktMatch(), pktMask(), CLIP_PKT_MATCH_MAX);
    if (typeof head === 'string') return head;
    const action = Number(trigOp());
    if (!isTriggerAction(action)) return PKT_FAULT_TEXT.verb;
    return {
      cls: pktCls(),
      id: pktAnyId() === 'any' ? CATCH_ID_ANY : pktId(),
      dir: Number(pktDir()) as Direction,
      action,
      consume: consumeNow(),
      oncePerRun: pktOnce(),
      selectorLen: pktOnce() ? pktSelector() : 0,
      ...head,
    };
  };

  // CLIP_TRIGGER has no reply, and the box drops a trigger on state this card reads late: the opt-in
  // turned off elsewhere, or another client filling the slots or the match pool. So a bind is checked
  // against the first status read after it went out. `before` is the status on screen at the send.
  const [sentPacket, setSentPacket] = createSignal<{ trigger: ClipPacketTrigger; before: ClipStatus | null } | null>(
    null,
  );
  createEffect(() => {
    const c = clip();
    const sent = sentPacket();
    if (!sent || !c || c === sent.before) return;
    setSentPacket(null);
    const why = bindRefusal(sent.trigger, c);
    if (why === null) return;
    dash.refreshPoll('imperfect');
    cmd.run(() => Promise.reject(new Error(why)));
  });

  // Refused here, where the fields are, for everything the fields decide.
  const addPacket = () => {
    setSentPacket(null);
    const picked = pickedPacket();
    const fault =
      typeof picked === 'string' ? null : clipPacketTriggerFault(picked, { imperfect: allowed(), held: packets() });
    const trigger = fault ? PKT_FAULT_TEXT[fault] : picked;
    if (typeof trigger === 'string') {
      cmd.run(() => Promise.reject(new Error(trigger)));
      return;
    }
    cmd.run(async () => {
      await dash.link()!.clipPacketTrigger(trigger);
      // The refresh strands any read already in flight, so the next status was read after the bind.
      dash.refreshPoll('clip');
      setSentPacket({ trigger, before: clip() });
    });
  };

  const removePacket = (t: ClipPacketTrigger) => {
    setSentPacket(null);
    cmd.run(() => dash.link()!.clipPacketUntrigger(t));
  };

  const clearTriggers = () => {
    setSentPacket(null);
    cmd.run(() => dash.link()!.clipClearTriggers());
  };

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

  // A packet trigger's key carries its match and mask, so whether a bind replaces one is only known
  // once the two hex fields parse.
  const pktReplacing = createMemo(() => {
    const picked = pickedPacket();
    return typeof picked !== 'string' && packets().some((t) => samePacketTrigger(t, picked));
  });
  const pktFull = createMemo(() => packets().length >= CLIP_PKT_TRIG_MAX && !pktReplacing());
  const pktBytes = createMemo(() => packets().reduce((n, t) => n + t.match.length, 0));
  const onPacket = () => trigKind() === 'packet';

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
          <Show
            when={!clipUnreadable()}
            fallback={
              <p style={muted}>
                This box's firmware sends clip status in an older layout than this dashboard reads.{' '}
                <A href="/dashboard/update">Update the firmware</A> to use clip playback.
              </p>
            }
          >
          <Show when={clip()} fallback={<p style={status}>Reading status...</p>}>
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
                  <NumberInput label="dx" value={dx()} min={-32768} max={32767} precision={0} onChange={(v) => setDx(v ?? 0)} />
                </div>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="dy" value={dy()} min={-32768} max={32767} precision={0} onChange={(v) => setDy(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'wheel'}>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="Detents" value={dz()} min={-32768} max={32767} precision={0} onChange={(v) => setDz(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'pan'}>
                <div style={{ 'max-width': '7rem' }}>
                  <NumberInput label="Detents" value={dpan()} min={-32768} max={32767} precision={0} onChange={(v) => setDpan(v ?? 0)} />
                </div>
              </Show>
              <Show when={kindNow() === 'gap'}>
                <div style={{ 'max-width': '9rem' }}>
                  <NumberInput label="Ticks" value={gap()} min={1} max={65535} precision={0} onChange={(v) => setGap(v ?? 1)} />
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
                    precision={0}
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
                    precision={0}
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
              Up to {CLIP_TRIG_MAX} input bindings and {CLIP_PKT_TRIG_MAX} packet triggers.
            </p>
            <Show
              when={(clip()?.triggers.length ?? 0) + packets().length > 0}
              fallback={<p>No triggers bound.</p>}
            >
              <Show when={(clip()?.triggers.length ?? 0) > 0}>
                <div style={label}>
                  Inputs ({clip()?.triggers.length ?? 0} of {CLIP_TRIG_MAX})
                </div>
                <div style={chips}>
                  <For each={clip()?.triggers ?? []}>
                    {(t) => (
                      <Chip variant="info" onRemove={() => removeTrigger(t)}>
                        {triggerText(t)}
                      </Chip>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={(clip()?.triggers ?? []).some(isWildcard)}>
                <p style={muted}>
                  Removing the any-input binding clears every trigger, packet triggers included: the
                  box reads that exact address as its clear-all.
                </p>
              </Show>
              <Show when={packets().length > 0}>
                <div style={(clip()?.triggers.length ?? 0) > 0 ? { ...label, ...section } : label}>
                  Packets ({packets().length} of {CLIP_PKT_TRIG_MAX}, {pktBytes()} of {CLIP_PKT_MATCH_POOL} match
                  bytes)
                </div>
                <For each={packets()}>
                  {(t, i) => (
                    <div data-packet-trigger style={i() > 0 ? { 'margin-top': 'var(--g-spacing-sm)' } : undefined}>
                      <div style={chips}>
                        <Chip variant="info" onRemove={() => removePacket(t)}>
                          {packetName(t)}
                        </Chip>
                        <Chip variant={t.hits > 0 ? 'info' : 'neutral'}>{hitsText(t.hits)}</Chip>
                      </div>
                      <p style={{ ...muted, 'margin-top': '4px', 'overflow-wrap': 'anywhere' }}>{packetText(t)}</p>
                    </div>
                  )}
                </For>
              </Show>
            </Show>

            <div style={section}>
              <div style={label}>Fires on</div>
              <RadioGroup
                name="clip-trig-kind"
                value={trigKind()}
                onChange={setTrigKind}
                options={[
                  { value: 'input', label: 'An input' },
                  { value: 'packet', label: 'A packet' },
                ]}
              />
              <Show when={!onPacket()}>
                <div style={section}>
                  <UsagePicker
                    name="clip-trigger"
                    classes={TRIGGER_CLASSES}
                    value={trigUsage()}
                    onChange={setTrigUsage}
                  />
                </div>
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
              </Show>
              <Show when={onPacket()}>
                <div style={section}>
                  <div style={label}>Class</div>
                  <RadioGroup name="clip-pkt-class" value={pktClass()} onChange={choosePktClass} options={TRAFFIC_CLASS_OPTIONS} />
                  <p style={{ ...muted, 'margin-top': '4px' }}>{TRAFFIC_CLASS_BLURB[pktCls()]}</p>
                </div>
                <div style={section}>
                  <div style={label}>Which id</div>
                  <RadioGroup
                    name="clip-pkt-anyid"
                    value={pktAnyId()}
                    onChange={setPktAnyId}
                    options={[
                      { value: 'any', label: 'Every id' },
                      { value: 'one', label: 'Just one' },
                    ]}
                  />
                  <Show when={pktAnyId() === 'one'}>
                    <div style={{ ...section, 'max-width': '11rem' }}>
                      <NumberInput
                        name="clip-pkt-id"
                        label={trafficIdLabel(pktCls())}
                        value={pktId()}
                        min={0}
                        max={65534}
                        precision={0}
                        onChange={(v) => setPktId(v ?? 0)}
                      />
                    </div>
                  </Show>
                </div>
                <div style={section}>
                  <div style={label}>Direction</div>
                  <RadioGroup name="clip-pkt-dir" value={pktDir()} onChange={setPktDir} options={pktDirOptions()} />
                  <Show when={DIR_WHY[pktCls()]}>
                    <p style={{ ...muted, 'margin-top': '4px' }}>{DIR_WHY[pktCls()]}</p>
                  </Show>
                </div>
                <div style={{ ...section, ...row }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <TextField
                      name="clip-pkt-match"
                      label="Match (hex)"
                      value={pktMatch()}
                      onInput={setPktMatch}
                      placeholder="e.g. 07 20"
                    />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <TextField
                      name="clip-pkt-mask"
                      label="Mask (hex)"
                      value={pktMask()}
                      onInput={setPktMask}
                      placeholder="e.g. ff 20"
                    />
                  </div>
                </div>
                <p style={{ ...muted, 'margin-top': '4px' }}>
                  Match and mask are the same length, {CLIP_PKT_MATCH_MAX} bytes at most. Blank matches
                  every packet on that address.
                </p>
              </Show>
              <div style={section}>
                <div style={label}>Runs</div>
                <RadioGroup
                  name="clip-trig-op"
                  value={trigOp()}
                  onChange={setTrigOp}
                  options={OPS.map((o) => ({ value: String(o.op), label: o.name }))}
                />
              </div>
              <Show when={!onPacket()}>
                <div style={section}>
                  <Checkbox
                    label="Consume the trigger"
                    checked={trigConsume()}
                    onChange={setTrigConsume}
                  />
                </div>
              </Show>
              <Show when={onPacket()}>
                <div style={{ ...section, ...checkColumn }}>
                  <Checkbox
                    label="Consume the packet"
                    checked={consumeNow()}
                    disabled={consumeWhy() !== null}
                    onChange={setPktConsume}
                  />
                  <Checkbox label="Once per run" checked={pktOnce()} onChange={setPktOnce} />
                </div>
                <Show when={pktOnce()}>
                  <div style={{ ...section, 'max-width': '11rem' }}>
                    <NumberInput
                      name="clip-pkt-selector"
                      label="Selector length"
                      value={pktSelector()}
                      min={0}
                      max={CLIP_PKT_MATCH_MAX - 1}
                      precision={0}
                      onChange={(v) => setPktSelector(v ?? 0)}
                    />
                  </div>
                </Show>
                <Show when={consumeWhy()}>
                  <p style={{ ...muted, 'margin-top': '4px' }}>{consumeWhy()}</p>
                </Show>
                <p style={{ ...muted, 'margin-top': '4px' }}>{pktBlurb()}</p>
              </Show>
              <div style={{ ...section, ...row }}>
                <Show
                  when={onPacket()}
                  fallback={
                    <Button variant="secondary" disabled={busy() || trigFull()} onClick={addTrigger}>
                      {replacing() ? 'Replace' : 'Bind'}
                    </Button>
                  }
                >
                  <Button variant="secondary" disabled={busy() || pktFull()} onClick={addPacket}>
                    {pktReplacing() ? 'Replace' : 'Bind'}
                  </Button>
                </Show>
                <Button
                  variant="danger"
                  disabled={busy() || (clip()?.triggers.length ?? 0) + packets().length === 0}
                  onClick={clearTriggers}
                >
                  Clear triggers
                </Button>
              </div>
              <Show when={onPacket() ? pktFull() : trigFull()}>
                <p style={muted}>
                  All {onPacket() ? CLIP_PKT_TRIG_MAX : CLIP_TRIG_MAX} slots are used. Remove one first.
                </p>
              </Show>
              <Show when={!onPacket() && replacing()}>
                <p style={muted}>
                  Already bound; binding again replaces it and re-arms every trigger's edge detector.
                </p>
              </Show>
              <Show when={onPacket() && pktReplacing()}>
                <p style={muted}>
                  Already bound; binding again replaces it, and a change starts its run and its hits again.
                </p>
              </Show>
            </div>

            </Section>

            <Show when={err()}>
              <div class="callout callout--danger" role="alert" style={section}>
                {err()}
              </div>
            </Show>
          </Show>
          </Show>
          </Show>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceClip;
