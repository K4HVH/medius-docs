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
  | { kind: 'needs-click' }
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

// How much a failure tells us about the box itself. A port that opened and then answered wrongly,
// or not at all, is talking about this device. One that would not open says nothing about it.
const TELLS_US: Record<ConnectVerdict['kind'], number> = {
  'old-firmware': 4,
  silent: 3,
  'needs-click': 2,
  busy: 2,
  other: 1,
  'no-port': 0,
  unsupported: 0,
  insecure: 0,
};

const nameOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';

export function classifyConnectError(e: unknown): ConnectVerdict {
  try {
    return classify(e);
  } catch {
    // A thrown value can be hostile all the way down: a null prototype, a getter that throws, a
    // Proxy that refuses instanceof. None of that may cost the page its only way forward.
    return { kind: 'other', message: 'the browser gave no reason' };
  }
}

function classify(e: unknown): ConnectVerdict {
  if (e instanceof BadProtoVerError) return { kind: 'old-firmware', version: e.version };
  if (e instanceof NoReplyError) return { kind: 'silent' };
  // Keyed on `name`, not on `instanceof DOMException`: a DOMException inherits from Error in a
  // browser, so its message is the bare text and the name is the only thing that survives.
  const name = nameOf(e);
  const message = e instanceof Error ? e.message : String(e);
  if (name === 'NotFoundError') return { kind: 'no-port' };
  if (name === 'NetworkError' || name === 'InvalidStateError') return { kind: 'busy' };
  if (/already open|failed to open|access denied/i.test(message)) return { kind: 'busy' };
  // Two different SecurityErrors: transient activation expiring, which one more click fixes, and a
  // permissions policy that blocks the feature outright, which it does not.
  if (name === 'SecurityError' && !/policy|disallow/i.test(message)) return { kind: 'needs-click' };
  return { kind: 'other', message: message || 'the browser gave no reason' };
}

const better = (a: ConnectVerdict | null, b: ConnectVerdict): ConnectVerdict =>
  a && TELLS_US[a.kind] >= TELLS_US[b.kind] ? a : b;

/**
 * Try to reach a box. `skipGranted` goes straight to the chooser, which is how a retry escapes a
 * granted port that is the wrong device: without it a single silent CH343 the browser remembers
 * would answer every future attempt and the real box could never be picked.
 */
export async function attemptConnect<L>(
  deps: ConnectDeps<L>,
  opts: { skipGranted?: boolean } = {},
): Promise<ConnectOutcome<L>> {
  if (!deps.supported()) return { ok: false, verdict: { kind: 'unsupported' } };
  if (!deps.secure()) return { ok: false, verdict: { kind: 'insecure' } };

  const drop = async (port: SerialPort) => {
    try {
      await deps.detach(port);
    } catch {
      // A port that will not let go is not a reason to abandon the attempt.
    }
  };

  let best: ConnectVerdict | null = null;

  if (!opts.skipGranted) {
    let ports: SerialPort[] = [];
    try {
      ports = await deps.granted();
    } catch {
      // Listing can reject on a page the browser has parked. Fall through to the chooser.
      ports = [];
    }
    for (const p of ports) {
      try {
        const { link, version } = await deps.attach(p);
        return { ok: true, port: p, link, version };
      } catch (e) {
        await drop(p);
        best = better(best, classifyConnectError(e));
      }
    }
    // A port that opened has answered about this box. Report that rather than making someone who
    // has one box pick it out of a dialog again.
    if (best && (best.kind === 'old-firmware' || best.kind === 'silent')) {
      return { ok: false, verdict: best };
    }
  }

  let picked: SerialPort;
  try {
    picked = await deps.choose();
  } catch (e) {
    const verdict = classifyConnectError(e);
    // An empty chooser and a cancelled one are the same error, and both say less than a grant that
    // failed to open. Keep the better answer.
    if (verdict.kind === 'no-port' && best) return { ok: false, verdict: best };
    return { ok: false, verdict };
  }
  try {
    const { link, version } = await deps.attach(picked);
    return { ok: true, port: picked, link, version };
  } catch (e) {
    await drop(picked);
    return { ok: false, verdict: classifyConnectError(e) };
  }
}
