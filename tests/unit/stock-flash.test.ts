import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { flashNativePort, flashStock, WrongChipError } from '../../src/dashboard/flash/flasher';
import type { FlashProgress } from '../../src/dashboard/flash';
import { OP, romChip, type ChipSetup } from './helpers/romChip';

const PKG = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) & 0xff);
const BOOT = Uint8Array.from({ length: 800 }, (_, i) => (i * 17 + 3) & 0xff);
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);
const blank = (b: Uint8Array) => b.every((x) => x === 0xff);
const md5 = (b: Uint8Array) => createHash('md5').update(b).digest('hex');

// A Medius app header naming its project, as the build stamps it.
function mediusApp(project: string): Uint8Array {
  const b = new Uint8Array(256);
  const dv = new DataView(b.buffer);
  b[0] = 0xe9;
  dv.setUint16(12, 9, true);
  dv.setUint32(32, 0xabcd5432, true);
  b.set(new TextEncoder().encode('3.4.5'), 48);
  b.set(new TextEncoder().encode(project), 80);
  return b;
}
// MAKCU's bootloader marker for a port, as its bootloaders carry it.
function stockBoot(role: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set(new TextEncoder().encode('MKCLIMG1'), 16);
  new DataView(b.buffer).setUint32(24, role, true);
  new DataView(b.buffer).setUint32(28, 2, true);
  return b;
}

function stock(chip: 'device' | 'host', setup: ChipSetup = {}, over: { anyway?: boolean; knownMain?: (mac: string) => boolean } = {}) {
  const c = romChip(setup);
  const seen: FlashProgress[] = [];
  const macs: (string | null)[] = [];
  const done = flashStock({ port: c.port, chip, pkg: PKG, boot: BOOT, onProgress: (p) => seen.push(p), onMac: (m) => macs.push(m), ...over });
  return { c, seen, macs, done };
}
const ops = (c: ReturnType<typeof romChip>, op: number) => c.state.seen.filter((s) => s.op === op);

describe('flashStock', () => {
  it("erases the whole flash, writes the package at 0x4000 and then the bootloader at 0x0, and starts MAKCU's firmware", async () => {
    const r = stock('device');
    r.c.flash.set([9, 9, 9], 0x2f0000);
    await r.done;
    expect(md5(r.c.flash.subarray(0x4000, 0x4000 + PKG.length))).toBe(md5(PKG));
    expect(md5(r.c.flash.subarray(0, BOOT.length))).toBe(md5(BOOT));
    expect(blank(r.c.flash.subarray(0x4000 + PKG.length))).toBe(true);
    expect(blank(r.c.flash.subarray(BOOT.length, 0x4000))).toBe(true);
    expect(ops(r.c, OP.FLASH_DEFL_BEGIN).map((s) => u32(s.data, 12))).toEqual([0x4000, 0]);
    expect(r.c.state.reset).toBe('watchdog');
    expect(r.c.state.closed).toBe(true);
    expect(r.macs).toEqual(['588c81df1e28']);
  });

  it("checks the package's MD5 before it writes the bootloader", async () => {
    const r = stock('device');
    await r.done;
    const order = r.c.state.seen.map((s) => (s.op === OP.FLASH_DEFL_BEGIN ? `write ${u32(s.data, 12).toString(16)}` : s.op === OP.SPI_FLASH_MD5 ? `md5 ${u32(s.data, 0).toString(16)}+${u32(s.data, 4)}` : ''));
    const writes = order.filter((s) => s.startsWith('write') || s === `md5 4000+${PKG.length}` || s === `md5 0+${BOOT.length}`);
    expect(writes).toEqual(['write 4000', `md5 4000+${PKG.length}`, 'write 0', `md5 0+${BOOT.length}`]);
  });

  it("erases all but the package's sectors before writing, each 64 KiB region holding data in one command", async () => {
    const r = stock('device');
    // The old bootloader, and data across two regions further on.
    r.c.flash.set([1], 0x100);
    r.c.flash.set(new Uint8Array(0x20).fill(2), 0x2fff0);
    await r.done;
    // The package ends in the sector at 0x5000.
    expect(ops(r.c, OP.ERASE_REGION).map((s) => [u32(s.data, 0), u32(s.data, 4)])).toEqual([
      [0, 0x4000],
      [0x20000, 0x10000],
      [0x30000, 0x10000],
    ]);
    const first = r.c.state.seen.findIndex((s) => s.op === OP.FLASH_DEFL_BEGIN);
    expect(r.c.state.seen.findLastIndex((s) => s.op === OP.ERASE_REGION)).toBeLessThan(first);
    expect(blank(r.c.flash.subarray(0x6000))).toBe(true);
  });

  it('counts the erase and both files as one figure, in bytes of the flash, then done', async () => {
    const r = stock('host');
    await r.done;
    const phases = r.seen.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1]);
    expect(phases).toEqual(['connecting', 'writing', 'done']);
    const writing = r.seen.filter((p) => p.phase === 'writing');
    // The bootloader's room is erased, then written.
    const total = 0x400000 + 0x1000;
    expect(new Set(writing.map((p) => p.total))).toEqual(new Set([total]));
    const written = writing.map((p) => p.written!);
    expect(written).toEqual([...written].sort((a, b) => a - b));
    expect(written[0]).toBe(0);
    expect(written.at(-1)).toBe(total);
    const steps = written.map((w, i) => w - (written[i - 1] ?? 0));
    expect(Math.max(...steps)).toBeLessThanOrEqual(0x10000);
  });

  it("refuses files that don't fit, before erasing anything", async () => {
    for (const [pkg, boot] of [[PKG, new Uint8Array(0x4001).fill(1)], [new Uint8Array(0x400000).fill(1), BOOT]]) {
      const c = romChip();
      await expect(flashStock({ port: c.port, chip: 'device', pkg, boot })).rejects.toThrow("MAKCU's files don't fit this flash.");
      expect(ops(c, OP.ERASE_REGION)).toEqual([]);
      expect(ops(c, OP.FLASH_DEFL_BEGIN)).toEqual([]);
    }
  });

  it('erases a refused region again, and stops on one that never erases, with nothing written', async () => {
    const once = stock('device');
    once.c.flash.set([1], 0x50000);
    let refusals = 1;
    once.c.state.on = (s) => (s.op === OP.ERASE_REGION && refusals-- > 0 ? { status: [0xc4, 0] } : undefined);
    await once.done;
    expect(ops(once.c, OP.ERASE_REGION)).toHaveLength(2);

    const never = stock('device');
    never.c.flash.set([1], 0x50000);
    never.c.state.on = (s) => (s.op === OP.ERASE_REGION ? { status: [0xc4, 0] } : undefined);
    await expect(never.done).rejects.toThrow("The flash at 0x50000 didn't erase after 3 tries.");
    expect(ops(never.c, OP.ERASE_REGION)).toHaveLength(3);
    expect(ops(never.c, OP.FLASH_DEFL_BEGIN)).toEqual([]);
    expect(never.c.state.closed).toBe(true);
  });

  it('erases a flash of unknown size in one command, uncounted, then counts the two files', async () => {
    const r = stock('device', { flashId: 0x994020 });
    await r.done;
    expect(ops(r.c, OP.ERASE_FLASH)).toHaveLength(1);
    expect(ops(r.c, OP.ERASE_REGION)).toEqual([]);
    expect(r.seen.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1])).toEqual(['connecting', 'erasing', 'writing', 'done']);
    expect(r.seen.find((p) => p.phase === 'erasing')!.total).toBeUndefined();
    expect(r.seen.filter((p) => p.phase === 'writing').at(-1)).toMatchObject({ written: 0x2000 + 0x1000, total: 0x2000 + 0x1000 });
  });

  it('refuses a chip that is not an ESP32-S3 before writing anything', async () => {
    const r = stock('device', { magic: 0x00f01d83 });
    await expect(r.done).rejects.toThrow("This isn't an ESP32-S3, so it isn't one of the box's chips.");
    expect(r.c.state.writes).toEqual([]);
  });

  it('refuses the other chip when Medius names it, and sends no MAC for a chip it refused', async () => {
    const r = stock('device');
    r.c.flash.set(mediusApp('medius_host'), 0x10000);
    await expect(r.done).rejects.toBeInstanceOf(WrongChipError);
    await expect(r.done).rejects.toMatchObject({ found: 'host', sure: true });
    expect(r.macs).toEqual([]);
    expect(ops(r.c, OP.ERASE_REGION)).toEqual([]);
    const s = stock('host', {}, { anyway: true });
    s.c.flash.set(mediusApp('medius_device'), 0x100000);
    await expect(s.done).rejects.toThrow(/main chip/);
    expect(ops(s.c, OP.FLASH_DEFL_BEGIN)).toEqual([]);
  });

  it("asks before flashing a chip MAKCU's bootloader names as the other, since an earlier flash may have put it there", async () => {
    const r = stock('device');
    r.c.flash.set(stockBoot(2), 0);
    await expect(r.done).rejects.toMatchObject({ found: 'host', sure: false });
    const told = stock('device', {}, { anyway: true });
    told.c.flash.set(stockBoot(2), 0);
    await told.done;
    expect(ops(told.c, OP.FLASH_DEFL_BEGIN)).toHaveLength(2);
  });

  it("refuses a blank chip picked as the mouse-side chip when its MAC is a box's main chip", async () => {
    const known = (m: string) => m === '588c81df1e28';
    await expect(stock('host', {}, { knownMain: known }).done).rejects.toMatchObject({ found: 'device', sure: true });
    await stock('device', {}, { knownMain: known }).done;
  });

  it('flashes the chip its flash names, and one whose flash names nothing', async () => {
    const a = stock('host');
    a.c.flash.set(mediusApp('medius_host'), 0x100000);
    await a.done;
    const b = stock('device');
    b.c.flash.set(stockBoot(1), 0);
    await b.done;
    await stock('device').done;
  });

  it('lets a failed write through, and closes the port', async () => {
    const r = stock('device');
    r.c.state.on = (s) => (s.op === OP.FLASH_DEFL_DATA ? { status: [0xc4, 0] } : undefined);
    await expect(r.done).rejects.toThrow('The chip refused the write at 0x4000 (0xC400).');
    expect(r.c.state.closed).toBe(true);
  });

  it('flashes a chip an earlier session left running the stub, uploading nothing over it', async () => {
    const r = stock('device', { stubRunning: true });
    await r.done;
    expect(ops(r.c, OP.MEM_BEGIN)).toEqual([]);
    expect(md5(r.c.flash.subarray(0, BOOT.length))).toBe(md5(BOOT));
  });
});

describe('flashNativePort', () => {
  // A Medius factory image: the ESP image magic, then anything, then a blank tail as the factory image's empty slot.
  let seed = 3;
  const image = new Uint8Array(200_000).fill(0xff);
  image.set(Uint8Array.from({ length: 70_000 }, () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24));
  image[0] = 0xe9;

  it('writes a factory image at 0x0 and an application at 0x10000, checks it, and starts it', async () => {
    for (const [kind, at] of [['factory', 0], ['app', 0x10000]] as const) {
      const c = romChip();
      const seen: FlashProgress[] = [];
      const macs: (string | null)[] = [];
      // An older image left in the flash: the new one must replace it everywhere it reaches, blank tail included.
      c.flash.fill(7, at, at + image.length);
      await flashNativePort({ port: c.port, image, kind, onProgress: (p) => seen.push(p), onMac: (m) => macs.push(m) });
      expect(md5(c.flash.subarray(at, at + image.length))).toBe(md5(image));
      // One count, the erase in it: the stub erases each region as the write reaches it.
      expect(seen.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1])).toEqual(['connecting', 'writing', 'done']);
      expect(ops(c, OP.ERASE_REGION)).toEqual([]);
      expect(u32(ops(c, OP.FLASH_DEFL_BEGIN)[0].data, 0)).toBe(image.length);
      const written = seen.filter((p) => p.phase === 'writing').map((p) => p.written!);
      expect(written.at(-1)).toBe(image.length);
      const steps = written.map((w, i) => w - (written[i - 1] ?? 0));
      expect(Math.max(...steps)).toBeLessThanOrEqual(0x2000);
      expect(macs).toEqual(['588c81df1e28']);
      expect(c.state.reset).toBe('watchdog');
      expect(c.state.closed).toBe(true);
    }
  });

  // Medius' partition table: ota_0 at 0x10000, ota_1 at 0x100000, otadata at 0x1F0000.
  const table = () => {
    const t = new Uint8Array(0xc00).fill(0xff);
    const rows: [number, number, number, number][] = [[1, 2, 0x9000, 0x6000], [1, 1, 0xf000, 0x1000], [0, 0x10, 0x10000, 0xf0000], [0, 0x11, 0x100000, 0xf0000], [1, 0, 0x1f0000, 0x2000]];
    rows.forEach(([type, sub, at, size], i) => {
      const v = new DataView(t.buffer, i * 32);
      t.set([0xaa, 0x50, type, sub], i * 32);
      v.setUint32(4, at, true);
      v.setUint32(8, size, true);
    });
    return t;
  };

  it('erases otadata after an application, so the chip boots the slot it was written to', async () => {
    const c = romChip();
    c.flash.set(table(), 0x8000);
    // otadata naming ota_1, where a USB2 update last landed.
    c.flash.fill(1, 0x1f0000, 0x1f0020);
    await flashNativePort({ port: c.port, image, kind: 'app' });
    expect(blank(c.flash.subarray(0x1f0000, 0x1f2000))).toBe(true);
    expect(md5(c.flash.subarray(0x10000, 0x10000 + image.length))).toBe(md5(image));
  });

  it('leaves the flash past an application alone where no partition table names otadata', async () => {
    const c = romChip();
    c.flash.fill(1, 0x1f0000, 0x1f0020);
    await flashNativePort({ port: c.port, image, kind: 'app' });
    expect(c.flash[0x1f0000]).toBe(1);
    expect(ops(c, OP.ERASE_REGION)).toEqual([]);
  });

  it("refuses a file that isn't an image before opening the port", async () => {
    const c = romChip();
    await expect(flashNativePort({ port: c.port, image: new Uint8Array(2000), kind: 'factory' })).rejects.toThrow(/0xE9/);
    expect(c.state.seen).toEqual([]);
  });
});

describe('WrongChipError', () => {
  it("names the chip picked when MAKCU's bootloader names the other less surely", () => {
    expect(new WrongChipError('host', false).message).toBe("MAKCU's bootloader on this chip is the mouse-side chip's, not the main chip's.");
  });
});
