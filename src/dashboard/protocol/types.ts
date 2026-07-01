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
      return 'keyboard';
    case DeviceKind.Mouse:
      return 'mouse';
    default:
      return 'unknown';
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

// Unified device capabilities (§4.4): one query describes the whole cloned device — mouse + keyboard +
// per-class change_driven. A class that is not present reads all-zero/false.
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

// Injection override action, shared by BUTTON, KEY (§3.10), and CONSUMER (§3.11). Wire values
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

// LOCK command (§3.8): which input to lock, and which direction/edge. Wire values match ctrl_proto.h.
export enum LockTarget {
  X = 0,
  Y = 1,
  Wheel = 2,
  Left = 3,
  Right = 4,
  Middle = 5,
  Side1 = 6,
  Side2 = 7,
}

// LOCK class (§3.8): which input class a lock addresses. usage is class-specific.
export enum LockClass {
  Mouse = 0,
  Key = 1,
  Media = 2,
  AllKeys = 3,
  AllMedia = 4,
  AllButtons = 5,
}

export enum LockDirection {
  Both = 0,
  Positive = 1,
  Negative = 2,
}

// Active input locks (§4.8): a 16-bit mask, 2 bits per target. bit(target*2) is the
// positive/press direction, bit(target*2+1) the negative/release direction.
export interface Locks {
  mask: number;
}

// True when the given target+direction lock is set in the mask.
export function lockSet(locks: Locks, target: LockTarget, direction: LockDirection): boolean {
  if (direction === LockDirection.Both) {
    return locksBit(locks, target, true) && locksBit(locks, target, false);
  }
  return locksBit(locks, target, direction === LockDirection.Positive);
}

function locksBit(locks: Locks, target: LockTarget, positive: boolean): boolean {
  const bit = target * 2 + (positive ? 0 : 1);
  return (locks.mask & (1 << bit)) !== 0;
}

// CATCH subscription classes (§3.9): which physical-input changes stream as event frames. Combine
// with bitwise OR. The mask only gates which reports trigger an event; the payload is always the
// full snapshot. Wire values match ctrl_proto.h.
export enum CatchClass {
  Motion = 0x01,
  Wheel = 0x02,
  Buttons = 0x04,
  Keys = 0x08,
  All = 0x0f,
}

// One mouse snapshot from the CATCH stream (a MOUSE_EVENT frame, §4.10), captured at the merge
// point before any lock suppression or injection.
export interface MouseReport {
  buttons: number; // bit b set = button id b held (0=Left .. 4=Side2)
  dx: number;
  dy: number;
  wheel: number;
}

// True when button id `button` (0=Left .. 4=Side2) is held in this snapshot.
export function mouseReportPressed(r: MouseReport, button: number): boolean {
  return (r.buttons & (1 << button)) !== 0;
}

// One keyboard snapshot from the CATCH stream (a KB_EVENT frame, §4.12): the modifier bitmap plus
// every currently-pressed keycode (ascending). A snapshot, not edge deltas.
export interface KeyboardReport {
  modifiers: number; // bit m set = the modifier at usage 0xE0 + m
  keys: number[]; // pressed HID keycodes
}

// One media snapshot from the CATCH stream (a CONS_EVENT frame, §4.13): the active Consumer usages.
export interface ConsumerReport {
  usages: number[];
}

// One decoded frame from the CATCH stream, tagged by source. The dashboard's `mouse`/`keyboard`/
// `media` kinds avoid shadowing the DOM `MouseEvent` / `KeyboardEvent` globals.
export type CatchEvent =
  | { kind: 'mouse'; report: MouseReport }
  | { kind: 'keyboard'; report: KeyboardReport }
  | { kind: 'media'; report: ConsumerReport };

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
