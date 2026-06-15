// Typed response/event decoders (box -> PC).

import { Q_HEALTH, Q_VERSION } from './opcode';
import {
  type Health,
  type LogLine,
  type Version,
  LogLevel,
  healthFromFlags,
  logLevelFromU8,
} from './types';

export type Resp =
  | { kind: 'version'; version: Version }
  | { kind: 'health'; health: Health };

// Parse a RESP payload: [what u8][data..].
export function parseResp(payload: Uint8Array): Resp | null {
  if (payload.length < 1) return null;
  const what = payload[0];
  switch (what) {
    case Q_VERSION:
      if (payload.length < 5) return null;
      return {
        kind: 'version',
        version: {
          protoVer: payload[1],
          fwMajor: payload[2],
          fwMinor: payload[3],
          fwPatch: payload[4],
        },
      };
    case Q_HEALTH:
      if (payload.length < 2) return null;
      return { kind: 'health', health: healthFromFlags(payload[1]) };
    default:
      return null;
  }
}

const logDecoder = new TextDecoder('utf-8', { fatal: false });

// Parse a LOG payload: [level u8][text UTF-8 (LEN-1)].
export function parseLog(payload: Uint8Array): LogLine {
  if (payload.length === 0) {
    return { level: LogLevel.Info, text: '' };
  }
  return {
    level: logLevelFromU8(payload[0]),
    text: logDecoder.decode(payload.subarray(1)),
  };
}
