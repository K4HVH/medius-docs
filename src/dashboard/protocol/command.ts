// Command payload builders (PC -> box).

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

// LOCK (§3.8): [class u8][usage u16 LE][direction u8][state u8]. state 0 = unlock, 1 = lock.
// usage is class-specific (mouse target / keyboard usage / media usage; ignored for blanket classes).
export function lockPayload(
  cls: LockClass,
  usage: number,
  direction: LockDirection,
  state: number,
): Uint8Array {
  return new Uint8Array([cls, usage & 0xff, (usage >> 8) & 0xff, direction, state & 0xff]);
}

// CATCH (§3.9): [mask u8] - subscribe to physical-input event classes (0 = unsubscribe).
export function catchPayload(mask: number): Uint8Array {
  return new Uint8Array([mask & 0xff]);
}

// IMPERFECT (§3.10): [allow u8] - 1 opts into cloning an over-capacity device, 0 is faithful-only
// (default). Persisted in NVS; takes effect on the next clone.
export function imperfectPayload(allow: boolean): Uint8Array {
  return new Uint8Array([allow ? 1 : 0]);
}

// INJECT (§3.2): [class u8][id u16 LE][action u8]. class 0 button / 1 key / 2 media; tri-state action.
export function injectPayload(cls: number, id: number, action: number): Uint8Array {
  return new Uint8Array([cls, id & 0xff, (id >> 8) & 0xff, action & 0xff]);
}
