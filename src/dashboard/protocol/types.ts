// Decoded protocol value types, mirroring the medius crate.

import {
  CLIP_EDGES_MAX,
  CLIP_ENTRY_MAX,
  CLIP_F_EDGES,
  CLIP_F_WHEEL,
  CLIP_F_XY,
  CLIP_TAG_GAP,
  ClipOp,
  ClipState,
  DEVICE_KIND_KEYBOARD,
  DEVICE_KIND_MOUSE,
  H_CATCH_ON,
  H_CLONE_CFG,
  H_INJECT_ON,
  H_KBD_ATT,
  H_LINK_UP,
  H_LOCK_ON,
  H_MOUSE_ATT,
  H_RATE_CONFIDENT,
  KBC_CONSUMER,
  KBC_NKRO,
  KBC_REPORT_ID,
  KBC_SYSTEM,
} from './opcode';

export interface Version {
  protoVer: number;
  fwMajor: number;
  fwMinor: number;
  fwPatch: number;
  mac: number[]; // the device chip's base MAC (6 bytes), a stable per-box id
  name: string; // the box's human-readable name; a synthesized "Medius-XXXX" default when unset
}

export function versionString(v: Version): string {
  return `${v.fwMajor}.${v.fwMinor}.${v.fwPatch}`;
}

// The box MAC as 12 lowercase hex digits, e.g. "123456789abc".
export function macHex(v: Version): string {
  return v.mac.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Health {
  linkUp: boolean;
  mouseAttached: boolean;
  cloneConfigured: boolean;
  injectionActive: boolean;
  rateConfident: boolean;
  lockOn: boolean;
  catchOn: boolean;
  kbdAttached: boolean;
}

export function healthFromFlags(flags: number): Health {
  return {
    linkUp: (flags & H_LINK_UP) !== 0,
    mouseAttached: (flags & H_MOUSE_ATT) !== 0,
    cloneConfigured: (flags & H_CLONE_CFG) !== 0,
    injectionActive: (flags & H_INJECT_ON) !== 0,
    rateConfident: (flags & H_RATE_CONFIDENT) !== 0,
    lockOn: (flags & H_LOCK_ON) !== 0,
    catchOn: (flags & H_CATCH_ON) !== 0,
    kbdAttached: (flags & H_KBD_ATT) !== 0,
  };
}

// The cloned device's primary kind (§4.3), from its Boot-interface bInterfaceProtocol.
export enum DeviceKind {
  Unknown = 0,
  Keyboard = 1,
  Mouse = 2,
}

export function deviceKindFromU8(value: number): DeviceKind {
  switch (value) {
    case DEVICE_KIND_KEYBOARD:
      return DeviceKind.Keyboard;
    case DEVICE_KIND_MOUSE:
      return DeviceKind.Mouse;
    default:
      return DeviceKind.Unknown;
  }
}

export function deviceKindLabel(kind: DeviceKind): string {
  switch (kind) {
    case DeviceKind.Keyboard:
      return 'Keyboard';
    case DeviceKind.Mouse:
      return 'Mouse';
    default:
      return 'Unknown';
  }
}

// The cloned device's USB identity, kind, and product string (§4.3). All-zero when nothing is cloned.
export interface DeviceInfo {
  vid: number;
  pid: number;
  bcdDevice: number;
  bcdUsb: number;
  hasSerial: boolean;
  hasBos: boolean;
  kind: DeviceKind;
  product: string;
}

// vid:pid formatted as the familiar 04X:04X, e.g. "046D:C08B".
export function vidPid(d: DeviceInfo): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  return `${hex(d.vid)}:${hex(d.pid)}`;
}

// Semantic capabilities of the emulated mouse (§4.4). Counts and booleans only.
export interface MouseCaps {
  nButtons: number;
  hasX: boolean;
  hasY: boolean;
  hasWheel: boolean;
  hasReportId: boolean;
  nHid: number;
}

export function isComposite(c: MouseCaps): boolean {
  return c.nHid > 1;
}

// Semantic capabilities of the cloned keyboard (§4.11). All-zero when no keyboard is bound.
// nkro is true for an NKRO bitmap board (n_keys 0xff or the NKRO flag).
export interface KbdCaps {
  nKeys: number;
  nkro: boolean;
  hasConsumer: boolean;
  hasSystem: boolean;
  hasReportId: boolean;
}

export function kbdCapsFromBytes(nKeys: number, flags: number): KbdCaps {
  return {
    nKeys,
    nkro: nKeys === 0xff || (flags & KBC_NKRO) !== 0,
    hasConsumer: (flags & KBC_CONSUMER) !== 0,
    hasSystem: (flags & KBC_SYSTEM) !== 0,
    hasReportId: (flags & KBC_REPORT_ID) !== 0,
  };
}

// Unified device capabilities (§4.4): one query describes the whole cloned device (mouse + keyboard +
// per-class change_driven). A class that is not present reads all-zero/false.
export interface Caps {
  mouse: MouseCaps;
  keyboard: KbdCaps;
  mouseChangeDriven: boolean;
  kbdChangeDriven: boolean;
}

export function hasMouse(c: Caps): boolean {
  return c.mouse.nButtons > 0 || c.mouse.hasX || c.mouse.hasY || c.mouse.hasWheel;
}

export function hasKeyboard(c: Caps): boolean {
  return c.keyboard.nKeys > 0 || c.keyboard.hasConsumer || c.keyboard.hasSystem;
}

// Live native report rate and clone poll period (§4.5).
export interface Rate {
  nativePeriodUs: number;
  pollPeriodUs: number;
  confident: boolean;
  // The active input is change-driven (keyboard/media): no continuous cadence, poll floor only.
  changeDriven: boolean;
}

// Native report rate in Hz, or null until learned (nativePeriodUs === 0).
export function nativeHz(r: Rate): number | null {
  if (r.nativePeriodUs === 0) return null;
  return Math.round((1_000_000 / r.nativePeriodUs) * 10) / 10;
}

// Delivery/telemetry counters (§4.6).
export interface Stats {
  injectEmits: number;
  txDrops: number;
  txMerges: number;
  txMaxdepth: number;
  txWedges: number;
  wakeups: number;
  resetCount: number;
  configCount: number;
}

// Injection override action, shared by INJECT across buttons, keys, and media (§3.2). Wire values
// match ctrl_proto.h CTRL_ACT_*.
export enum Action {
  SoftRelease = 0,
  Press = 1,
  ForceRelease = 2,
}

export enum RebootTarget {
  DeviceDownload = 0,
  HostDownload = 1,
  DeviceRun = 2,
  HostRun = 3,
}

// LED command (§3.7): which LED, and what to drive it to. Wire values match ctrl_proto.h.
export enum LedTarget {
  Device = 0,
  Host = 1,
  Both = 2,
}

export enum LedMode {
  Auto = 0,
  Off = 1,
  Solid = 2,
  Blink = 3,
}

// LOCK class (§3.8): which input class a lock addresses. A momentary usage shares INJECT's (class, id)
// space (button / key / media); a relative axis is its own class. Wire values match ctrl_proto.h.
export enum LockClass {
  Button = 0,
  Key = 1,
  Media = 2,
  Axis = 3,
}

// LOCK axis id (§3.8): for an Axis-class lock, id picks the axis and direction carries the sign.
export enum LockAxis {
  X = 0,
  Y = 1,
  Wheel = 2,
}

// The edge or sign a LOCK, CLIP or CATCH entry covers. One vocabulary across all three, so the
// aliases below give each reading a name and no call site has to write the ambiguous member.
export enum Direction {
  Both = 0,
  Positive = 1,
  Negative = 2,
}

// A momentary usage's edge: buttons, keys, and media.
export const Press = Direction.Positive;
export const Release = Direction.Negative;

// A traffic class's transfer direction.
export const In = Direction.Positive; // device to PC
export const Out = Direction.Negative; // PC to device

// The id sentinel that blanket-locks a whole class (§3.8), e.g. every button or every key.
export const LOCK_ID_ALL = 0xffff;

// One lock target: a class plus its class-specific id (axis id, button id, HID keycode, or media
// usage; LOCK_ID_ALL for a blanket). A button locks as class Button, id = button id, like a key.
export interface LockTarget {
  cls: LockClass;
  id: number;
}

export const lockAxis = (axis: LockAxis): LockTarget => ({ cls: LockClass.Axis, id: axis });
export const lockButton = (id: number): LockTarget => ({ cls: LockClass.Button, id });
export const lockKey = (usage: number): LockTarget => ({ cls: LockClass.Key, id: usage });
export const lockMedia = (usage: number): LockTarget => ({ cls: LockClass.Media, id: usage });
export const lockBlanket = (cls: LockClass): LockTarget => ({ cls, id: LOCK_ID_ALL });

// One active lock (§4.8): a target plus which directions it covers. dirbits b0 = positive/press,
// b1 = negative/release.
export interface LockEntry {
  cls: LockClass;
  id: number;
  positive: boolean;
  negative: boolean;
}

// The active input-lock set (§4.8): a list of entries, one per locked field across every class.
export interface Locks {
  entries: LockEntry[];
}

// True when the given target+direction is locked in the set.
export function isLocked(locks: Locks, target: LockTarget, direction: Direction): boolean {
  const e = locks.entries.find((x) => x.cls === target.cls && x.id === target.id);
  if (!e) return false;
  if (direction === Direction.Both) return e.positive && e.negative;
  return direction === Direction.Positive ? e.positive : e.negative;
}

// CATCH address classes (§3.9): what a subscription entry points at. Classes 0-3 are LOCK's classes
// unchanged, so one address vocabulary covers locking a field and catching it; 4 and up reach the
// byte-oriented traffic the box carries. Addressing doubles as the filter because the control link
// is 4 Mbaud and vendor bulk alone measures 250 KiB/s through the box, so a subscription has to be
// able to name one endpoint rather than a whole class. Wire values match ctrl_proto.h.
export enum CatchClass {
  Button = 0,
  Key = 1,
  Media = 2,
  Axis = 3,
  HidIn = 4,
  HidOut = 5,
  VendorInterrupt = 6,
  VendorBulk = 7,
  Control = 8,
  Emit = 9,
  Bus = 10,
  Any = 0xff,
}

// The id sentinel that subscribes to a whole class (§3.9), matching LOCK_ID_ALL.
export const CATCH_ID_ANY = 0xffff;

// What one CATCH table entry addresses (§3.9): an address, a direction, and how much of each packet
// to capture. capture is a byte count per entry, 0 meaning the whole packet, because the useful
// value differs by orders of magnitude between classes - a 64-byte vendor interrupt report wants
// all of it, a bulk pipe traced for framing wants 16. dir is the press/release edge for the input
// classes and the transfer direction for the traffic classes; no class is both, so one byte carries
// either reading unambiguously.
export interface CatchFilter {
  cls: CatchClass;
  id: number;
  dir: Direction;
  capture: number;
}

// One entry as the box reports it back (§4.9): the filter it accepted, plus what that entry lost.
// Kept separate from CatchFilter so a subscription request cannot carry a drop count that would
// always read 0 and mean nothing.
export interface CatchEntry extends CatchFilter {
  // Per entry, because under a saturating bulk trace the box-wide counter says you are losing
  // events but not which ones.
  dropped: number;
}

// Named for the value they build, not for an action: `filterEverything()` is the argument that
// clears the table as readily as the one that subscribes to everything, so calling it `catchAll`
// would collide with the reference client's subscribe-only verb.
export const filterEverything = (): CatchFilter => ({
  cls: CatchClass.Any,
  id: CATCH_ID_ANY,
  dir: Direction.Both,
  capture: 0,
});

// The input side (classes 0-3). These carry no bytes, so no capture length applies: an event is the
// axis delta or the held-usage snapshot itself.

// One momentary usage: a button, a key, or a media usage.
export const filterWatch = (cls: CatchClass, id: number): CatchFilter => ({
  cls,
  id,
  dir: Direction.Both,
  capture: 0,
});

// One relative axis (LockAxis: X, Y, or Wheel).
export const filterWatchAxis = (axis: number): CatchFilter => ({
  cls: CatchClass.Axis,
  id: axis,
  dir: Direction.Both,
  capture: 0,
});

// Every usage in one momentary class.
export const filterWatchClass = (cls: CatchClass): CatchFilter => ({
  cls,
  id: CATCH_ID_ANY,
  dir: Direction.Both,
  capture: 0,
});

// Every relative axis.
export const filterWatchAxes = (): CatchFilter => ({
  cls: CatchClass.Axis,
  id: CATCH_ID_ANY,
  dir: Direction.Both,
  capture: 0,
});

// The byte-oriented side (classes 4 and up), where capture caps the bytes taken per event.
export const filterTrafficClass = (cls: CatchClass, capture = 0): CatchFilter => ({
  cls,
  id: CATCH_ID_ANY,
  dir: Direction.Both,
  capture,
});

export const filterTraffic = (cls: CatchClass, id: number, capture = 0): CatchFilter => ({
  cls,
  id,
  dir: Direction.Both,
  capture,
});

// True when two filters address the same thing, which is how a caller reconciles the table it asked
// for against the one RESP(CATCH) reports. Only a full-table flag marks a refusal; the other three
// refusal reasons in §3.9 are visible solely as an entry's absence.
export const sameFilter = (a: CatchFilter, b: CatchFilter): boolean =>
  a.cls === b.cls && a.id === b.id && a.dir === b.dir;

// Which chip's microsecond clock stamped an event (§4.10). The two ESP32-S3s boot independently, so
// nothing relates their timers: compare stamps only within a domain, or apply RESP(CATCH)'s measured
// offset and respect its error bound.
export enum ClockDomain {
  Host = 0,
  Device = 1,
}

// An unknown byte falls back to Host, matching how deviceKindFromU8 and logLevelFromU8 absorb one:
// the stamp is still usable within whichever domain produced it, and refusing to decode the frame
// would lose the event outright.
export function clockDomainFromU8(v: number): ClockDomain {
  return v === ClockDomain.Device ? ClockDomain.Device : ClockDomain.Host;
}

// BUS event kinds (§4.10): the kind lives in the TRAFFIC_EVENT flags byte for class Bus.
export enum BusEventKind {
  Reset = 0,
  Suspend = 1,
  Resume = 2,
  Configured = 3,
  Deconfigured = 4,
  SetInterface = 5,
  DeviceAttached = 6,
  DeviceDetached = 7,
  CloneUp = 8,
  CloneDown = 9,
}

// A momentary usage: a class plus its class-specific id. Buttons, keys, and media share one shape
// (class = INJ_BTN / INJ_KEY / INJ_MEDIA; id = button id, HID keycode with 0xE0-0xE7 modifiers, or
// a 16-bit Consumer usage).
export interface Usage {
  cls: number;
  id: number;
}

// The relative axes from the CATCH stream (a MOTION_EVENT frame, §4.10), captured at the merge point
// before any lock suppression or injection.
export interface MotionEvent {
  // When the device's report arrived, in box microseconds. The box's own clock, so only compare
  // stamps against each other; it wraps every ~71.6 min and returns to 0 on a box reboot.
  tsUs: number;
  // Which chip's clock tsUs came from. Always Host for motion: the stamp is taken in USB interrupt
  // context on the host chip, the instant the real device's transfer completed.
  clk: ClockDomain;
  dx: number;
  dy: number;
  dz: number;
}

// A class-tagged held-usage snapshot from the CATCH stream (a USAGE_EVENT frame, §4.10). One event
// carries usages of a single class (buttons, keys, or media). A snapshot, not edge deltas.
export interface UsageSnapshot {
  // See MotionEvent.tsUs.
  tsUs: number;
  // Always Host, like MotionEvent.clk.
  clk: ClockDomain;
  // Which class this snapshot is of, from the frame header rather than the first usage -- an empty
  // snapshot is a release-to-nothing and has no usage to read it from.
  cls: number;
  // The edge that produced it: the subscribed set grew (POS) or shrank (NEG).
  dir: number;
  usages: Usage[];
}

// One byte-oriented event from the CATCH stream (a TRAFFIC_EVENT frame, §4.10): the HID interfaces
// the semantic model does not parse, the vendor endpoints, proxied control transactions, what the
// clone emitted, and the bus lifecycle.
export interface TrafficEvent {
  tsUs: number;
  // Which chip stamped it. IN traffic and the input classes come from the host chip; OUT traffic,
  // control, emit and bus are stamped on the device chip at the tap.
  clk: ClockDomain;
  cls: CatchClass;
  // Endpoint address, interface number, or endpoint number, depending on the class.
  id: number;
  // In (device to PC) or Out (PC to device).
  dir: Direction;
  // Class-specific: end-of-transfer / ZLP bits for VendorBulk, the device's answer for Control, the
  // BusEventKind for Bus, 0 otherwise.
  flags: number;
  // The packet's length before capture truncation. Without it a packet cut short by capture and a
  // genuinely short packet are indistinguishable.
  trueLen: number;
  // What arrived: up to capture bytes, so bytes.length < trueLen means the capture was truncated.
  bytes: Uint8Array;
}

// True when this event's bytes were cut short by the entry's capture length.
export function trafficTruncated(ev: TrafficEvent): boolean {
  return ev.bytes.length < ev.trueLen;
}

// True when the given usage is held in this snapshot.
export function usageHeld(snap: UsageSnapshot, cls: number, id: number): boolean {
  return snap.usages.some((u) => u.cls === cls && u.id === id);
}

// The class every usage in this snapshot shares (one report is one class), or null when empty.
export function snapshotClass(snap: UsageSnapshot): number | null {
  return snap.usages.length > 0 ? snap.usages[0].cls : null;
}

// One decoded frame from the CATCH stream. A `motion` frame carries the relative axes; a `usages`
// frame carries a class-tagged held-usage snapshot (buttons, keys, or media); a `traffic` frame
// carries bytes off one of the byte-oriented classes.
export type CatchEvent =
  | { kind: 'motion'; motion: MotionEvent }
  | { kind: 'usages'; snapshot: UsageSnapshot }
  | { kind: 'traffic'; traffic: TrafficEvent };

// The cross-chip clock estimate carried in RESP(CATCH) (§4.9). The box measures it with a
// four-timestamp exchange over the inter-chip link, stamped as each frame reaches the wire rather
// than when it is queued, because queueing is the largest and most variable delay on that link.
export interface ClockEstimate {
  // The host chip's clock minus the device chip's, in microseconds.
  offsetUs: number;
  // Relative drift between the two crystals, parts per billion. Extrapolate with it rather than
  // trusting a stale offset: two free-running crystals go stale at up to 20 us per second.
  ratePpb: number;
  // Best measured round trip of the window. The offset is good to about half of this.
  delayUs: number;
  // Age of the estimate in ms, or null when the box has not measured one yet.
  ageMs: number | null;
}

// Decoded RESP(CATCH) (§4.9): the scalar header, then the active subscription table.
export interface CatchState {
  // An entry was refused because the 32-entry table is full. CATCH has no reply, so this flag plus
  // the entry's absence from `entries` is how a refusal becomes visible.
  tableFull: boolean;
  // Box-wide events that could not be queued, across every entry.
  dropped: number;
  clock: ClockEstimate;
  entries: CatchEntry[];
}

// Decoded RESP(OPTIONS, IMPERFECT) (§4.14): the imperfect-clone opt-in state, whether the attached device is
// over-capacity (needs an interrupt-IN endpoint the box can't service), and whether the live clone was
// cloned over-capacity anyway (an interface is silently dead).
export interface ImperfectStatus {
  allowed: boolean;
  overCapacity: boolean;
  cloneImperfect: boolean;
}

// One momentary edge inside a clip tick: the same (class, id, action) an INJECT frame carries, so a
// recorded clip and a live injection say the same thing about the same input.
export interface ClipEdge {
  cls: number;
  id: number;
  action: Action;
}

// One clip tick's content. A tick with no fields at all cannot be encoded: its flags byte would be
// zero, which is the gap tag. Use a gap run to say "nothing happened for N ticks".
export interface ClipTick {
  // Both cursor axes travel together, because the wire flag covers the pair.
  xy?: { dx: number; dy: number };
  wheel?: number;
  edges?: ClipEdge[];
}

export type ClipEntry = ({ kind: 'gap'; ticks: number } | ({ kind: 'tick' } & ClipTick));

// Encode one clip entry (§3.11). Returns null for an entry the box would reject or misread, rather
// than a nearest-legal guess: a silently-clamped clip plays back as something the caller never
// recorded.
export function encodeClipEntry(e: ClipEntry): Uint8Array | null {
  if (e.kind === 'gap') {
    if (!Number.isInteger(e.ticks) || e.ticks < 1 || e.ticks > 0xffff) return null;
    return new Uint8Array([CLIP_TAG_GAP, e.ticks & 0xff, (e.ticks >> 8) & 0xff]);
  }
  const edges = e.edges ?? [];
  if (edges.length > CLIP_EDGES_MAX) return null;
  let flags = 0;
  if (e.xy) flags |= CLIP_F_XY;
  if (e.wheel !== undefined) flags |= CLIP_F_WHEEL;
  if (edges.length > 0) flags |= CLIP_F_EDGES;
  if (flags === 0) return null;
  const out = new Uint8Array(CLIP_ENTRY_MAX);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  let off = 0;
  out[off++] = flags;
  if (e.xy) {
    view.setInt16(off, i16(e.xy.dx), true);
    view.setInt16(off + 2, i16(e.xy.dy), true);
    off += 4;
  }
  if (e.wheel !== undefined) {
    view.setInt16(off, i16(e.wheel), true);
    off += 2;
  }
  if (edges.length > 0) {
    out[off++] = edges.length;
    for (const ed of edges) {
      out[off++] = ed.cls;
      view.setUint16(off, ed.id & 0xffff, true);
      off += 2;
      out[off++] = ed.action;
    }
  }
  return out.subarray(0, off);
}

function i16(v: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(v || 0)));
}

// The ops a trigger may carry. The box stores a binding only when its action is Toggle or lower,
// and CLIP_TRIGGER has no reply, so binding Clear or Finalize puts a frame on the wire that is
// silently discarded and never fires.
export type ClipTriggerAction =
  | ClipOp.Start
  | ClipOp.Stop
  | ClipOp.Pause
  | ClipOp.Resume
  | ClipOp.Restart
  | ClipOp.Toggle;

export const isTriggerAction = (op: number): op is ClipTriggerAction => op >= ClipOp.Start && op <= ClipOp.Toggle;

// One stored clip trigger (§3.11): an input edge that runs an engine verb. `consume` hides the
// trigger input from the game, so the key that starts a clip does not also reach it.
export interface ClipTrigger {
  cls: number;
  id: number;
  edge: Direction;
  action: ClipTriggerAction;
  consume: boolean;
}

// Decoded RESP(CLIP) (§4.15): engine state, ring accounting, what the clip is holding down right
// now, and the stored configuration.
export interface ClipStatus {
  state: ClipState;
  // Ring bytes free and used. `freeBytes` is the only flow-control signal an appending client has.
  freeBytes: number;
  totalBytes: number;
  // Ticks played and ticks in the clip. Both reset on CLEAR.
  played: number;
  ticks: number;
  // Ran out of buffered ticks mid-play; appended past the ring; append SEQ discontinuities.
  underruns: number;
  overruns: number;
  seqGaps: number;
  // Usages the clip is holding down. A clip stopped mid-hold leaves these set until the engine
  // releases them, so this is how a UI shows what playback still owns.
  held: Usage[];
  autolock: number;
  loop: boolean;
  retain: boolean;
  finalized: boolean;
  // Whether the clip's motion waits to ride a native report (CLIP_SET ride). Off = the box's own clock.
  ride: boolean;
  triggers: ClipTrigger[];
}

export const clipStateLabel = (s: ClipState): string =>
  s === ClipState.Playing
    ? 'Playing'
    : s === ClipState.Paused
      ? 'Paused'
      : s === ClipState.Faulted
        ? 'Faulted'
        : 'Idle';

// True when two trigger bindings address the same input edge, which is the key the box stores them
// under: setting one overwrites the other rather than adding a second binding.
export const sameTrigger = (a: ClipTrigger, b: ClipTrigger): boolean =>
  a.cls === b.cls && a.id === b.id && a.edge === b.edge;

export enum LogLevel {
  Error = 0,
  Warn = 1,
  Info = 2,
  Debug = 3,
  Verbose = 4,
}

export function logLevelFromU8(v: number): LogLevel {
  switch (v) {
    case 0:
      return LogLevel.Error;
    case 1:
      return LogLevel.Warn;
    case 2:
      return LogLevel.Info;
    case 3:
      return LogLevel.Debug;
    case 4:
      return LogLevel.Verbose;
    default:
      return LogLevel.Info;
  }
}

export interface LogLine {
  level: LogLevel;
  text: string;
}
