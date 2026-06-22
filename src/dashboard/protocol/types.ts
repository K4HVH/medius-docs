// Decoded protocol value types, mirroring the medius crate.

import {
  H_CLONE_CFG,
  H_INJECT_ON,
  H_LINK_UP,
  H_LOCK_ON,
  H_MOUSE_ATT,
  H_RATE_CONFIDENT,
} from './opcode';

export interface Version {
  protoVer: number;
  fwMajor: number;
  fwMinor: number;
  fwPatch: number;
}

export function versionString(v: Version): string {
  return `${v.fwMajor}.${v.fwMinor}.${v.fwPatch}`;
}

export interface Health {
  linkUp: boolean;
  mouseAttached: boolean;
  cloneConfigured: boolean;
  injectionActive: boolean;
  rateConfident: boolean;
  lockOn: boolean;
}

export function healthFromFlags(flags: number): Health {
  return {
    linkUp: (flags & H_LINK_UP) !== 0,
    mouseAttached: (flags & H_MOUSE_ATT) !== 0,
    cloneConfigured: (flags & H_CLONE_CFG) !== 0,
    injectionActive: (flags & H_INJECT_ON) !== 0,
    rateConfident: (flags & H_RATE_CONFIDENT) !== 0,
    lockOn: (flags & H_LOCK_ON) !== 0,
  };
}

// The cloned mouse's USB identity (§4.3). All-zero when no mouse is cloned.
export interface MouseInfo {
  vid: number;
  pid: number;
  bcdDevice: number;
  bcdUsb: number;
  hasSerial: boolean;
  hasBos: boolean;
}

// vid:pid formatted as the familiar 04X:04X, e.g. "046D:C08B".
export function vidPid(m: MouseInfo): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  return `${hex(m.vid)}:${hex(m.pid)}`;
}

// Semantic capabilities of the emulated mouse (§4.4). Counts and booleans only.
export interface Caps {
  nButtons: number;
  hasX: boolean;
  hasY: boolean;
  hasWheel: boolean;
  hasReportId: boolean;
  nHid: number;
}

export function isComposite(c: Caps): boolean {
  return c.nHid > 1;
}

// Live native report rate and clone poll period (§4.5).
export interface Rate {
  nativePeriodUs: number;
  pollPeriodUs: number;
  confident: boolean;
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
