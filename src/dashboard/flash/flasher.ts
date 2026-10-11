// Loaded lazily so esptool-js stays out of the main bundle.

import { ESPLoader, type FlashOptions, type IEspLoaderTerminal, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import {
  APP_FLASH_ADDR,
  FACTORY_FLASH_ADDR,
  type FlashChip,
  type FlashKind,
  type FlashNativeParams,
  type FlashProgress,
  type FlashStockParams,
  WrongChipError,
  romMac,
  validateImage,
} from './types';

export { WrongChipError };
import { SLOT_BYTES, mediusChip, readAppHeader } from './image';

// Native USB ignores the baud and breaks on a change, so stay at the ROM baud.
const NATIVE_BAUD = 115200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function md5Hex(image: Uint8Array): string {
  const copy = new Uint8Array(image);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}

const addressFor = (kind: FlashKind) => (kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);

async function runEsptool(
  port: SerialPort,
  image: Uint8Array,
  address: number,
  onProgress?: (p: FlashProgress) => void,
  onLog?: (line: string) => void,
  onMac?: (mac: string | null) => void,
): Promise<void> {
  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    write: (d) => onLog?.(d),
    writeLine: (d) => onLog?.(d),
  };
  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate: NATIVE_BAUD, terminal });
  try {
    onProgress?.({ phase: 'connecting' });
    await loader.main('no_reset');
    onMac?.(romMac(await loader.chip.readMac(loader).catch(() => '')));
    onProgress?.({ phase: 'writing', written: 0, total: image.length });
    const flashOptions: FlashOptions = {
      fileArray: [{ data: image, address }],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (_i, written, total) => onProgress?.({ phase: 'writing', written, total }),
      calculateMD5Hash: md5Hex,
    };
    await loader.writeFlash(flashOptions);
    onProgress?.({ phase: 'done' });
    // Reboot into the new firmware. esptool-js's USB-OTG hard_reset only deasserts RTS (no
    // edge); esptool.py pulses it.
    try {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(200);
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {
      // ignore
    }
    onLog?.('Flash complete.');
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // ignore
    }
  }
}

// MAKCU's repair flash, as makcu-toolkit does it: the whole chip erased, MAKCU's package at 0x4000, then the
// chip's bootloader at 0x0, last, so a write that stops leaves a chip that doesn't boot rather than a
// bootloader with no package to load.
const STOCK_PACKAGE_ADDR = 0x4000;

// What the chip's flash says it is: a Medius image names its project; MAKCU's bootloader carries its port's
// marker ("MKCLIMG1", role 1 for USB1, 2 for USB3). Null where it says nothing.
async function flashNames(loader: ESPLoader): Promise<{ chip: FlashChip; sure: boolean } | null> {
  for (const at of [APP_FLASH_ADDR, APP_FLASH_ADDR + SLOT_BYTES]) {
    const named = mediusChip(readAppHeader(await loader.readFlash(at, 256), 'app'));
    if (named) return { chip: named, sure: true };
  }
  const boot = await loader.readFlash(0, 0x4000);
  const marker = new TextEncoder().encode('MKCLIMG1');
  for (let i = 0; i + 16 <= boot.length; i += 4) {
    if (!marker.every((c, k) => boot[i + k] === c)) continue;
    const role = boot[i + 8] | (boot[i + 9] << 8);
    if (role === 1) return { chip: 'device', sure: false };
    if (role === 2) return { chip: 'host', sure: false };
  }
  return null;
}

// The flash erased whole, as MAKCU's toolkit does it (1.11.10 on): in 64 KiB regions, one command and answer each,
// since one whole-chip erase left the chip's USB silent for 10 to 20 s and Windows dropped the port ("Serial data
// stream stopped"). A region that fails is tried again; a flash of unknown size is erased in one command.
const REGION = 0x10000;
const REGION_TRIES = 3;

async function eraseChip(loader: ESPLoader, onProgress?: (p: FlashProgress) => void): Promise<void> {
  const named = loader.DETECTED_FLASH_SIZES[((await loader.readFlashId()) >> 16) & 0xff];
  const size = /^(\d+)(KB|MB)$/.exec(named ?? '');
  if (!size) {
    await loader.eraseFlash();
    return;
  }
  const total = Number(size[1]) * (size[2] === 'MB' ? 0x100000 : 0x400);
  const region = new Uint8Array(8);
  const view = new DataView(region.buffer);
  view.setUint32(4, REGION, true);
  for (let at = 0; at < total; at += REGION) {
    view.setUint32(0, at, true);
    for (let tries = 1; ; tries++) {
      try {
        await loader.checkCommand('erase region', loader.ESP_ERASE_REGION, region, 0, 0, loader.timeoutPerMb(loader.ERASE_REGION_TIMEOUT_PER_MB, REGION));
        break;
      } catch (e) {
        if (tries === REGION_TRIES) throw e;
      }
    }
    onProgress?.({ phase: 'erasing', written: at + REGION, total });
  }
}

export async function flashStock(params: FlashStockParams): Promise<void> {
  const { port, chip, pkg, boot, onProgress, onLog, onMac, anyway, knownMain } = params;
  const terminal: IEspLoaderTerminal = { clean: () => {}, write: (d) => onLog?.(d), writeLine: (d) => onLog?.(d) };
  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate: NATIVE_BAUD, terminal });
  try {
    onProgress?.({ phase: 'connecting' });
    await loader.main('no_reset');
    if (loader.chip.CHIP_NAME !== 'ESP32-S3') throw new Error(`This is an ${loader.chip.CHIP_NAME}, not one of the MAKCU's ESP32-S3 chips.`);
    const mac = romMac(await loader.chip.readMac(loader).catch(() => ''));
    // A box is known by its main chip's MAC, so a known one names a blank chip too.
    const named = (await flashNames(loader)) ?? (mac && knownMain?.(mac) ? { chip: 'device' as const, sure: true } : null);
    if (named && named.chip !== chip && (named.sure || !anyway)) throw new WrongChipError(named.chip, named.sure);
    onMac?.(mac);
    onProgress?.({ phase: 'erasing' });
    await eraseChip(loader, onProgress);
    const total = pkg.length + boot.length;
    await loader.writeFlash({
      fileArray: [
        { data: pkg, address: STOCK_PACKAGE_ADDR },
        { data: boot, address: 0 },
      ],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      // esptool-js counts what it sends, compressed: each file's share of it, in bytes written.
      reportProgress: (i, sent, of) =>
        onProgress?.({ phase: 'writing', written: Math.round((i ? pkg.length : 0) + (of ? sent / of : 0) * (i ? boot.length : pkg.length)), total }),
      calculateMD5Hash: md5Hex,
    });
    onProgress?.({ phase: 'done' });
    try {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(200);
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {
      // ignore
    }
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // ignore
    }
  }
}

// Flash a chip already in ROM download on its native USB port.
export async function flashNativePort(params: FlashNativeParams): Promise<void> {
  const { port, image, kind, onProgress, onLog, onMac } = params;
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  await runEsptool(port, image, addressFor(kind), onProgress, onLog, onMac);
}
