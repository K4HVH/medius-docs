// Typed response/event decoders (box -> PC).

import {
  CAP_REPORT_ID,
  CAP_WHEEL,
  CAP_X,
  CAP_Y,
  MI_HAS_BOS,
  MI_HAS_SERIAL,
  Q_CAPS,
  Q_CATCH,
  Q_HEALTH,
  Q_LOCKS,
  Q_MOUSE_INFO,
  Q_RATE,
  Q_STATS,
  Q_VERSION,
  RATE_CONFIDENT,
} from './opcode';
import {
  type Caps,
  type CatchState,
  type Health,
  type InputReport,
  type Locks,
  type LogLine,
  type MouseInfo,
  type Rate,
  type Stats,
  type Version,
  LogLevel,
  healthFromFlags,
  logLevelFromU8,
} from './types';

export type Resp =
  | { kind: 'version'; version: Version }
  | { kind: 'health'; health: Health }
  | { kind: 'mouseInfo'; mouseInfo: MouseInfo }
  | { kind: 'caps'; caps: Caps }
  | { kind: 'rate'; rate: Rate }
  | { kind: 'stats'; stats: Stats }
  | { kind: 'locks'; locks: Locks }
  | { kind: 'catch'; catch: CatchState };

const u16le = (p: Uint8Array, i: number): number => p[i] | (p[i + 1] << 8);
const u32le = (p: Uint8Array, i: number): number =>
  (p[i] | (p[i + 1] << 8) | (p[i + 2] << 16) | (p[i + 3] << 24)) >>> 0;
const i16le = (p: Uint8Array, i: number): number => ((p[i] | (p[i + 1] << 8)) << 16) >> 16;

// Parse a RESP payload: [what u8][data..]. All multi-byte fields little-endian (§4).
export function parseResp(payload: Uint8Array): Resp | null {
  if (payload.length < 1) return null;
  const what = payload[0];
  switch (what) {
    case Q_VERSION:
      if (payload.length < 5) return null;
      return {
        kind: 'version',
        version: {
          protoVer: payload[1],
          fwMajor: payload[2],
          fwMinor: payload[3],
          fwPatch: payload[4],
        },
      };
    case Q_HEALTH:
      if (payload.length < 2) return null;
      return { kind: 'health', health: healthFromFlags(payload[1]) };
    case Q_MOUSE_INFO: {
      if (payload.length < 10) return null;
      const flags = payload[9];
      return {
        kind: 'mouseInfo',
        mouseInfo: {
          vid: u16le(payload, 1),
          pid: u16le(payload, 3),
          bcdDevice: u16le(payload, 5),
          bcdUsb: u16le(payload, 7),
          hasSerial: (flags & MI_HAS_SERIAL) !== 0,
          hasBos: (flags & MI_HAS_BOS) !== 0,
        },
      };
    }
    case Q_CAPS: {
      if (payload.length < 4) return null;
      const axis = payload[2];
      return {
        kind: 'caps',
        caps: {
          nButtons: payload[1],
          hasX: (axis & CAP_X) !== 0,
          hasY: (axis & CAP_Y) !== 0,
          hasWheel: (axis & CAP_WHEEL) !== 0,
          hasReportId: (axis & CAP_REPORT_ID) !== 0,
          nHid: payload[3],
        },
      };
    }
    case Q_RATE: {
      if (payload.length < 6) return null;
      return {
        kind: 'rate',
        rate: {
          nativePeriodUs: u16le(payload, 1),
          pollPeriodUs: u16le(payload, 3),
          confident: (payload[5] & RATE_CONFIDENT) !== 0,
        },
      };
    }
    case Q_STATS: {
      if (payload.length < 17) return null;
      return {
        kind: 'stats',
        stats: {
          injectEmits: u32le(payload, 1),
          txDrops: u16le(payload, 5),
          txMerges: u16le(payload, 7),
          txMaxdepth: payload[9],
          txWedges: payload[10],
          wakeups: u16le(payload, 11),
          resetCount: u16le(payload, 13),
          configCount: u16le(payload, 15),
        },
      };
    }
    case Q_LOCKS: {
      if (payload.length < 3) return null;
      return { kind: 'locks', locks: { mask: u16le(payload, 1) } };
    }
    case Q_CATCH: {
      if (payload.length < 6) return null;
      return { kind: 'catch', catch: { mask: payload[1], dropped: u32le(payload, 2) } };
    }
    default:
      return null;
  }
}

// Parse an EVENT payload (§4.10): [buttons u8][dx i16][dy i16][wheel i16]. Unsolicited (box -> PC).
export function parseEvent(payload: Uint8Array): InputReport | null {
  if (payload.length < 7) return null;
  return {
    buttons: payload[0],
    dx: i16le(payload, 1),
    dy: i16le(payload, 3),
    wheel: i16le(payload, 5),
  };
}

const logDecoder = new TextDecoder('utf-8', { fatal: false });

// Parse a LOG payload: [level u8][text UTF-8 (LEN-1)].
export function parseLog(payload: Uint8Array): LogLine {
  if (payload.length === 0) {
    return { level: LogLevel.Info, text: '' };
  }
  return {
    level: logLevelFromU8(payload[0]),
    text: logDecoder.decode(payload.subarray(1)),
  };
}
