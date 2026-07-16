// Command payload builders (PC -> box).

import { EmitMode, NAME_MAX, OPT_EMIT, OPT_IMPERFECT, OPT_MOVE_RIDE, OPT_NAME } from './opcode';
import { LedMode, LedTarget, LockClass, LockDirection, RebootTarget } from './types';

export function queryPayload(what: number): Uint8Array {
  return new Uint8Array([what]);
}

export function rebootPayload(target: RebootTarget): Uint8Array {
  return new Uint8Array([target]);
}

// LED (§3.7): [target u8][mode u8][level u8].
export function ledPayload(target: LedTarget, mode: LedMode, level: number): Uint8Array {
  return new Uint8Array([target, mode, level & 0xff]);
}

// LOCK (§3.8): [class u8][id u16 LE][direction u8][state u8]. state 0 = unlock, 1 = lock. id is
// class-specific (axis id / button id / keyboard usage / media usage; LOCK_ID_ALL for a blanket).
export function lockPayload(
  cls: LockClass,
  id: number,
  direction: LockDirection,
  state: number,
): Uint8Array {
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, direction, state & 0xff]);
}

// CATCH (§3.9): [mask u8] - subscribe to physical-input event classes (0 = unsubscribe).
export function catchPayload(mask: number): Uint8Array {
  return new Uint8Array([mask & 0xff]);
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

// OPTION(EMIT) (§3.10): [id=2][mode u8][rate_hz u16 LE] - emit-rate pacing. mode 0 learned (default), 1
// follows the cloned poll rate, 2 paces at a fixed rate_hz. rate_hz only matters in fixed mode; the box
// snaps it to 1000/n Hz and caps it at 1000. Raises the emit ceiling only. Persisted in NVS.
export function emitPayload(mode: EmitMode, rateHz = 0): Uint8Array {
  const hz = Math.max(0, Math.min(0xffff, Math.round(rateHz)));
  return new Uint8Array([OPT_EMIT, mode & 0xff, hz & 0xff, (hz >> 8) & 0xff]);
}

// OPTION(NAME) (§3.10): [id=3][name ascii 1..32]. 1..32 printable ASCII bytes set the box's name; the
// id alone (0 value bytes) clears it, reverting to the firmware-synthesized "Medius-XXXX" default. The
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

// OPTION(NAME) clear (§3.10): the id alone, no value bytes, reverting to the synthesized default.
export function clearNamePayload(): Uint8Array {
  return new Uint8Array([OPT_NAME]);
}

// INJECT (§3.2): [class u8][id u16 LE][action u8]. class 0 button / 1 key / 2 media; tri-state action.
export function injectPayload(cls: number, id: number, action: number): Uint8Array {
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, action & 0xff]);
}
