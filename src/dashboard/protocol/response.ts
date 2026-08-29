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
  RenderMode,
  renderModeFromU8,
  emitModeFromU8,
  OPT_BEARING,
  OPT_EMIT,
  OPT_IMPERFECT,
  OPT_MOVE_RIDE,
  Q_CAPS,
  Q_CATCH,
  Q_DEVICE_INFO,
  Q_HEALTH,
  LOCK_ENTRY_LEN,
  LOCKS_MAX,
  Q_LOCKS,
  Q_OPTIONS,
  Q_RATE,
  Q_STATS,
  Q_VERSION,
  RATE_CHANGE_DRIVEN,
  RATE_CONFIDENT,
  CATCH_FLAG_TABLE_FULL,
  CATCH_TABLE_MAX,
  CLIP_CFG_F_FINALIZED,
  CLIP_CFG_F_LOOP,
  CLIP_CFG_F_RETAIN,
  CLIP_CFG_F_RIDE,
  CLIP_HELD_MAX,
  CLIP_TRIG_LEN,
  CLIP_TRIG_MAX,
  CLK_AGE_NONE,
  EVENT_HDR,
  EVENT_TS_LEN,
  Q_CLIP,
  Q_FIRMWARE,
  RESP_FIRMWARE_LEN,
  RESP_CLIP_HDR,
  clipStateFromU8,
} from './opcode';
import {
  type Caps,
  type CatchEntry,
  type CatchState,
  type ClipStatus,
  type ClipTrigger,
  type ClipTriggerAction,
  type DeviceInfo,
  type Direction,
  type Health,
  type ImperfectStatus,
  type Bearing,
  BearingMode,
  bearingModeFromU8,
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
  directionFromU8,
  healthFromFlags,
  kbdCapsFromBytes,
  lockClassFromU8,
  logLevelFromU8,
  FirmwareInfo,
  ImageState,
} from './types';

// Decoded RESP(OPTIONS, EMIT) (§4.14): the emit-rate pacing mode, the configured fixed rate, the rate
// actually in effect (resolvedHz 0 = adaptive/learnt, or no device yet in interval mode), the requested
// wire rate (forceHz 0 = off), what the clone's input endpoints advertise now (advertisedHz 0 = no
// clone), and whether a forced interval is in the served descriptor. mode null is a mode the box
// reported that this build doesn't know.
export interface EmitPace {
  mode: EmitMode | null;
  render: RenderMode | null;
  fixedHz: number;
  resolvedHz: number;
  forceHz: number;
  advertisedHz: number;
  forceActive: boolean;
}

export type Resp =
  | { kind: 'version'; version: Version }
  | { kind: 'health'; health: Health }
  | { kind: 'deviceInfo'; deviceInfo: DeviceInfo }
  | { kind: 'caps'; caps: Caps }
  | { kind: 'rate'; rate: Rate }
  | { kind: 'stats'; stats: Stats }
  | { kind: 'locks'; locks: Locks }
  | { kind: 'bearing'; bearing: Bearing }
  | { kind: 'catch'; catch: CatchState }
  | { kind: 'imperfect'; imperfect: ImperfectStatus }
  | { kind: 'movementRiding'; windowMs: number } // 0 = off
  | { kind: 'emitPace'; emit: EmitPace }
  | { kind: 'clip'; clip: ClipStatus }
  | { kind: 'firmware'; firmware: FirmwareInfo };

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
      // [what][n u8] then n × [class u8][id u16 LE][dir u8][scale u8], one entry per direction not
      // passing untouched. A target absent from the list is passing on every direction.
      if (payload.length < 2) return null;
      const n = payload[1];
      if (n > LOCKS_MAX) return null;
      if (payload.length < 2 + LOCK_ENTRY_LEN * n) return null;
      const entries: LockEntry[] = [];
      for (let i = 0; i < n; i++) {
        const off = 2 + LOCK_ENTRY_LEN * i;
        // An entry this build cannot name is dropped, the way the crate drops one, rather than kept as
        // a raw byte wearing the enum's type: scaleOf would compare it against a class or direction
        // nothing matches and report a pass over a lock the box is holding.
        const cls = lockClassFromU8(payload[off]);
        const direction = directionFromU8(payload[off + 3]);
        if (cls === null || direction === null) continue;
        entries.push({
          cls,
          id: u16le(payload, off + 1),
          direction,
          scale: payload[off + 4],
        });
      }
      return { kind: 'locks', locks: { entries } };
    }
    case Q_CATCH: {
      // [what][flags][dropped u32][clk_off_us i32][clk_rate_ppb i32][clk_delay_us u16]
      // [clk_age_ms u16][n u8] then n × [class][id u16 LE][dir][capture][dropped u16].
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
          capture: payload[off + 4],
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
    case Q_FIRMWARE: {
      // [what][dev maj][min][patch][slot][state][host_present][host maj][min][patch][slot][state]
      // [slot_size u32 LE][staged bits]. The only place the host chip's version appears: RESP(VERSION)
      // reports the device chip alone and its name tail is LEN-delimited, so nothing can follow it.
      if (payload.length < RESP_FIRMWARE_LEN) return null;
      const chip = (o: number) => ({
        major: payload[o],
        minor: payload[o + 1],
        patch: payload[o + 2],
        slot: payload[o + 3],
        state: payload[o + 4] as ImageState,
      });
      return {
        kind: 'firmware',
        firmware: {
          device: chip(1),
          host: payload[6] ? chip(7) : null,
          slotSize: u32le(payload, 12),
          deviceStaged: (payload[16] & 0x01) !== 0,
          hostStaged: (payload[16] & 0x02) !== 0,
        },
      };
    }
    case Q_CLIP: {
      // [what][state][free u32][used u32][played u32][ticks u32][underruns u16][overruns u16]
      // [seq_gaps u16][n_held u8] then n_held x [class][id u16 LE], then [autolock][flags][n_trig]
      // then n_trig x [class][id u16 LE][edge][action][consume].
      if (payload.length < RESP_CLIP_HDR) return null;
      const nHeld = payload[24];
      if (nHeld > CLIP_HELD_MAX) return null;
      const cfgAt = RESP_CLIP_HDR + 3 * nHeld;
      // The config section is fixed-size and always present, so a reply that stops inside it is
      // truncated rather than a box that omitted its configuration.
      if (payload.length < cfgAt + 3) return null;
      const held: Usage[] = [];
      for (let i = 0; i < nHeld; i++) {
        const off = RESP_CLIP_HDR + 3 * i;
        held.push({ cls: payload[off], id: u16le(payload, off + 1) });
      }
      const nTrig = payload[cfgAt + 2];
      if (nTrig > CLIP_TRIG_MAX) return null;
      if (payload.length < cfgAt + 3 + CLIP_TRIG_LEN * nTrig) return null;
      const triggers: ClipTrigger[] = [];
      for (let i = 0; i < nTrig; i++) {
        const off = cfgAt + 3 + CLIP_TRIG_LEN * i;
        triggers.push({
          cls: payload[off],
          id: u16le(payload, off + 1),
          edge: payload[off + 3] as Direction,
          action: payload[off + 4] as ClipTriggerAction,
          consume: payload[off + 5] !== 0,
        });
      }
      const flags = payload[cfgAt + 1];
      return {
        kind: 'clip',
        clip: {
          state: clipStateFromU8(payload[1]),
          freeBytes: u32le(payload, 2),
          totalBytes: u32le(payload, 6),
          played: u32le(payload, 10),
          ticks: u32le(payload, 14),
          underruns: u16le(payload, 18),
          overruns: u16le(payload, 20),
          seqGaps: u16le(payload, 22),
          held,
          autolock: payload[cfgAt],
          loop: (flags & CLIP_CFG_F_LOOP) !== 0,
          retain: (flags & CLIP_CFG_F_RETAIN) !== 0,
          finalized: (flags & CLIP_CFG_F_FINALIZED) !== 0,
          ride: (flags & CLIP_CFG_F_RIDE) !== 0,
          triggers,
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
        case OPT_BEARING:
          // [what=9][id=4][window u16 LE ms][mode u8]
          if (payload.length < 5) return null;
          return {
            kind: 'bearing',
            bearing: { windowMs: u16le(payload, 2), mode: bearingModeFromU8(payload[4]) ?? BearingMode.PerAxis },
          };
        case OPT_EMIT:
          // [what=9][id=2][mode u8][fixed_hz u16][resolved_hz u16][force_hz u16][advertised_hz u16][force_active u8][render u8]
          if (payload.length < 13) return null;
          return {
            kind: 'emitPace',
            emit: {
              mode: emitModeFromU8(payload[2]),
              render: renderModeFromU8(payload[12]),
              fixedHz: u16le(payload, 3),
              resolvedHz: u16le(payload, 5),
              forceHz: u16le(payload, 7),
              advertisedHz: u16le(payload, 9),
              forceActive: payload[11] !== 0,
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

// Parse a USAGE_EVENT payload (§4.10): [ts_us u32][clk u8][cls u8][dir u8][n u8] then
// n × [class u8][id u16 LE]. A class-tagged held-usage snapshot (buttons, keys, or media, one class
// per event). Class and edge are in the HEADER, not read off the entries: the snapshot that most
// needs them is the empty one: the release of the last held usage, which lists nothing.
// Unsolicited.
export function parseUsageEvent(payload: Uint8Array): UsageSnapshot | null {
  if (payload.length < EVENT_HDR + 3) return null;
  const n = payload[EVENT_HDR + 2];
  if (payload.length < EVENT_HDR + 3 + 3 * n) return null;
  const usages: Usage[] = [];
  for (let i = 0; i < n; i++) {
    const off = EVENT_HDR + 3 + 3 * i;
    usages.push({ cls: payload[off], id: u16le(payload, off + 1) });
  }
  return {
    tsUs: u32le(payload, 0),
    clk: clockDomainFromU8(payload[EVENT_TS_LEN]),
    cls: payload[EVENT_HDR],
    dir: payload[EVENT_HDR + 1],
    usages,
  };
}

// Parse a TRAFFIC_EVENT payload (§4.10): [ts_us u32][clk u8][class u8][id u16 LE][dir u8][flags u8]
// [true_len u16 LE][bytes..]. The frame LEN delimits how many bytes arrived, which is at most the
// entry's capture length; compare that against true_len to see whether the capture was cut short.
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
