// Typed response/event decoders (box -> PC).

import {
  CAP_REPORT_ID,
  CAP_WHEEL,
  CAP_X,
  CAP_Y,
  CAPS_CD_KBD,
  CAPS_CD_MOUSE,
  DI_HAS_BOS,
  DI_HAS_SERIAL,
  EmitMode,
  emitModeFromU8,
  OPT_EMIT,
  OPT_IMPERFECT,
  OPT_MOVE_RIDE,
  Q_CAPS,
  Q_CATCH,
  Q_DEVICE_INFO,
  Q_HEALTH,
  Q_LOCKS,
  Q_OPTIONS,
  Q_RATE,
  Q_STATS,
  Q_VERSION,
  RATE_CHANGE_DRIVEN,
  RATE_CONFIDENT,
  CATCH_FLAG_TABLE_FULL,
  CATCH_TABLE_MAX,
  CLK_AGE_NONE,
  EVENT_HDR,
  EVENT_TS_LEN,
} from './opcode';
import {
  type Caps,
  type CatchEntry,
  type CatchState,
  type DeviceInfo,
  type Health,
  type ImperfectStatus,
  type LockEntry,
  type Locks,
  type LogLine,
  type MotionEvent,
  type Rate,
  type Stats,
  type TrafficEvent,
  type Usage,
  type UsageSnapshot,
  type Version,
  LogLevel,
  clockDomainFromU8,
  deviceKindFromU8,
  healthFromFlags,
  kbdCapsFromBytes,
  logLevelFromU8,
} from './types';

// Decoded RESP(OPTIONS, EMIT) (§4.14): the emit-rate pacing mode, the configured fixed rate, and the rate
// actually in effect (resolvedHz 0 = adaptive/learnt, or no device yet in interval mode). mode null is a
// mode the box reported that this build doesn't know.
export interface EmitPace {
  mode: EmitMode | null;
  fixedHz: number;
  resolvedHz: number;
}

export type Resp =
  | { kind: 'version'; version: Version }
  | { kind: 'health'; health: Health }
  | { kind: 'deviceInfo'; deviceInfo: DeviceInfo }
  | { kind: 'caps'; caps: Caps }
  | { kind: 'rate'; rate: Rate }
  | { kind: 'stats'; stats: Stats }
  | { kind: 'locks'; locks: Locks }
  | { kind: 'catch'; catch: CatchState }
  | { kind: 'imperfect'; imperfect: ImperfectStatus }
  | { kind: 'movementRiding'; windowMs: number } // 0 = off
  | { kind: 'emitPace'; emit: EmitPace };

const u16le = (p: Uint8Array, i: number): number => p[i] | (p[i + 1] << 8);
const u32le = (p: Uint8Array, i: number): number =>
  (p[i] | (p[i + 1] << 8) | (p[i + 2] << 16) | (p[i + 3] << 24)) >>> 0;
const i16le = (p: Uint8Array, i: number): number => ((p[i] | (p[i + 1] << 8)) << 16) >> 16;
const i32le = (p: Uint8Array, i: number): number =>
  p[i] | (p[i + 1] << 8) | (p[i + 2] << 16) | (p[i + 3] << 24);

// RESP(CATCH) (§4.9) shape: a 19-byte scalar header, then 7 bytes per subscription entry.
const CATCH_HDR_LEN = 19;
const CATCH_ENTRY_LEN = 7;

// TRAFFIC_EVENT (§4.10): 12 fixed header bytes before the captured payload.
const TRAFFIC_HDR_LEN = 12;

// Parse a RESP payload: [what u8][data..]. All multi-byte fields little-endian (§4).
export function parseResp(payload: Uint8Array): Resp | null {
  if (payload.length < 1) return null;
  const what = payload[0];
  switch (what) {
    case Q_VERSION:
      // [0][proto][major][minor][patch][mac 6B] = 11-byte header, then the box name tail (ASCII,
      // LEN-delimited, may be empty). The name tail is additive.
      if (payload.length < 11) return null;
      return {
        kind: 'version',
        version: {
          protoVer: payload[1],
          fwMajor: payload[2],
          fwMinor: payload[3],
          fwPatch: payload[4],
          mac: Array.from(payload.subarray(5, 11)),
          name: textDecoder.decode(payload.subarray(11)),
        },
      };
    case Q_HEALTH:
      if (payload.length < 2) return null;
      return { kind: 'health', health: healthFromFlags(payload[1]) };
    case Q_DEVICE_INFO: {
      // [2][vid][pid][bcd_device][bcd_usb][flags][primary_kind] = 11-byte header, then the product tail.
      if (payload.length < 11) return null;
      const flags = payload[9];
      return {
        kind: 'deviceInfo',
        deviceInfo: {
          vid: u16le(payload, 1),
          pid: u16le(payload, 3),
          bcdDevice: u16le(payload, 5),
          bcdUsb: u16le(payload, 7),
          hasSerial: (flags & DI_HAS_SERIAL) !== 0,
          hasBos: (flags & DI_HAS_BOS) !== 0,
          kind: deviceKindFromU8(payload[10]),
          product: textDecoder.decode(payload.subarray(11)),
        },
      };
    }
    case Q_CAPS: {
      if (payload.length < 7) return null;
      const axis = payload[2];
      const cd = payload[6];
      return {
        kind: 'caps',
        caps: {
          mouse: {
            nButtons: payload[1],
            hasX: (axis & CAP_X) !== 0,
            hasY: (axis & CAP_Y) !== 0,
            hasWheel: (axis & CAP_WHEEL) !== 0,
            hasReportId: (axis & CAP_REPORT_ID) !== 0,
            nHid: payload[3],
          },
          keyboard: kbdCapsFromBytes(payload[4], payload[5]),
          mouseChangeDriven: (cd & CAPS_CD_MOUSE) !== 0,
          kbdChangeDriven: (cd & CAPS_CD_KBD) !== 0,
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
          changeDriven: (payload[5] & RATE_CHANGE_DRIVEN) !== 0,
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
      // [what][n u8] then n × [class u8][id u16 LE][dirbits u8] (dirbits b0 = pos, b1 = neg).
      if (payload.length < 2) return null;
      const n = payload[1];
      if (payload.length < 2 + 4 * n) return null;
      const entries: LockEntry[] = [];
      for (let i = 0; i < n; i++) {
        const off = 2 + 4 * i;
        const dirbits = payload[off + 3];
        entries.push({
          cls: payload[off],
          id: u16le(payload, off + 1),
          positive: (dirbits & 0x01) !== 0,
          negative: (dirbits & 0x02) !== 0,
        });
      }
      return { kind: 'locks', locks: { entries } };
    }
    case Q_CATCH: {
      // [what][flags][dropped u32][clk_off_us i32][clk_rate_ppb i32][clk_delay_us u16]
      // [clk_age_ms u16][n u8] then n × [class][id u16 LE][dir][snaplen][dropped u16].
      if (payload.length < CATCH_HDR_LEN) return null;
      const n = payload[18];
      // The frame's 512-byte payload ceiling would admit 70 entries, but the box's table holds 32,
      // so a larger count is a malformed reply rather than a bigger table.
      if (n > CATCH_TABLE_MAX) return null;
      if (payload.length < CATCH_HDR_LEN + CATCH_ENTRY_LEN * n) return null;
      const ageMs = u16le(payload, 16);
      const entries: CatchEntry[] = [];
      for (let i = 0; i < n; i++) {
        const off = CATCH_HDR_LEN + CATCH_ENTRY_LEN * i;
        entries.push({
          cls: payload[off],
          id: u16le(payload, off + 1),
          dir: payload[off + 3],
          snaplen: payload[off + 4],
          dropped: u16le(payload, off + 5),
        });
      }
      return {
        kind: 'catch',
        catch: {
          tableFull: (payload[1] & CATCH_FLAG_TABLE_FULL) !== 0,
          dropped: u32le(payload, 2),
          clock: {
            offsetUs: i32le(payload, 6),
            ratePpb: i32le(payload, 10),
            delayUs: u16le(payload, 14),
            ageMs: ageMs === CLK_AGE_NONE ? null : ageMs,
          },
          entries,
        },
      };
    }
    case Q_OPTIONS: {
      if (payload.length < 2) return null;
      switch (payload[1]) {
        case OPT_IMPERFECT:
          // [what=9][id=0][allowed][over_capacity][clone_imperfect]
          if (payload.length < 5) return null;
          return {
            kind: 'imperfect',
            imperfect: {
              allowed: payload[2] !== 0,
              overCapacity: payload[3] !== 0,
              cloneImperfect: payload[4] !== 0,
            },
          };
        case OPT_MOVE_RIDE:
          // [what=9][id=1][timeout u16 LE ms]
          if (payload.length < 4) return null;
          return { kind: 'movementRiding', windowMs: u16le(payload, 2) };
        case OPT_EMIT:
          // [what=9][id=2][mode u8][fixed_hz u16 LE][resolved_hz u16 LE]
          if (payload.length < 7) return null;
          return {
            kind: 'emitPace',
            emit: {
              mode: emitModeFromU8(payload[2]),
              fixedHz: u16le(payload, 3),
              resolvedHz: u16le(payload, 5),
            },
          };
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

// Parse a MOTION_EVENT payload (§4.10): [ts_us u32][clk u8][dx i16][dy i16][dz i16]. Unsolicited.
export function parseMotionEvent(payload: Uint8Array): MotionEvent | null {
  if (payload.length < EVENT_HDR + 6) return null;
  return {
    tsUs: u32le(payload, 0),
    clk: clockDomainFromU8(payload[EVENT_TS_LEN]),
    dx: i16le(payload, EVENT_HDR),
    dy: i16le(payload, EVENT_HDR + 2),
    dz: i16le(payload, EVENT_HDR + 4),
  };
}

// Parse a USAGE_EVENT payload (§4.10): [ts_us u32][clk u8][cls u8][n u8] then n × [class u8][id u16
// LE]. A class-tagged held-usage snapshot (buttons, keys, or media, one class per event). The class
// is in the HEADER, not read off the first usage: the snapshot that most needs it is the empty one,
// which is the release of the last held usage and lists nothing. Unsolicited.
export function parseUsageEvent(payload: Uint8Array): UsageSnapshot | null {
  if (payload.length < EVENT_HDR + 2) return null;
  const n = payload[EVENT_HDR + 1];
  if (payload.length < EVENT_HDR + 2 + 3 * n) return null;
  const usages: Usage[] = [];
  for (let i = 0; i < n; i++) {
    const off = EVENT_HDR + 2 + 3 * i;
    usages.push({ cls: payload[off], id: u16le(payload, off + 1) });
  }
  return {
    tsUs: u32le(payload, 0),
    clk: clockDomainFromU8(payload[EVENT_TS_LEN]),
    cls: payload[EVENT_HDR],
    usages,
  };
}

// Parse a TRAFFIC_EVENT payload (§4.10): [ts_us u32][clk u8][class u8][id u16 LE][dir u8][flags u8]
// [true_len u16 LE][bytes..]. The frame LEN delimits how many bytes arrived, which is at most the
// entry's snaplen; compare that against true_len to see whether the capture was cut short.
// Unsolicited.
export function parseTrafficEvent(payload: Uint8Array): TrafficEvent | null {
  if (payload.length < TRAFFIC_HDR_LEN) return null;
  return {
    tsUs: u32le(payload, 0),
    clk: clockDomainFromU8(payload[4]),
    cls: payload[5],
    id: u16le(payload, 6),
    dir: payload[8],
    flags: payload[9],
    trueLen: u16le(payload, 10),
    bytes: payload.slice(TRAFFIC_HDR_LEN),
  };
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

// Parse a LOG payload: [level u8][text UTF-8 (LEN-1)].
export function parseLog(payload: Uint8Array): LogLine {
  if (payload.length === 0) {
    return { level: LogLevel.Info, text: '' };
  }
  return {
    level: logLevelFromU8(payload[0]),
    text: textDecoder.decode(payload.subarray(1)),
  };
}
