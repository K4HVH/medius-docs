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
