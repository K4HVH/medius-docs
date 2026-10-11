import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chip in ROM download, as esptool-js sees it: its name, what its flash holds, and every write.
const rom = vi.hoisted(() => ({
  chip: 'ESP32-S3',
  flash: new Map<number, Uint8Array>(),
  writes: [] as { fileArray: { data: Uint8Array; address: number }[]; eraseAll: boolean; flashMode: string; flashFreq: string; flashSize: string; compress: boolean; md5: boolean }[],
  fail: null as Error | null,
  disconnected: 0,
}));

vi.mock('esptool-js', () => {
  class Transport {
    async disconnect() {
      rom.disconnected++;
    }
  }
  class ESPLoader {
    chip = { CHIP_NAME: rom.chip, readMac: async () => '58:8c:81:df:1e:28' };
    constructor() {
      this.chip.CHIP_NAME = rom.chip;
    }
    async main() {
      return rom.chip;
    }
    async readFlash(addr: number, size: number) {
      const out = new Uint8Array(size).fill(0xff);
      for (const [at, bytes] of rom.flash) {
        for (let i = 0; i < bytes.length; i++) {
          const o = at + i - addr;
          if (o >= 0 && o < size) out[o] = bytes[i];
        }
      }
      return out;
    }
    async writeFlash(o: {
      fileArray: { data: Uint8Array; address: number }[];
      eraseAll: boolean;
      flashMode: string;
      flashFreq: string;
      flashSize: string;
      compress: boolean;
      reportProgress?: (i: number, w: number, t: number) => void;
      calculateMD5Hash?: (d: Uint8Array) => string;
    }) {
      if (rom.fail) throw rom.fail;
      rom.writes.push({ fileArray: o.fileArray, eraseAll: o.eraseAll, flashMode: o.flashMode, flashFreq: o.flashFreq, flashSize: o.flashSize, compress: o.compress, md5: !!o.calculateMD5Hash?.(o.fileArray[0].data) });
      o.fileArray.forEach((f, i) => {
        o.reportProgress?.(i, 0, f.data.length);
        o.reportProgress?.(i, f.data.length, f.data.length);
      });
    }
  }
  return { ESPLoader, Transport };
});

import { flashStock, WrongChipError } from '../../src/dashboard/flash/flasher';
import type { FlashProgress } from '../../src/dashboard/flash';

const port = { setSignals: async () => {} } as unknown as SerialPort;
const PKG = new Uint8Array(5000).fill(1);
const BOOT = new Uint8Array(800).fill(2);

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

const run = (chip: 'device' | 'host') => {
  const seen: FlashProgress[] = [];
  return { seen, done: flashStock({ port, chip, pkg: PKG, boot: BOOT, onProgress: (p) => seen.push(p) }) };
};

beforeEach(() => {
  rom.chip = 'ESP32-S3';
  rom.flash = new Map();
  rom.writes = [];
  rom.fail = null;
  rom.disconnected = 0;
});

describe('flashStock', () => {
  it('erases the chip, writes the package at 0x4000 and then the bootloader at 0x0, all as they are', async () => {
    await run('device').done;
    expect(rom.writes).toHaveLength(1);
    const w = rom.writes[0];
    expect(w.eraseAll).toBe(true);
    expect(w.fileArray.map((f) => [f.address, f.data.length])).toEqual([[0x4000, PKG.length], [0, BOOT.length]]);
    expect([w.flashMode, w.flashFreq, w.flashSize]).toEqual(['keep', 'keep', 'keep']);
    expect(w.compress).toBe(true);
    expect(w.md5).toBe(true);
    expect(rom.disconnected).toBe(1);
  });

  it('shows the erase, then one bar across both files, then done', async () => {
    const { seen, done } = run('host');
    await done;
    const phases = seen.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1]);
    expect(phases).toEqual(['connecting', 'erasing', 'writing', 'done']);
    const written = seen.filter((p) => p.phase === 'writing').map((p) => p.written!);
    expect(written).toEqual([...written].sort((a, b) => a - b));
    expect(seen.find((p) => p.phase === 'writing')!.total).toBe(PKG.length + BOOT.length);
    expect(written.at(-1)).toBe(PKG.length + BOOT.length);
  });

  it('refuses a chip that is not an ESP32-S3 before writing anything', async () => {
    rom.chip = 'ESP32';
    await expect(run('device').done).rejects.toThrow(/ESP32-S3/);
    expect(rom.writes).toEqual([]);
  });

  it('refuses the other chip when its flash names it, Medius or MAKCU', async () => {
    rom.flash.set(0x10000, mediusApp('medius_host'));
    await expect(run('device').done).rejects.toBeInstanceOf(WrongChipError);
    rom.flash = new Map([[0x100000, mediusApp('medius_device')]]);
    await expect(run('host').done).rejects.toThrow(/main chip/);
    rom.flash = new Map([[0, stockBoot(2)]]);
    await expect(run('device').done).rejects.toThrow(/mouse-side chip/);
    expect(rom.writes).toEqual([]);
  });

  it('flashes the chip its flash names, and one whose flash names nothing', async () => {
    rom.flash.set(0x100000, mediusApp('medius_host'));
    await run('host').done;
    rom.flash = new Map([[0, stockBoot(1)]]);
    await run('device').done;
    rom.flash = new Map();
    await run('device').done;
    expect(rom.writes).toHaveLength(3);
  });

  it('lets a failed write through, and lets the port go', async () => {
    rom.fail = new Error('Failed to write to target RAM (result was 01070000: Operation timed out)');
    await expect(run('device').done).rejects.toThrow(/timed out/);
    expect(rom.disconnected).toBe(1);
  });
});
