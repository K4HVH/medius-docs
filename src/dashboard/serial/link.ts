/// <reference types="w3c-web-serial" />
// The device control link over Web Serial: frame the wire protocol, correlate
// QUERY/RESP by SEQ and selector, and run the version handshake. Mirrors the
// medius crate's link/correlation behavior.

import {
  type CatchEvent,
  type Caps,
  type CatchState,
  type DecodedFrame,
  type DeviceInfo,
  type EmitPace,
  type Health,
  type ImperfectStatus,
  type Locks,
  type LogLine,
  type Rate,
  type Stats,
  type Version,
  EmitMode,
  FrameDecoder,
  FrameType,
  PROTO_VER,
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
  INJ_KEY,
  INJ_MEDIA,
  LedMode,
  LedTarget,
  LockClass,
  LockDirection,
  LockTarget,
  RebootTarget,
  catchPayload,
  emitPayload,
  encode,
  imperfectPayload,
  injectPayload,
  ledPayload,
  lockPayload,
  moveRidePayload,
  parseConsEvent,
  parseKbEvent,
  parseLog,
  parseMouseEvent,
  parseResp,
  queryPayload,
  rebootPayload,
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
  constructor() {
    super('no reply to the version handshake');
    this.name = 'NoReplyError';
  }
}

export class BadProtoVerError extends Error {
  constructor(readonly got: number) {
    super(`unsupported protocol version ${got} (expected ${PROTO_VER})`);
    this.name = 'BadProtoVerError';
  }
}

export interface SerialLinkEvents {
  onLog?: (line: LogLine) => void;
  onClose?: (reason?: Error) => void;
  onVersionHello?: (version: Version) => void;
  // An unsolicited physical-input event (the CATCH stream); `seq` is the box's rolling event counter.
  // The event is tagged mouse / keyboard / media by its source frame type.
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
  private seq = 1;
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
    await this.port.open({ baudRate: CTRL_BAUD });
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
        if (version.protoVer !== PROTO_VER) {
          throw new BadProtoVerError(version.protoVer);
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

  lock(target: LockTarget, direction: LockDirection): Promise<void> {
    return this.send(
      encode(FrameType.Lock, this.nextSeq(), lockPayload(LockClass.Mouse, target, direction, 1)),
    );
  }

  unlock(target: LockTarget, direction: LockDirection): Promise<void> {
    return this.send(
      encode(FrameType.Lock, this.nextSeq(), lockPayload(LockClass.Mouse, target, direction, 0)),
    );
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

  // Subscribe to the physical-input event stream (§3.9); event frames arrive on `onEvent` tagged
  // mouse / keyboard / media. mask 0 unsubscribes. The subscription clears after ~1 s of silence,
  // so poll a query to hold it alive.
  catch(mask: number): Promise<void> {
    return this.send(encode(FrameType.Catch, this.nextSeq(), catchPayload(mask)));
  }

  uncatch(): Promise<void> {
    return this.catch(0);
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

  // Set emit-rate pacing (§3.10): the source the box paces injection to. Learned tracks the mouse's
  // native report rate (default), Interval follows the cloned poll rate, Fixed paces at rateHz (snapped
  // to 1000/n, capped at 1000). rateHz only matters in Fixed mode. It raises the emit ceiling only; idle
  // still emits when pending. Persisted in NVS. Read back with `queryEmitPace`.
  setEmitPace(mode: EmitMode, rateHz = 0): Promise<void> {
    return this.send(encode(FrameType.Option, this.nextSeq(), emitPayload(mode, rateHz)));
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
      await this.port.close();
    } catch {
      // ignore
    }
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
    if (f.ty === FrameType.Log) {
      this.events.onLog?.(parseLog(f.payload));
      return;
    }
    if (f.ty === FrameType.MouseEvent) {
      const report = parseMouseEvent(f.payload);
      if (report) this.events.onEvent?.({ kind: 'mouse', report }, f.seq);
      return;
    }
    if (f.ty === FrameType.KbEvent) {
      const report = parseKbEvent(f.payload);
      if (report) this.events.onEvent?.({ kind: 'keyboard', report }, f.seq);
      return;
    }
    if (f.ty === FrameType.ConsEvent) {
      const report = parseConsEvent(f.payload);
      if (report) this.events.onEvent?.({ kind: 'media', report }, f.seq);
    }
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }
}
