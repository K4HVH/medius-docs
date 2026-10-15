// Loaded lazily, so the ROM client and its flasher stub stay out of the main bundle.

import SparkMD5 from 'spark-md5';
import {
  APP_FLASH_ADDR,
  FACTORY_FLASH_ADDR,
  PARTITION_TABLE_OFFSET,
  type FlashChip,
  type FlashKind,
  type FlashNativeParams,
  type FlashProgress,
  type FlashStockParams,
  WrongChipError,
  validateImage,
} from './types';
import { SLOT_BYTES, mediusChip, readAppHeader } from './image';
import { Rom } from './rom/loader';

export { WrongChipError };

const addressFor = (kind: FlashKind) => (kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);

// A Rom synced, with the stub running and the flash attached; the port is closed if a step fails.
async function open(port: SerialPort): Promise<{ rom: Rom; size: number | null }> {
  const rom = await Rom.connect(port);
  try {
    await rom.runStub();
    return { rom, size: await rom.attachFlash() };
  } catch (e) {
    await rom.close();
    throw e;
  }
}

// MAKCU's repair flash, as makcu-toolkit does it: the whole chip erased, MAKCU's package at 0x4000, then the
// chip's bootloader at 0x0, last, so a write that stops leaves a chip that doesn't boot rather than a
// bootloader with no package to load.
const STOCK_PACKAGE_ADDR = 0x4000;
const STOCK_BOOT_ROOM = STOCK_PACKAGE_ADDR;

// What the chip's flash says it is: a Medius image names its project; MAKCU's bootloader carries its port's
// marker ("MKCLIMG1", role 1 for USB1, 2 for USB3). Null where it says nothing.
async function flashNames(rom: Rom): Promise<{ chip: FlashChip; sure: boolean } | null> {
  for (const at of [APP_FLASH_ADDR, APP_FLASH_ADDR + SLOT_BYTES]) {
    const named = mediusChip(readAppHeader(await rom.readFlash(at, 256), 'app'));
    if (named) return { chip: named, sure: true };
  }
  const boot = await rom.readFlash(0, 0x4000);
  const marker = new TextEncoder().encode('MKCLIMG1');
  for (let i = 0; i + 16 <= boot.length; i += 4) {
    if (!marker.every((c, k) => boot[i + k] === c)) continue;
    const role = boot[i + 8] | (boot[i + 9] << 8);
    if (role === 1) return { chip: 'device', sure: false };
    if (role === 2) return { chip: 'host', sure: false };
  }
  return null;
}

// A range erased in 64 KiB regions, one command and answer each, as makcu-toolkit erases a chip from 1.11.10: one
// whole-chip erase left the chip's USB silent for 10 to 20 s and Windows dropped the port ("Serial data stream
// stopped"). A blank region is skipped; every region must read back blank.
const REGION = 0x10000;
const SECTOR = 0x1000;
const REGION_TRIES = 3;
const blanks = new Map<number, string>();
const blankMd5 = (len: number) => {
  let h = blanks.get(len);
  if (!h) blanks.set(len, (h = SparkMD5.ArrayBuffer.hash(new Uint8Array(len).fill(0xff).buffer)));
  return h;
};

async function eraseRange(rom: Rom, from: number, to: number, onErased?: (bytes: number) => void): Promise<void> {
  for (let at = from; at < to; ) {
    const end = Math.min(to, (Math.floor(at / REGION) + 1) * REGION);
    for (let tries = 0; (await rom.md5(at, end - at)) !== blankMd5(end - at); tries++) {
      if (tries === REGION_TRIES) throw new Error(`The flash at 0x${at.toString(16)} didn't erase after ${REGION_TRIES} tries.`);
      await rom.eraseRegion(at, end - at);
    }
    onErased?.(end - from);
    at = end;
  }
}

// Where the chip's partition table puts otadata, when it puts ota_0 where an application is written. The
// bootloader boots the slot otadata names, which after a USB2 update can be ota_1; with otadata blank it boots
// ota_0, as after a factory image, whose blank stretch covers otadata.
async function otadata(rom: Rom): Promise<[number, number] | null> {
  const t = await rom.readFlash(PARTITION_TABLE_OFFSET, 0xc00);
  let ota0 = false;
  let range: [number, number] | null = null;
  for (let i = 0; i + 32 <= t.length && t[i] === 0xaa && t[i + 1] === 0x50; i += 32) {
    const v = new DataView(t.buffer, t.byteOffset + i);
    if (t[i + 2] === 0 && t[i + 3] === 0x10 && v.getUint32(4, true) === APP_FLASH_ADDR) ota0 = true;
    if (t[i + 2] === 1 && t[i + 3] === 0) range = [v.getUint32(4, true), v.getUint32(8, true)];
  }
  return ota0 ? range : null;
}

// A stock file's blank tail is left to the erase.
const withoutBlankTail = (image: Uint8Array) => {
  let end = image.length;
  while (end > 0 && image[end - 1] === 0xff) end--;
  return image.subarray(0, end);
};
// A write erases its range to the end of the sector it ends in.
const sectors = (bytes: number) => Math.ceil(bytes / SECTOR) * SECTOR;

export async function flashStock(params: FlashStockParams): Promise<void> {
  const { port, chip, pkg, boot, onProgress, onMac, anyway, knownMain } = params;
  onProgress?.({ phase: 'connecting' });
  const { rom, size } = await open(port);
  try {
    // A box is known by its main chip's MAC, so a known one names a blank chip too.
    const named = (await flashNames(rom)) ?? (rom.mac && knownMain?.(rom.mac) ? { chip: 'device' as const, sure: true } : null);
    if (named && named.chip !== chip && (named.sure || !anyway)) throw new WrongChipError(named.chip, named.sure);
    onMac?.(rom.mac);
    const [p, b] = [withoutBlankTail(pkg), withoutBlankTail(boot)];
    // The bootloader's write erases to its sector's end, which must stop short of the package.
    if (sectors(b.length) > STOCK_BOOT_ROOM || STOCK_PACKAGE_ADDR + sectors(p.length) > (size ?? Infinity)) {
      throw new Error("MAKCU's files don't fit this flash.");
    }
    // A flash of unknown size is erased in one command, which counts nothing; the files are then counted alone.
    if (size === null) {
      onProgress?.({ phase: 'erasing' });
      await rom.eraseFlash();
    }
    // Erased first: everything but the package's sectors, the bootloader's room included. One count across the
    // erase and both files, in bytes of the flash.
    const erase: [number, number][] = size === null ? [] : [[0, STOCK_BOOT_ROOM], [STOCK_PACKAGE_ADDR + sectors(p.length), size]];
    const total = erase.reduce((n, [from, to]) => n + to - from, 0) + sectors(p.length) + sectors(b.length);
    let done = 0;
    const count = (bytes: number) => onProgress?.({ phase: 'writing', written: done + bytes, total });
    const write = async (file: Uint8Array, at: number) => {
      if (file.length) await rom.write(file, at, (written, of) => count(Math.round((written / of) * sectors(of))));
      done += sectors(file.length);
    };
    count(0);
    for (const [from, to] of erase) {
      await eraseRange(rom, from, to, count);
      done += to - from;
    }
    await write(p, STOCK_PACKAGE_ADDR);
    await write(b, 0);
    onProgress?.({ phase: 'done' });
    await rom.reset().catch(() => {});
  } finally {
    await rom.close();
  }
}

// Flash a chip already in ROM download over its USB port.
export async function flashNativePort(params: FlashNativeParams): Promise<void> {
  const { port, image, kind, onProgress, onMac } = params;
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  onProgress?.({ phase: 'connecting' });
  const { rom } = await open(port);
  try {
    onMac?.(rom.mac);
    // The whole image, blank tail included: one count, which the erase is part of.
    onProgress?.({ phase: 'writing', written: 0, total: image.length });
    await rom.write(image, addressFor(kind), (written, total) => onProgress?.({ phase: 'writing', written, total }));
    const slots = kind === 'app' ? await otadata(rom) : null;
    if (slots) await eraseRange(rom, slots[0], slots[0] + slots[1]);
    onProgress?.({ phase: 'done' });
    await rom.reset().catch(() => {});
  } finally {
    await rom.close();
  }
}
