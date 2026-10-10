// A box for the dev server: open any dashboard page with `?fakebox` and Connect finds a box that answers
// every query with a G502 X LIGHTSPEED's figures and takes every command. Only the dev build loads it,
// so the dashboard's connected pages can be looked at and checked without hardware.
//
// `?fakebox=a,b` adds scenarios, so each rare state can be brought up and looked at:
//   no-port, needs-click, denied   Connect fails before a port is picked
//   busy, silent, unreadable, old  the port answers that way
//   unsupported, insecure          the page can't reach a port at all
//   newer, older                   the box speaks a newer or an older protocol
//   nomouse, keyboard              nothing cloned, or a keyboard
//   imperfect                      imperfect clones allowed (the Advanced tab's controls)
//   fail                           every command the box is sent is refused
//   lost                           the box stops answering 4 s after it connects
//   logs                           a long device log with warnings, errors and a very long line
//   events                         the box streams catch events once subscribed
//   gone, reverted                 an update whose box never comes back, or comes back on the old version
//   clip                           a clip retained and playing
//   full                           every table holding entries and every option away from its default

import type { BoxesDeps, SerialLike } from '../app/pages/dashboard/boxes';
import { CTRL_BAUD, CH343_PID, WCH_VID, type SerialLink, type SerialLinkEvents } from '../dashboard/serial';
import {
  BearingMode,
  CatchClass,
  ClipState,
  ClockDomain,
  DeviceKind,
  Direction,
  EmitMode,
  ImageState,
  LockClass,
  LogLevel,
  PatchSection,
  PROTO_VER,
  RenderMode,
  RewriteAction,
  TransformOp,
  type DeviceInfo,
  type Version,
} from '../dashboard/protocol';

const on = new Set(
  (new URLSearchParams(location.search).get('fakebox') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const VERSION: Version = {
  protoVer: on.has('newer') ? PROTO_VER + 1 : on.has('older') ? PROTO_VER - 1 : PROTO_VER,
  fwMajor: 3,
  fwMinor: 4,
  fwPatch: 5,
  mac: [0x58, 0x8c, 0x81, 0xdf, 0x1e, 0x28],
  name: 'Desk',
};

const DEVICE: DeviceInfo = on.has('keyboard')
  ? { vid: 0x31e3, pid: 0x1322, bcdDevice: 0x0100, bcdUsb: 0x0200, hasSerial: true, hasBos: false, kind: DeviceKind.Keyboard, product: 'Wooting 60HE+' }
  : { vid: 0x046d, pid: 0xc098, bcdDevice: 0x0100, bcdUsb: 0x0200, hasSerial: true, hasBos: false, kind: DeviceKind.Mouse, product: 'G502 X LIGHTSPEED' };

const chip = { major: 3, minor: 4, patch: 5, slot: 0, state: ImageState.Valid };
const old = { ...chip, patch: 4 };

const mouse = !on.has('nomouse') && !on.has('keyboard');
const ANSWERS: Record<string, unknown> = {
  handshake: VERSION,
  queryVersion: VERSION,
  queryHealth: {
    linkUp: true, mouseAttached: mouse, cloneConfigured: !on.has('nomouse'), injectionActive: false, rateConfident: mouse,
    lockOn: false, catchOn: on.has('events'), kbdAttached: on.has('keyboard'), rewriteOn: false, patchOn: false, transformOn: false,
  },
  queryDeviceInfo: on.has('nomouse') ? null : DEVICE,
  queryCaps: {
    mouse: mouse
      ? { nButtons: 5, hasX: true, hasY: true, hasWheel: true, hasPan: false, hasReportId: false, nHid: 3 }
      : { nButtons: 0, hasX: false, hasY: false, hasWheel: false, hasPan: false, hasReportId: false, nHid: 0 },
    keyboard: on.has('keyboard')
      ? { nKeys: 104, nkro: true, hasConsumer: true, hasSystem: false, hasReportId: true }
      : { nKeys: 0, nkro: false, hasConsumer: false, hasSystem: false, hasReportId: false },
    mouseChangeDriven: false,
    kbdChangeDriven: on.has('keyboard'),
  },
  queryRate: { nativePeriodUs: 1000, pollPeriodUs: 1000, confident: mouse, changeDriven: on.has('keyboard') },
  queryStats: {
    injectEmits: 0, txDrops: 0, txMerges: 0, txMaxdepth: 0, txWedges: 0, wakeups: 0, resetCount: 0,
    configCount: 1, linkRxDrops: 0, hostRxDrops: 0, relayDrops: 0, session: 1,
  },
  queryLocks: { entries: [] },
  queryCatch: { tableFull: false, dropped: 0, clock: { offsetUs: 412, ratePpb: 0, delayUs: 6, ageMs: 212 }, entries: [] },
  queryImperfect: { allowed: on.has('imperfect'), overCapacity: on.has('nomouse'), cloneImperfect: false },
  queryMovementRiding: 0,
  queryBearing: { windowMs: 20, mode: BearingMode.PerAxis },
  queryEmitPace: { mode: EmitMode.Learned, fixedHz: 1000, resolvedHz: 1000, forceHz: 0, advertisedHz: 1000, forceActive: false },
  queryRender: { mode: RenderMode.Despiked, full: false, ready: true },
  querySpread: { percent: 100, spanUs: 1000 },
  queryClip: on.has('clip')
    ? {
        state: ClipState.Playing, freeBytes: 40000, totalBytes: 25536, played: 812, ticks: 2400, underruns: 0, overruns: 0,
        seqGaps: 0, xfers: 0, xferErrs: 0, gated: 0, held: [], autolock: 0, loop: true, retain: true,
        finalized: true, ride: false, triggers: [], packetTriggers: [],
      }
    : {
        state: ClipState.Idle, freeBytes: 65536, totalBytes: 0, played: 0, ticks: 0, underruns: 0, overruns: 0,
        seqGaps: 0, xfers: 0, xferErrs: 0, gated: 0, held: [], autolock: 0, loop: false, retain: true,
        finalized: false, ride: false, triggers: [], packetTriggers: [],
      },
  queryRewrite: { tableFull: false, gen: 0, entries: [] },
  queryPatches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
  queryTransforms: { tableFull: false, entries: [] },
  queryFirmware: { device: chip, host: chip, slotSize: 0x1f0000, deviceStaged: false, hostStaged: false },
};

// Every table holding something, and every option off its default.
if (on.has('full')) {
  Object.assign(ANSWERS, {
    queryHealth: { ...(ANSWERS.queryHealth as object), injectionActive: true, lockOn: true, rewriteOn: true, patchOn: true, transformOn: true },
    queryLocks: {
      entries: [
        { cls: LockClass.Axis, id: 0, direction: Direction.Both, scale: 40 },
        { cls: LockClass.Axis, id: 1, direction: Direction.Negative, scale: -100 },
        { cls: LockClass.Button, id: 1, direction: Direction.Both, scale: 0 },
        { cls: LockClass.Key, id: 0x04, direction: Direction.Positive, scale: 0 },
      ],
    },
    queryTransforms: {
      tableFull: false,
      entries: [
        { op: TransformOp.Swap, sclass: LockClass.Axis, sid: 0, dclass: LockClass.Axis, did: 1 },
        { op: TransformOp.Remap, sclass: LockClass.Button, sid: 3, dclass: LockClass.Button, did: 4 },
      ],
    },
    queryRewrite: {
      tableFull: false,
      gen: 3,
      entries: [
        { cls: CatchClass.HidIn, id: 0, dir: Direction.Positive, action: RewriteAction.Drop, mlen: 2, off: 0, plen: 0, hits: 12840 },
        { cls: CatchClass.Control, id: 0, dir: Direction.Both, action: RewriteAction.Answer, mlen: 8, off: 0, plen: 18, hits: 3 },
      ],
    },
    queryPatches: {
      applied: true,
      pending: true,
      refused: false,
      tableFull: false,
      entries: [
        { section: PatchSection.Device, cfg: 0, index: 0, offset: 8, len: 4 },
        { section: PatchSection.String, cfg: 0, index: 2, offset: 0, len: 22 },
      ],
    },
    queryCatch: {
      ...(ANSWERS.queryCatch as object),
      dropped: 4,
      entries: [{ cls: CatchClass.HidIn, id: 0, dir: Direction.Positive, capture: 16, dropped: 4 }],
    },
    queryImperfect: { allowed: true, overCapacity: true, cloneImperfect: true },
    queryMovementRiding: 8,
    queryBearing: { windowMs: 35, mode: BearingMode.Vector },
    queryEmitPace: { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500, forceHz: 1000, advertisedHz: 1000, forceActive: true },
    queryRender: { mode: RenderMode.Off, full: true, ready: false },
    querySpread: { percent: 50, spanUs: 0 },
  });
}

const LOG = [
  'inter-chip link up',
  'configuration -> index 0',
  '  intf 0 in ep 0x81 rpt 13',
  'clone active: VID=046D PID=C098 cfg=1 ifs=3 fw=3.4.5',
];
const LONG_LOG: [LogLevel, string][] = [
  ...Array.from({ length: 60 }, (_, i) => [LogLevel.Info, `poll ${i}: 1000 Hz, 0 dropped`] as [LogLevel, string]),
  [LogLevel.Warn, 'relay: endpoint 0x83 stalled, clearing'],
  [LogLevel.Error, 'host link: frame CRC mismatch (seq 4211), resynchronising'],
  [LogLevel.Info, `descriptor ${'0123456789abcdef'.repeat(12)}`],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const refused = () => Promise.reject(new Error('The box refused that.'));

// One link per open. After an update, the box answers as the scenario says: not at all, or on the old
// version.
let updated = false;
let streaming = false;
let connectedAt = 0;

function devLink(port: SerialPort, events: SerialLinkEvents): SerialLink {
  const silent = () => (on.has('lost') && connectedAt > 0 && Date.now() - connectedAt > 4000) || (updated && on.has('gone'));
  const base: Record<string | symbol, unknown> = {
    serialPort: port,
    lastRxAt: Date.now(),
    open: async () => {
      if (silent()) throw new Error('The port went away');
      connectedAt ||= Date.now();
      setTimeout(() => {
        LOG.forEach((text) => events.onLog?.({ level: LogLevel.Info, text }));
        if (on.has('logs')) LONG_LOG.forEach(([level, text]) => events.onLog?.({ level, text }));
      }, 400);
    },
    close: async () => {},
    stageFirmware: async (_t: number, image: Uint8Array, progress?: (w: number, t: number) => void) => {
      const total = image.length || 1_000_000;
      for (let w = 0; w <= total; w += Math.ceil(total / 40)) {
        progress?.(Math.min(w, total), total);
        await sleep(60);
      }
      progress?.(total, total);
    },
    activateFirmware: async () => {
      updated = true;
      await sleep(400);
    },
    queryFirmware: async () => {
      if (silent()) throw new Error('No reply');
      // A chip that took the update boots its other slot; a reverted one stays where it was.
      if (!updated) return structuredClone(ANSWERS.queryFirmware);
      const moved = { ...chip, slot: 1 };
      return { ...(ANSWERS.queryFirmware as object), device: moved, host: on.has('reverted') ? old : moved };
    },
    // The table holds what was subscribed, so the page reads every entry as taken.
    uncatch: async () => {
      if (on.has('fail')) return refused();
      (ANSWERS.queryCatch as { entries: unknown[] }).entries = [];
    },
    catch: async (f: object) => {
      if (on.has('fail')) return refused();
      (ANSWERS.queryCatch as { entries: unknown[] }).entries.push({ ...f, dropped: 0 });
      if (!on.has('events') || streaming) return undefined;
      streaming = true;
      let seq = 0;
      const tick = setInterval(() => {
        events.onEvent?.(
          {
            kind: 'traffic',
            traffic: {
              tsUs: Date.now() * 1000,
              clk: ClockDomain.Device,
              cls: CatchClass.HidIn,
              id: 0x81,
              dir: Direction.Positive,
              flags: 0,
              trueLen: 8,
              bytes: new Uint8Array([0, seq & 0xff, 0, 0, 0, 0, 0, 0]),
            },
          } as never,
          seq++,
        );
        if (seq > 300) {
          clearInterval(tick);
          streaming = false;
        }
      }, 120);
      return undefined;
    },
  };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'then') return undefined;
      if (typeof key !== 'string') return undefined;
      if (!silent()) target.lastRxAt = Date.now();
      if (key in ANSWERS) return async () => (silent() ? Promise.reject(new Error('No reply')) : structuredClone(ANSWERS[key]));
      if (key.startsWith('query')) return async () => (silent() ? Promise.reject(new Error('No reply')) : undefined);
      return async () => (on.has('fail') ? refused() : undefined);
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

const chooseError = (): Error | null => {
  const named = (name: string, message: string) => Object.assign(new Error(message), { name });
  if (on.has('no-port')) return named('NotFoundError', 'No port selected by the user.');
  if (on.has('needs-click')) return named('SecurityError', 'Must be handling a user gesture to show a permission request.');
  if (on.has('denied')) return new Error('The device was disconnected by the operating system.');
  return null;
};

export function fakeBoxDeps(): Partial<BoxesDeps> {
  const port = new DevPort() as unknown as SerialPort;
  let chosen = false;
  const serial: SerialLike = {
    getPorts: async () => (chosen ? [port] : []),
    addEventListener() {},
    removeEventListener() {},
  };
  return {
    serial: on.has('unsupported') ? null : serial,
    supported: !on.has('unsupported'),
    secure: !on.has('insecure'),
    choose: async () => {
      const e = chooseError();
      if (e) throw e;
      chosen = true;
      return port;
    },
    probe: async () => {
      if (on.has('busy')) return { kind: 'busy' };
      if (on.has('silent') || (on.has('lost') && connectedAt > 0)) return { kind: 'silent' };
      if (on.has('unreadable')) return { kind: 'unreadable' };
      if (on.has('old')) return { kind: 'old-firmware', version: { ...VERSION, protoVer: 3, fwMajor: 3, fwMinor: 1, fwPatch: 0 } };
      return { kind: 'box', version: VERSION, device: on.has('nomouse') ? null : DEVICE, baud: CTRL_BAUD };
    },
    makeLink: devLink,
  };
}
