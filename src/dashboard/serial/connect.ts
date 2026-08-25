/// <reference types="w3c-web-serial" />
// One connect attempt, one verdict. Free of the DOM and of SerialLink so every branch is reachable
// from a test: the caller supplies how to list, choose, open and close a port.

import type { Version } from '../protocol';
import { BadProtoVerError, NoReplyError } from './link';

export type ConnectVerdict =
  | { kind: 'unsupported' }
  | { kind: 'insecure' }
  | { kind: 'no-port' }
  | { kind: 'busy' }
  | { kind: 'silent' }
  | { kind: 'old-firmware'; version: Version }
  | { kind: 'other'; message: string };

export interface ConnectDeps<L> {
  supported: () => boolean;
  secure: () => boolean;
  granted: () => Promise<SerialPort[]>;
  choose: () => Promise<SerialPort>;
  attach: (port: SerialPort) => Promise<{ link: L; version: Version }>;
  detach: (port: SerialPort) => Promise<void>;
}

export type ConnectOutcome<L> =
  | { ok: true; port: SerialPort; link: L; version: Version }
  | { ok: false; verdict: ConnectVerdict };

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

export function classifyConnectError(e: unknown): ConnectVerdict {
  if (e instanceof BadProtoVerError) return { kind: 'old-firmware', version: e.version };
  if (e instanceof NoReplyError) return { kind: 'silent' };
  if (isUserCancel(e)) return { kind: 'no-port' };
  const message = e instanceof Error ? e.message : String(e);
  if (/already open|failed to open|access denied|networkerror/i.test(message)) {
    return { kind: 'busy' };
  }
  return { kind: 'other', message };
}

export async function attemptConnect<L>(deps: ConnectDeps<L>): Promise<ConnectOutcome<L>> {
  if (!deps.supported()) return { ok: false, verdict: { kind: 'unsupported' } };
  if (!deps.secure()) return { ok: false, verdict: { kind: 'insecure' } };

  for (const p of await deps.granted()) {
    try {
      const { link, version } = await deps.attach(p);
      return { ok: true, port: p, link, version };
    } catch (e) {
      await deps.detach(p);
      const verdict = classifyConnectError(e);
      // A grant that will not open is either a box that is not on this machine or one another page
      // holds, and Web Serial words both the same way, so fall through and let the chooser settle
      // it. A port that DID open has answered about this box, and that answer stands.
      if (verdict.kind !== 'busy' && verdict.kind !== 'other') return { ok: false, verdict };
    }
  }

  let picked: SerialPort;
  try {
    picked = await deps.choose();
  } catch (e) {
    return { ok: false, verdict: classifyConnectError(e) };
  }
  try {
    const { link, version } = await deps.attach(picked);
    return { ok: true, port: picked, link, version };
  } catch (e) {
    await deps.detach(picked);
    return { ok: false, verdict: classifyConnectError(e) };
  }
}
