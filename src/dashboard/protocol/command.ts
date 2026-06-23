// Command payload builders (PC -> box).

import { LedMode, LedTarget, LockDirection, LockTarget, RebootTarget } from './types';

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

// LOCK (§3.8): [target u8][direction u8][state u8]. state 0 = unlock, 1 = lock.
export function lockPayload(
  target: LockTarget,
  direction: LockDirection,
  state: number,
): Uint8Array {
  return new Uint8Array([target, direction, state & 0xff]);
}

// CATCH (§3.9): [mask u8] - subscribe to physical-input event classes (0 = unsubscribe).
export function catchPayload(mask: number): Uint8Array {
  return new Uint8Array([mask & 0xff]);
}

// KEY (§3.10): [usage u8][action u8]. usage is a HID keycode (0xE0-0xE7 is a modifier).
export function keyPayload(usage: number, action: number): Uint8Array {
  return new Uint8Array([usage & 0xff, action & 0xff]);
}

// CONSUMER (§3.11): [usage u16 LE][action u8]. usage is a 16-bit Consumer (media-key) usage.
export function consumerPayload(usage: number, action: number): Uint8Array {
  return new Uint8Array([usage & 0xff, (usage >> 8) & 0xff, action & 0xff]);
}
