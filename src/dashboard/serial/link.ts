/// <reference types="w3c-web-serial" />
// The device control link over Web Serial: frame the wire protocol, correlate
// QUERY/RESP by SEQ and selector, and run the version handshake. Mirrors the
// medius crate's link/correlation behavior.

import {
  type CatchEvent,
  type CatchState,
  type DecodedFrame,
  type Health,
  type KbdCaps,
  type Locks,
  type LogLine,
  type MouseCaps,
  type MouseInfo,
  type Rate,
  type Stats,
  type Version,
  FrameDecoder,
  FrameType,
  PROTO_VER,
  Q_CATCH,
  Q_HEALTH,
  Q_KBD_CAPS,
  Q_LOCKS,
  Q_MOUSE_CAPS,
  Q_MOUSE_INFO,
  Q_RATE,
  Q_STATS,
  Q_VERSION,
  LedMode,
  LedTarget,
  LockDirection,
  LockTarget,
  RebootTarget,
  catchPayload,
  consumerPayload,
  encode,
  keyPayload,
  ledPayload,
  lockPayload,
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
        // Timeouts and transient unparseable replies retry; mirrors connect.rs.
      }
    }
    throw new NoReplyError();
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

  async queryMouseInfo(timeoutMs?: number): Promise<MouseInfo> {
    const resp = parseResp(await this.query(Q_MOUSE_INFO, timeoutMs));
    if (resp?.kind !== 'mouseInfo') throw new Error('unexpected reply to MOUSE_INFO query');
    return resp.mouseInfo;
  }

  async queryMouseCaps(timeoutMs?: number): Promise<MouseCaps> {
    const resp = parseResp(await this.query(Q_MOUSE_CAPS, timeoutMs));
    if (resp?.kind !== 'caps') throw new Error('unexpected reply to MOUSE_CAPS query');
    return resp.caps;
  }

  async queryKbdCaps(timeoutMs?: number): Promise<KbdCaps> {
    const resp = parseResp(await this.query(Q_KBD_CAPS, timeoutMs));
    if (resp?.kind !== 'kbdcaps') throw new Error('unexpected reply to KBD_CAPS query');
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

  reboot(target: RebootTarget): Promise<void> {
    return this.send(encode(FrameType.RebootDl, this.nextSeq(), rebootPayload(target)));
  }

  led(target: LedTarget, mode: LedMode, level: number): Promise<void> {
    return this.send(encode(FrameType.Led, this.nextSeq(), ledPayload(target, mode, level)));
  }

  lock(target: LockTarget, direction: LockDirection): Promise<void> {
    return this.send(encode(FrameType.Lock, this.nextSeq(), lockPayload(target, direction, 1)));
  }

  unlock(target: LockTarget, direction: LockDirection): Promise<void> {
    return this.send(encode(FrameType.Lock, this.nextSeq(), lockPayload(target, direction, 0)));
  }

  // Inject a keyboard key or modifier by HID keycode (§3.10), tri-state action (0/1/2).
  key(usage: number, action: number): Promise<void> {
    return this.send(encode(FrameType.Key, this.nextSeq(), keyPayload(usage, action)));
  }

  // Inject a media key by 16-bit Consumer usage (§3.11), tri-state action (0/1/2).
  consumer(usage: number, action: number): Promise<void> {
    return this.send(encode(FrameType.Consumer, this.nextSeq(), consumerPayload(usage, action)));
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
    const seq = this.nextSeq();
    const frame = encode(FrameType.Query, seq, queryPayload(what));
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
