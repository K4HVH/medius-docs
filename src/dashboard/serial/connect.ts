/// <reference types="w3c-web-serial" />
// A failed connect, as one verdict.

import { PROTO_VER, type Version } from '../protocol';
import { BadProtoVerError, NoReplyError } from './link';

export type ConnectVerdict =
  | { kind: 'unsupported' }
  | { kind: 'insecure' }
  | { kind: 'no-port' }
  | { kind: 'busy' }
  | { kind: 'silent' }
  | { kind: 'needs-click' }
  | { kind: 'old-firmware'; version: Version }
  | { kind: 'new-firmware'; version: Version }
  | { kind: 'other'; message: string };

const nameOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';

export function classifyConnectError(e: unknown): ConnectVerdict {
  try {
    return classify(e);
  } catch {
    // A thrown value can be hostile: a null prototype, a throwing getter, a Proxy refusing instanceof.
    return { kind: 'other', message: 'The browser gave no reason' };
  }
}

function classify(e: unknown): ConnectVerdict {
  if (e instanceof BadProtoVerError) {
    const kind = e.version.protoVer > PROTO_VER ? 'new-firmware' : 'old-firmware';
    return { kind, version: e.version };
  }
  if (e instanceof NoReplyError) return { kind: 'silent' };
  // Keyed on `name`: a browser DOMException's message is bare text, so only the name survives.
  const name = nameOf(e);
  const message = e instanceof Error ? e.message : String(e);
  if (name === 'NotFoundError') return { kind: 'no-port' };
  if (name === 'NetworkError' || name === 'InvalidStateError') return { kind: 'busy' };
  if (/already open|failed to open|access denied/i.test(message)) return { kind: 'busy' };
  // Two SecurityErrors: expired transient activation, which one more click fixes, and a permissions
  // policy block, which it doesn't.
  if (name === 'SecurityError' && !/policy|disallow/i.test(message)) return { kind: 'needs-click' };
  return { kind: 'other', message: message || 'The browser gave no reason' };
}
