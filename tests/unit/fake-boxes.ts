// Boxes behind fake ports that fail the way Chromium does: one open per port per page, NetworkError
// for a port another tab or program holds, a failed read loop keeps the port until closed.

import {
  BadProtoVerError,
  NoReplyError,
  QueryTimeoutError,
  UnreadablePortError,
  canUpdate,
  type SerialLink,
  type SerialLinkEvents,
} from '../../src/dashboard/serial';
import type { SerialLike } from '../../src/app/pages/dashboard/boxes';
import { DeviceKind, PROTO_VER, type DeviceInfo, type Health, type Version } from '../../src/dashboard/protocol';

export interface FakeChip {
  major: number;
  minor: number;
  patch: number;
  slot: number;
  state: number;
}

// What an activate does: the chips staged boot their new images; they revert to the slot they ran; the
// box never answers again; the box refuses it.
export type ActivateOutcome = 'lands' | 'reverts' | 'gone' | 'throws';

export interface BoxOpts {
  mac?: number[];
  name?: string;
  protoVer?: number;
  baud?: number;
}

export const DEVICE: DeviceInfo = {
  vid: 0x046d,
  pid: 0xc08b,
  bcdDevice: 0x0100,
  bcdUsb: 0x0200,
  hasSerial: true,
  hasBos: false,
  kind: DeviceKind.Mouse,
  product: 'G502',
};

export class FakeBox {
  version: Version;
  baud: number;
  alive = true;
  // Held by another program.
  busy = false;
  // The port object, in whichever page, that has the device open.
  openedBy: FakePort | null = null;
  active: FakeLink | null = null;
  opens: number[] = [];
  closes = 0;
  // A second link over a port this page holds: always a bug in the code under test.
  doubleOpens = 0;
  leds: [number, number, number][] = [];
  healthQueries = 0;
  versionQueries = 0;
  locksQueries = 0;
  deviceQueries = 0;
  firmwareQueries = 0;
  device: DeviceInfo | null = DEVICE;
  gate: Promise<void> | null = null;
  // Opens, but every read fails: Chromium after another program left the tty's read minimum at 0.
  unreadable = false;
  // Holds staging alone, so a reconnect can finish while an update is stuck in it.
  stageGate: Promise<void> | null = null;
  firmware: { device: FakeChip; host: FakeChip | null } = {
    device: { major: 3, minor: 4, patch: 4, slot: 0, state: 2 },
    host: { major: 3, minor: 4, patch: 4, slot: 0, state: 2 },
  };
  // A FIRMWARE read goes unanswered.
  firmwareSilent = false;
  staged: number[] = [];
  onActivate: ActivateOutcome = 'lands';
  // The version a chip staged boots into when its activate lands.
  next: { device?: [number, number, number]; host?: [number, number, number] } = {};

  constructor(o: BoxOpts = {}) {
    this.version = {
      protoVer: o.protoVer ?? PROTO_VER,
      fwMajor: 3,
      fwMinor: 4,
      fwPatch: 4,
      mac: o.mac ?? [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01],
      name: o.name ?? 'Medius-EE01',
    };
    this.baud = o.baud ?? 6_000_000;
  }

  get mac(): string {
    return this.version.mac.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  get isOpen(): boolean {
    return this.openedBy !== null;
  }

  rename(name: string): void {
    this.version = { ...this.version, name };
  }

  drop(): void {
    this.active?.fail();
  }

  // Holds every handshake until the returned function is called.
  hold(): () => void {
    let release = () => {};
    this.gate = new Promise<void>((r) => (release = r));
    return () => {
      this.gate = null;
      release();
    };
  }
}

let ports = 0;

export class FakePort {
  readonly id = ++ports;
  open = false;
  constructor(
    public box: FakeBox | null,
    readonly info = { usbVendorId: 0x1a86, usbProductId: 0x55d3 },
  ) {}
  getInfo() {
    return this.info;
  }
}

export const asPort = (p: FakePort) => p as unknown as SerialPort;

const HEALTH = { linkUp: true, mouseAttached: true } as Health;

export class FakeLink {
  lastRxAt = 0;
  private baud = 0;
  private open_ = false;

  constructor(
    readonly port: FakePort,
    private readonly events: SerialLinkEvents = {},
  ) {}

  get serialPort(): SerialPort {
    return asPort(this.port);
  }

  private get box(): FakeBox {
    if (!this.port.box) throw new DOMException('The device has been lost.', 'NetworkError');
    return this.port.box;
  }

  private rx(): void {
    this.lastRxAt = Date.now();
  }

  async open(baud: number): Promise<void> {
    const b = this.box;
    b.opens.push(baud);
    if (this.port.open) {
      b.doubleOpens++;
      throw new TypeError('Failed to execute getWriter: Cannot create writer when WritableStream is locked');
    }
    if (b.busy || (b.openedBy && b.openedBy !== this.port)) {
      throw new DOMException('Failed to open serial port.', 'NetworkError');
    }
    this.port.open = true;
    b.openedBy = this.port;
    b.active = this;
    this.open_ = true;
    this.baud = baud;
  }

  async handshake(): Promise<Version> {
    const b = this.box;
    if (b.gate) await b.gate;
    if (b.unreadable) throw new UnreadablePortError();
    if (!this.open_ || !b.alive || this.baud !== b.baud) throw new NoReplyError();
    this.rx();
    if (!canUpdate(b.version)) throw new BadProtoVerError(b.version);
    return b.version;
  }

  private answer<T>(v: () => T): T {
    const b = this.box;
    if (!this.open_ || !b.alive || this.baud !== b.baud) throw new QueryTimeoutError();
    this.rx();
    return v();
  }

  async queryVersion(): Promise<Version> {
    this.box.versionQueries++;
    return this.answer(() => this.box.version);
  }

  async queryHealth(): Promise<Health> {
    this.box.healthQueries++;
    return this.answer(() => HEALTH);
  }

  async queryLocks() {
    this.box.locksQueries++;
    return this.answer(() => ({ entries: [] }));
  }

  async queryDeviceInfo(): Promise<DeviceInfo> {
    this.box.deviceQueries++;
    return this.answer(() => {
      if (!this.box.device) throw new QueryTimeoutError();
      return this.box.device;
    });
  }

  async queryFirmware() {
    this.box.firmwareQueries++;
    return this.answer(() => {
      const b = this.box;
      if (b.firmwareSilent) throw new QueryTimeoutError();
      return { device: { ...b.firmware.device }, host: b.firmware.host && { ...b.firmware.host }, slotSize: 983040, deviceStaged: false, hostStaged: false };
    });
  }

  // Staging waits on the gate, so a test can hold an update in flight.
  async stageFirmware(target: number): Promise<void> {
    const b = this.box;
    if (b.gate) await b.gate;
    if (b.stageGate) await b.stageGate;
    // A write after the port went away fails, as Chromium's does.
    if (!this.open_) throw new DOMException('The device has been lost.', 'NetworkError');
    b.staged.push(target);
  }

  async activateFirmware(): Promise<void> {
    const b = this.box;
    if (b.onActivate === 'throws') throw new Error('The box refused the activate.');
    const staged = b.staged;
    b.staged = [];
    if (b.onActivate === 'gone') {
      b.alive = false;
      return;
    }
    if (b.onActivate === 'reverts') return;
    const land = (c: FakeChip, v?: [number, number, number]): FakeChip =>
      v ? { major: v[0], minor: v[1], patch: v[2], slot: c.slot ^ 1, state: 2 } : { ...c, slot: c.slot ^ 1 };
    if (staged.includes(0)) {
      b.firmware.device = land(b.firmware.device, b.next.device);
      b.version = { ...b.version, fwMajor: b.firmware.device.major, fwMinor: b.firmware.device.minor, fwPatch: b.firmware.device.patch };
    }
    // A mouse-side chip that wasn't answering before boots its image like any other.
    if (staged.includes(1)) b.firmware.host = land(b.firmware.host ?? { major: 0, minor: 0, patch: 0, slot: 0, state: 2 }, b.next.host);
  }

  async abortUpdate(): Promise<void> {
    this.box.staged = [];
  }

  async led(target: number, mode: number, level: number): Promise<void> {
    if (!this.open_) throw new Error('link closed');
    this.box.leds.push([target, mode, level]);
  }

  async close(): Promise<void> {
    const wasOpen = this.port.open && (this.open_ || this.port.box?.active === this || !this.port.box);
    this.open_ = false;
    if (!wasOpen) return;
    this.port.open = false;
    const b = this.port.box;
    if (b && b.openedBy === this.port) {
      b.openedBy = null;
      b.active = null;
      b.closes++;
    }
  }

  fail(): void {
    this.open_ = false;
    this.events.onClose?.(new Error('The device has been lost.'));
  }
}

export const makeFakeLink = (port: SerialPort, events: SerialLinkEvents): SerialLink =>
  new FakeLink(port as unknown as FakePort, events) as unknown as SerialLink;

// Lets queued promise chains run without moving the fake clock.
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

type Listener = (ev: Event) => void;

export class FakeSerial implements SerialLike {
  private listeners = new Map<string, Set<Listener>>();
  chosen: FakePort | null = null;
  chooserCalls = 0;
  getPortsFails = false;
  constructor(public ports: FakePort[]) {}
  async getPorts() {
    if (this.getPortsFails) throw new DOMException('parked', 'InvalidStateError');
    return this.ports.map(asPort);
  }
  async choose() {
    this.chooserCalls++;
    if (!this.chosen) throw new DOMException('No port selected.', 'NotFoundError');
    if (!this.ports.includes(this.chosen)) this.ports.push(this.chosen);
    return asPort(this.chosen);
  }
  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  private emit(type: string, port: FakePort) {
    for (const fn of this.listeners.get(type) ?? []) fn({ target: asPort(port) } as unknown as Event);
  }
  plug(port: FakePort) {
    this.ports.push(port);
    this.emit('connect', port);
  }
  // The device leaves: its link's read loop fails, and the port object is dead for good.
  unplug(port: FakePort) {
    this.ports = this.ports.filter((p) => p !== port);
    const b = port.box;
    if (b && b.openedBy === port) {
      b.openedBy = null;
      b.active?.fail();
      b.active = null;
    }
    port.box = null;
    this.emit('disconnect', port);
  }
}

// Another tab: new port objects for the same devices.
export const otherTab = (ports: FakePort[]) => ports.map((p) => new FakePort(p.box, p.info));

// Web Locks as Chromium runs them: held until the callback's promise settles, refused to a second
// holder when asked ifAvailable.
export class FakeLocks {
  held = new Set<string>();
  request(name: string, _opts: { ifAvailable: true }, cb: (lock: unknown) => unknown): Promise<unknown> {
    if (this.held.has(name)) return Promise.resolve(cb(null));
    this.held.add(name);
    return Promise.resolve(cb({ name })).finally(() => this.held.delete(name));
  }
}
