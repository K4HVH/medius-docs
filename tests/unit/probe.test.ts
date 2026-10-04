import { describe, it, expect } from 'vitest';
import {
  BadProtoVerError,
  NoReplyError,
  probePort,
  probeVerdict,
  type Probe,
  type SerialLink,
} from '../../src/dashboard/serial';
import { DeviceKind, MIN_PROTO_VER, PROTO_VER, type DeviceInfo, type Version } from '../../src/dashboard/protocol';

const version = (protoVer: number): Version => ({
  protoVer,
  fwMajor: 3,
  fwMinor: 4,
  fwPatch: 4,
  mac: [1, 2, 3, 4, 5, 6],
  name: 'Desk',
});

const device: DeviceInfo = {
  vid: 0x046d,
  pid: 0xc08b,
  bcdDevice: 0x0100,
  bcdUsb: 0x0200,
  hasSerial: true,
  hasBos: false,
  kind: DeviceKind.Mouse,
  product: 'G502',
};

interface Box {
  openError?: Error;
  baud?: number;
  version?: Version;
  device?: DeviceInfo | Error;
  log: string[];
}

class FakeLink {
  private baud = 0;
  constructor(private readonly box: Box) {}
  async open(baud: number) {
    this.box.log.push(`open ${baud}`);
    if (this.box.openError) throw this.box.openError;
    this.baud = baud;
  }
  async handshake() {
    const v = this.box.version;
    if (!v || this.baud !== this.box.baud) throw new NoReplyError();
    if (v.protoVer < MIN_PROTO_VER || v.protoVer > PROTO_VER) throw new BadProtoVerError(v);
    return v;
  }
  async queryDeviceInfo() {
    this.box.log.push('deviceInfo');
    if (this.box.device instanceof Error) throw this.box.device;
    return this.box.device!;
  }
  async close() {
    this.box.log.push('close');
  }
}

const probe = (box: Box): Promise<Probe> =>
  probePort(box as unknown as SerialPort, (p) => new FakeLink(p as unknown as Box) as unknown as SerialLink);

describe('probePort', () => {
  it('a box on the current wire carries its version, cloned device and rate, and is closed', async () => {
    const box: Box = { baud: 6_000_000, version: version(PROTO_VER), device, log: [] };
    expect(await probe(box)).toEqual({ kind: 'box', version: version(PROTO_VER), device, baud: 6_000_000 });
    expect(box.log.at(-1)).toBe('close');
  });

  it('a box on an older wire in range carries no device and is not asked for one', async () => {
    const box: Box = { baud: 4_000_000, version: version(MIN_PROTO_VER), device, log: [] };
    expect(await probe(box)).toEqual({ kind: 'box', version: version(MIN_PROTO_VER), device: null, baud: 4_000_000 });
    expect(box.log).not.toContain('deviceInfo');
    expect(box.log.at(-1)).toBe('close');
  });

  it('a failed device read leaves the device unknown, not the probe failed', async () => {
    const box: Box = { baud: 6_000_000, version: version(PROTO_VER), device: new Error('timeout'), log: [] };
    expect(await probe(box)).toMatchObject({ kind: 'box', device: null });
    expect(box.log.at(-1)).toBe('close');
  });

  it('below the floor is old-firmware with its version', async () => {
    const box: Box = { baud: 6_000_000, version: version(MIN_PROTO_VER - 1), log: [] };
    expect(await probe(box)).toEqual({ kind: 'old-firmware', version: version(MIN_PROTO_VER - 1) });
  });

  it('above the page is new-firmware with its version', async () => {
    const box: Box = { baud: 6_000_000, version: version(PROTO_VER + 1), log: [] };
    expect(await probe(box)).toEqual({ kind: 'new-firmware', version: version(PROTO_VER + 1) });
  });

  it('a port that will not open is busy', async () => {
    const box: Box = { openError: new DOMException('The port is already open.', 'InvalidStateError'), log: [] };
    expect(await probe(box)).toEqual({ kind: 'busy' });
  });

  it('no reply at either rate is silent', async () => {
    const box: Box = { log: [] };
    expect(await probe(box)).toEqual({ kind: 'silent' });
    expect(box.log.filter((l) => l.startsWith('open'))).toEqual(['open 6000000', 'open 4000000']);
  });

  it('anything else is other, with its message', async () => {
    const box: Box = { openError: new Error('the adapter caught fire'), log: [] };
    expect(await probe(box)).toEqual({ kind: 'other', message: 'the adapter caught fire' });
  });
});

describe('probeVerdict', () => {
  it('maps every result that is not a box to the verdict a failed connect gives', () => {
    expect(probeVerdict(null)).toBeNull();
    expect(probeVerdict({ kind: 'box', version: version(PROTO_VER), device: null, baud: 6_000_000 })).toBeNull();
    expect(probeVerdict({ kind: 'busy' })).toEqual({ kind: 'busy' });
    expect(probeVerdict({ kind: 'silent' })).toEqual({ kind: 'silent' });
    expect(probeVerdict({ kind: 'old-firmware', version: version(4) })).toEqual({ kind: 'old-firmware', version: version(4) });
    expect(probeVerdict({ kind: 'new-firmware', version: version(99) })).toEqual({ kind: 'new-firmware', version: version(99) });
    expect(probeVerdict({ kind: 'other', message: 'x' })).toEqual({ kind: 'other', message: 'x' });
  });
});
