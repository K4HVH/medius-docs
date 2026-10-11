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
  romMac,
  validateImage,
} from './types';
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
    // Reboot into the new firmware. esptool-js's own USB-OTG hard_reset only deasserts RTS (no
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

const CHIP_NAME: Record<FlashChip, string> = { device: 'main chip', host: 'mouse-side chip' };
const CHIP_PORT: Record<FlashChip, string> = { device: 'USB1', host: 'USB3' };

export class WrongChipError extends Error {
  constructor(readonly found: FlashChip) {
    super(`This is the ${CHIP_NAME[found]}. Pick it above, or plug in ${CHIP_PORT[found === 'device' ? 'host' : 'device']} with the button beside it held.`);
  }
}

// What the chip's flash says it is: a Medius image names its project; MAKCU's bootloader carries its port's
// marker ("MKCLIMG1", role 1 for USB1, 2 for USB3). Null where it says nothing.
async function flashNames(loader: ESPLoader): Promise<FlashChip | null> {
  for (const at of [APP_FLASH_ADDR, APP_FLASH_ADDR + SLOT_BYTES]) {
    const named = mediusChip(readAppHeader(await loader.readFlash(at, 256), 'app'));
    if (named) return named;
  }
  const boot = await loader.readFlash(0, 0x4000);
  const marker = new TextEncoder().encode('MKCLIMG1');
  for (let i = 0; i + 16 <= boot.length; i += 4) {
    if (!marker.every((c, k) => boot[i + k] === c)) continue;
    const role = boot[i + 8] | (boot[i + 9] << 8);
    if (role === 1) return 'device';
    if (role === 2) return 'host';
  }
  return null;
}

export async function flashStock(params: FlashStockParams): Promise<void> {
  const { port, chip, pkg, boot, onProgress, onLog, onMac } = params;
  const terminal: IEspLoaderTerminal = { clean: () => {}, write: (d) => onLog?.(d), writeLine: (d) => onLog?.(d) };
  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate: NATIVE_BAUD, terminal });
  try {
    onProgress?.({ phase: 'connecting' });
    await loader.main('no_reset');
    if (loader.chip.CHIP_NAME !== 'ESP32-S3') throw new Error(`This is an ${loader.chip.CHIP_NAME}, not one of the MAKCU's ESP32-S3 chips.`);
    onMac?.(romMac(await loader.chip.readMac(loader).catch(() => '')));
    const named = await flashNames(loader);
    if (named && named !== chip) throw new WrongChipError(named);
    onProgress?.({ phase: 'erasing' });
    const total = pkg.length + boot.length;
    await loader.writeFlash({
      fileArray: [
        { data: pkg, address: STOCK_PACKAGE_ADDR },
        { data: boot, address: 0 },
      ],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: true,
      compress: true,
      reportProgress: (i, written) => onProgress?.({ phase: 'writing', written: (i ? pkg.length : 0) + written, total }),
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
