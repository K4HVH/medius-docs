// Command payload builders (PC -> box).

import {
  CLIP_COND_ANY_CLASS,
  CLIP_COND_ANY_ID,
  CLIP_TRIG_F_CONSUME,
  CLIP_TRIG_F_PRESENT,
  CLIP_TRIG_F_RUN,
  ClipOp,
  EmitMode,
  RenderMode,
  MAX_PAYLOAD,
  MOTION_CURSOR,
  MOTION_WHEEL,
  MOTION_PAN,
  NAME_MAX,
  OPT_BEARING,
  OPT_EMIT,
  OPT_RENDER,
  OPT_SPREAD,
  OPT_IMPERFECT,
  OPT_MOVE_RIDE,
  OPT_NAME,
  PATCH_APPLY,
  PATCH_CLEAR,
  PatchSection,
  TransformOp,
} from './opcode';
import {
  type ClipEntry,
  type ClipPacketTrigger,
  type ClipTrigger,
  type RewriteRule,
  type Transform,
  BearingMode,
  CatchClass,
  CATCH_ID_ANY,
  Direction,
  LedMode,
  LOCK_SCALE_MAX,
  LOCK_SCALE_MIN,
  LedTarget,
  LockClass,
  RebootTarget,
  clipPacketKeyFault,
  clipPacketTriggerFault,
  encodeClipEntry,
} from './types';

export function queryPayload(what: number): Uint8Array {
  return new Uint8Array([what]);
}

// MOVE cursor (§3.1): [motion=0][dx i16 LE][dy i16 LE][flags].
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

// MOVE pan (§3.1): [motion=2][dpan i16 LE][flags]. AC Pan, same carry behaviour as the wheel.
export function movePanPayload(dpan: number, flags = 0): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = MOTION_PAN;
  new DataView(out.buffer).setInt16(1, clampI16(dpan), true);
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

// LOCK (§3.8): [class u8][id u16 LE][direction u8][scale i16 LE].
export function lockPayload(
  cls: LockClass,
  id: number,
  direction: Direction,
  scale: number,
): Uint8Array {
  const s = Math.max(LOCK_SCALE_MIN, Math.min(LOCK_SCALE_MAX, Math.round(scale)));
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, direction, s & 0xff, (s >> 8) & 0xff]);
}

// CATCH (§3.9): [class u8][id u16 LE][dir u8][state u8][capture u8]. One table entry, addressed the
// same way a LOCK is: class 0xFF is every class and id 0xFFFF every id in the class.
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

// OPTION(BEARING) (§3.10): [id=4][window u16 LE ms][mode u8] - what the With/Against lock
// directions are measured against (§3.12).
export function bearingPayload(windowMs: number, mode: BearingMode): Uint8Array {
  const ms = Math.max(0, Math.min(0xffff, Math.round(windowMs)));
  return new Uint8Array([OPT_BEARING, ms & 0xff, (ms >> 8) & 0xff, mode & 0xff]);
}

// OPTION(EMIT) (§3.10): [id=2][mode u8][rate_hz u16 LE][force_hz u16 LE]. mode is the pace (0
// learned, 1 follows the cloned poll rate, 2 fixed rate_hz).
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

// OPTION(NAME) (§3.10): [id=3][name ascii 1..32].
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
// box parses them by walking the tags.
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

// CLIP_TRIGGER with a traffic class (§3.11), a packet trigger: [class u8][id u16 LE][dir u8][action
// u8] [flags u8][slen u8][mlen u8][match mlen][mask mlen].
export function clipPacketTriggerPayload(t: ClipPacketTrigger, present: boolean): Uint8Array | null {
  if ((present ? clipPacketTriggerFault(t) : clipPacketKeyFault(t)) !== null) return null;
  const mlen = t.match.length;
  const flags = present
    ? CLIP_TRIG_F_PRESENT | (t.consume ? CLIP_TRIG_F_CONSUME : 0) | (t.oncePerRun ? CLIP_TRIG_F_RUN : 0)
    : 0;
  const out = new Uint8Array(8 + 2 * mlen);
  out[0] = t.cls;
  out[1] = t.id & 0xff;
  out[2] = (t.id >> 8) & 0xff;
  out[3] = t.dir;
  out[4] = present ? t.action : 0;
  out[5] = flags;
  out[6] = present ? t.selectorLen : 0;
  out[7] = mlen;
  out.set(t.match, 8);
  out.set(t.mask, 8 + mlen);
  return out;
}

// CLIP_TRIGGER clear (§3.11): the any-class, any-id, both-edges, flags-0 sentinel clears the input
// bindings and the packet triggers in one frame.
export function clearClipTriggersPayload(): Uint8Array {
  return new Uint8Array([CLIP_COND_ANY_CLASS, CLIP_COND_ANY_ID & 0xff, CLIP_COND_ANY_ID >> 8, Direction.Both, 0, 0]);
}

// RAW (§3.14): [ep_num u8][dir u8][bytes...].
export function rawPayload(epNum: number, dir: number, bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(2 + bytes.length);
  out[0] = epNum & 0x0f;
  out[1] = dir & 0xff;
  out.set(bytes, 2);
  return out;
}

// TRANSFER (§3.14): [ep u8][setup 8][OUT data..]. The setup packet is the 8 USB bytes
// [bmRequestType u8][bRequest u8][wValue u16 LE][wIndex u16 LE][wLength u16 LE].
export function transferPayload(
  ep: number,
  bmRequestType: number,
  bRequest: number,
  wValue: number,
  wIndex: number,
  wLength: number,
  out: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const buf = new Uint8Array(9 + out.length);
  buf[0] = ep & 0xff;
  buf[1] = bmRequestType & 0xff;
  buf[2] = bRequest & 0xff;
  const dv = new DataView(buf.buffer);
  dv.setUint16(3, wValue & 0xffff, true);
  dv.setUint16(5, wIndex & 0xffff, true);
  dv.setUint16(7, wLength & 0xffff, true);
  buf.set(out, 9);
  return buf;
}

// REWRITE (§3.14): [cls u8][id u16 LE][dir u8][state u8][action u8][off u16 LE][mlen u8][match
// mlen] [mask mlen][payload..].
export function rewritePayload(rule: RewriteRule, state: number): Uint8Array {
  const mlen = Math.min(rule.match.length, rule.mask.length);
  const head = new Uint8Array(9);
  head[0] = rule.cls & 0xff;
  const dv = new DataView(head.buffer);
  dv.setUint16(1, rule.id & 0xffff, true);
  head[3] = rule.dir & 0xff;
  head[4] = state & 0xff;
  head[5] = rule.action & 0xff;
  dv.setUint16(6, rule.off & 0xffff, true);
  head[8] = mlen & 0xff;
  const out = new Uint8Array(head.length + 2 * mlen + rule.payload.length);
  out.set(head, 0);
  out.set(rule.match.subarray(0, mlen), head.length);
  out.set(rule.mask.subarray(0, mlen), head.length + mlen);
  out.set(rule.payload, head.length + 2 * mlen);
  return out;
}

// REWRITE clear (§3.14): the any-class, any-id, state-0 sentinel clears the whole table in one frame.
export function clearRewritePayload(): Uint8Array {
  return rewritePayload(
    {
      cls: CatchClass.Any,
      id: CATCH_ID_ANY,
      dir: Direction.Both,
      action: 0,
      off: 0,
      match: new Uint8Array(0),
      mask: new Uint8Array(0),
      payload: new Uint8Array(0),
    },
    0,
  );
}

// PATCH (§3.14): [section u8][cfg u8][index u8][offset u16 LE][bytes..]. Overwrite bytes in a served
// descriptor; a zero-length `bytes` removes the patch at that (section, cfg, index, offset) key. The box
// stores it whether or not OPTION(IMPERFECT) is on, but applies it to the clone only under the opt-in.
export function patchPayload(
  section: PatchSection,
  cfg: number,
  index: number,
  offset: number,
  bytes: Uint8Array,
): Uint8Array {
  const buf = new Uint8Array(5 + bytes.length);
  buf[0] = section & 0xff;
  buf[1] = cfg & 0xff;
  buf[2] = index & 0xff;
  new DataView(buf.buffer).setUint16(3, offset & 0xffff, true);
  buf.set(bytes, 5);
  return buf;
}

// PATCH apply (§3.14): re-present the clone with the stored patch set (the game PC sees one replug).
export function patchApplyPayload(): Uint8Array {
  return new Uint8Array([PATCH_APPLY]);
}

// PATCH clear (§3.14): drop every patch for this device and re-present unpatched.
export function patchClearPayload(): Uint8Array {
  return new Uint8Array([PATCH_CLEAR]);
}

// QUERY for one full rewrite rule or descriptor patch by list index (§4.17): [what][index]. The reply
// still leads with `what`, so it correlates on that selector like every other RESP.
export function queryEntryPayload(what: number, index: number): Uint8Array {
  return new Uint8Array([what, index & 0xff]);
}

// TRANSFORM (§3.15): [op u8][sclass u8][sid u16 LE][dclass u8][did u16 LE][state u8]. state 1 adds
// or overwrites, 0 removes; an entry is keyed by (source, dest).
export function transformPayload(t: Transform, state: number): Uint8Array {
  const out = new Uint8Array(8);
  const dv = new DataView(out.buffer);
  out[0] = t.op & 0xff;
  out[1] = t.sclass & 0xff;
  dv.setUint16(2, t.sid & 0xffff, true);
  out[4] = t.dclass & 0xff;
  dv.setUint16(5, t.did & 0xffff, true);
  out[7] = state & 0xff;
  return out;
}

// TRANSFORM clear (§3.15): the any-class, any-id, state-0 sentinel drops the whole table in one frame.
export function clearTransformPayload(): Uint8Array {
  return transformPayload(
    { op: TransformOp.Remap, sclass: 0xff, sid: CATCH_ID_ANY, dclass: 0xff, did: CATCH_ID_ANY },
    0,
  );
}
