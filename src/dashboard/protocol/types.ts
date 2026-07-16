// Decoded protocol value types, mirroring the medius crate.

import {
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

export enum LockDirection {
  Both = 0,
  Positive = 1,
  Negative = 2,
}

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
export function isLocked(locks: Locks, target: LockTarget, direction: LockDirection): boolean {
  const e = locks.entries.find((x) => x.cls === target.cls && x.id === target.id);
  if (!e) return false;
  if (direction === LockDirection.Both) return e.positive && e.negative;
  return direction === LockDirection.Positive ? e.positive : e.negative;
}

// CATCH subscription classes (§3.9): which physical-input changes stream as event frames. Combine
// with bitwise OR. The mask only gates which reports trigger an event; the payload is always the
// full snapshot. Wire values match ctrl_proto.h.
export enum CatchClass {
  Motion = 0x01,
  Wheel = 0x02,
  Buttons = 0x04,
  Keys = 0x08,
  Media = 0x10,
  All = 0x1f,
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
  dx: number;
  dy: number;
  dz: number;
}

// A class-tagged held-usage snapshot from the CATCH stream (a USAGE_EVENT frame, §4.10). One event
// carries usages of a single class (buttons, keys, or media). A snapshot, not edge deltas.
export interface UsageSnapshot {
  usages: Usage[];
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
// frame carries a class-tagged held-usage snapshot (buttons, keys, or media).
export type CatchEvent =
  | { kind: 'motion'; motion: MotionEvent }
  | { kind: 'usages'; snapshot: UsageSnapshot };

// Decoded RESP(CATCH) (§4.9): the active subscription mask + box-side dropped-event count.
export interface CatchState {
  mask: number;
  dropped: number;
}

// Decoded RESP(OPTIONS, IMPERFECT) (§4.14): the imperfect-clone opt-in state, whether the attached device is
// over-capacity (needs an interrupt-IN endpoint the box can't service), and whether the live clone was
// cloned over-capacity anyway (an interface is silently dead).
export interface ImperfectStatus {
  allowed: boolean;
  overCapacity: boolean;
  cloneImperfect: boolean;
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
