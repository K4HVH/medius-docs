import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chip in ROM download, as esptool-js sees it: its name, what its flash holds, and every write.
const rom = vi.hoisted(() => ({
  chip: 'ESP32-S3',
  flash: new Map<number, Uint8Array>(),
  writes: [] as { fileArray: { data: Uint8Array; address: number }[]; eraseAll: boolean; flashMode: string; flashFreq: string; flashSize: string; compress: boolean; md5: boolean }[],
  fail: null as Error | null,
  disconnected: 0,
  // The flash's size id (0x16, 4 MB) as its JEDEC id reports it, each erase command in turn, and regions to refuse once.
  sizeId: 0x16,
  erased: [] as string[],
  refuse: new Map<number, number>(),
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
    ESP_ERASE_REGION = 0xd1;
    ERASE_REGION_TIMEOUT_PER_MB = 30000;
    DETECTED_FLASH_SIZES: Record<number, string> = { 0x16: '4MB', 0x17: '8MB' };
    timeoutPerMb(ms: number, bytes: number) {
      return ms * (bytes / 1e6);
    }
    async readFlashId() {
      return (rom.sizeId << 16) | 0x4020;
    }
    async eraseFlash() {
      rom.erased.push('all');
      return 0;
    }
    async checkCommand(_what: string, op: number, data: Uint8Array) {
      if (op !== 0xd1) throw new Error(`unexpected command ${op}`);
      const v = new DataView(data.buffer, data.byteOffset);
      const at = v.getUint32(0, true);
      const left = rom.refuse.get(at) ?? 0;
      if (left > 0) {
        rom.refuse.set(at, left - 1);
        throw new Error('Timed out waiting for packet header');
      }
      rom.erased.push(`${at.toString(16)}+${v.getUint32(4, true).toString(16)}`);
      return 0;
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
      rom.erased.push('write');
      rom.writes.push({ fileArray: o.fileArray, eraseAll: o.eraseAll, flashMode: o.flashMode, flashFreq: o.flashFreq, flashSize: o.flashSize, compress: o.compress, md5: !!o.calculateMD5Hash?.(o.fileArray[0].data) });
      // esptool-js counts what it sends, compressed.
      o.fileArray.forEach((f, i) => {
        const sent = Math.round(f.data.length * 0.6);
        o.reportProgress?.(i, 0, sent);
        o.reportProgress?.(i, Math.round(sent / 2), sent);
        o.reportProgress?.(i, sent, sent);
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

const run = (chip: 'device' | 'host', over: { anyway?: boolean; knownMain?: (mac: string) => boolean } = {}) => {
  const seen: FlashProgress[] = [];
  const macs: (string | null)[] = [];
  return { seen, macs, done: flashStock({ port, chip, pkg: PKG, boot: BOOT, onProgress: (p) => seen.push(p), onMac: (m) => macs.push(m), ...over }) };
};

beforeEach(() => {
  rom.chip = 'ESP32-S3';
  rom.flash = new Map();
  rom.writes = [];
  rom.fail = null;
  rom.disconnected = 0;
  rom.sizeId = 0x16;
  rom.erased = [];
  rom.refuse = new Map();
});

describe('flashStock', () => {
  it('erases the chip, writes the package at 0x4000 and then the bootloader at 0x0, all as they are', async () => {
    await run('device').done;
    expect(rom.writes).toHaveLength(1);
    const w = rom.writes[0];
    expect(w.eraseAll).toBe(false);
    expect(rom.erased.at(-1)).toBe('write');
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
    // The package's last report and the bootloader's first meet: no jump between the files.
    expect(written).toContain(PKG.length);
    const steps = written.slice(1).map((w, i) => w - written[i]);
    expect(Math.max(...steps)).toBeLessThanOrEqual(PKG.length / 2 + 1);
  });

  it('refuses a chip that is not an ESP32-S3 before writing anything', async () => {
    rom.chip = 'ESP32';
    await expect(run('device').done).rejects.toThrow(/ESP32-S3/);
    expect(rom.writes).toEqual([]);
  });

  it('refuses the other chip when Medius names it, and sends no MAC for a chip it refused', async () => {
    rom.flash.set(0x10000, mediusApp('medius_host'));
    const r = run('device');
    await expect(r.done).rejects.toBeInstanceOf(WrongChipError);
    await expect(r.done).rejects.toMatchObject({ found: 'host', sure: true });
    expect(r.macs).toEqual([]);
    rom.flash = new Map([[0x100000, mediusApp('medius_device')]]);
    await expect(run('host', { anyway: true }).done).rejects.toThrow(/main chip/);
    expect(rom.writes).toEqual([]);
  });

  it("asks before flashing a chip MAKCU's bootloader names as the other, since an earlier flash may have put it there", async () => {
    rom.flash = new Map([[0, stockBoot(2)]]);
    await expect(run('device').done).rejects.toMatchObject({ found: 'host', sure: false });
    expect(rom.writes).toEqual([]);
    await run('device', { anyway: true }).done;
    expect(rom.writes).toHaveLength(1);
  });

  it("refuses a blank chip picked as the mouse-side chip when its MAC is a box's main chip", async () => {
    await expect(run('host', { knownMain: (m) => m === '588c81df1e28' }).done).rejects.toMatchObject({ found: 'device', sure: true });
    await run('device', { knownMain: (m) => m === '588c81df1e28' }).done;
    expect(rom.writes).toHaveLength(1);
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

  it('erases the whole flash in 64 KiB regions, one command each, so the port never goes quiet for long', async () => {
    await run('device').done;
    const regions = rom.erased.slice(0, -1);
    expect(regions).toHaveLength(64);
    expect(regions[0]).toBe('0+10000');
    expect(regions.at(-1)).toBe('3f0000+10000');
    rom.erased = [];
    rom.sizeId = 0x17;
    await run('device').done;
    expect(rom.erased.slice(0, -1)).toHaveLength(128);
  });

  it('tries a region that failed again, and stops on one that keeps failing', async () => {
    rom.refuse.set(0x20000, 1);
    await run('device').done;
    expect(rom.erased.filter((e) => e === '20000+10000')).toHaveLength(1);
    rom.erased = [];
    rom.refuse.set(0x30000, 9);
    await expect(run('device').done).rejects.toThrow(/Timed out/);
    expect(rom.erased).not.toContain('write');
  });

  it('erases a flash of unknown size whole', async () => {
    rom.sizeId = 0x99;
    await run('device').done;
    expect(rom.erased).toEqual(['all', 'write']);
  });

  it('shows the erase as it goes', async () => {
    const { seen, done } = run('device');
    await done;
    const erasing = seen.filter((p) => p.phase === 'erasing' && p.total);
    expect(erasing.at(-1)).toMatchObject({ written: 0x400000, total: 0x400000 });
  });

  it('lets a failed write through, and lets the port go', async () => {
    rom.fail = new Error('Failed to write to target RAM (result was 01070000: Operation timed out)');
    await expect(run('device').done).rejects.toThrow(/timed out/);
    expect(rom.disconnected).toBe(1);
  });
});
