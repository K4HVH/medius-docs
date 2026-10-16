// An ESP32-S3 in ROM download as the dashboard's ROM client meets it, at the byte level: the boot ROM until
// MEM_END starts the uploaded stub, then esp-flasher-stub, over a flash held here. Tests read what it was
// sent and set faults through `on`. Where the ROM and the stub differ, it follows them: the ROM answers with
// 4 status bytes and the stub with 2; the stub takes MEM_* too, and writing over itself breaks it; the stub
// reports a block's write failure on the next command. A write erases its sectors at FLASH_DEFL_BEGIN and decodes
// each block as it comes, as the stub does.
/// <reference types="w3c-web-serial" />
import { createHash } from 'node:crypto';
import { Unzlib } from 'fflate';
import { SlipDecoder, slipEncode } from '../../../src/dashboard/flash/rom/slip';
import stub from '../../../src/dashboard/flash/rom/stub/esp32s3.json';

export const OP = {
  SYNC: 0x08,
  WRITE_REG: 0x09,
  READ_REG: 0x0a,
  SPI_SET_PARAMS: 0x0b,
  SPI_ATTACH: 0x0d,
  MEM_BEGIN: 0x05,
  MEM_END: 0x06,
  MEM_DATA: 0x07,
  FLASH_DEFL_BEGIN: 0x10,
  FLASH_DEFL_DATA: 0x11,
  FLASH_DEFL_END: 0x12,
  SPI_FLASH_MD5: 0x13,
  ERASE_FLASH: 0xd0,
  ERASE_REGION: 0xd1,
  READ_FLASH: 0xd2,
} as const;

export const REG = {
  MAGIC: 0x40001000,
  UARTDEV_BUF_NO: 0x3fcef14c,
  MAC0: 0x60007044,
  MAC1: 0x60007048,
  STRAP: 0x60004038,
  OPTION1: 0x6000812c,
  WDTCONFIG0: 0x60008098,
  WDTCONFIG1: 0x6000809c,
  WDTWPROTECT: 0x600080b0,
  SWD_CONF: 0x600080b4,
  SWD_WPROTECT: 0x600080b8,
  SPI_CMD: 0x60002000,
  SPI_W0: 0x60002058,
} as const;

// A command as the chip took it, and what the test wants done with it: `late` answers after that many ms,
// `drop` never answers, `status` answers with that refusal, `deferred` answers now and refuses the next
// command with it (as the stub reports a block's failed write), `lose` makes the device go away.
export interface Seen {
  op: number;
  data: Uint8Array;
  stub: boolean;
}
export type Fault =
  | { late: number }
  | 'drop'
  | { status: [number, number] }
  | { deferred: [number, number] }
  | 'lose'
  | undefined;

export interface ChipSetup {
  magic?: number;
  // 3 USB-OTG, 4 USB-Serial/JTAG.
  uartNo?: number;
  // JEDEC id as RDID reads it: manufacturer, type, capacity (0x16: 4 MB).
  flashId?: number;
  size?: number;
  // eFuse words holding the MAC 58:8c:81:df:1e:28.
  mac?: [number, number];
  // Bit 3 clear: GPIO0 was low at reset, the button held.
  strap?: number;
  // The ROM never answers SYNC.
  deaf?: boolean;
  // The stub is already running: an earlier session started it.
  stubRunning?: boolean;
}

const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));
const xor = (b: Uint8Array) => b.reduce((c, x) => c ^ x, 0xef);

export function romChip(setup: ChipSetup = {}) {
  const size = setup.size ?? 0x400000;
  const flash = new Uint8Array(size).fill(0xff);
  const regs = new Map<number, number>([
    [REG.MAGIC, setup.magic ?? 0x09],
    [REG.UARTDEV_BUF_NO, setup.uartNo ?? 3],
    [REG.MAC0, (setup.mac ?? [0x81df1e28, 0x588c])[0]],
    [REG.MAC1, (setup.mac ?? [0x81df1e28, 0x588c])[1]],
    [REG.STRAP, setup.strap ?? 0x0],
    [REG.OPTION1, 0x1],
    [REG.SWD_CONF, 0x0],
  ]);
  const state = {
    stub: !!setup.stubRunning,
    // The stub took a MEM_* load over itself and answers nothing more.
    trampled: false,
    seen: [] as Seen[],
    writes: [] as { addr: number; value: number; mask: number }[],
    signals: [] as SerialOutputSignals[],
    reset: null as null | 'watchdog' | 'rts',
    closed: false,
    // What the uploaded RAM held when MEM_END ran: text and data at their addresses.
    ram: new Map<number, Uint8Array>(),
    entry: -1,
    params: null as null | number[],
    // What each block of the last write decoded to, in bytes.
    inflated: [] as number[],
    on: (() => undefined) as (s: Seen) => Fault,
  };

  let out!: ReadableStreamDefaultController<Uint8Array>;
  let gone = false;
  const decoder = new SlipDecoder();
  const emit = (frame: Uint8Array) => {
    if (!gone) out.enqueue(slipEncode(frame));
  };
  const answer = (op: number, value = 0, data: Uint8Array = new Uint8Array(0), status: [number, number] = [0, 0]) => {
    const tail = state.stub ? status : [...status, 0, 0];
    const f = new Uint8Array(8 + data.length + tail.length);
    const v = new DataView(f.buffer);
    f[0] = 1;
    f[1] = op;
    v.setUint16(2, data.length + tail.length, true);
    v.setUint32(4, value >>> 0, true);
    f.set(data, 8);
    f.set(tail, 8 + data.length);
    return f;
  };
  const lose = () => {
    if (gone) return;
    gone = true;
    out.error(new DOMException('The device has been lost.', 'NetworkError'));
  };

  let defl: { at: number; size: number; written: number; inflate: Unzlib } | null = null;
  // A READ_FLASH in progress: what is left to send, and everything sent.
  let reading: { at: number; left: number; packet: number; sent: Uint8Array[] } | null = null;
  // A failure the stub reports on the next command.
  let pending: [number, number] | null = null;
  let rts = false;

  const md5 = (b: Uint8Array) => createHash('md5').update(b).digest();
  const sendRead = () => {
    const r = reading!;
    if (r.left === 0) {
      emit(md5(Buffer.concat(r.sent)));
      reading = null;
      return;
    }
    const n = Math.min(r.packet, r.left);
    const chunk = flash.slice(r.at, r.at + n);
    r.sent.push(chunk);
    r.at += n;
    r.left -= n;
    emit(chunk);
  };

  // What the command does, and its answer; null for no answer.
  const run = (op: number, d: Uint8Array, chk: number): Uint8Array | null => {
    switch (op) {
      case OP.SYNC: {
        const value = state.stub ? 0 : 0x20120707;
        for (let i = 0; i < 7; i++) emit(answer(op, value));
        return answer(op, value);
      }
      case OP.READ_REG:
        return answer(op, regs.get(u32(d, 0)) ?? 0);
      case OP.WRITE_REG: {
        for (let at = 0; at + 16 <= d.length; at += 16) {
          const addr = u32(d, at);
          const value = u32(d, at + 4);
          const mask = u32(d, at + 8);
          state.writes.push({ addr, value, mask });
          regs.set(addr, ((regs.get(addr) ?? 0) & ~mask) | (value & mask));
          // An SPI user command: RDID answers in W0, and the command bit clears.
          if (state.stub && addr === REG.SPI_CMD && value & (1 << 18)) {
            regs.set(REG.SPI_W0, setup.flashId ?? 0x164020);
            regs.set(REG.SPI_CMD, 0);
          }
          // The armed watchdog resets the chip about 15 ms later, and its USB goes.
          if (addr === REG.WDTCONFIG0 && value & (1 << 31)) {
            state.reset = 'watchdog';
            setTimeout(lose, 15);
          }
        }
        return answer(op);
      }
      case OP.MEM_BEGIN:
        if (state.stub) {
          state.trampled = true;
          return answer(op);
        }
        state.ram.set(u32(d, 12), new Uint8Array(0));
        return answer(op);
      case OP.MEM_DATA: {
        const len = u32(d, 0);
        const block = d.slice(16, 16 + len);
        if (xor(block) !== chk) return answer(op, 0, undefined, [0x01, 0x07]);
        const start = [...state.ram.keys()].at(-1)!;
        const had = state.ram.get(start)!;
        const joined = new Uint8Array(had.length + block.length);
        joined.set(had);
        joined.set(block, had.length);
        state.ram.set(start, joined);
        return answer(op);
      }
      case OP.MEM_END: {
        state.entry = u32(d, 4);
        emit(answer(op));
        const text = state.ram.get(stub.text_start);
        const data = state.ram.get(stub.data_start);
        const good =
          u32(d, 0) === 0 &&
          state.entry === stub.entry &&
          !!text &&
          !!data &&
          Buffer.from(text).equals(Buffer.from(b64(stub.text))) &&
          Buffer.from(data).equals(Buffer.from(b64(stub.data)));
        if (good) {
          state.stub = true;
          emit(new TextEncoder().encode('OHAI'));
        }
        return null;
      }
      case OP.SPI_ATTACH:
        return answer(op);
      case OP.SPI_SET_PARAMS:
        state.params = [0, 4, 8, 12, 16, 20].map((i) => u32(d, i));
        return answer(op);
      case OP.SPI_FLASH_MD5: {
        const at = u32(d, 0);
        return answer(op, 0, md5(flash.slice(at, at + u32(d, 4))));
      }
      case OP.ERASE_REGION: {
        const at = u32(d, 0);
        const n = u32(d, 4);
        if (at % 0x1000 || n % 0x1000) return answer(op, 0, undefined, [0xc0, 0]);
        flash.fill(0xff, at, at + n);
        return answer(op);
      }
      case OP.ERASE_FLASH:
        flash.fill(0xff);
        return answer(op);
      case OP.READ_FLASH:
        reading = { at: u32(d, 0), left: u32(d, 4), packet: u32(d, 8), sent: [] };
        emit(answer(op));
        sendRead();
        return null;
      case OP.FLASH_DEFL_BEGIN: {
        const w = { size: u32(d, 0), at: u32(d, 12), written: 0, inflate: new Unzlib() };
        w.inflate.ondata = (chunk) => {
          flash.set(chunk, w.at + w.written);
          w.written += chunk.length;
        };
        flash.fill(0xff, Math.floor(w.at / 0x1000) * 0x1000, Math.ceil((w.at + w.size) / 0x1000) * 0x1000);
        defl = w;
        state.inflated = [];
        return answer(op);
      }
      case OP.FLASH_DEFL_DATA: {
        const len = u32(d, 0);
        const block = d.slice(16, 16 + len);
        if (!defl) return answer(op, 0, undefined, [0xc6, 0]);
        if (xor(block) !== chk) return answer(op, 0, undefined, [0xc1, 0]);
        if (u32(d, 4) !== state.inflated.length) return answer(op, 0, undefined, [0xc7, 0]);
        const before = defl.written;
        defl.inflate.push(block);
        state.inflated.push(defl.written - before);
        return answer(op);
      }
      case OP.FLASH_DEFL_END: {
        if (!defl) return answer(op, 0, undefined, [0xc6, 0]);
        const ended = defl.written === defl.size;
        defl = null;
        if (!ended) return answer(op, 0, undefined, [0xc0, 0]);
        return answer(op);
      }
      default:
        return answer(op, 0, undefined, [0xc3, 0]);
    }
  };

  const take = (frame: Uint8Array) => {
    if (state.trampled) return;
    if (reading && frame.length === 4) {
      sendRead();
      return;
    }
    if (frame[0] !== 0 || frame.length < 8) return;
    const op = frame[1];
    const data = frame.slice(8, 8 + (frame[2] | (frame[3] << 8)));
    const chk = u32(frame, 4);
    if (setup.deaf && !state.stub) return;
    // Before the stub runs, the ROM knows no stub command.
    if (!state.stub && op >= 0xd0) {
      emit(answer(op, 0, undefined, [0x01, 0x05]));
      return;
    }
    const seen = { op, data, stub: state.stub };
    state.seen.push(seen);
    if (pending) {
      emit(answer(op, 0, undefined, pending));
      pending = null;
      return;
    }
    const fault = state.on(seen);
    if (fault === 'lose') return lose();
    if (fault === 'drop') return;
    if (fault && typeof fault === 'object' && 'status' in fault) {
      emit(answer(op, 0, undefined, fault.status));
      return;
    }
    const reply = run(op, data, chk);
    if (fault && typeof fault === 'object' && 'deferred' in fault) pending = fault.deferred;
    if (!reply) return;
    if (fault && typeof fault === 'object' && 'late' in fault) setTimeout(() => emit(reply), fault.late);
    else emit(reply);
  };

  const port = {
    readable: new ReadableStream<Uint8Array>({
      start: (c) => {
        out = c;
        // The ROM's boot text, before any frame.
        if (!state.stub) c.enqueue(new TextEncoder().encode('ESP-ROM:esp32s3-20210327\r\nwaiting for download\r\n'));
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write: (b) => {
        for (const f of decoder.push(b)) take(f);
      },
    }),
    async open() {},
    async close() {
      state.closed = true;
    },
    async setSignals(s: SerialOutputSignals) {
      state.signals.push(s);
      if (s.requestToSend === undefined) return;
      // USB-Serial/JTAG holds the chip in reset while RTS is set with DTR clear; on USB-OTG the stub resets
      // the chip on RTS falling.
      if (setup.uartNo === 4 && s.requestToSend && !s.dataTerminalReady) state.reset = 'rts';
      if (setup.uartNo !== 4 && rts && !s.requestToSend && state.stub) state.reset = 'rts';
      rts = s.requestToSend;
    },
  };

  return { port: port as unknown as SerialPort, flash, regs, state, lose };
}
