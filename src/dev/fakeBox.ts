// A box for the dev server: open any dashboard page with `?fakebox` and Connect finds a box that answers
// every query with a G502 X LIGHTSPEED's figures and takes every command. Only the dev build loads it,
// so the dashboard's connected pages can be looked at and checked without hardware.

import type { BoxesDeps, SerialLike } from '../app/pages/dashboard/boxes';
import { CTRL_BAUD, CH343_PID, WCH_VID, type SerialLink, type SerialLinkEvents } from '../dashboard/serial';
import {
  BearingMode,
  ClipState,
  DeviceKind,
  EmitMode,
  ImageState,
  LogLevel,
  PROTO_VER,
  RenderMode,
  type DeviceInfo,
  type Version,
} from '../dashboard/protocol';

const VERSION: Version = { protoVer: PROTO_VER, fwMajor: 3, fwMinor: 4, fwPatch: 5, mac: [0x58, 0x8c, 0x81, 0xdf, 0x1e, 0x28], name: 'Desk' };

const DEVICE: DeviceInfo = {
  vid: 0x046d,
  pid: 0xc098,
  bcdDevice: 0x0100,
  bcdUsb: 0x0200,
  hasSerial: true,
  hasBos: false,
  kind: DeviceKind.Mouse,
  product: 'G502 X LIGHTSPEED',
};

const chip = { major: 3, minor: 4, patch: 5, slot: 0, state: ImageState.Valid };

const ANSWERS: Record<string, unknown> = {
  handshake: VERSION,
  queryVersion: VERSION,
  queryHealth: {
    linkUp: true, mouseAttached: true, cloneConfigured: true, injectionActive: false, rateConfident: true,
    lockOn: false, catchOn: false, kbdAttached: false, rewriteOn: false, patchOn: false, transformOn: false,
  },
  queryDeviceInfo: DEVICE,
  queryCaps: {
    mouse: { nButtons: 5, hasX: true, hasY: true, hasWheel: true, hasPan: false, hasReportId: false, nHid: 3 },
    keyboard: { nKeys: 0, nkro: false, hasConsumer: false, hasSystem: false, hasReportId: false },
    mouseChangeDriven: false,
    kbdChangeDriven: false,
  },
  queryRate: { nativePeriodUs: 1000, pollPeriodUs: 1000, confident: true, changeDriven: false },
  queryStats: {
    injectEmits: 0, txDrops: 0, txMerges: 0, txMaxdepth: 0, txWedges: 0, wakeups: 0, resetCount: 0,
    configCount: 1, linkRxDrops: 0, hostRxDrops: 0, relayDrops: 0, session: 1,
  },
  queryLocks: { entries: [] },
  queryCatch: { tableFull: false, dropped: 0, clock: { offsetUs: 412, ratePpb: 0, delayUs: 6, ageMs: 212 }, entries: [] },
  queryImperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
  queryMovementRiding: 0,
  queryBearing: { windowMs: 20, mode: BearingMode.PerAxis },
  queryEmitPace: { mode: EmitMode.Learned, fixedHz: 1000, resolvedHz: 1000, forceHz: 0, advertisedHz: 1000, forceActive: false },
  queryRender: { mode: RenderMode.Despiked, full: false, ready: true },
  querySpread: { percent: 100, spanUs: 1000 },
  queryClip: {
    state: ClipState.Idle, freeBytes: 65536, totalBytes: 65536, played: 0, ticks: 0, underruns: 0, overruns: 0,
    seqGaps: 0, xfers: 0, xferErrs: 0, gated: 0, held: [], autolock: 0, loop: false, retain: true,
    finalized: false, ride: false, triggers: [], packetTriggers: [],
  },
  queryRewrite: { tableFull: false, gen: 0, entries: [] },
  queryPatches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
  queryTransforms: { tableFull: false, entries: [] },
  queryFirmware: { device: chip, host: chip, slotSize: 0x1f0000, deviceStaged: false, hostStaged: false },
};

const LOG = [
  'inter-chip link up',
  'configuration -> index 0',
  '  intf 0 in ep 0x81 rpt 13',
  'clone active: VID=046D PID=C098 cfg=1 ifs=3 fw=3.4.5',
];

function devLink(port: SerialPort, events: SerialLinkEvents): SerialLink {
  const base: Record<string | symbol, unknown> = {
    serialPort: port,
    lastRxAt: Date.now(),
    open: async () => {
      setTimeout(() => LOG.forEach((text) => events.onLog?.({ level: LogLevel.Info, text })), 400);
    },
    close: async () => {},
  };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'then') return undefined;
      target.lastRxAt = Date.now();
      if (typeof key === 'string' && key in ANSWERS) return async () => structuredClone(ANSWERS[key]);
      return async () => undefined;
    },
  }) as unknown as SerialLink;
}

class DevPort {
  getInfo() {
    return { usbVendorId: WCH_VID, usbProductId: CH343_PID };
  }
  async open() {}
  async close() {}
  async forget() {}
  readable = null;
  writable = null;
}

export function fakeBoxDeps(): Partial<BoxesDeps> {
  const port = new DevPort() as unknown as SerialPort;
  let chosen = false;
  const serial: SerialLike = {
    getPorts: async () => (chosen ? [port] : []),
    addEventListener() {},
    removeEventListener() {},
  };
  return {
    serial,
    supported: true,
    secure: true,
    choose: async () => {
      chosen = true;
      return port;
    },
    probe: async () => ({ kind: 'box', version: VERSION, device: DEVICE, baud: CTRL_BAUD }),
    makeLink: devLink,
  };
}
