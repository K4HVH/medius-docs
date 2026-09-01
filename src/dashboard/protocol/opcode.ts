// Frame opcodes and wire constants, pinned to the medius crate and ctrl_proto.h.

export const SOF = 0xa5;
export const MAX_PAYLOAD = 512;
export const PROTO_VER = 7; // the render settings are OPTION(RENDER), and OPTION(EMIT) is back to pace alone

// The oldest wire this page will still open. One-click update arrived with proto 5 (firmware 3.2.0)
// and everything it uses (QUERY(VERSION), QUERY(FIRMWARE), UPDATE/UPDATE_RESP, LOG) has been
// unchanged since; the options moved around it at 6 and 7. Refusing an older box outright would lock it out of
// the one mechanism that brings it up to date. A box between this and PROTO_VER connects for updating
// only: the rest of the dashboard speaks the current wire and is not offered.
export const MIN_PROTO_VER = 5;

// INJECT class (the momentary-usage field kind) + MOVE motion (the relative-axis field kind).
export const INJ_BTN = 0;
export const INJ_KEY = 1;
export const INJ_MEDIA = 2;
export const MOTION_CURSOR = 0;
export const MOTION_WHEEL = 1;

// MOVE flags (§3.1): the per-command movement-riding override. Applied DISCARD, then FLUSH, then the
// delta; FLUSH and DISCARD together contradict and the box refuses the frame.
export const MV_F_NOW = 0x01;
export const MV_F_FLUSH = 0x02;
export const MV_F_DISCARD = 0x04;

export const Q_VERSION = 0;
export const Q_HEALTH = 1;
export const Q_DEVICE_INFO = 2;
export const Q_CAPS = 3; // unified: mouse + keyboard + per-class change_driven
export const Q_RATE = 4;
export const Q_STATS = 5;
export const Q_LOCKS = 6;
// RESP(LOCKS) entry (§4.8): [class u8][id u16 LE][dir u8][scale u8].
export const LOCK_ENTRY_LEN = 5;
// The most entries one RESP(LOCKS) carries (§4.8). The box fills them in a fixed order and truncates
// the granular key list with nothing marking the cut, so a larger count is a malformed reply rather than a longer table.
export const LOCKS_MAX = 96;
export const Q_CATCH = 7;
// selector 8 retired (was Q_KBD_CAPS; folded into Q_CAPS = 3)
export const Q_OPTIONS = 9; // persistent box options: QUERY [Q_OPTIONS][id] -> RESP [Q_OPTIONS][id][value..]
export const Q_CLIP = 10; // buffered clip status (§4.15): engine state, ring accounting, held usages, config
export const Q_FIRMWARE = 11; // both chips' versions + which app slot each booted (§4.16)

// CLIP_CTRL engine verbs (§3.11). Ops 0..5 are the shared action space a trigger binding's `action`
// byte draws from, so a trigger runs the same verb the control PC would.
export enum ClipOp {
  Start = 0,
  Stop = 1,
  Pause = 2,
  Resume = 3,
  Restart = 4,
  Toggle = 5, // highest value a trigger `action` may carry
  Clear = 6, // discard the loaded clip, free the ring, clear FAULTED
  Finalize = 7, // close a retained clip: fix the write head as the clip end
}

// CLIP_SET scalar setting ids (§3.11), shaped like OPTION: one whole-value write per id.
export const CLIP_SET_AUTOLOCK = 0; // value = CLIP_LOCK_* scope bits
export const CLIP_SET_LOOP = 1; // value != 0
export const CLIP_SET_RETAIN = 2; // value != 0 (0 = streaming, the default)
export const CLIP_SET_RIDE = 3; // value != 0 = clip motion waits to ride a native report (0 = the box's own clock, the default)

// CLIP_TRIGGER binding set (§3.11), shaped like LOCK. Keyed by (class, id, edge).
export const CLIP_TRIG_MAX = 8;
export const CLIP_TRIG_F_PRESENT = 0x01; // set = add/overwrite, clear = remove
export const CLIP_TRIG_F_CONSUME = 0x02; // suppress the trigger input from the game

// Autolock scope (the CLIP_SET_AUTOLOCK value): which classes the clip blocks physical input on
// while it plays, so physical input cannot add to what it plays.
export const CLIP_LOCK_AIM = 0x01; // the X and Y cursor axes
export const CLIP_LOCK_WHEEL = 0x02;
export const CLIP_LOCK_BUTTONS = 0x04;
export const CLIP_LOCK_KEYS = 0x08;
export const CLIP_LOCK_MEDIA = 0x10;
export const CLIP_LOCK_ALL = 0x1f;

// Trigger binding wildcards: class is an INJ_* class or CLIP_COND_ANY_CLASS; id is that class's
// usage or CLIP_COND_ANY_ID.
export const CLIP_COND_ANY_CLASS = 0xff;
export const CLIP_COND_ANY_ID = 0xffff;

export enum ClipState {
  Idle = 0,
  Playing = 1,
  Paused = 2,
  // An append SEQ gap or a ring overrun: the stream may be corrupt, so the engine refuses to play
  // it. Only CLIP_OP_CLEAR leaves this state.
  Faulted = 3,
}

// RESP(CLIP) config-section flags byte (§4.15).
export const CLIP_CFG_F_LOOP = 0x01;
export const CLIP_CFG_F_RETAIN = 0x02;
export const CLIP_CFG_F_FINALIZED = 0x04;
export const CLIP_CFG_F_RIDE = 0x08;

// Clip entry tags (§3.11). Tag 0 is a gap run; a content tick's tag is a nonzero field-flags byte,
// which is why a fieldless content tick cannot be encoded: it would read back as a gap.
export const CLIP_TAG_GAP = 0x00;
export const CLIP_F_XY = 0x01;
export const CLIP_F_WHEEL = 0x02;
export const CLIP_F_EDGES = 0x04;
export const CLIP_EDGES_MAX = 8;
export const CLIP_ENTRY_MAX = 1 + 4 + 2 + 1 + CLIP_EDGES_MAX * 4;

// Held usages in one RESP(CLIP) snapshot, the reply's fixed scalar prefix, and the width of one
// trigger in its config section (§4.15).
export const CLIP_HELD_MAX = 40;
export const RESP_CLIP_HDR = 25;
export const CLIP_TRIG_LEN = 6;

// A state byte this build does not know reads as Faulted rather than Idle: an unknown engine state
// is not one a UI should offer Start on.
export function clipStateFromU8(v: number): ClipState {
  switch (v) {
    case 0:
      return ClipState.Idle;
    case 1:
      return ClipState.Playing;
    case 2:
      return ClipState.Paused;
    default:
      return ClipState.Faulted;
  }
}

// OPTION ids (§3.10): persistent box options set via OPTION, read via Q_OPTIONS. The value is id-specific.
export const OPT_IMPERFECT = 0; // value [allow u8]
export const OPT_MOVE_RIDE = 1; // value [timeout u16 LE ms], 0 = off
export const OPT_EMIT = 2; // value [mode u8][rate_hz u16 LE][force_hz u16 LE]; mode 0 learned / 1 interval / 2 fixed
export const OPT_NAME = 3; // value [name ascii 1..32]; 0 value bytes clears it (read via RESP(VERSION), not Q_OPTIONS)
export const OPT_BEARING = 4; // value [window u16 LE ms][mode u8]; what the With/Against lock directions are measured against (§3.12)
export const OPT_RENDER = 5; // value [mode u8][full u8]; the texture motion is drawn with (§3.14)

// The box name's length bounds (§3.10): 1..32 printable ASCII bytes.
export const NAME_MAX = 32;

// OPTION(EMIT) emit-rate pacing modes (§3.10). Fixed snaps to 1000/n Hz and is capped at 1000.
export enum EmitMode {
  Learned = 0, // pace to the mouse's learnt native report rate (default)
  Interval = 1, // follow the cloned mouse's bInterval poll rate
  Fixed = 2, // pace at a fixed rate_hz
}

// OPTION(RENDER)'s mode: Off is the paced fill; the rest draw the mouse's learned texture and differ only
// in the onboard path smoother. The box boots at Despiked.
export enum RenderMode {
  Off = 0,
  Stock = 1,
  Despiked = 2,
  Unsmoothed = 3,
}

export function renderModeFromU8(render: number): RenderMode | null {
  switch (render) {
    case 0:
      return RenderMode.Off;
    case 1:
      return RenderMode.Stock;
    case 2:
      return RenderMode.Despiked;
    case 3:
      return RenderMode.Unsmoothed;
    default:
      return null;
  }
}

export function emitModeFromU8(value: number): EmitMode | null {
  switch (value) {
    case 0:
      return EmitMode.Learned;
    case 1:
      return EmitMode.Interval;
    case 2:
      return EmitMode.Fixed;
    default:
      return null;
  }
}

export const H_LINK_UP = 0x01;
export const H_MOUSE_ATT = 0x02;
export const H_CLONE_CFG = 0x04;
export const H_INJECT_ON = 0x08;
export const H_RATE_CONFIDENT = 0x10;
export const H_LOCK_ON = 0x20;
export const H_CATCH_ON = 0x40;
export const H_KBD_ATT = 0x80;

// DEVICE_INFO flags (§4.3).
export const DI_HAS_SERIAL = 0x01;
export const DI_HAS_BOS = 0x02;

// DEVICE_INFO primary_kind (§4.3): the cloned device's Boot-interface bInterfaceProtocol.
export const DEVICE_KIND_UNKNOWN = 0;
export const DEVICE_KIND_KEYBOARD = 1;
export const DEVICE_KIND_MOUSE = 2;

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
  MotionEvent = 0x0c,
  UsageEvent = 0x0f,
  // 0x10 reserved (was ConsEvent; media folded into UsageEvent)
  Option = 0x11,
  ClipAppend = 0x12,
  ClipCtrl = 0x13,
  ClipSet = 0x14,
  ClipTrigger = 0x15,
  TrafficEvent = 0x16,
  Update = 0x17,
  UpdateResp = 0x18,
}

// Byte width of the ts_us field every catch event frame leads with (§4.10).
export const EVENT_TS_LEN = 4;

// Byte width of the header every catch event frame shares: ts_us then the clk domain byte (§4.10).
// The two chips boot independently, so a stamp only means something against another from the same
// domain, and every event has to say which clock produced it.
export const EVENT_HDR = EVENT_TS_LEN + 1;

// The CATCH table's size (§3.9). A refused entry is visible by its absence from RESP(CATCH) plus
// the table-full flag, because CATCH itself has no reply. The clk byte's two values live on the
// ClockDomain enum rather than here, so there is one vocabulary for them rather than two.
export const CATCH_TABLE_MAX = 32;

// RESP(CATCH) flags (§4.9).
export const CATCH_FLAG_TABLE_FULL = 0x01;

// RESP(CATCH) clk_age_ms sentinel (§4.9): no cross-chip clock estimate has been taken yet. It is a
// distinct value because "no estimate" and "the offset happens to be zero" both report offset 0.
export const CLK_AGE_NONE = 0xffff;

// TRAFFIC_EVENT flags for class VEND_BULK (§4.10).
export const TRAFFIC_BULK_END = 0x01;
export const TRAFFIC_BULK_ZLP = 0x02;

// UPDATE sub-ops (§3.13). Firmware reaches either chip over this port; the host chip's image is
// relayed over the inter-chip link, which is the only route to it.
export const OTA_OP_BEGIN = 0;
export const OTA_OP_DATA = 1;
export const OTA_OP_END = 2;
export const OTA_OP_ABORT = 3;
export const OTA_OP_ACTIVATE = 4;
export const OTA_TGT_DEVICE = 0;
export const OTA_TGT_HOST = 1;
// Image bytes per DATA frame: the frame's 512 less op, target and a 2-byte chunk index, rounded down
// to a multiple of four so every flash write on the box is aligned.
export const OTA_CHUNK = 504;
// DATA frames the box accepts before it must answer. Not a throughput knob: a flash page write stalls
// both cores for 0.3-0.7 ms while the RX FIFO holds 320 us of wire, so an unthrottled sender overruns it.
export const OTA_CREDIT = 16;
export const UPD_RESP_LEN = 7;
export const RESP_FIRMWARE_LEN = 17;

// UPDATE_RESP status bytes (§4.16).
export const UPD_OK = 0x00;
export const UPD_READY = 0x01;
export const UPD_ACK = 0x02;
export const UPD_STAGED = 0x03;
export const UPD_NAMES: Record<number, string> = {
  0x00: 'ok',
  0x01: 'ready',
  0x02: 'ack',
  0x03: 'staged',
  0x10: 'busy',
  0x11: 'no-slot',
  0x12: 'too-big',
  0x13: 'seq-gap',
  0x14: 'write-failed',
  0x15: 'bad-sha',
  0x16: 'bad-image',
  0x17: 'link-down',
  0x18: 'timeout',
  0x19: 'nothing-staged',
  0x1a: 'bad-state',
  0x1b: 'on-probation',
  0x1c: 'untouched',
};

// TRAFFIC_EVENT flags for class CONTROL (§4.10): the real device's answer to the proxied request.
export const TRAFFIC_CONTROL_OK = 0x00;
export const TRAFFIC_CONTROL_STALL = 0xfd;
export const TRAFFIC_CONTROL_NAK = 0xfe;

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
      return FrameType.MotionEvent;
    case 0x0f:
      return FrameType.UsageEvent;
    case 0x11:
      return FrameType.Option;
    case 0x12:
      return FrameType.ClipAppend;
    case 0x13:
      return FrameType.ClipCtrl;
    case 0x14:
      return FrameType.ClipSet;
    case 0x15:
      return FrameType.ClipTrigger;
    case 0x16:
      return FrameType.TrafficEvent;
    case 0x17:
      return FrameType.Update;
    case 0x18:
      return FrameType.UpdateResp;
    default:
      return null;
  }
}
