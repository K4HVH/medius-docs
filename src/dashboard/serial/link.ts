/// <reference types="w3c-web-serial" />
// The device control link over Web Serial: frame the wire protocol, correlate
// QUERY/RESP by SEQ and selector, and run the version handshake. Mirrors the
// medius crate's link/correlation behavior.

import {
  type Bearing,
  type CatchEvent,
  type CatchFilter,
  type Caps,
  type CatchState,
  type ClipEntry,
  type ClipStatus,
  type ClipTrigger,
  type DecodedFrame,
  type DeviceInfo,
  type EmitPace,
  type Health,
  type ImperfectStatus,
  type Locks,
  type LockTarget,
  type LogLine,
  type Rate,
  type Stats,
  type Version,
  ClipOp,
  EmitMode,
  RenderMode,
  FrameDecoder,
  FrameType,
  MAX_PAYLOAD,
  MIN_PROTO_VER,
  PROTO_VER,
  Q_CLIP,
  OPT_BEARING,
  OPT_EMIT,
  OPT_IMPERFECT,
  OPT_MOVE_RIDE,
  Q_CAPS,
  Q_CATCH,
  Q_DEVICE_INFO,
  Q_HEALTH,
  Q_LOCKS,
  Q_OPTIONS,
  Q_RATE,
  Q_STATS,
  Q_VERSION,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  Direction,
  LockClass,
  LedMode,
  LedTarget,
  RebootTarget,
  catchPayload,
  clearNamePayload,
  clipAppendPayload,
  clipCtrlPayload,
  clipSetPayload,
  clipTriggerPayload,
  emitPayload,
  encode,
  encodeClipEntry,
  filterEverything,
  imperfectPayload,
  injectPayload,
  ledPayload,
  BearingMode,
  bearingPayload,
  LOCK_SCALE_BLOCK,
  LOCK_SCALE_PASS,
  lockPayload,
  moveCursorPayload,
  moveWheelPayload,
  moveRidePayload,
  MV_F_DISCARD,
  MV_F_FLUSH,
  MV_F_NOW,
  namePayload,
  parseLog,
  parseMotionEvent,
  parseResp,
  parseTrafficEvent,
  parseUsageEvent,
  queryPayload,
  rebootPayload,
  type FirmwareInfo,
  anyPending,
  Q_FIRMWARE,
  OTA_OP_BEGIN,
  OTA_OP_DATA,
  OTA_OP_END,
  OTA_OP_ABORT,
  OTA_OP_ACTIVATE,
  OTA_TGT_DEVICE,
  OTA_CHUNK,
  OTA_CREDIT,
  UPD_OK,
  UPD_READY,
  UPD_ACK,
  UPD_STAGED,
  UPD_NAMES,
  UPD_RESP_LEN,
} from '../protocol';
import { isWebSerialSupported } from './support';

export const CTRL_BAUD = 4_000_000;
export const WCH_VID = 0x1a86;
export const CH343_PID = 0x55d3;
export const ESP_ROM_VID = 0x303a;

const HANDSHAKE_ATTEMPTS = 5;
const HANDSHAKE_TIMEOUT_MS = 250;
const DEFAULT_QUERY_TIMEOUT_MS = 500;

export class QueryTimeoutError extends Error {
  constructor() {
    super('no reply from the box before the query timed out');
    this.name = 'QueryTimeoutError';
  }
}

export class NoReplyError extends Error {
  constructor(what = 'the version handshake') {
    super(`no reply to ${what}`);
    this.name = 'NoReplyError';
  }
}

/** The box refused an update op (§4.16); `arg` is that status's argument. */
const UPDATE_DOING: Record<number, string> = {
  0x00: 'Starting the transfer',
  0x01: 'Sending the firmware',
  0x02: 'Finishing the transfer',
  0x03: 'Cancelling the transfer',
  0x04: 'Activating',
};

// Why it was refused, and what to do where that is not obvious. A status name and an arg read as a
// code dump.
function updateReason(op: number, status: number, arg: number): string {
  switch (status) {
    case 0x10: return 'an update is already open on that chip.';
    case 0x11: return 'the box has one firmware slot. It needs a ROM-download flash first.';
    case 0x12: return `the image is too big. A slot holds ${arg} bytes.`;
    case 0x13: return `a chunk went missing. The box wanted ${arg}.`;
    case 0x14: return `the flash write failed (error ${arg}).`;
    case 0x15: return 'the image was corrupted in transit. Try again.';
    case 0x16: return `that is not a bootable image (error ${arg}).`;
    case 0x17: return 'the mouse-side chip is not reachable.';
    case 0x18: return op === 0x04
      ? 'the mouse-side chip did not come back. Power cycle the box.'
      : 'the box stopped answering and dropped the transfer.';
    case 0x19: return 'nothing is staged.';
    case 0x1a: return `out of order. The box wanted op ${arg}.`;
    case 0x1b: return 'a chip is still verifying its new firmware. Try again in a few seconds.';
    case 0x1c: return 'refused before writing, so anything staged is untouched.';
    default: return `${UPD_NAMES[status] ?? status} (arg ${arg}).`;
  }
}

export class UpdateError extends Error {
  constructor(
    readonly op: number,
    readonly status: number,
    readonly arg: number,
  ) {
    super(`${UPDATE_DOING[op] ?? `Update op ${op}`} failed: ${updateReason(op, status, arg)}`);
    this.name = 'UpdateError';
  }
}

interface UpdateResp {
  op: number;
  target: number;
  status: number;
  arg: number;
}

/** One update op's budget. BEGIN erases the whole slot before it answers. */
const UPDATE_OP_TIMEOUT_MS = 20_000;
/** ACTIVATE reboots the host chip and waits for it back on the link before the device chip follows. */
const ACTIVATE_TIMEOUT_MS = 60_000;
/** A chip confirms the image it booted after about ten seconds of running. */
const CONFIRM_TIMEOUT_MS = 45_000;
/** Replies held for a waiter that has not registered yet. A window is 16 frames; this is slack. */
const UPDATE_BACKLOG_MAX = 64;

export class BadProtoVerError extends Error {
  constructor(readonly version: Version) {
    super(
      `unsupported protocol version ${version.protoVer} ` +
        `(this page speaks ${MIN_PROTO_VER}..${PROTO_VER})`,
    );
    this.name = 'BadProtoVerError';
  }
}

/** Whether a box speaks the current wire, or only enough of it to be updated. */
export function speaksCurrentWire(version: Version): boolean {
  return version.protoVer === PROTO_VER;
}

export interface SerialLinkEvents {
  onLog?: (line: LogLine) => void;
  onClose?: (reason?: Error) => void;
  onVersionHello?: (version: Version) => void;
  // An unsolicited physical-input event (the CATCH stream); `seq` is the box's rolling event counter.
  // The event is tagged motion (relative axes) or usages (a class-tagged held-usage snapshot).
  onEvent?: (ev: CatchEvent, seq: number) => void;
}

interface Pending {
  what: number;
  resolve: (payload: Uint8Array) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// Open a Web Serial port chooser filtered to the CH343 control link.
export async function requestMediusPort(): Promise<SerialPort> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser');
  }
  return navigator.serial.requestPort({
    filters: [{ usbVendorId: WCH_VID, usbProductId: CH343_PID }],
  });
}

// Ports this origin has already been granted that are a CH343. Opening one of these needs no
// chooser, so a box that has been connected once before never asks for permission again.
export async function grantedMediusPorts(): Promise<SerialPort[]> {
  if (!isWebSerialSupported()) return [];
  const ports = await navigator.serial.getPorts();
  return ports.filter((p) => {
    const info = p.getInfo();
    return info.usbVendorId === WCH_VID && info.usbProductId === CH343_PID;
  });
}

// Open a chooser filtered to an ESP32-S3 in ROM download mode (native USB).
export async function requestRomPort(): Promise<SerialPort> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser');
  }
  return navigator.serial.requestPort({ filters: [{ usbVendorId: ESP_ROM_VID }] });
}

export class SerialLink {
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoop: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private pending = new Map<number, Pending>();
  // UPDATE_RESP waiters, keyed by the op they answer. Not SEQ-correlated like a RESP: one
  // acknowledgement answers a whole window of DATA frames and carries a rolling SEQ of its own.
  private updateWaiters = new Map<number, (r: UpdateResp | null, cause?: Error) => void>();
  // Replies that arrived before anyone was waiting. Discarding them loses every refusal raised
  // inside a credit window, because the waiter is only registered once the window closes.
  private updateBacklog: UpdateResp[] = [];
  private seq = 1;
  // CLIP_APPEND's own sequence; see `clipAppend`.
  private clipSeq = 0;
  private opened = false;
  private closing = false;

  constructor(
    private readonly port: SerialPort,
    private readonly events: SerialLinkEvents = {},
  ) {}

  // The underlying Web Serial port, handed to esptool-js for the flash handoff.
  get serialPort(): SerialPort {
    return this.port;
  }

  async open(): Promise<void> {
    if (this.opened) throw new Error('link already opened');
    this.opened = true;
    // Adopt a port that is already open rather than opening it again. A close that could not finish
    // (the usual cause is the box re-enumerating underneath it as it reboots into a new image)
    // leaves the port open, and Web Serial answers the next open() with "the port is already open",
    // which strands the page with no way back except a replug.
    if (!this.port.readable || !this.port.writable) {
      await this.port.open({ baudRate: CTRL_BAUD });
    }
    // Deassert DTR/RTS so opening the port cannot strap or reset the device chip.
    try {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {
      // Not all platforms support setSignals; the CH343 link tolerates either way.
    }
    this.writer = this.port.writable ? this.port.writable.getWriter() : null;
    this.readLoop = this.runReadLoop();
  }

  async handshake(): Promise<Version> {
    for (let i = 0; i < HANDSHAKE_ATTEMPTS; i++) {
      try {
        const version = await this.queryVersion(HANDSHAKE_TIMEOUT_MS);
        // Below MIN_PROTO_VER there is no UPDATE opcode to reach, and above PROTO_VER the box speaks
        // a wire this page cannot know. Between them it connects, for updating.
        if (version.protoVer < MIN_PROTO_VER || version.protoVer > PROTO_VER) {
          throw new BadProtoVerError(version);
        }
        return version;
      } catch (e) {
        if (e instanceof BadProtoVerError) throw e;
        // A first attempt that times out often means the box's frame decoder is wedged mid-frame by a
        // prior client that disconnected mid-write, so it swallows our QUERY while still emitting
        // unsolicited LOGs. Flush it before retrying. (Firmware >= 2.3.0 also self-heals on its own; this
        // covers boxes on older firmware.) Timeouts and transient unparseable replies otherwise retry;
        // mirrors connect.rs.
        await this.flushPeerDecoder();
      }
    }
    throw new NoReplyError();
  }

  // Write a run of 0x00 to clear a wedged box decoder: enough bytes to complete the largest possible
  // stuck frame (FRAME_MAX_PAYLOAD 512 + overhead), which then fails CRC and is dropped, and 0x00 is
  // never a SOF, so the decoder ends up idle and ready for the next QUERY. Harmless on a healthy box.
  private async flushPeerDecoder(): Promise<void> {
    try {
      await this.send(new Uint8Array(600));
    } catch {
      // Best-effort; the handshake retries regardless.
    }
  }

  async queryVersion(timeoutMs?: number): Promise<Version> {
    const resp = parseResp(await this.query(Q_VERSION, timeoutMs));
    if (resp?.kind !== 'version') throw new Error('unexpected reply to VERSION query');
    return resp.version;
  }

  async queryHealth(timeoutMs?: number): Promise<Health> {
    const resp = parseResp(await this.query(Q_HEALTH, timeoutMs));
    if (resp?.kind !== 'health') throw new Error('unexpected reply to HEALTH query');
    return resp.health;
  }

  async queryDeviceInfo(timeoutMs?: number): Promise<DeviceInfo> {
    const resp = parseResp(await this.query(Q_DEVICE_INFO, timeoutMs));
    if (resp?.kind !== 'deviceInfo') throw new Error('unexpected reply to DEVICE_INFO query');
    return resp.deviceInfo;
  }

  async queryCaps(timeoutMs?: number): Promise<Caps> {
    const resp = parseResp(await this.query(Q_CAPS, timeoutMs));
    if (resp?.kind !== 'caps') throw new Error('unexpected reply to CAPS query');
    return resp.caps;
  }

  async queryRate(timeoutMs?: number): Promise<Rate> {
    const resp = parseResp(await this.query(Q_RATE, timeoutMs));
    if (resp?.kind !== 'rate') throw new Error('unexpected reply to RATE query');
    return resp.rate;
  }

  async queryStats(timeoutMs?: number): Promise<Stats> {
    const resp = parseResp(await this.query(Q_STATS, timeoutMs));
    if (resp?.kind !== 'stats') throw new Error('unexpected reply to STATS query');
    return resp.stats;
  }

  async queryLocks(timeoutMs?: number): Promise<Locks> {
    const resp = parseResp(await this.query(Q_LOCKS, timeoutMs));
    if (resp?.kind !== 'locks') throw new Error('unexpected reply to LOCKS query');
    return resp.locks;
  }

  // The active CATCH table (§4.9): the box-wide drop count, the cross-chip clock estimate, and one
  // entry per subscription with its own drop count. CATCH is fire-and-forget, so this is the only
  // way to see that an entry landed rather than being refused by a full table.
  async queryCatch(timeoutMs?: number): Promise<CatchState> {
    const resp = parseResp(await this.query(Q_CATCH, timeoutMs));
    if (resp?.kind !== 'catch') throw new Error('unexpected reply to CATCH query');
    return resp.catch;
  }

  async queryImperfect(timeoutMs?: number): Promise<ImperfectStatus> {
    const resp = parseResp(await this.queryOption(OPT_IMPERFECT, timeoutMs));
    if (resp?.kind !== 'imperfect') throw new Error('unexpected reply to OPTIONS(IMPERFECT) query');
    return resp.imperfect;
  }

  // The movement-riding window in milliseconds (§4.14); 0 means off.
  async queryMovementRiding(timeoutMs?: number): Promise<number> {
    const resp = parseResp(await this.queryOption(OPT_MOVE_RIDE, timeoutMs));
    if (resp?.kind !== 'movementRiding') throw new Error('unexpected reply to OPTIONS(MOVE_RIDE) query');
    return resp.windowMs;
  }

  // The bearing (§4.14): the window the With/Against directions are held over, and how it is read.
  async queryBearing(timeoutMs?: number): Promise<Bearing> {
    const resp = parseResp(await this.queryOption(OPT_BEARING, timeoutMs));
    if (resp?.kind !== 'bearing') throw new Error('unexpected reply to OPTIONS(BEARING) query');
    return resp.bearing;
  }

  // The emit-rate pacing option (§4.14): the mode, the configured fixed rate, and the rate in effect.
  async queryEmitPace(timeoutMs?: number): Promise<EmitPace> {
    const resp = parseResp(await this.queryOption(OPT_EMIT, timeoutMs));
    if (resp?.kind !== 'emitPace') throw new Error('unexpected reply to OPTIONS(EMIT) query');
    return resp.emit;
  }

  reboot(target: RebootTarget): Promise<void> {
    return this.send(encode(FrameType.RebootDl, this.nextSeq(), rebootPayload(target)));
  }

  led(target: LedTarget, mode: LedMode, level: number): Promise<void> {
    return this.send(encode(FrameType.Led, this.nextSeq(), ledPayload(target, mode, level)));
  }

  // Weigh physical input on a target and direction (§3.8). `scale` is the percent of the physical
  // value the box keeps: LOCK_SCALE_BLOCK blocks it, LOCK_SCALE_PASS passes it untouched, above that
  // amplifies. `lock` and `unlock` are its two ends. Direction.With / .Against are measured against
  // the bearing (§3.12) and do nothing until one is live; see `setBearing`.
  // A blanket (id LOCK_ID_ALL) carries the direction to every member, so an every-key lock can block
  // press edges alone. A media usage has no edges and ignores the byte either way.
  scale(target: LockTarget, direction: Direction, scale: number): Promise<void> {
    // Only an axis has a bearing, so a relative direction elsewhere is refused rather than sent: the
    // box does a different thing per class with it, and every other client refuses it too. A media usage
    // has no edges at all, so an edge named on one goes out as Both, which is what the box reports back.
    if (target.cls !== LockClass.Axis && (direction === Direction.With || direction === Direction.Against)) {
      return Promise.reject(new Error(`${Direction[direction]} is measured against the bearing, which only an axis has`));
    }
    const dir = target.cls === LockClass.Media ? Direction.Both : direction;
    return this.send(
      encode(FrameType.Lock, this.nextSeq(), lockPayload(target.cls, target.id, dir, scale)),
    );
  }

  lock(target: LockTarget, direction: Direction): Promise<void> {
    return this.scale(target, direction, LOCK_SCALE_BLOCK);
  }

  // Back to passing untouched. Direction.Both clears every direction of the target, the
  // bearing-relative pair included, so an unlock never leaves one weighing unseen.
  unlock(target: LockTarget, direction: Direction): Promise<void> {
    return this.scale(target, direction, LOCK_SCALE_PASS);
  }

  // Move the cursor (§3.1). Relative, in the cloned mouse's own units. The wire field is an i16, so
  // a larger delta saturates here rather than wrapping; the box then clamps that to the cloned
  // report's own field width and carries the remainder into later reports.
  moveRel(dx: number, dy: number, flags = 0): Promise<void> {
    return this.send(encode(FrameType.Move, this.nextSeq(), moveCursorPayload(dx, dy, flags)));
  }

  // Scroll the wheel (§3.1), in detents, same carry behaviour as `moveRel`.
  wheel(dz: number, flags = 0): Promise<void> {
    return this.send(encode(FrameType.Move, this.nextSeq(), moveWheelPayload(dz, flags)));
  }

  // The same two verbs with movement riding bypassed (§3.1, MV_F_NOW): the delta emits on the box's
  // own clock instead of waiting for a native cursor-motion report to carry it. With riding off these
  // are the same as `moveRel` / `wheel`.
  moveRelNow(dx: number, dy: number): Promise<void> {
    return this.moveRel(dx, dy, MV_F_NOW);
  }

  wheelNow(dz: number): Promise<void> {
    return this.wheel(dz, MV_F_NOW);
  }

  // Emit the motion the box is holding for a ride, now, ignoring the ride window (§3.1, MV_F_FLUSH).
  flushMotion(): Promise<void> {
    return this.moveRel(0, 0, MV_F_FLUSH);
  }

  // Drop the motion the box is holding for a ride (§3.1, MV_F_DISCARD).
  discardMotion(): Promise<void> {
    return this.moveRel(0, 0, MV_F_DISCARD);
  }

  // Inject a mouse button by semantic id (§3.2, class button), tri-state action (0/1/2).
  button(id: number, action: number): Promise<void> {
    return this.send(encode(FrameType.Inject, this.nextSeq(), injectPayload(INJ_BTN, id, action)));
  }

  // Inject any momentary usage (§3.2): one call for all three classes, so a caller holding a mixed
  // set does not have to branch on class to release it.
  inject(cls: number, id: number, action: number): Promise<void> {
    return this.send(encode(FrameType.Inject, this.nextSeq(), injectPayload(cls, id, action)));
  }

  // The box-wide safety clear (§3.4). Wider than its name: in one atomic release it drops every
  // injected usage, every lock, the whole CATCH subscription table, the loaded clip AND its
  // configuration (autolock scope, loop, retain, and all eight trigger bindings), and it returns the
  // status LEDs back to the box. It is the recovery for a press whose release was lost, because it
  // does not depend on knowing what is held. Release known holds one at a time when that matters.
  reset(): Promise<void> {
    return this.send(encode(FrameType.Reset, this.nextSeq(), new Uint8Array(0)));
  }

  // Inject a keyboard key or modifier by HID keycode (§3.2, class key), tri-state action (0/1/2).
  key(usage: number, action: number): Promise<void> {
    return this.send(encode(FrameType.Inject, this.nextSeq(), injectPayload(INJ_KEY, usage, action)));
  }

  // Inject a media key by 16-bit Consumer usage (§3.2, class media), tri-state action (0/1/2).
  consumer(usage: number, action: number): Promise<void> {
    return this.send(
      encode(FrameType.Inject, this.nextSeq(), injectPayload(INJ_MEDIA, usage, action)),
    );
  }

  // Add one entry to the CATCH subscription table (§3.9); event frames arrive on `onEvent` tagged
  // motion, usages, or traffic. The table holds 32 entries and matching is most-specific-first, so
  // "everything at 16 bytes, except endpoint 0x83 in full" is two calls. The subscription clears
  // after ~1 s of control-PC silence, so poll a query to reset the timer.
  catch(filter: CatchFilter): Promise<void> {
    return this.send(
      encode(
        FrameType.Catch,
        this.nextSeq(),
        catchPayload(filter.cls, filter.id, filter.dir, 1, filter.capture),
      ),
    );
  }

  // Drop one entry from the table. Unsubscribing matches on (class, id, dir) alone, so the
  // filter's capture length is carried for symmetry and ignored by the box.
  unsubscribeCatch(filter: CatchFilter): Promise<void> {
    return this.send(
      encode(
        FrameType.Catch,
        this.nextSeq(),
        catchPayload(filter.cls, filter.id, filter.dir, 0, filter.capture),
      ),
    );
  }

  // Clear the whole table in one frame: the all-classes wildcard with state 0.
  uncatch(): Promise<void> {
    return this.unsubscribeCatch(filterEverything());
  }

  // Opt into (or out of) cloning an over-capacity device imperfectly (§3.10). Persisted in NVS; the box
  // reboots itself to re-clone with the new setting. Fire-and-forget. Read the state back with
  // `queryImperfect`.
  allowImperfectClones(allow: boolean): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), imperfectPayload(allow)));
  }

  // Set movement riding (§3.10): a window in milliseconds, or 0 to turn it off. With it on, injected
  // motion only rides a native cursor-motion report inside the window (no synthetic motion frames),
  // so injection's report density matches the native mouse. Persisted in NVS. Read back with
  // `queryMovementRiding`.
  setMovementRiding(windowMs: number): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), moveRidePayload(windowMs)));
  }

  // Set the bearing (§3.10, §3.12): what the With/Against lock directions are measured against.
  // `windowMs` is how long the last injected delta's direction stays the bearing on that axis; 0 turns
  // it off, leaving both directions inert whatever their scale. `mode` reads each axis's own sign
  // (PerAxis) or projects the delta onto the injected XY vector (Vector). Persisted in NVS. Read back
  // with `queryBearing`.
  setBearing(windowMs: number, mode: BearingMode = BearingMode.PerAxis): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), bearingPayload(windowMs, mode)));
  }

  // Set emit-rate pacing and the forced wire rate (§3.10). Learned tracks the mouse's native report rate
  // (default), Interval follows the cloned poll rate, Fixed paces at rateHz (snapped to 1000/n, capped at
  // 1000); the mode raises the emit ceiling only and idle still emits when pending. forceHz is the rate
  // the clone advertises and the box polls the device at, 0 for the device's own; it needs IMPERFECT on
  // and re-clones the box when the resolved interval changes. Both ride one command, so both are written
  // every call. Persisted in NVS. Read back with `queryEmitPace`.
  setEmitPace(mode: EmitMode, render: RenderMode, rateHz = 0, forceHz = 0): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), emitPayload(mode, render, rateHz, forceHz)));
  }

  // The clip engine's state, ring accounting, held usages, and stored configuration (§4.15).
  async queryClip(timeoutMs?: number): Promise<ClipStatus> {
    const resp = parseResp(await this.query(Q_CLIP, timeoutMs));
    if (resp?.kind !== 'clip') throw new Error('unexpected reply to CLIP query');
    return resp.clip;
  }

  // Append entries to the clip ring (§3.11). Rejects an unencodable batch rather than sending a
  // partial one.
  //
  // CLIP_APPEND carries its own sequence: the box expects each append's SEQ to be exactly one past
  // the last one it saw, and faults the engine on any gap so a dropped append cannot be played as
  // if it were whole. That counter therefore cannot be the link's shared SEQ, which every query and
  // command also advances, and a single health poll between two appends would look like a lost
  // append. Appends count on their own.
  //
  // The ring has no backpressure: an append past the end is dropped whole and faults the engine, so
  // check `freeBytes` from `queryClip` before sending. The box also drops an append with no reply when
  // no mouse is cloned, and after FINALIZE on a retained clip.
  async clipAppend(entries: ClipEntry[]): Promise<void> {
    // Split on entry boundaries only. The ring has no framing inside it, so an entry cut across two
    // appends misaligns everything after it rather than being rejected.
    const batches: ClipEntry[][] = [];
    let batch: ClipEntry[] = [];
    let size = 0;
    for (const e of entries) {
      const b = encodeClipEntry(e);
      if (!b) throw new Error('clip entries could not be encoded');
      if (size + b.length > MAX_PAYLOAD) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(e);
      size += b.length;
    }
    if (batch.length > 0) batches.push(batch);
    // Encode every batch before sending any of them, so a failure cannot leave half a clip loaded.
    const frames = batches.map(clipAppendPayload);
    if (frames.some((f) => f === null)) throw new Error('clip entries could not be encoded');
    for (const payload of frames as Uint8Array[]) {
      await this.send(encode(FrameType.ClipAppend, this.clipSeq, payload));
      // Advanced only once the frame is away. Bumping it first would leave the box expecting a
      // sequence number that never reached it, and the next append would read as a lost one.
      this.clipSeq = (this.clipSeq + 1) & 0xff;
    }
  }

  // Run one clip engine verb (§3.11). Ignored by the box when no mouse is cloned: the clip is
  // clocked by the mouse's own report tick, so without one it could never advance.
  clipCtrl(op: ClipOp): Promise<void> {
    return this.send(encode(FrameType.ClipCtrl, this.nextSeq(), clipCtrlPayload(op)));
  }

  // Write one clip scalar setting (§3.11): autolock scope, loop, retain, or ride. Two of the four are
  // coerced by the box with no reply: retain is ignored unless the ring is empty, and the autolock
  // scope is masked to the defined bits. Read the value back to see what landed.
  clipSet(id: number, value: number): Promise<void> {
    return this.send(encode(FrameType.ClipSet, this.nextSeq(), clipSetPayload(id, value)));
  }

  // Add or overwrite a clip trigger binding (§3.11). Keyed by (class, id, edge), so setting one
  // that already exists replaces it rather than adding a second.
  clipTrigger(trigger: ClipTrigger): Promise<void> {
    return this.send(
      encode(FrameType.ClipTrigger, this.nextSeq(), clipTriggerPayload(trigger, true)),
    );
  }

  // Remove a trigger binding. Only its (class, id, edge) key is read; action and consume are
  // carried for symmetry and ignored. One address is special: the any-class, any-id, both-edges
  // binding is byte-identical to the box's clear-all sentinel, so removing that one removes them
  // all.
  clipUntrigger(trigger: ClipTrigger): Promise<void> {
    return this.send(
      encode(FrameType.ClipTrigger, this.nextSeq(), clipTriggerPayload(trigger, false)),
    );
  }

  // Set the box name (§3.10): 1..32 printable ASCII bytes, the readable partner to the box MAC.
  // Persisted in NVS, no reboot. Fire-and-forget. Read it back on RESP(VERSION) as the name tail after
  // the MAC (there is no Q_OPTIONS readback for it).
  setName(name: string): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), namePayload(name)));
  }

  // Clear the box name (§3.10): reverts to the firmware-synthesized "Medius-XXXX" default. Persisted
  // in NVS. Fire-and-forget.
  clearName(): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), clearNamePayload()));
  }

  async close(): Promise<void> {
    this.closing = true;
    this.failAll(new Error('link closed'));
    try {
      await this.reader?.cancel();
    } catch {
      // ignore
    }
    try {
      await this.readLoop;
    } catch {
      // ignore
    }
    try {
      await this.writeChain;
    } catch {
      // ignore
    }
    try {
      this.writer?.releaseLock();
    } catch {
      // ignore
    }
    this.writer = null;
    try {
      this.reader?.releaseLock();
    } catch {
      // already released by the read loop
    }
    this.reader = null;
    // Not swallowed: a port that would not close is the one thing the next open() has to know about,
    // and it is recoverable by adopting it rather than by giving up.
    await this.port.close();
  }

  private query(what: number, timeoutMs = DEFAULT_QUERY_TIMEOUT_MS): Promise<Uint8Array> {
    return this.queryRaw(what, queryPayload(what), timeoutMs);
  }

  // QUERY(OPTIONS, id): a single persistent box option. The reply still leads with Q_OPTIONS, so it
  // correlates on that selector (the SEQ disambiguates concurrent option reads).
  private queryOption(id: number, timeoutMs = DEFAULT_QUERY_TIMEOUT_MS): Promise<Uint8Array> {
    return this.queryRaw(Q_OPTIONS, new Uint8Array([Q_OPTIONS, id]), timeoutMs);
  }

  private queryRaw(what: number, request: Uint8Array, timeoutMs: number): Promise<Uint8Array> {
    const seq = this.nextSeq();
    const frame = encode(FrameType.Query, seq, request);
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new QueryTimeoutError());
      }, timeoutMs);
      this.pending.set(seq, { what, resolve, reject, timer });
      this.send(frame).catch((err) => {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(err as Error);
      });
    });
  }

  // Serialize writes through one cached writer so concurrent callers cannot race
  // on getWriter() or interleave frames on the wire.
  private send(frame: Uint8Array): Promise<void> {
    const run = this.writeChain.then(() => {
      if (!this.writer) throw new Error('serial port is not writable');
      return this.writer.write(frame);
    });
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private nextSeq(): number {
    const s = this.seq;
    this.seq = (this.seq + 1) & 0xff;
    // SEQ 0 is reserved for the box's unsolicited VERSION boot hello.
    if (this.seq === 0) this.seq = 1;
    return s;
  }

  private async runReadLoop(): Promise<void> {
    const dec = new FrameDecoder();
    let dropErr: Error | undefined;
    while (!this.closing && this.port.readable) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) dec.feed(value, (f) => this.onFrame(f));
        }
      } catch (e) {
        dropErr = e as Error;
        break;
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
        this.reader = null;
      }
    }
    if (!this.closing) {
      this.failAll(dropErr ?? new Error('serial link closed'));
      this.events.onClose?.(dropErr);
    }
  }

  private onFrame(f: DecodedFrame): void {
    if (f.ty === FrameType.Resp) {
      const p = this.pending.get(f.seq);
      // A solicited reply must match both SEQ and the request's selector byte.
      if (p && f.payload.length > 0 && f.payload[0] === p.what) {
        clearTimeout(p.timer);
        this.pending.delete(f.seq);
        p.resolve(f.payload);
        return;
      }
      const resp = parseResp(f.payload);
      if (resp?.kind === 'version') this.events.onVersionHello?.(resp.version);
      return;
    }
    if (f.ty === FrameType.UpdateResp) {
      if (f.payload.length >= UPD_RESP_LEN) {
        const op = f.payload[0];
        const resp: UpdateResp = {
          op,
          target: f.payload[1],
          status: f.payload[2],
          arg:
            (f.payload[3] |
              (f.payload[4] << 8) |
              (f.payload[5] << 16) |
              (f.payload[6] << 24)) >>>
            0,
        };
        const w = this.updateWaiters.get(op);
        if (w) {
          this.updateWaiters.delete(op);
          w(resp);
        } else {
          this.updateBacklog.push(resp);
          // Drop the oldest only once past the cap; the newest is the one that explains a failure.
          if (this.updateBacklog.length > UPDATE_BACKLOG_MAX) this.updateBacklog.shift();
        }
      }
      return;
    }
    if (f.ty === FrameType.Log) {
      this.events.onLog?.(parseLog(f.payload));
      return;
    }
    if (f.ty === FrameType.MotionEvent) {
      const motion = parseMotionEvent(f.payload);
      if (motion) this.events.onEvent?.({ kind: 'motion', motion }, f.seq);
      return;
    }
    if (f.ty === FrameType.UsageEvent) {
      const snapshot = parseUsageEvent(f.payload);
      if (snapshot) this.events.onEvent?.({ kind: 'usages', snapshot }, f.seq);
      return;
    }
    if (f.ty === FrameType.TrafficEvent) {
      const traffic = parseTrafficEvent(f.payload);
      if (traffic) this.events.onEvent?.({ kind: 'traffic', traffic }, f.seq);
    }
  }

  async queryFirmware(timeoutMs?: number): Promise<FirmwareInfo> {
    const resp = parseResp(await this.query(Q_FIRMWARE, timeoutMs));
    if (resp?.kind !== 'firmware') throw new NoReplyError('the firmware query');
    return resp.firmware;
  }

  /** Block until neither chip is on probation; a chip that has not confirmed its image refuses an update. */
  async waitFirmwareConfirmed(timeoutMs = CONFIRM_TIMEOUT_MS): Promise<FirmwareInfo> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const info = await this.queryFirmware();
      if (!anyPending(info)) return info;
      if (Date.now() >= deadline) throw new UpdateError(OTA_OP_BEGIN, 0x1b, 0);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  /**
   * Write one image into a chip's spare slot. It stays inert until `activateFirmware`, so nothing
   * boots it and a power cut brings the running image back.
   */
  async stageFirmware(
    target: number,
    image: Uint8Array,
    onProgress?: (sent: number, total: number) => void,
  ): Promise<void> {
    if (image.length === 0) throw new Error('image is empty');
    await this.waitFirmwareConfirmed();

    this.updateBacklog.length = 0;   // nothing queued answers the session about to start
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', image as BufferSource));
    const begin = new Uint8Array(4 + digest.length);
    new DataView(begin.buffer).setUint32(0, image.length, true);
    begin.set(digest, 4);
    const ready = await this.updateOp(OTA_OP_BEGIN, target, begin, UPDATE_OP_TIMEOUT_MS);
    if (ready.status !== UPD_READY) throw new UpdateError(OTA_OP_BEGIN, ready.status, ready.arg);

    const credit = ready.arg || OTA_CREDIT;
    let seq = 0;
    let sent = 0;
    let unacked = 0;
    while (sent < image.length) {
      const end = Math.min(sent + OTA_CHUNK, image.length);
      const frame = new Uint8Array(4 + (end - sent));
      frame[0] = OTA_OP_DATA;
      frame[1] = target;
      frame[2] = seq & 0xff;
      frame[3] = (seq >> 8) & 0xff;
      frame.set(image.subarray(sent, end), 4);
      await this.send(encode(FrameType.Update, this.nextSeq(), frame));
      seq = (seq + 1) & 0xffff;
      sent = end;
      unacked++;
      if (unacked < credit && sent < image.length) continue;
      // No pre-arm: an acknowledgement that beats this await lands in the backlog and is picked up
      // from there, and arming early leaked a rejected promise on every error path below.
      const ack = await this.awaitUpdate(OTA_OP_DATA, UPDATE_OP_TIMEOUT_MS);
      if (ack.status !== UPD_OK && ack.status !== UPD_ACK) {
        throw new UpdateError(OTA_OP_DATA, ack.status, ack.arg);
      }
      // The box reports the chunk it expects next. A disagreement means the two sides no longer share
      // an offset, and writing on would put bytes in the wrong place.
      if (ack.arg !== seq) throw new UpdateError(OTA_OP_DATA, 0x13, ack.arg);
      unacked = 0;
      onProgress?.(sent, image.length);
    }

    const staged = await this.updateOp(OTA_OP_END, target, new Uint8Array(0), UPDATE_OP_TIMEOUT_MS);
    if (staged.status !== UPD_STAGED) throw new UpdateError(OTA_OP_END, staged.status, staged.arg);
  }

  /** Drop whatever is staged or in flight for one target; the clone comes back without a reboot. */
  async abortUpdate(target: number, timeoutMs = UPDATE_OP_TIMEOUT_MS): Promise<void> {
    this.updateBacklog.length = 0;
    const r = await this.updateOp(OTA_OP_ABORT, target, new Uint8Array(0), timeoutMs);
    if (r.status !== UPD_OK) throw new UpdateError(OTA_OP_ABORT, r.status, r.arg);
  }

  /** Commit every staged image and reboot into it. The host chip goes first and has to come back. */
  async activateFirmware(): Promise<void> {
    const r = await this.updateOp(
      OTA_OP_ACTIVATE,
      OTA_TGT_DEVICE,
      new Uint8Array(0),
      ACTIVATE_TIMEOUT_MS,
    );
    if (r.status !== UPD_OK) throw new UpdateError(OTA_OP_ACTIVATE, r.status, r.arg);
  }

  private async updateOp(
    op: number,
    target: number,
    body: Uint8Array,
    timeoutMs: number,
  ): Promise<UpdateResp> {
    // Anything queued for THIS op answers an earlier command; served here it would read as a fresh
    // success. The other two clients drop the same thing at the same point.
    this.updateBacklog = this.updateBacklog.filter((r) => r.op !== op);
    const frame = new Uint8Array(2 + body.length);
    frame[0] = op;
    frame[1] = target;
    frame.set(body, 2);
    const wait = this.awaitUpdate(op, timeoutMs);
    await this.send(encode(FrameType.Update, this.nextSeq(), frame));
    return wait;
  }

  private awaitUpdate(op: number, timeoutMs: number): Promise<UpdateResp> {
    const queued = this.updateBacklog.findIndex((r) => r.op === op);
    if (queued >= 0) return Promise.resolve(this.updateBacklog.splice(queued, 1)[0]);
    return new Promise<UpdateResp>((resolve, reject) => {
      // Delete by identity, not by key: an orphaned waiter's timer firing later must not evict a
      // live one that has since taken its place.
      const self = (r: UpdateResp | null, cause?: Error) => {
        clearTimeout(timer);
        if (this.updateWaiters.get(op) === self) this.updateWaiters.delete(op);
        if (r) resolve(r);
        else reject(cause ?? new Error(`update op ${op} was superseded`));
      };
      const timer = setTimeout(() => {
        if (this.updateWaiters.get(op) === self) this.updateWaiters.delete(op);
        reject(new QueryTimeoutError());
      }, timeoutMs);
      const prev = this.updateWaiters.get(op);
      if (prev) prev(null);   // displaced, not silently dropped
      this.updateWaiters.set(op, self);
    });
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    // Update waiters too: without this an in-flight op sits out its full 20 to 60 second timeout
    // after the port is already gone.
    for (const w of this.updateWaiters.values()) w(null, err);   // the real cause, not a supersession
    this.updateWaiters.clear();
    this.updateBacklog.length = 0;
  }
}
