/// <reference types="w3c-web-serial" />
// One connect attempt, one verdict.

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

export interface ConnectDeps<L> {
  supported: () => boolean;
  secure: () => boolean;
  granted: () => Promise<SerialPort[]>;
  choose: () => Promise<SerialPort>;
  attach: (port: SerialPort) => Promise<{ link: L; version: Version }>;
}

export type ConnectOutcome<L> =
  | { ok: true; port: SerialPort; link: L; version: Version }
  | { ok: false; verdict: ConnectVerdict };

// How much a failure says about the box: a port that opened and answered wrongly, or not at all, is
// this device; one that wouldn't open says nothing.
const TELLS_US: Record<ConnectVerdict['kind'], number> = {
  'old-firmware': 4,
  'new-firmware': 4,
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
    // A thrown value can be hostile: a null prototype, a throwing getter, a Proxy refusing instanceof.
    return { kind: 'other', message: 'the browser gave no reason' };
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
  return { kind: 'other', message: message || 'the browser gave no reason' };
}

const better = (a: ConnectVerdict | null, b: ConnectVerdict): ConnectVerdict =>
  a && TELLS_US[a.kind] >= TELLS_US[b.kind] ? a : b;

// `skipGranted` goes straight to the chooser, so a retry escapes a remembered silent CH343 that is
// the wrong device.
export async function attemptConnect<L>(
  deps: ConnectDeps<L>,
  opts: { skipGranted?: boolean } = {},
): Promise<ConnectOutcome<L>> {
  if (!deps.supported()) return { ok: false, verdict: { kind: 'unsupported' } };
  if (!deps.secure()) return { ok: false, verdict: { kind: 'insecure' } };

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
        best = better(best, classifyConnectError(e));
      }
    }
    // An opened port has answered for this box; report that rather than reopen the chooser.
    if (best && (best.kind === 'old-firmware' || best.kind === 'new-firmware' || best.kind === 'silent')) {
      return { ok: false, verdict: best };
    }
  }

  let picked: SerialPort;
  try {
    picked = await deps.choose();
  } catch (e) {
    const verdict = classifyConnectError(e);
    // An empty or cancelled chooser says less than a grant that failed to open.
    if (verdict.kind === 'no-port' && best) return { ok: false, verdict: best };
    return { ok: false, verdict };
  }
  try {
    const { link, version } = await deps.attach(picked);
    return { ok: true, port: picked, link, version };
  } catch (e) {
    return { ok: false, verdict: classifyConnectError(e) };
  }
}
