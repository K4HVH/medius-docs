// Command payload builders (PC -> box).

import {
  CLIP_TRIG_F_CONSUME,
  CLIP_TRIG_F_PRESENT,
  ClipOp,
  EmitMode,
  RenderMode,
  MAX_PAYLOAD,
  MOTION_CURSOR,
  MOTION_WHEEL,
  NAME_MAX,
  OPT_BEARING,
  OPT_EMIT,
  OPT_RENDER,
  OPT_SPREAD,
  OPT_IMPERFECT,
  OPT_MOVE_RIDE,
  OPT_NAME,
} from './opcode';
import {
  type ClipEntry,
  type ClipTrigger,
  BearingMode,
  CatchClass,
  Direction,
  LedMode,
  LOCK_SCALE_MAX,
  LedTarget,
  LockClass,
  RebootTarget,
  encodeClipEntry,
} from './types';

export function queryPayload(what: number): Uint8Array {
  return new Uint8Array([what]);
}

// MOVE cursor (§3.1): [motion=0][dx i16 LE][dy i16 LE][flags]. Saturated to the i16 the wire carries;
// the box then clamps that to the cloned report's field width and carries the remainder into the next
// emit. `flags` is the movement-riding override (MV_F_*), 0 for an ordinary move.
export function moveCursorPayload(dx: number, dy: number, flags = 0): Uint8Array {
  const out = new Uint8Array(6);
  out[0] = MOTION_CURSOR;
  new DataView(out.buffer).setInt16(1, clampI16(dx), true);
  new DataView(out.buffer).setInt16(3, clampI16(dy), true);
  out[5] = flags & 0x07;
  return out;
}

// MOVE wheel (§3.1): [motion=1][dz i16 LE][flags].
export function moveWheelPayload(dz: number, flags = 0): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = MOTION_WHEEL;
  new DataView(out.buffer).setInt16(1, clampI16(dz), true);
  out[3] = flags & 0x07;
  return out;
}

// A JS number reaches the wire as an i16, so clamp here rather than letting DataView wrap: a
// slider at 40000 should saturate, not come out as -25536 and fling the cursor the other way.
function clampI16(v: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(v || 0)));
}

export function rebootPayload(target: RebootTarget): Uint8Array {
  return new Uint8Array([target]);
}

// LED (§3.7): [target u8][mode u8][level u8].
export function ledPayload(target: LedTarget, mode: LedMode, level: number): Uint8Array {
  return new Uint8Array([target, mode, level & 0xff]);
}

// LOCK (§3.8): [class u8][id u16 LE][direction u8][scale u8]. scale is the percent of the physical
// value the box keeps: LOCK_SCALE_BLOCK blocks it, LOCK_SCALE_PASS passes it untouched, above that
// amplifies to LOCK_SCALE_MAX (2.55x). Locking and unlocking are its two ends. id is class-specific
// (axis id / button id / keyboard usage / media usage; LOCK_ID_ALL for a blanket).
//
// A delta picks up at most two scales, its absolute direction's and its bearing-relative one's, and
// they multiply, so a block in either zeroes the delta. Direction.With / .Against need a live bearing (§3.12).
// Direction.Both is the exception: it writes `scale` to the two fixed signs and a full PASS to the
// relative pair, so a Both of 50 means 50% whether or not a bearing is live rather than squaring to
// 25% when one is. It is still a total clear, since a Both of PASS returns all four slots to passing.
export function lockPayload(
  cls: LockClass,
  id: number,
  direction: Direction,
  scale: number,
): Uint8Array {
  const s = Math.max(0, Math.min(LOCK_SCALE_MAX, Math.round(scale)));
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, direction, s]);
}

// CATCH (§3.9): [class u8][id u16 LE][dir u8][state u8][capture u8]. One table entry, addressed the
// same way a LOCK is: class 0xFF is every class and id 0xFFFF every id in the class. state 1
// subscribes, 0 unsubscribes; the all-classes wildcard with state 0 clears the whole table in one
// frame. capture caps the bytes taken per event, 0 meaning the whole packet.
export function catchPayload(
  cls: CatchClass,
  id: number,
  dir: Direction,
  state: number,
  capture = 0,
): Uint8Array {
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, dir, state & 0xff, capture & 0xff]);
}

// OPTION(IMPERFECT) (§3.10): [id=0][allow u8] - 1 opts into cloning an over-capacity device, 0 is
// faithful-only (default). Persisted in NVS; takes effect on the next clone.
export function imperfectPayload(allow: boolean): Uint8Array {
  return new Uint8Array([OPT_IMPERFECT, allow ? 1 : 0]);
}

// OPTION(MOVE_RIDE) (§3.10): [id=1][timeout u16 LE ms] - 0 = off; N = injected motion only rides a
// native cursor-motion report within an N ms window (no synthetic motion frames). Persisted in NVS.
export function moveRidePayload(timeoutMs: number): Uint8Array {
  const ms = Math.max(0, Math.min(0xffff, Math.round(timeoutMs)));
  return new Uint8Array([OPT_MOVE_RIDE, ms & 0xff, (ms >> 8) & 0xff]);
}

// OPTION(BEARING) (§3.10): [id=4][window u16 LE ms][mode u8] - what the With/Against lock directions
// are measured against (§3.12). window is how long the last injected delta's direction stays the
// bearing on that axis; 0 turns it off, leaving both directions inert whatever their scale. mode 0
// reads each axis's own sign, mode 1 projects the delta onto the injected XY vector. Persisted in NVS.
export function bearingPayload(windowMs: number, mode: BearingMode): Uint8Array {
  const ms = Math.max(0, Math.min(0xffff, Math.round(windowMs)));
  return new Uint8Array([OPT_BEARING, ms & 0xff, (ms >> 8) & 0xff, mode & 0xff]);
}

// OPTION(EMIT) (§3.10): [id=2][mode u8][rate_hz u16 LE][force_hz u16 LE]. mode is the pace (0 learned,
// 1 follows the cloned poll rate, 2 fixed rate_hz). forceHz is the rate the clone advertises and the box
// polls the device at, 0 for native ; it needs IMPERFECT on and re-clones the box when the
// resolved interval changes. Both are written every call.
export function emitPayload(mode: EmitMode, rateHz = 0, forceHz = 0): Uint8Array {
  const hz = Math.max(0, Math.min(0xffff, Math.round(rateHz)));
  const fhz = Math.max(0, Math.min(0xffff, Math.round(forceHz)));
  return new Uint8Array([
    OPT_EMIT,
    mode & 0xff,
    hz & 0xff,
    (hz >> 8) & 0xff,
    fhz & 0xff,
    (fhz >> 8) & 0xff,
  ]);
}

// OPTION(RENDER) (§3.10): [id=5][mode u8][full u8]. mode is the texture motion is rendered with; full puts
// native motion through the same model rather than relaying it. Both are written every call.
export function renderPayload(mode: RenderMode, full: boolean): Uint8Array {
  return new Uint8Array([OPT_RENDER, mode & 0xff, full ? 1 : 0]);
}

// OPTION(SPREAD) (§3.10): [id=6][percent u16 LE]. The share of the interval between commands an
// injected delta is released across; 0 puts the whole delta on the next report the box emits.
export function spreadPayload(percent: number): Uint8Array {
  const p = percent & 0xffff;
  return new Uint8Array([OPT_SPREAD, p & 0xff, p >> 8]);
}

// OPTION(NAME) (§3.10): [id=3][name ascii 1..32]. 1..32 printable ASCII bytes set the box's name; the
// id alone (0 value bytes) clears it, reverting to the firmware-synthesised "Medius-XXXX" default. The
// name is read back on RESP(VERSION), not Q_OPTIONS. Persisted in NVS. Non-ASCII/out-of-range bytes are
// dropped so only a valid name is ever sent.
export function namePayload(name: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e) bytes.push(c);
    if (bytes.length >= NAME_MAX) break;
  }
  return new Uint8Array([OPT_NAME, ...bytes]);
}

// OPTION(NAME) clear (§3.10): the id alone, no value bytes, reverting to the synthesised default.
export function clearNamePayload(): Uint8Array {
  return new Uint8Array([OPT_NAME]);
}

// INJECT (§3.2): [class u8][id u16 LE][action u8]. class 0 button / 1 key / 2 media; tri-state action.
export function injectPayload(cls: number, id: number, action: number): Uint8Array {
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, action & 0xff]);
}

// CLIP_APPEND (§3.11): a back-to-back run of encoded entries, no count and no separators, so the
// box parses them by walking the tags. Returns null if any entry is unencodable, because a partial
// append would land as a valid but wrong clip rather than being rejected.
export function clipAppendPayload(entries: ClipEntry[]): Uint8Array | null {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const e of entries) {
    const b = encodeClipEntry(e);
    if (!b) return null;
    parts.push(b);
    total += b.length;
  }
  if (total === 0 || total > MAX_PAYLOAD) return null;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// CLIP_CTRL (§3.11): [op u8], one engine verb.
export function clipCtrlPayload(op: ClipOp): Uint8Array {
  return new Uint8Array([op & 0xff]);
}

// CLIP_SET (§3.11): [id u8][value u8], one whole-value scalar write.
export function clipSetPayload(id: number, value: number): Uint8Array {
  return new Uint8Array([id & 0xff, value & 0xff]);
}

// CLIP_TRIGGER (§3.11): [class u8][id u16 LE][edge u8][action u8][flags u8]. Keyed by
// (class, id, edge); clearing PRESENT removes that binding, and `action` is ignored on a removal.
export function clipTriggerPayload(t: ClipTrigger, present: boolean): Uint8Array {
  const flags = (present ? CLIP_TRIG_F_PRESENT : 0) | (t.consume ? CLIP_TRIG_F_CONSUME : 0);
  return new Uint8Array([t.cls, t.id & 0xff, (t.id >> 8) & 0xff, t.edge, t.action, flags]);
}
