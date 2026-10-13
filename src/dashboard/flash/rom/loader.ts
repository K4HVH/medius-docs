/// <reference types="w3c-web-serial" />
// The ESP32-S3 boot ROM's serial protocol, and esp-flasher-stub's once the ROM has started it. Addresses and
// values are the ESP32-S3's, from its Technical Reference Manual and esptool 5.
import { Zlib } from 'fflate';
import SparkMD5 from 'spark-md5';
import { NotTheBox } from '../types';
import { NoAnswer, RomPort } from './port';
import stub from './stub/esp32s3.json';

const OP = {
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

const CHIP_MAGIC_REG = 0x40001000;
const ESP32S3_MAGIC = 0x09;
// The ROM's console: 3 is USB-OTG, 4 USB-Serial/JTAG.
const UARTDEV_BUF_NO = 0x3fcef14c;
const MAC_EFUSE_REG = 0x60007044;
const GPIO_STRAP_REG = 0x60004038;
const STRAP_SPI_BOOT = 1 << 3;
const RTC_CNTL_OPTION1_REG = 0x6000812c;
const FORCE_DOWNLOAD_BOOT = 1;
const RTC_CNTL_WDTCONFIG0_REG = 0x60008098;
const RTC_CNTL_WDTCONFIG1_REG = 0x6000809c;
const RTC_CNTL_WDTWPROTECT_REG = 0x600080b0;
const RTC_CNTL_WDT_WKEY = 0x50d83aa1;
const RTC_CNTL_SWD_CONF_REG = 0x600080b4;
const RTC_CNTL_SWD_WPROTECT_REG = 0x600080b8;
const RTC_CNTL_SWD_WKEY = 0x8f1d312a;
const SWD_AUTO_FEED_EN = 1 << 31;
const SPI_CMD_REG = 0x60002000;
const SPI_USR_REG = 0x60002018;
const SPI_USR2_REG = 0x60002020;
const SPI_MISO_DLEN_REG = 0x60002028;
const SPI_W0_REG = 0x60002058;
const SPI_CMD_USR = 1 << 18;
const SPI_USR_COMMAND = 1 << 31;
const SPI_USR_MISO = 1 << 28;
const SPIFLASH_RDID = 0x9f;

const RAM_BLOCK = 0x1800;
const USB_OTG_RAM_BLOCK = 0x800;
// Each block of a write holds this much of the file, so a 2 MB image counts in steps under 1% and blank padding,
// which compresses to almost nothing, counts at the pace it is written. The stub takes blocks of up to 16 KiB.
const WRITE_PIECE = 0x2000;
const WRITE_BLOCK_MAX = 0x4000;
const READ_PACKET = 0x1000;

const WAIT_MS = 3000;
const SYNC_MS = 100;
const SYNC_TRIES = 10;
const MD5_MS_PER_MB = 8000;
// The stub programs 32 KiB at a time, so an answer can wait on 32 KiB written and a 64 KiB block or eight sectors
// erased: about 3.6 s at the flash's rated slowest.
const WRITE_BLOCK_MS = 6000;
const ERASE_FLASH_MS = 120_000;
const perMb = (msPerMb: number, bytes: number) => Math.max(WAIT_MS, Math.round((msPerMb * bytes) / 1e6));

// The flash's size from the capacity byte of its JEDEC id, as esptool reads it.
function flashBytes(capacity: number): number | null {
  if (capacity >= 0x12 && capacity <= 0x1c) return 2 ** capacity;
  if (capacity >= 0x20 && capacity <= 0x22) return 2 ** (capacity - 6);
  if (capacity >= 0x32 && capacity <= 0x3a) return 2 ** (capacity - 0x20);
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const md5Hex = (b: Uint8Array) => SparkMD5.ArrayBuffer.hash(new Uint8Array(b).buffer as ArrayBuffer);
const words = (...w: number[]) => {
  const out = new Uint8Array(w.length * 4);
  const v = new DataView(out.buffer);
  w.forEach((x, i) => v.setUint32(i * 4, x >>> 0, true));
  return out;
};
const join = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};
const checksum = (b: Uint8Array) => b.reduce((c, x) => c ^ x, 0xef);
const base64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// One zlib stream, a block for each WRITE_PIECE of the data. The flush ends each piece's block on a bit, not a
// byte: fflate 0.8.3's byte-aligned flush writes a stored block zlib rejects.
function deflatePieces(data: Uint8Array): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  let parts: Uint8Array[] = [];
  const z = new Zlib({ level: 9 }, (chunk) => parts.push(chunk));
  for (let at = 0; at < data.length; at += WRITE_PIECE) {
    const last = at + WRITE_PIECE >= data.length;
    z.push(data.subarray(at, at + WRITE_PIECE), last);
    if (!last) z.flush();
    const block = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
    parts.reduce((o, b) => (block.set(b, o), o + b.length), 0);
    blocks.push(block);
    parts = [];
  }
  return blocks;
}

interface Answer {
  value: number;
  // Everything after the header: any data, then the status. The ROM sends 4 status bytes and the stub 2.
  body: Uint8Array;
}

export class Rom {
  private block = RAM_BLOCK;
  // An earlier session left the stub running: it answers SYNC with 0, where the ROM sends a value.
  private stub = false;
  usb: 'otg' | 'jtag' | 'uart' = 'uart';
  // The factory MAC in the form a box id takes, "588c81e08244"; null when the eFuses read as zero.
  mac: string | null = null;

  private constructor(private readonly port: RomPort) {}

  // A chip already in download mode: synced, checked to be an ESP32-S3, its MAC read. Nothing is written
  // except, on USB-Serial/JTAG, the watchdogs that would otherwise reset it mid-flash.
  static async connect(serial: SerialPort): Promise<Rom> {
    const rom = new Rom(await RomPort.open(serial));
    try {
      await rom.sync();
      if ((await rom.readReg(CHIP_MAGIC_REG)) !== ESP32S3_MAGIC) throw new NotTheBox();
      const console = (await rom.readReg(UARTDEV_BUF_NO)) & 0xff;
      rom.usb = console === 3 ? 'otg' : console === 4 ? 'jtag' : 'uart';
      if (rom.usb === 'otg') rom.block = USB_OTG_RAM_BLOCK;
      if (rom.usb === 'jtag' && !rom.stub) await rom.quietWatchdogs();
      const mac0 = await rom.readReg(MAC_EFUSE_REG);
      const mac1 = await rom.readReg(MAC_EFUSE_REG + 4);
      const mac = hex(new Uint8Array([(mac1 >> 8) & 0xff, mac1 & 0xff, mac0 >>> 24, (mac0 >> 16) & 0xff, (mac0 >> 8) & 0xff, mac0 & 0xff]));
      rom.mac = mac === '000000000000' ? null : mac;
      return rom;
    } catch (e) {
      await rom.close();
      throw e;
    }
  }

  private async sync() {
    const frame = join(new Uint8Array([0x07, 0x07, 0x12, 0x20]), new Uint8Array(32).fill(0x55));
    for (let i = 0; i < SYNC_TRIES; i++) {
      this.port.drain();
      await this.send(OP.SYNC, frame);
      try {
        this.stub = (await this.answer(OP.SYNC, SYNC_MS)).value === 0;
        return;
      } catch (e) {
        if (!(e instanceof NoAnswer)) throw e;
      }
    }
    throw new Error("The chip didn't answer.");
  }

  private async quietWatchdogs() {
    await this.writeReg(RTC_CNTL_WDTWPROTECT_REG, RTC_CNTL_WDT_WKEY);
    await this.writeReg(RTC_CNTL_WDTCONFIG0_REG, 0);
    await this.writeReg(RTC_CNTL_WDTWPROTECT_REG, 0);
    await this.writeReg(RTC_CNTL_SWD_WPROTECT_REG, RTC_CNTL_SWD_WKEY);
    await this.writeReg(RTC_CNTL_SWD_CONF_REG, (await this.readReg(RTC_CNTL_SWD_CONF_REG)) | SWD_AUTO_FEED_EN);
    await this.writeReg(RTC_CNTL_SWD_WPROTECT_REG, 0);
  }

  private send(op: number, data: Uint8Array = new Uint8Array(0), chk = 0): Promise<void> {
    const frame = new Uint8Array(8 + data.length);
    const v = new DataView(frame.buffer);
    frame[1] = op;
    v.setUint16(2, data.length, true);
    v.setUint32(4, chk, true);
    frame.set(data, 8);
    return this.port.send(frame);
  }

  // The answer to `op`. Anything else that arrives meanwhile (the ROM's spare SYNC answers) is dropped.
  private async answer(op: number, ms: number): Promise<Answer> {
    const until = Date.now() + ms;
    for (;;) {
      const f = await this.port.next(Math.max(1, until - Date.now()));
      if (f.length < 10 || f[0] !== 1 || f[1] !== op) continue;
      const v = new DataView(f.buffer, f.byteOffset);
      return { value: v.getUint32(4, true), body: f.subarray(8, 8 + v.getUint16(2, true)) };
    }
  }

  // `data` bytes of answer, then the status, as esptool reads it: a first status byte other than 0 is a refusal.
  private async check(what: string, op: number, args?: Uint8Array, ms = WAIT_MS, chk = 0, data = 0): Promise<Answer> {
    await this.send(op, args, chk);
    const a = await this.answer(op, ms);
    const status = a.body.length >= data + 2 ? a.body.subarray(data, data + 2) : a.body.subarray(0, 2);
    if (status[0] !== 0 || a.body.length < data + 2) {
      const code = ((status[0] << 8) | (status[1] ?? 0)).toString(16).toUpperCase().padStart(4, '0');
      throw new Error(`The chip refused ${what} (0x${code}).`);
    }
    return { value: a.value, body: a.body.subarray(0, data) };
  }

  async readReg(addr: number): Promise<number> {
    return (await this.check('a register read', OP.READ_REG, words(addr))).value >>> 0;
  }

  async writeReg(addr: number, value: number, mask = 0xffffffff): Promise<void> {
    await this.check('a register write', OP.WRITE_REG, words(addr, value, mask, 0));
  }

  // A stub already running is left alone: an upload would overwrite the code it runs.
  async runStub(): Promise<void> {
    if (this.stub) return;
    for (const [field, at] of [
      [stub.text, stub.text_start],
      [stub.data, stub.data_start],
    ] as const) {
      const bytes = base64(field);
      const blocks = Math.ceil(bytes.length / this.block);
      await this.check('the stub upload', OP.MEM_BEGIN, words(bytes.length, blocks, this.block, at));
      for (let seq = 0; seq < blocks; seq++) {
        const part = bytes.subarray(seq * this.block, (seq + 1) * this.block);
        await this.check('the stub upload', OP.MEM_DATA, join(words(part.length, seq, 0, 0), part), WAIT_MS, checksum(part));
      }
    }
    try {
      await this.check('the stub start', OP.MEM_END, words(0, stub.entry));
      const until = Date.now() + WAIT_MS;
      while (new TextDecoder().decode(await this.port.next(Math.max(1, until - Date.now()))) !== 'OHAI');
    } catch (e) {
      throw e instanceof NoAnswer ? new Error("The flasher stub didn't start on the chip.") : e;
    }
    this.stub = true;
  }

  // The flash's size in bytes from its JEDEC id, told to the stub; null when the id names none.
  async attachFlash(): Promise<number | null> {
    await this.check('the flash attach', OP.SPI_ATTACH, words(0));
    const usr = await this.readReg(SPI_USR_REG);
    const usr2 = await this.readReg(SPI_USR2_REG);
    await this.writeReg(SPI_MISO_DLEN_REG, 24 - 1);
    await this.writeReg(SPI_USR_REG, SPI_USR_COMMAND | SPI_USR_MISO);
    await this.writeReg(SPI_USR2_REG, (7 << 28) | SPIFLASH_RDID);
    await this.writeReg(SPI_W0_REG, 0);
    await this.writeReg(SPI_CMD_REG, SPI_CMD_USR);
    let done = false;
    for (let i = 0; i < 10 && !done; i++) done = ((await this.readReg(SPI_CMD_REG)) & SPI_CMD_USR) === 0;
    if (!done) throw new Error("The chip's flash didn't answer.");
    const id = await this.readReg(SPI_W0_REG);
    await this.writeReg(SPI_USR_REG, usr);
    await this.writeReg(SPI_USR2_REG, usr2);
    const size = flashBytes((id >> 16) & 0xff);
    if (size !== null) await this.check('the flash size', OP.SPI_SET_PARAMS, words(0, size, 0x10000, 0x1000, 0x100, 0xffff));
    return size;
  }

  // Each packet is acknowledged with the count so far; the stub then sends the MD5 of all it sent.
  async readFlash(at: number, size: number): Promise<Uint8Array> {
    await this.check('a flash read', OP.READ_FLASH, words(at, size, READ_PACKET, 64));
    const out = new Uint8Array(size);
    let got = 0;
    while (got < size) {
      const packet = await this.port.next(WAIT_MS);
      out.set(packet.subarray(0, size - got), got);
      got += packet.length;
      await this.port.send(words(got));
    }
    const digest = await this.port.next(WAIT_MS);
    if (hex(digest) !== md5Hex(out)) throw new Error('A flash read was corrupted in transit.');
    return out;
  }

  async md5(at: number, size: number): Promise<string> {
    const a = await this.check('an MD5 check', OP.SPI_FLASH_MD5, words(at, size, 0, 0), perMb(MD5_MS_PER_MB, size), 0, 16);
    return hex(a.body);
  }

  // A refusal is left to the MD5 the caller checks after. An answer names no address, so one that comes late
  // is waited for once more and the command never sent again: a second command's answer would be taken for
  // the first's.
  async eraseRegion(at: number, size: number): Promise<void> {
    await this.send(OP.ERASE_REGION, words(at, size));
    try {
      await this.answer(OP.ERASE_REGION, WAIT_MS);
    } catch (e) {
      if (!(e instanceof NoAnswer)) throw e;
      await this.answer(OP.ERASE_REGION, WAIT_MS);
    }
  }

  async eraseFlash(): Promise<void> {
    await this.check('the erase', OP.ERASE_FLASH, undefined, ERASE_FLASH_MS);
  }

  // The stub erases each region as the write reaches it, answers a block once the block before it is decoded,
  // and reports a write's failure on the next command. `onWritten` counts the file's bytes sent on, which run
  // up to 32 KiB ahead of the flash. The MD5 of the range written must then match the file's.
  async write(data: Uint8Array, at: number, onWritten?: (written: number, total: number) => void): Promise<void> {
    const what = `the write at 0x${at.toString(16)}`;
    const blocks = deflatePieces(data);
    await this.check(what, OP.FLASH_DEFL_BEGIN, words(data.length, blocks.length, WRITE_BLOCK_MAX, at));
    for (const [seq, block] of blocks.entries()) {
      await this.check(what, OP.FLASH_DEFL_DATA, join(words(block.length, seq, 0, 0), block), seq ? WRITE_BLOCK_MS : WAIT_MS, checksum(block));
      // Every piece before the last is whole.
      if (seq) onWritten?.(seq * WRITE_PIECE, data.length);
    }
    await this.check(what, OP.FLASH_DEFL_END, words(1), WRITE_BLOCK_MS);
    onWritten?.(data.length, data.length);
    if ((await this.md5(at, data.length)) !== md5Hex(data)) {
      throw new Error(`The flash at 0x${at.toString(16)} doesn't match the file written there.`);
    }
  }

  // Starts the firmware. The button is GPIO0's strap, sampled only on a chip reset: the RTC watchdog gives one
  // on USB-OTG, an RTS pulse elsewhere. Forced download is cleared first, or the chip boots back into download
  // mode.
  async reset(): Promise<void> {
    await this.writeReg(RTC_CNTL_OPTION1_REG, 0, FORCE_DOWNLOAD_BOOT).catch(() => {});
    if (this.usb === 'otg') {
      const strap = await this.readReg(GPIO_STRAP_REG);
      const forced = (await this.readReg(RTC_CNTL_OPTION1_REG)) & FORCE_DOWNLOAD_BOOT;
      if (!(strap & STRAP_SPI_BOOT) && !forced) {
        await this.writeReg(RTC_CNTL_WDTWPROTECT_REG, RTC_CNTL_WDT_WKEY);
        await this.writeReg(RTC_CNTL_WDTCONFIG1_REG, 2000);
        await this.writeReg(RTC_CNTL_WDTCONFIG0_REG, (1 << 31) | (5 << 28) | (1 << 8) | 2);
        await this.writeReg(RTC_CNTL_WDTWPROTECT_REG, 0);
        await sleep(500);
        return;
      }
    }
    await this.port.signals({ dataTerminalReady: false, requestToSend: true });
    await sleep(100);
    await this.port.signals({ dataTerminalReady: false, requestToSend: false });
  }

  close(): Promise<void> {
    return this.port.close();
  }
}
