// Decoded protocol value types, mirroring the medius crate.

import {
  CLIP_EDGES_MAX,
  CLIP_ENTRY_MAX,
  CLIP_F_EDGES,
  CLIP_F_PAN,
  CLIP_F_RAW,
  CLIP_F_WHEEL,
  CLIP_F_XFER,
  CLIP_F_XY,
  CLIP_PKT_MATCH_MAX,
  CLIP_PKT_MATCH_POOL,
  CLIP_PKT_TRIG_MAX,
  CLIP_RAW_MAX,
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
  H_PATCH_ON,
  H_RATE_CONFIDENT,
  H_REWRITE_ON,
  H_TRANSFORM_ON,
  KBC_CONSUMER,
  KBC_NKRO,
  KBC_REPORT_ID,
  KBC_SYSTEM,
  RewriteAction,
  PatchSection,
  TransformOp,
  TransferStatus,
  TRAFFIC_CONTROL_MASK,
  TRAFFIC_CONTROL_NAK,
  TRAFFIC_CONTROL_OK,
  TRAFFIC_CONTROL_STALL,
  TRAFFIC_F_RULE,
  transferStatusFromU8,
} from './opcode';

export interface Version {
  protoVer: number;
  fwMajor: number;
  fwMinor: number;
  fwPatch: number;
  mac: number[]; // the device chip's base MAC (6 bytes), a stable per-box id
  name: string; // the box's human-readable name; a synthesised "Medius-XXXX" default when unset
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
  // The advanced control layer state (§4.2), in the high byte HEALTH gained at proto 7.
  rewriteOn: boolean;
  patchOn: boolean;
  transformOn: boolean;
}

// From proto 7 the flags word is a u16, so `flags` carries both bytes. A proto-6 box answers a single
// byte; read through this the high three bits are then 0, which is the truth for a box without the layer.
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
    rewriteOn: (flags & H_REWRITE_ON) !== 0,
    patchOn: (flags & H_PATCH_ON) !== 0,
    transformOn: (flags & H_TRANSFORM_ON) !== 0,
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
  hasPan: boolean;
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
  // Frames an inter-chip link RX ring could not take, one counter per chip, counting only the ones
  // whose loss is input loss: a native report, a motion delta, an injected command.
  linkRxDrops: number;
  hostRxDrops: number;
  // Back-pressure on a relayed stream, either direction: a vendor IN packet the PC is not draining,
  // or an OUT packet past what the relay carries in one frame.
  relayDrops: number;
  // The times the box released state a host set. Wraps at 0xFFFF: compare for inequality.
  session: number;
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

// A class byte no constant names is dropped rather than carried as a LockClass it is not; a raw
// number wearing the enum's type reaches scaleOf and matches nothing, or matches the wrong thing.
export function lockClassFromU8(v: number): LockClass | null {
  switch (v) {
    case LockClass.Button:
    case LockClass.Key:
    case LockClass.Media:
    case LockClass.Axis:
      return v;
    default:
      return null;
  }
}

// LOCK axis id (§3.8): for an Axis-class lock, id picks the axis and direction carries the sign.
export enum LockAxis {
  X = 0,
  Y = 1,
  Wheel = 2,
  Pan = 3,
}

// The edge or sign a LOCK, CLIP or CATCH entry covers. One vocabulary across all three, so the
// aliases below give each reading a name and no call site has to write the ambiguous member.
export enum Direction {
  Both = 0,
  Positive = 1,
  Negative = 2,
  With = 3,
  Against = 4,
}

export function directionFromU8(v: number): Direction | null {
  switch (v) {
    case Direction.Both:
    case Direction.Positive:
    case Direction.Negative:
    case Direction.With:
    case Direction.Against:
      return v;
    default:
      return null;
  }
}

// Whether a direction is measured against the bearing rather than a fixed sign.
export const isRelativeDirection = (d: Direction): boolean =>
  d === Direction.With || d === Direction.Against;

// A momentary usage's edge: buttons, keys, and media.
export const Press = Direction.Positive;
export const Release = Direction.Negative;

// A traffic class's transfer direction.
export const In = Direction.Positive; // device to PC
export const Out = Direction.Negative; // PC to device

// The id sentinel that blanket-locks a whole class (§3.8), e.g. every button or every key.
export const LOCK_ID_ALL = 0xffff;

// LOCK scale (§3.8): the percent of the physical value the box keeps on that direction.
export const LOCK_SCALE_BLOCK = 0;
export const LOCK_SCALE_PASS = 100;
export const LOCK_SCALE_MAX = 255;
export const LOCK_SCALE_MIN = -255;

// OPTION(BEARING) geometry (§3.12): how the box compares physical motion against its own injection
// its own injection.
export enum BearingMode {
  PerAxis = 0,
  Vector = 1,
}

// A mode byte no constant names is not a BearingMode; the box rejects the whole write for one, so a
// reply carrying one is not something to carry forward as a geometry it is not.
export function bearingModeFromU8(v: number): BearingMode | null {
  switch (v) {
    case BearingMode.PerAxis:
    case BearingMode.Vector:
      return v;
    default:
      return null;
  }
}

// The configured bearing (§4.14). windowMs is how long the last injected delta's direction stays the
// thing With/Against are measured against; 0 is off, leaving both inert whatever their scale.
export interface Bearing {
  windowMs: number;
  mode: BearingMode;
}

// The bearing window the box holds before any host sets one.
export const BEARING_WINDOW_DEFAULT_MS = 20;

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

// One weighed direction (§4.8): a target, which direction of it, and how much of the physical value
// survives.
export interface LockEntry {
  cls: LockClass;
  id: number;
  direction: Direction;
  scale: number;
}

// The active input-scale set (§4.8): every direction not passing untouched, across every class.
export interface Locks {
  entries: LockEntry[];
}

// The percent of the physical value kept on a target and direction; LOCK_SCALE_PASS when nothing
// weighs it.
export function scaleOf(locks: Locks, target: LockTarget, direction: Direction): number {
  // A whole-class blanket covers every usage of its class, so an entry at LOCK_ID_ALL counts for a
  // target it never names.
  const covers = (x: LockEntry) =>
    x.cls === target.cls && (x.id === target.id || x.id === LOCK_ID_ALL);
  const covering = locks.entries.filter(
    (x) =>
      covers(x) &&
      (direction === Direction.Both ||
        x.direction === Direction.Both ||
        x.direction === direction),
  );
  // By magnitude, not by value: a signed minimum ranks -50 below 0 and would report a reversal over a
  // block, when the block is what the delta actually meets.
  if (!covering.length) return LOCK_SCALE_PASS;
  return covering
    .map((x) => x.scale)
    .reduce((a, b) => (Math.abs(b) < Math.abs(a) || (Math.abs(b) === Math.abs(a) && b < a) ? b : a));
}

// True when the target is blocked outright on that direction. A direction merely weighed is not
// locked.
export function isLocked(locks: Locks, target: LockTarget, direction: Direction): boolean {
  if (direction === Direction.Both) {
    return (
      scaleOf(locks, target, Direction.Positive) === LOCK_SCALE_BLOCK &&
      scaleOf(locks, target, Direction.Negative) === LOCK_SCALE_BLOCK
    );
  }
  return scaleOf(locks, target, direction) === LOCK_SCALE_BLOCK;
}

// CATCH address classes (§3.9): what a subscription entry points at.
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
  ClipTransfer = 11,
  Any = 0xff,
}

// The id sentinel that subscribes to a whole class (§3.9), matching LOCK_ID_ALL.
export const CATCH_ID_ANY = 0xffff;

// What one CATCH table entry addresses (§3.9): an address, a direction, and how much of each packet
// to capture.
export interface CatchFilter {
  cls: CatchClass;
  id: number;
  dir: Direction;
  capture: number;
}

// One entry as the box reports it back (§4.9): the filter it accepted, plus what that entry lost.
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

// One relative axis (LockAxis: X, Y, Wheel, or Pan).
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
// for against the one RESP(CATCH) reports.
export const sameFilter = (a: CatchFilter, b: CatchFilter): boolean =>
  a.cls === b.cls && a.id === b.id && a.dir === b.dir;

// Which chip's microsecond clock stamped an event (§4.10).
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

// A momentary usage: a class plus its class-specific id.
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
  // AC Pan (horizontal scroll) this report; + = right. A first-class relative axis peer of the wheel.
  dpan: number;
}

// A class-tagged held-usage snapshot from the CATCH stream (a USAGE_EVENT frame, §4.10). One event
// carries usages of a single class (buttons, keys, or media). A snapshot, not edge deltas.
export interface UsageSnapshot {
  // See MotionEvent.tsUs.
  tsUs: number;
  // Always Host, like MotionEvent.clk.
  clk: ClockDomain;
  // Which class this snapshot is of, from the frame header rather than the first usage: an empty
  // snapshot is a release-to-nothing and has no usage to read it from.
  cls: number;
  // The edge that produced it: the subscribed set grew (POS) or shrank (NEG).
  dir: number;
  usages: Usage[];
}

// One byte-oriented event from the CATCH stream (a TRAFFIC_EVENT frame, §4.10): the HID interfaces
// the semantic model does not parse, the vendor endpoints, proxied control transactions, what the
// clone emitted, the bus lifecycle, and the control transfers a clip ran.
export interface TrafficEvent {
  tsUs: number;
  // Which chip stamped it. The device's IN traffic and the input classes come from the host chip; OUT
  // traffic, a vendor IN packet RAW or a clip put there, control, clip transfers, emit and bus are
  // stamped on the device chip at the tap.
  clk: ClockDomain;
  cls: CatchClass;
  // Endpoint address, interface number, or endpoint number, depending on the class.
  id: number;
  // In (device to PC) or Out (PC to device).
  dir: Direction;
  // Class-specific: the rule bit on every class a rewrite rule acts at, end-of-transfer / ZLP bits for
  // VendorBulk, the handshake the game PC got for Control, a TransferStatus for ClipTransfer, the
  // BusEventKind for Bus. Read it through the traffic* helpers below.
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

// The two classes whose bytes are [setup 8][data]: a proxied control transaction, and a control
// transfer a clip ran.
const controlShaped = (ev: TrafficEvent): boolean =>
  ev.cls === CatchClass.Control || ev.cls === CatchClass.ClipTransfer;

// The 8-byte setup packet of a Control or ClipTransfer event, or null for any other class and for a
// capture that cut the setup packet itself short.
export function trafficSetup(ev: TrafficEvent): Uint8Array | null {
  return controlShaped(ev) && ev.bytes.length >= 8 ? ev.bytes.subarray(0, 8) : null;
}

// The data stage of a Control or ClipTransfer event; the whole packet for any other class.
export function trafficData(ev: TrafficEvent): Uint8Array {
  if (!controlShaped(ev)) return ev.bytes;
  return ev.bytes.length >= 8 ? ev.bytes.subarray(8) : new Uint8Array(0);
}

// The handshake the game PC received for a control transaction (§4.10), on any control endpoint.
export enum ControlStatus {
  Ok = TRAFFIC_CONTROL_OK,
  // A STALL: from the device, from a rule that refused the request, or, above endpoint 0, for a
  // request that failed.
  Stall = TRAFFIC_CONTROL_STALL,
  // NAKed until the host gave up, on endpoint 0 only: the device never answered, or a Nak rule.
  Nak = TRAFFIC_CONTROL_NAK,
  // The one value bits 0-1 carry that no firmware sends. Kept apart so it never reads as a device fault.
  Other = TRAFFIC_CONTROL_MASK,
}

// The handshake a Control event reports, or null for any other class.
export function trafficControlStatus(ev: TrafficEvent): ControlStatus | null {
  return ev.cls === CatchClass.Control ? ((ev.flags & TRAFFIC_CONTROL_MASK) as ControlStatus) : null;
}

// The classes a rewrite rule acts at, which are the ones whose flags carry the rule bit.
const RULED_CLASSES: ReadonlySet<number> = new Set([
  CatchClass.HidIn,
  CatchClass.HidOut,
  CatchClass.VendorInterrupt,
  CatchClass.VendorBulk,
  CatchClass.Control,
  CatchClass.Emit,
]);

// Whether a rewrite rule at this event's class changed, dropped, answered or refused the packet. A
// ClipTransfer status or a BusEventKind that happens to have bit 7 set is not the rule bit.
export function trafficRuleActed(ev: TrafficEvent): boolean {
  return RULED_CLASSES.has(ev.cls) && (ev.flags & TRAFFIC_F_RULE) !== 0;
}

// How a clip's control transfer ended, for a ClipTransfer event: the status a TRANSFER returns, Nak
// when no answer came.
export function trafficTransferStatus(ev: TrafficEvent): TransferStatus | null {
  return ev.cls === CatchClass.ClipTransfer ? transferStatusFromU8(ev.flags) : null;
}

// True when the given usage is held in this snapshot.
export function usageHeld(snap: UsageSnapshot, cls: number, id: number): boolean {
  return snap.usages.some((u) => u.cls === cls && u.id === id);
}

// The class every usage in this snapshot shares (one report is one class), or null when empty.
export function snapshotClass(snap: UsageSnapshot): number | null {
  return snap.usages.length > 0 ? snap.usages[0].cls : null;
}

// One decoded frame from the CATCH stream.
export type CatchEvent =
  | { kind: 'motion'; motion: MotionEvent }
  | { kind: 'usages'; snapshot: UsageSnapshot }
  | { kind: 'traffic'; traffic: TrafficEvent };

// The cross-chip clock estimate carried in RESP(CATCH) (§4.9).
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
// over-capacity or high-speed, and whether the live clone is not an exact copy (an opted-in device, a
// forced rate, or an applied patch set).
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

// One raw report inside a clip tick: RAW's payload (§3.14) with its length. In puts the bytes on
// cloned IN endpoint `ep`, Out relays them to the real device.
export interface ClipRawItem {
  ep: number;
  dir: Direction;
  bytes: Uint8Array;
}

// The five fields of a USB setup packet, under their specification names.
export interface SetupPacket {
  bmRequestType: number;
  bRequest: number;
  wValue: number;
  wIndex: number;
  wLength: number;
}

// One control transfer inside a clip tick: TRANSFER's payload (§3.14). `out` is wLength bytes when
// bmRequestType bit 7 is clear and empty when it is set. The answer comes back as a ClipTransfer event.
export interface ClipTransferItem {
  ep: number;
  setup: SetupPacket;
  out: Uint8Array;
}

// One clip tick's content. A tick with no fields at all cannot be encoded: its flags byte would be
// zero, which is the gap tag. Use a gap run to say "nothing happened for N ticks".
export interface ClipTick {
  // Both cursor axes travel together, because the wire flag covers the pair.
  xy?: { dx: number; dy: number };
  wheel?: number;
  pan?: number;
  edges?: ClipEdge[];
  // Both ride OPTION(IMPERFECT), read as the tick plays: with it off the box discards the item and
  // counts it in ClipStatus.gated.
  raw?: ClipRawItem[];
  transfers?: ClipTransferItem[];
}

export type ClipEntry = ({ kind: 'gap'; ticks: number } | ({ kind: 'tick' } & ClipTick));

// Why an entry cannot be encoded (§3.11), in the order the checks run.
export type ClipEntryFault =
  | 'gap' // a gap run outside 1..65535 whole ticks
  | 'edges' // more than CLIP_EDGES_MAX edges
  | 'raw-count' // more than CLIP_RAW_MAX raw reports
  | 'empty' // a content tick with no fields
  | 'raw-direction' // a raw report going neither In nor Out
  | 'transfer-data' // OUT data that is not wLength bytes, or any data on an IN request
  | 'too-long'; // past CLIP_ENTRY_MAX bytes

const CLIP_RAW_HDR = 4;
const CLIP_XFER_HDR = 9;

const transferOutLen = (s: SetupPacket): number => (s.bmRequestType & 0x80 ? 0 : s.wLength & 0xffff);

// What is wrong with an entry, or null when it encodes. The box faults the clip on an entry that
// can never be valid, so these are refused here before anything is sent.
export function clipEntryFault(e: ClipEntry): ClipEntryFault | null {
  if (e.kind === 'gap') {
    return Number.isInteger(e.ticks) && e.ticks >= 1 && e.ticks <= 0xffff ? null : 'gap';
  }
  const edges = e.edges ?? [];
  const raw = e.raw ?? [];
  const transfers = e.transfers ?? [];
  if (edges.length > CLIP_EDGES_MAX) return 'edges';
  if (raw.length > CLIP_RAW_MAX) return 'raw-count';
  if (clipTickFlags(e) === 0) return 'empty';
  if (raw.some((r) => r.dir !== Direction.Positive && r.dir !== Direction.Negative)) return 'raw-direction';
  if (transfers.some((t) => t.out.length !== transferOutLen(t.setup))) return 'transfer-data';
  return clipTickSize(e) > CLIP_ENTRY_MAX ? 'too-long' : null;
}

function clipTickFlags(e: ClipTick): number {
  let flags = 0;
  if (e.xy) flags |= CLIP_F_XY;
  if (e.wheel !== undefined) flags |= CLIP_F_WHEEL;
  if (e.pan !== undefined) flags |= CLIP_F_PAN;
  if (e.edges?.length) flags |= CLIP_F_EDGES;
  if (e.raw?.length) flags |= CLIP_F_RAW;
  if (e.transfers?.length) flags |= CLIP_F_XFER;
  return flags;
}

function clipTickSize(e: ClipTick): number {
  let n = 1;
  if (e.xy) n += 4;
  if (e.wheel !== undefined) n += 2;
  if (e.pan !== undefined) n += 2;
  if (e.edges?.length) n += 1 + 4 * e.edges.length;
  if (e.raw?.length) n += 1 + e.raw.reduce((sum, r) => sum + CLIP_RAW_HDR + r.bytes.length, 0);
  if (e.transfers?.length) n += 1 + e.transfers.reduce((sum, t) => sum + CLIP_XFER_HDR + t.out.length, 0);
  return n;
}

// Encode one clip entry (§3.11). Returns null for an entry the box would reject or misread, rather
// than a nearest-legal guess: a clamped clip plays back as something the caller never recorded.
export function encodeClipEntry(e: ClipEntry): Uint8Array | null {
  if (clipEntryFault(e) !== null) return null;
  if (e.kind === 'gap') return new Uint8Array([CLIP_TAG_GAP, e.ticks & 0xff, (e.ticks >> 8) & 0xff]);
  const out = new Uint8Array(clipTickSize(e));
  const view = new DataView(out.buffer);
  let off = 0;
  out[off++] = clipTickFlags(e);
  if (e.xy) {
    view.setInt16(off, i16(e.xy.dx), true);
    view.setInt16(off + 2, i16(e.xy.dy), true);
    off += 4;
  }
  if (e.wheel !== undefined) {
    view.setInt16(off, i16(e.wheel), true);
    off += 2;
  }
  if (e.pan !== undefined) {
    view.setInt16(off, i16(e.pan), true);
    off += 2;
  }
  if (e.edges?.length) {
    out[off++] = e.edges.length;
    for (const ed of e.edges) {
      out[off++] = ed.cls;
      view.setUint16(off, ed.id & 0xffff, true);
      off += 2;
      out[off++] = ed.action;
    }
  }
  if (e.raw?.length) {
    out[off++] = e.raw.length;
    for (const r of e.raw) {
      out[off++] = r.ep & 0x0f;
      out[off++] = r.dir;
      view.setUint16(off, r.bytes.length, true);
      off += 2;
      out.set(r.bytes, off);
      off += r.bytes.length;
    }
  }
  if (e.transfers?.length) {
    out[off++] = e.transfers.length;
    for (const t of e.transfers) {
      out[off++] = t.ep & 0xff;
      out[off++] = t.setup.bmRequestType & 0xff;
      out[off++] = t.setup.bRequest & 0xff;
      view.setUint16(off, t.setup.wValue & 0xffff, true);
      view.setUint16(off + 2, t.setup.wIndex & 0xffff, true);
      view.setUint16(off + 4, t.setup.wLength & 0xffff, true);
      off += 6;
      out.set(t.out, off);
      off += t.out.length;
    }
  }
  return out;
}

function i16(v: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(v || 0)));
}

// The ops a trigger may carry.
export type ClipTriggerAction =
  | ClipOp.Start
  | ClipOp.Stop
  | ClipOp.Pause
  | ClipOp.Resume
  | ClipOp.Restart
  | ClipOp.Toggle;

export const isTriggerAction = (op: number): op is ClipTriggerAction => op >= ClipOp.Start && op <= ClipOp.Toggle;

// The verbs a trigger may run, in wire order.
export const CLIP_VERBS: ClipTriggerAction[] = [
  ClipOp.Start,
  ClipOp.Stop,
  ClipOp.Pause,
  ClipOp.Resume,
  ClipOp.Restart,
  ClipOp.Toggle,
];

// The engine verb's short name, for a trigger readout and the verb picker.
export function clipOpName(op: ClipOp): string {
  switch (op) {
    case ClipOp.Start:
      return 'start';
    case ClipOp.Stop:
      return 'stop';
    case ClipOp.Pause:
      return 'pause';
    case ClipOp.Resume:
      return 'resume';
    case ClipOp.Restart:
      return 'restart';
    case ClipOp.Toggle:
      return 'toggle';
    case ClipOp.Clear:
      return 'clear';
    case ClipOp.Finalize:
      return 'finalize';
    default:
      return 'unknown';
  }
}

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
  // Bytes played from the clip start, and content ticks played since boot.
  played: number;
  ticks: number;
  // Ran out of buffered ticks mid-play; appended past the ring; append SEQ discontinuities.
  underruns: number;
  overruns: number;
  seqGaps: number;
  // Clip transfers the device completed; ones that ended any other way (another status, no answer, no
  // room in the box's queue, dropped behind a slow one); raw reports and transfers discarded because
  // OPTION(IMPERFECT) was off. Like `ticks` and the three above, since boot and wrapping.
  xfers: number;
  xferErrs: number;
  gated: number;
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
  packetTriggers: ClipPacketTriggerEntry[];
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

// One packet trigger (§3.11): a packet on a traffic surface whose head matches under the mask runs
// an engine verb on the box's next tick.
export interface ClipPacketTrigger {
  cls: number;
  id: number;
  dir: Direction;
  action: ClipTriggerAction;
  consume: boolean;
  oncePerRun: boolean;
  selectorLen: number;
  match: Uint8Array;
  mask: Uint8Array;
}

// One packet trigger as RESP(CLIP) lists it (§4.15): the trigger, which replays as the command that
// set it, and the packets it has matched as the top-ranked trigger, saturating at 65535.
export interface ClipPacketTriggerEntry extends ClipPacketTrigger {
  hits: number;
}

// The surfaces a packet trigger can watch: the traffic classes, in wire order.
export const CLIP_PKT_CLASSES: CatchClass[] = [
  CatchClass.HidIn,
  CatchClass.HidOut,
  CatchClass.VendorInterrupt,
  CatchClass.VendorBulk,
  CatchClass.Control,
  CatchClass.Emit,
];

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// True when two packet triggers share the key the box stores them under, so setting one overwrites
// the other: the address, and the match and mask bytes.
export const samePacketTrigger = (a: ClipPacketTrigger, b: ClipPacketTrigger): boolean =>
  a.cls === b.cls && a.id === b.id && a.dir === b.dir && sameBytes(a.match, b.match) && sameBytes(a.mask, b.mask);

export type ClipPacketTriggerFault =
  | 'class' // not one of the six traffic surfaces
  | 'direction' // not Both, In or Out
  | 'verb' // past Toggle
  | 'mask-length' // match and mask differ in length
  | 'match-length' // past CLIP_PKT_MATCH_MAX bytes
  | 'class-direction' // a direction the class never carries: HID in or Emit with Out, HID out with In
  | 'match-outside-mask' // a match bit outside its mask, which no packet can meet
  | 'consume-control' // a drop has no meaning on a control request
  | 'consume-opt-in' // consuming drops traffic, which needs OPTION(IMPERFECT)
  | 'run-stream' // a run is over one stream: a class other than Control, one id, In or Out
  | 'run-selector' // the match must run past the selector
  | 'run-condition' // no masked bit past the selector, so the run would never end
  | 'selector' // a selector without once per run
  | 'full' // CLIP_PKT_TRIG_MAX held and this key is new
  | 'pool'; // the set's match bytes would pass CLIP_PKT_MATCH_POOL

// What the box holds that decides a set: the opt-in, and the packet triggers already stored.
export interface ClipPacketTriggerBox {
  imperfect: boolean;
  held: readonly ClipPacketTrigger[];
}

// The directions a class carries: HID in and Emit travel In only, HID out travels Out only, and the
// vendor and control classes travel both ways. Both is a wildcard, so every class takes it.
export const clipPacketDirOk = (cls: number, dir: Direction): boolean => {
  if (dir === Direction.Negative) return cls !== CatchClass.HidIn && cls !== CatchClass.Emit;
  if (dir === Direction.Positive) return cls !== CatchClass.HidOut;
  return true;
};

// Why the box would refuse this key, or null when it names a trigger: the checks a removal shares
// with a set. A key no packet can match names nothing the box holds.
export function clipPacketKeyFault(t: ClipPacketTrigger): ClipPacketTriggerFault | null {
  if (!CLIP_PKT_CLASSES.includes(t.cls)) return 'class';
  if (t.dir !== Direction.Both && t.dir !== Direction.Positive && t.dir !== Direction.Negative) return 'direction';
  if (t.match.length !== t.mask.length) return 'mask-length';
  if (t.match.length > CLIP_PKT_MATCH_MAX) return 'match-length';
  if (!clipPacketDirOk(t.cls, t.dir)) return 'class-direction';
  if (t.match.some((b, i) => (b & ~t.mask[i] & 0xff) !== 0)) return 'match-outside-mask';
  return null;
}

// Why the box would refuse to set this trigger, or null when it stores it. CLIP_TRIGGER has no
// reply and a refused frame is dropped whole, so this is the only place the reason exists.
export function clipPacketTriggerFault(
  t: ClipPacketTrigger,
  box?: ClipPacketTriggerBox,
): ClipPacketTriggerFault | null {
  const key = clipPacketKeyFault(t);
  if (key !== null) return key;
  if (!isTriggerAction(t.action)) return 'verb';
  if (t.consume && t.cls === CatchClass.Control) return 'consume-control';
  if (t.consume && box && !box.imperfect) return 'consume-opt-in';
  if (t.oncePerRun) {
    if (t.cls === CatchClass.Control || t.id === CATCH_ID_ANY || t.dir === Direction.Both) return 'run-stream';
    if (t.selectorLen >= t.match.length) return 'run-selector';
    if (t.mask.subarray(t.selectorLen).every((b) => b === 0)) return 'run-condition';
  } else if (t.selectorLen !== 0) return 'selector';
  if (!box || box.held.some((h) => samePacketTrigger(h, t))) return null;
  if (box.held.length >= CLIP_PKT_TRIG_MAX) return 'full';
  const used = box.held.reduce((n, h) => n + h.match.length, 0);
  return used + t.match.length > CLIP_PKT_MATCH_POOL ? 'pool' : null;
}

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

/** What the bootloader thinks of the image a chip is running (§4.16). */
export enum ImageState {
  New = 0,
  PendingVerify = 1,
  Valid = 2,
  Invalid = 3,
  Aborted = 4,
  Unknown = 0xff,
}

/** One chip's firmware version and which of its two app slots it booted. */
export interface ChipFirmware {
  major: number;
  minor: number;
  patch: number;
  /** 0 = ota_0, 1 = ota_1. */
  slot: number;
  state: ImageState;
}

/** The decoded RESP(FIRMWARE) payload (§4.16). */
export interface FirmwareInfo {
  device: ChipFirmware;
  /** null when the host chip has not answered over the inter-chip link. */
  host: ChipFirmware | null;
  /** Usable bytes in a spare slot; the same on both chips. */
  slotSize: number;
  deviceStaged: boolean;
  hostStaged: boolean;
}

/** True while either chip has not confirmed the image it booted, which is when an update is refused. */
export function anyPending(f: FirmwareInfo): boolean {
  return (
    f.device.state === ImageState.PendingVerify ||
    (f.host !== null && f.host.state === ImageState.PendingVerify)
  );
}

export const IMAGE_STATE_NAMES: Record<number, string> = {
  0: 'new',
  1: 'pending-verify',
  2: 'valid',
  3: 'invalid',
  4: 'aborted',
  0xff: 'unknown',
};

// The v3.4.0 advanced control layer (§3.14 / §4.17): rewrite rules and descriptor patches, both addressed in
// the CATCH (class, id, dir) space and both admitted only under OPTION(IMPERFECT).

// The rewrite classes are the traffic classes CATCH already names (§4.17): a report or control surface
// a rule can address, plus the any-class wildcard the box uses for a whole-table clear.
export const REWRITE_CLASSES: CatchClass[] = [
  CatchClass.HidIn,
  CatchClass.HidOut,
  CatchClass.VendorInterrupt,
  CatchClass.VendorBulk,
  CatchClass.Control,
  CatchClass.Emit,
];

// One rewrite rule as RESP(REWRITE) summarises it (§4.17): the address, the action, the match/payload
// lengths, and the running hit count. The match and payload bytes themselves come from RESP(REWRITE_ENTRY).
export interface RewriteRuleInfo {
  cls: number;
  id: number;
  dir: Direction;
  action: RewriteAction | null;
  mlen: number;
  off: number;
  plen: number;
  hits: number;
}

// The decoded RESP(REWRITE) table (§4.17). `gen` increments on a change that alters the table and on a
// clear of a non-empty one, and returns to 0 with the table on RESET, detach, link loss, a re-clone and
// the opt-in turned off. `tableFull` says the last add was refused for capacity, 32 rules or the
// 2048-byte payload pool; the next change to the table clears it.
export interface RewriteTable {
  tableFull: boolean;
  gen: number;
  entries: RewriteRuleInfo[];
}

// A rewrite rule in full, the shape RESP(REWRITE_ENTRY) returns and the REWRITE command takes: the
// address, the action, the offset, and the raw match/mask/payload bytes. A read entry replays as a set.
export interface RewriteRule {
  cls: number;
  id: number;
  dir: Direction;
  action: RewriteAction;
  off: number;
  match: Uint8Array;
  mask: Uint8Array;
  payload: Uint8Array;
}

// One descriptor patch as RESP(PATCHES) summarises it (§4.17): which served descriptor it overwrites,
// where, and how many bytes. The bytes themselves come from RESP(PATCH_ENTRY).
export interface PatchInfo {
  section: PatchSection | null;
  cfg: number;
  index: number;
  offset: number;
  len: number;
}

// The decoded RESP(PATCHES) set (§4.17). `entries` is the stored set; the clone serves a copy taken when
// it was last presented.
export interface PatchSet {
  // The clone serves a non-empty patched set.
  applied: boolean;
  // The stored set differs from the one the clone serves: not applied yet, changed or emptied since,
  // refused, or stored with the opt-in off.
  pending: boolean;
  // The stored set failed a check at the last presentation and is unchanged since, so the clone serves
  // the device unpatched.
  refused: boolean;
  // The last add was refused for capacity, 16 patches or the 1024-byte pool; the next change clears it.
  tableFull: boolean;
  entries: PatchInfo[];
}

// A descriptor patch in full, the shape RESP(PATCH_ENTRY) returns and the PATCH command takes.
export interface PatchEntry {
  section: PatchSection | null;
  cfg: number;
  index: number;
  offset: number;
  bytes: Uint8Array;
}

// A field transform in full, the shape RESP(TRANSFORMS) returns and the TRANSFORM command takes
// (§3.15). Swap exchanges two axes; Remap moves the source field into the destination.
export interface Transform {
  op: TransformOp;
  sclass: number;
  sid: number;
  dclass: number;
  did: number;
}

// The decoded RESP(TRANSFORMS) table (§4.18): the full flag and one entry per transform. There is no
// generation counter and no per-entry state byte; the table is re-asserted wholesale on reconnect.
export interface TransformTable {
  tableFull: boolean;
  entries: Transform[];
}

// The decoded TRANSFER_RESP (§3.14): which endpoint answered, the device's status, and the IN data.
export interface TransferResult {
  ep: number;
  status: TransferStatus;
  data: Uint8Array;
}

// The rewrite action's short name, for a rule readout and the editor's dropdown.
export function rewriteActionName(action: RewriteAction | null): string {
  switch (action) {
    case RewriteAction.Pass:
      return 'pass';
    case RewriteAction.Drop:
      return 'drop';
    case RewriteAction.Patch:
      return 'patch';
    case RewriteAction.Replace:
      return 'replace';
    case RewriteAction.Answer:
      return 'answer';
    case RewriteAction.Stall:
      return 'stall';
    case RewriteAction.Nak:
      return 'nak';
    case RewriteAction.ReplyPatch:
      return 'reply-patch';
    case RewriteAction.ReplyReplace:
      return 'reply-replace';
    default:
      return 'unknown';
  }
}

// The patch section's short name, for a patch readout and the editor's dropdown.
export function patchSectionName(section: PatchSection | null): string {
  switch (section) {
    case PatchSection.Device:
      return 'device';
    case PatchSection.Config:
      return 'configuration';
    case PatchSection.Report:
      return 'report';
    case PatchSection.String:
      return 'string';
    case PatchSection.Bos:
      return 'BOS';
    default:
      return 'unknown';
  }
}

// The transfer status's short name, for the console readout.
export function transferStatusName(status: TransferStatus): string {
  switch (status) {
    case TransferStatus.Ok:
      return 'ok';
    case TransferStatus.Refused:
      return 'refused';
    case TransferStatus.Stall:
      return 'stall';
    case TransferStatus.Nak:
      return 'nak';
    default:
      return 'no device';
  }
}

// The rewrite class's short name, reusing the CATCH class vocabulary (§4.17).
export function rewriteClassName(cls: number): string {
  switch (cls) {
    case CatchClass.HidIn:
      return 'HID in';
    case CatchClass.HidOut:
      return 'HID out';
    case CatchClass.VendorInterrupt:
      return 'vendor interrupt';
    case CatchClass.VendorBulk:
      return 'vendor bulk';
    case CatchClass.Control:
      return 'control';
    case CatchClass.Emit:
      return 'emit';
    case CatchClass.Any:
      return 'any';
    default:
      return `class ${cls}`;
  }
}
