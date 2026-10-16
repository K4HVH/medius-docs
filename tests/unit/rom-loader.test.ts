import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Rom } from '../../src/dashboard/flash/rom/loader';
import stub from '../../src/dashboard/flash/rom/stub/esp32s3.json';
import { OP, REG, romChip, type ChipSetup } from './helpers/romChip';

const md5 = (b: Uint8Array) => createHash('md5').update(b).digest('hex');
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);

// A chip with the stub running and its flash attached.
async function ready(setup: ChipSetup = {}) {
  const chip = romChip(setup);
  const rom = await Rom.connect(chip.port);
  await rom.runStub();
  await rom.attachFlash();
  return { chip, rom };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Rom.connect', () => {
  it('syncs past the boot text, and reads the chip, its port kind and its MAC without writing anything', async () => {
    const chip = romChip();
    const rom = await Rom.connect(chip.port);
    expect(rom.usb).toBe('otg');
    expect(rom.mac).toBe('588c81df1e28');
    expect(chip.state.seen[0].op).toBe(OP.SYNC);
    expect(chip.state.writes).toEqual([]);
    await rom.close();
    expect(chip.state.closed).toBe(true);
  });

  it('gives no MAC when the eFuses read as zero', async () => {
    const chip = romChip({ mac: [0, 0] });
    const rom = await Rom.connect(chip.port);
    expect(rom.mac).toBeNull();
    await rom.close();
  });

  it('refuses a chip that is not an ESP32-S3, and closes the port', async () => {
    const chip = romChip({ magic: 0x00f01d83 });
    await expect(Rom.connect(chip.port)).rejects.toThrow("This isn't an ESP32-S3, so it isn't one of the box's chips. Pick the box in the list.");
    expect(chip.state.writes).toEqual([]);
    expect(chip.state.closed).toBe(true);
  });

  it('says so when the ROM never answers, and closes the port', async () => {
    const chip = romChip({ deaf: true });
    await expect(Rom.connect(chip.port)).rejects.toThrow("The chip didn't answer.");
    expect(chip.state.closed).toBe(true);
  });

  it('on USB-Serial/JTAG turns the RTC watchdog off and has the super watchdog fed, as esptool does', async () => {
    const chip = romChip({ uartNo: 4 });
    const rom = await Rom.connect(chip.port);
    expect(rom.usb).toBe('jtag');
    expect(chip.state.writes.map((w) => [w.addr, w.value])).toEqual([
      [REG.WDTWPROTECT, 0x50d83aa1],
      [REG.WDTCONFIG0, 0],
      [REG.WDTWPROTECT, 0],
      [REG.SWD_WPROTECT, 0x8f1d312a],
      [REG.SWD_CONF, 1 << 31],
      [REG.SWD_WPROTECT, 0],
    ].map(([a, v]) => [a, v >>> 0]));
    await rom.close();
  });
});

describe('Rom.runStub', () => {
  it("uploads the stub's text and data where it runs, starts it at its entry, and waits for its greeting", async () => {
    const chip = romChip();
    const rom = await Rom.connect(chip.port);
    await rom.runStub();
    expect(chip.state.stub).toBe(true);
    expect(chip.state.entry).toBe(stub.entry);
    await rom.close();
  });

  it("reads the ROM's status from the front of its 4 status bytes: a refused upload stops there", async () => {
    const chip = romChip();
    chip.state.on = (s) => (s.op === OP.MEM_DATA ? { status: [0x01, 0x07] } : undefined);
    const rom = await Rom.connect(chip.port);
    await expect(rom.runStub()).rejects.toThrow('The chip refused the stub upload (0x0107).');
    expect(chip.state.seen.filter((s) => s.op === OP.MEM_DATA)).toHaveLength(1);
    await rom.close();
  });

  it('uploads nothing to a stub an earlier session left running, which would overwrite itself', async () => {
    const chip = romChip({ stubRunning: true });
    const rom = await Rom.connect(chip.port);
    await rom.runStub();
    expect(chip.state.seen.some((s) => s.op === OP.MEM_BEGIN)).toBe(false);
    expect(await rom.attachFlash()).toBe(0x400000);
    await rom.close();
  });

  it('says the stub did not start when it never greets, and passes on a device that went away', async () => {
    const quiet = romChip();
    quiet.state.on = (s) => (s.op === OP.MEM_END ? 'drop' : undefined);
    const a = await Rom.connect(quiet.port);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const started = a.runStub();
    const failed = expect(started).rejects.toThrow("The flasher stub didn't start on the chip.");
    await vi.advanceTimersByTimeAsync(7000);
    await failed;
    await a.close();
    vi.useRealTimers();

    const gone = romChip();
    gone.state.on = (s) => (s.op === OP.MEM_END ? 'lose' : undefined);
    const b = await Rom.connect(gone.port);
    await expect(b.runStub()).rejects.toThrow('The device has been lost.');
    await b.close();
  });

  it('sends RAM in blocks of 0x800 on USB-OTG and 0x1800 elsewhere', async () => {
    for (const [uartNo, block] of [[3, 0x800], [4, 0x1800]]) {
      const chip = romChip({ uartNo });
      const rom = await Rom.connect(chip.port);
      await rom.runStub();
      const begins = chip.state.seen.filter((s) => s.op === OP.MEM_BEGIN);
      expect(begins.map((b) => u32(b.data, 8))).toEqual([block, block]);
      const sizes = chip.state.seen.filter((s) => s.op === OP.MEM_DATA).map((s) => u32(s.data, 0));
      expect(Math.max(...sizes)).toBe(block);
      await rom.close();
    }
  });
});

describe('Rom.attachFlash', () => {
  it("reads the flash's size from its JEDEC id and tells the stub, leaving the SPI registers as they were", async () => {
    const chip = romChip();
    chip.regs.set(0x60002018, 0x1234);
    chip.regs.set(0x60002020, 0x5678);
    const rom = await Rom.connect(chip.port);
    await rom.runStub();
    expect(await rom.attachFlash()).toBe(0x400000);
    expect(chip.state.params).toEqual([0, 0x400000, 0x10000, 0x1000, 0x100, 0xffff]);
    expect(chip.regs.get(0x60002018)).toBe(0x1234);
    expect(chip.regs.get(0x60002020)).toBe(0x5678);
    await rom.close();
  });

  it("reads every capacity code esptool knows, the 0x3x family included", async () => {
    for (const [id, size] of [[0x364020, 0x400000], [0x174020, 0x800000], [0x194020, 0x2000000], [0x204020, 0x4000000]]) {
      const { chip, rom } = await ready({ flashId: id });
      expect(chip.state.params?.[1]).toBe(size);
      await rom.close();
    }
  });

  it('knows no size for an id it cannot read, and sets none', async () => {
    const { chip, rom } = await ready({ flashId: 0x994020 });
    expect(chip.state.params).toBeNull();
    await rom.close();
  });
});

describe('reading and checking the flash', () => {
  it('reads across packets, each acknowledged, and checks the MD5 the stub sends after', async () => {
    const { chip, rom } = await ready();
    chip.flash.set(Uint8Array.from({ length: 0x3000 }, (_, i) => i & 0xff), 0x1800);
    const read = await rom.readFlash(0x1000, 0x4000);
    expect([...read]).toEqual([...chip.flash.slice(0x1000, 0x5000)]);
    await rom.close();
  });

  it("gives a region's MD5 as the stub computes it", async () => {
    const { chip, rom } = await ready();
    chip.flash.set([1, 2, 3], 0x20000);
    expect(await rom.md5(0x20000, 0x10000)).toBe(md5(chip.flash.slice(0x20000, 0x30000)));
    await rom.close();
  });
});

describe('Rom.eraseRegion', () => {
  it('erases a region in one command', async () => {
    const { chip, rom } = await ready();
    chip.flash.set([1, 2, 3], 0x30000);
    await rom.eraseRegion(0x30000, 0x10000);
    expect(chip.flash.slice(0x30000, 0x40000).every((b) => b === 0xff)).toBe(true);
    await rom.close();
  });

  it('waits once more for a late answer and never sends the command again', async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => (s.op === OP.ERASE_REGION ? { late: 4000 } : undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const done = rom.eraseRegion(0x30000, 0x10000);
    await vi.advanceTimersByTimeAsync(4500);
    await done;
    expect(chip.state.seen.filter((s) => s.op === OP.ERASE_REGION)).toHaveLength(1);
    await rom.close();
  });

  it('stops when the answer never comes, still having sent the command once', async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => (s.op === OP.ERASE_REGION ? 'drop' : undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const done = rom.eraseRegion(0x30000, 0x10000);
    const failed = expect(done).rejects.toThrow('The chip stopped answering.');
    await vi.advanceTimersByTimeAsync(7000);
    await failed;
    expect(chip.state.seen.filter((s) => s.op === OP.ERASE_REGION)).toHaveLength(1);
    await rom.close();
  });

  it('leaves a refused erase to the MD5 that follows it', async () => {
    const { chip, rom } = await ready();
    chip.flash.set([1], 0x30000);
    chip.state.on = (s) => (s.op === OP.ERASE_REGION ? { status: [0xc4, 0] } : undefined);
    await rom.eraseRegion(0x30000, 0x10000);
    expect(chip.flash[0x30000]).toBe(1);
    await rom.close();
  });
});

describe('Rom.write', () => {
  // Noise, so it compresses to several blocks.
  let seed = 1;
  const image = Uint8Array.from({ length: 100_000 }, () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24);

  it('writes the file compressed 8 KiB of it to a block, in order, then checks its MD5 on the chip', async () => {
    const { chip, rom } = await ready();
    const written: [number, number][] = [];
    await rom.write(image, 0x10000, (s, t) => written.push([s, t]));
    expect(md5(chip.flash.slice(0x10000, 0x10000 + image.length))).toBe(md5(image));
    const blocks = chip.state.seen.filter((s) => s.op === OP.FLASH_DEFL_DATA);
    expect(blocks.map((b) => u32(b.data, 4))).toEqual(blocks.map((_, i) => i));
    expect(blocks).toHaveLength(Math.ceil(image.length / 0x2000));
    expect(Math.max(...blocks.map((b) => u32(b.data, 0)))).toBeLessThanOrEqual(0x4000);
    const ops = chip.state.seen.map((s) => s.op);
    expect(ops.lastIndexOf(OP.SPI_FLASH_MD5)).toBeGreaterThan(ops.lastIndexOf(OP.FLASH_DEFL_END));
    expect(written.at(-1)).toEqual([image.length, image.length]);
    await rom.close();
  });

  it('sends blocks that each decode to their 8 KiB of the file', async () => {
    const { chip, rom } = await ready();
    await rom.write(image, 0x10000);
    const pieces = Array.from({ length: Math.ceil(image.length / 0x2000) }, (_, i) => Math.min(0x2000, image.length - i * 0x2000));
    expect(chip.state.inflated).toEqual(pieces);
    await rom.close();
  });

  it('counts the bytes of the file written, a blank stretch as evenly as data', async () => {
    // A factory image's shape: data, then a blank slot that compresses to almost nothing.
    const factory = new Uint8Array(2_000_000).fill(0xff);
    factory.set(image);
    const { rom } = await ready();
    const written: number[] = [];
    await rom.write(factory, 0, (s) => written.push(s));
    expect(written).toEqual([...written].sort((a, b) => a - b));
    const steps = written.map((s, i) => s - (written[i - 1] ?? 0));
    expect(Math.max(...steps)).toBeLessThanOrEqual(0x2000);
    expect(written.at(-1)).toBe(factory.length);
    await rom.close();
  });

  it('says what was written does not match when the MD5 differs', async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => {
      if (s.op === OP.SPI_FLASH_MD5) chip.flash[0x10005] ^= 0xff;
      return undefined;
    };
    await expect(rom.write(image, 0x10000)).rejects.toThrow("The flash at 0x10000 doesn't match the file written there.");
    await rom.close();
  });

  it('names a refusal with its status bytes and the address', async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => (s.op === OP.FLASH_DEFL_DATA ? { status: [0xc1, 0] } : undefined);
    await expect(rom.write(image, 0x10000)).rejects.toThrow('The chip refused the write at 0x10000 (0xC100).');
    await rom.close();
  });

  it("catches a block's failed write, which the stub reports on the command after it", async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => (s.op === OP.FLASH_DEFL_DATA && u32(s.data, 4) === 2 ? { deferred: [0xc4, 0] } : undefined);
    await expect(rom.write(image, 0x10000)).rejects.toThrow('The chip refused the write at 0x10000 (0xC400).');
    expect(chip.state.seen.filter((s) => s.op === OP.FLASH_DEFL_DATA)).toHaveLength(4);
    await rom.close();
  });

  it("waits 6 s for a block's answer, which can wait on 32 KiB written and an erase", async () => {
    for (const [late, ok] of [[5000, true], [7000, false]] as const) {
      const { chip, rom } = await ready();
      chip.state.on = (s) => (s.op === OP.FLASH_DEFL_DATA && u32(s.data, 4) === 1 ? { late } : undefined);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const done = rom.write(image, 0x10000);
      const settled = ok ? expect(done).resolves.toBeUndefined() : expect(done).rejects.toThrow('The chip stopped answering.');
      await vi.advanceTimersByTimeAsync(30_000);
      await settled;
      vi.useRealTimers();
      await rom.close();
    }
  });

  it('ends at once with the error of a device that goes away mid-write', async () => {
    const { chip, rom } = await ready();
    chip.state.on = (s) => (s.op === OP.FLASH_DEFL_DATA && u32(s.data, 4) === 1 ? 'lose' : undefined);
    const t0 = Date.now();
    await expect(rom.write(image, 0x10000)).rejects.toThrow('The device has been lost.');
    expect(Date.now() - t0).toBeLessThan(1000);
    await rom.close();
  });
});

describe('Rom.reset', () => {
  it('clears forced download, then on USB-OTG with the button strapped resets through the RTC watchdog', async () => {
    const { chip, rom } = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const done = rom.reset();
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(chip.regs.get(REG.OPTION1)! & 1).toBe(0);
    expect(chip.state.reset).toBe('watchdog');
    const wdt = chip.state.writes.filter((w) => [REG.WDTWPROTECT, REG.WDTCONFIG1, REG.WDTCONFIG0].includes(w.addr as never));
    expect(wdt.map((w) => [w.addr, w.value])).toEqual([
      [REG.WDTWPROTECT, 0x50d83aa1],
      [REG.WDTCONFIG1, 2000],
      [REG.WDTCONFIG0, ((1 << 31) | (5 << 28) | (1 << 8) | 2) >>> 0],
      [REG.WDTWPROTECT, 0],
    ]);
    expect(chip.state.signals).toEqual([]);
    await rom.close();
  });

  it('pulses RTS where the watchdog is not for it: USB-Serial/JTAG, or a chip not strapped by the button', async () => {
    for (const setup of [{ uartNo: 4 }, { strap: 0x8 }]) {
      const { chip, rom } = await ready(setup);
      await rom.reset();
      expect(chip.state.reset).toBe('rts');
      expect(chip.state.writes.some((w) => w.addr === REG.WDTCONFIG0 && w.value !== 0)).toBe(false);
      await rom.close();
    }
  });
});
