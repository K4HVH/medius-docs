/// <reference types="w3c-web-serial" />
import { SlipDecoder, slipEncode } from './slip';

// The baud means nothing on the chip's native USB; the ROM's UART default.
const BAUD = 115200;
// A frame the chip never takes: it NAKs its USB OUT while it is wedged.
const SEND_MS = 3000;

// No frame in time, or a frame the chip never took. Callers tell it apart from other failures by class.
export class NoAnswer extends Error {
  constructor() {
    super('The chip stopped answering.');
  }
}

// A Web Serial port as a queue of SLIP frames. A port that fails (the device went away) ends every wait at once
// with its error, rather than at the wait's timeout.
export class RomPort {
  private frames: Uint8Array[] = [];
  private waiter: ((f: Uint8Array | Error) => void) | null = null;
  private failed: Error | null = null;
  private readonly decoder = new SlipDecoder();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reading: Promise<void> = Promise.resolve();
  private writing = false;
  private closed = false;

  private constructor(private readonly port: SerialPort) {}

  static async open(port: SerialPort): Promise<RomPort> {
    await port.open({ baudRate: BAUD });
    const p = new RomPort(port);
    try {
      p.reader = port.readable!.getReader();
      p.writer = port.writable!.getWriter();
    } catch (e) {
      await p.close();
      throw e;
    }
    p.reading = p.read();
    return p;
  }

  private async read() {
    const reader = this.reader!;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const f of this.decoder.push(value)) this.deliver(f);
      }
      this.fail(new Error('The port closed partway through.'));
    } catch (e) {
      this.fail(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private deliver(f: Uint8Array) {
    const w = this.waiter;
    if (w) {
      this.waiter = null;
      w(f);
    } else {
      this.frames.push(f);
    }
  }

  private fail(e: Error) {
    this.failed ??= e;
    const w = this.waiter;
    this.waiter = null;
    w?.(this.failed);
  }

  async send(frame: Uint8Array): Promise<void> {
    if (this.failed) throw this.failed;
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.writing = true;
    try {
      await Promise.race([
        this.writer!.write(slipEncode(frame)),
        new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new NoAnswer()), SEND_MS))),
      ]);
      this.writing = false;
    } catch (e) {
      if (e instanceof NoAnswer) this.fail(e);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // The next frame from the chip, waiting up to `ms`. One wait at a time: a second would take the first's
  // frame.
  next(ms: number): Promise<Uint8Array> {
    if (this.waiter) return Promise.reject(new Error('A wait for the chip is already pending.'));
    const queued = this.frames.shift();
    if (queued) return Promise.resolve(queued);
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new NoAnswer());
      }, ms);
      this.waiter = (f) => {
        clearTimeout(timer);
        if (f instanceof Error) reject(f);
        else resolve(f);
      };
    });
  }

  drain() {
    this.frames = [];
  }

  async signals(s: SerialOutputSignals): Promise<void> {
    await this.port.setSignals(s);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      // the device may already be gone
    }
    await this.reading;
    this.reader?.releaseLock();
    // A write the chip never took is dropped, not waited for: an abort waits for a write in flight, and
    // closing the port ends that write.
    if (this.writing) this.writer?.abort().catch(() => {});
    this.writer?.releaseLock();
    try {
      await this.port.close();
    } catch {
      // as above
    }
  }
}
