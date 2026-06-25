// Frame opcodes and wire constants, pinned to the medius crate and ctrl_proto.h.

export const SOF = 0xa5;
export const MAX_PAYLOAD = 512;
export const PROTO_VER = 2; // the unified-input-core redesign (generic INJECT/MOVE/LOCK, class-aware RATE)

// INJECT class (the momentary-usage field kind) + MOVE motion (the relative-axis field kind).
export const INJ_BTN = 0;
export const INJ_KEY = 1;
export const INJ_MEDIA = 2;
export const MOTION_CURSOR = 0;
export const MOTION_WHEEL = 1;

export const Q_VERSION = 0;
export const Q_HEALTH = 1;
export const Q_MOUSE_INFO = 2;
export const Q_CAPS = 3; // unified: mouse + keyboard + per-class change_driven
export const Q_RATE = 4;
export const Q_STATS = 5;
export const Q_LOCKS = 6;
export const Q_CATCH = 7;
// selector 8 retired (was Q_KBD_CAPS; folded into Q_CAPS = 3)
export const Q_IMPERFECT = 9;

export const H_LINK_UP = 0x01;
export const H_MOUSE_ATT = 0x02;
export const H_CLONE_CFG = 0x04;
export const H_INJECT_ON = 0x08;
export const H_RATE_CONFIDENT = 0x10;
export const H_LOCK_ON = 0x20;
export const H_CATCH_ON = 0x40;
export const H_KBD_ATT = 0x80;

// MOUSE_INFO flags (§4.3).
export const MI_HAS_SERIAL = 0x01;
export const MI_HAS_BOS = 0x02;

// CAPS axis_flags (§4.4).
export const CAP_X = 0x01;
export const CAP_Y = 0x02;
export const CAP_WHEEL = 0x04;
export const CAP_REPORT_ID = 0x08;

// CAPS kbd_flags (§4.4). n_keys 0xff means an NKRO bitmap.
export const KBC_NKRO = 0x01;
export const KBC_CONSUMER = 0x02;
export const KBC_SYSTEM = 0x04;
export const KBC_REPORT_ID = 0x08;

// CAPS change_driven byte (§4.4), per class.
export const CAPS_CD_MOUSE = 0x01;
export const CAPS_CD_KBD = 0x02;

// RATE flags (§4.5).
export const RATE_CONFIDENT = 0x01;
export const RATE_CHANGE_DRIVEN = 0x02;

export enum FrameType {
  Move = 0x01,
  Inject = 0x03,
  Reset = 0x04,
  Query = 0x05,
  Resp = 0x06,
  RebootDl = 0x07,
  Log = 0x08,
  Led = 0x09,
  Lock = 0x0a,
  Catch = 0x0b,
  MouseEvent = 0x0c,
  KbEvent = 0x0f,
  ConsEvent = 0x10,
  Imperfect = 0x11,
}

export function frameTypeFromU8(value: number): FrameType | null {
  switch (value) {
    case 0x01:
      return FrameType.Move;
    case 0x03:
      return FrameType.Inject;
    case 0x04:
      return FrameType.Reset;
    case 0x05:
      return FrameType.Query;
    case 0x06:
      return FrameType.Resp;
    case 0x07:
      return FrameType.RebootDl;
    case 0x08:
      return FrameType.Log;
    case 0x09:
      return FrameType.Led;
    case 0x0a:
      return FrameType.Lock;
    case 0x0b:
      return FrameType.Catch;
    case 0x0c:
      return FrameType.MouseEvent;
    case 0x0f:
      return FrameType.KbEvent;
    case 0x10:
      return FrameType.ConsEvent;
    case 0x11:
      return FrameType.Imperfect;
    default:
      return null;
  }
}
