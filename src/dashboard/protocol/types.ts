// Decoded protocol value types, mirroring the medius crate.

import { H_CLONE_CFG, H_INJECT_ON, H_LINK_UP, H_MOUSE_ATT } from './opcode';

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
}

export function healthFromFlags(flags: number): Health {
  return {
    linkUp: (flags & H_LINK_UP) !== 0,
    mouseAttached: (flags & H_MOUSE_ATT) !== 0,
    cloneConfigured: (flags & H_CLONE_CFG) !== 0,
    injectionActive: (flags & H_INJECT_ON) !== 0,
  };
}

export enum RebootTarget {
  DeviceDownload = 0,
  HostDownload = 1,
  DeviceRun = 2,
  HostRun = 3,
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
