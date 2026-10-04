/// <reference types="w3c-web-serial" />
// What is behind a port: open, handshake, read the cloned device, close.

import type { DeviceInfo, Version } from '../protocol';
import { type ConnectVerdict, classifyConnectError } from './connect';
import { SerialLink, attachLink, speaksCurrentWire } from './link';

export type Probe =
  | { kind: 'box'; version: Version; device: DeviceInfo | null; baud: number }
  | { kind: 'old-firmware' | 'new-firmware'; version: Version }
  | { kind: 'busy' }
  | { kind: 'silent' }
  | { kind: 'other'; message: string };

export function probeFromError(e: unknown): Probe {
  const v = classifyConnectError(e);
  if (v.kind === 'old-firmware' || v.kind === 'new-firmware') return v;
  if (v.kind === 'busy' || v.kind === 'silent') return { kind: v.kind };
  return { kind: 'other', message: v.kind === 'other' ? v.message : 'The port went away' };
}

export async function probePort(
  port: SerialPort,
  make: (port: SerialPort) => SerialLink = (p) => new SerialLink(p),
): Promise<Probe> {
  let attached: Awaited<ReturnType<typeof attachLink>>;
  try {
    attached = await attachLink(port, make);
  } catch (e) {
    return probeFromError(e);
  }
  const { link, version, baud } = attached;
  const device = speaksCurrentWire(version) ? await link.queryDeviceInfo().catch(() => null) : null;
  await link.close().catch(() => undefined);
  return { kind: 'box', version, device, baud };
}

export function probeVerdict(p: Probe | null): ConnectVerdict | null {
  if (!p || p.kind === 'box') return null;
  return p.kind === 'busy' || p.kind === 'silent' ? { kind: p.kind } : p;
}
