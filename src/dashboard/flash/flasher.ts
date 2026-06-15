// Device-chip and native-USB flashing via esptool-js. Loaded lazily (dynamic
// import) so esptool-js stays out of the main bundle.

import { ESPLoader, type FlashOptions, type IEspLoaderTerminal, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { RebootTarget } from '../protocol';
import {
  APP_FLASH_ADDR,
  FACTORY_FLASH_ADDR,
  type FlashDeviceParams,
  type FlashKind,
  type FlashNativeParams,
  type FlashProgress,
  validateImage,
} from './types';

const ROM_SETTLE_MS = 2000;

// The main chip flashes over the CH343 UART (0x1a86) and can go fast. The
// mouse-side chip flashes over the ESP native USB (0x303a), which ignores the
// serial baud and breaks on a baud change, so keep the ROM baud there.
const flashBaud = (port: SerialPort) => (port.getInfo().usbVendorId === 0x303a ? 115200 : 921600);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function md5Hex(image: Uint8Array): string {
  const copy = new Uint8Array(image);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}

const addressFor = (kind: FlashKind) => (kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);

// esptool a chip that is already in ROM download mode on `port`.
async function runEsptool(
  port: SerialPort,
  image: Uint8Array,
  address: number,
  onProgress?: (p: FlashProgress) => void,
  onLog?: (line: string) => void,
): Promise<void> {
  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    write: (d) => onLog?.(d),
    writeLine: (d) => onLog?.(d),
  };
  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate: flashBaud(port), terminal });
  try {
    onProgress?.({ phase: 'connecting' });
    await loader.main('no_reset');
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
    // Reboot to run the new firmware: the main chip resets via the CH343's RTS,
    // native USB via its own reset. Best-effort - a power-cycle works if it can't.
    try {
      await loader.after('hard_reset', port.getInfo().usbVendorId === 0x303a);
    } catch {
      // ignore
    }
    onProgress?.({ phase: 'done' });
    onLog?.('Flash complete.');
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // ignore
    }
  }
}

// Device chip over its CH343 control port: reboot into download, then esptool.
// Closes the link; the chip needs a power-cycle to run (no DTR/RTS reset wired).
export async function flashDeviceChip(params: FlashDeviceParams): Promise<void> {
  const { link, image, kind, onProgress, onLog } = params;
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  const port = link.serialPort;

  onProgress?.({ phase: 'rebooting' });
  onLog?.('Rebooting the device chip into download mode...');
  await link.reboot(RebootTarget.DeviceDownload);
  await link.close();
  await sleep(ROM_SETTLE_MS);

  await runEsptool(port, image, addressFor(kind), onProgress, onLog);
}

// A chip already in ROM download on a native USB port (the BOOT-button method),
// used for recovery and for flashing the host chip over its own USB.
export async function flashNativePort(params: FlashNativeParams): Promise<void> {
  const { port, image, kind, onProgress, onLog } = params;
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  await runEsptool(port, image, addressFor(kind), onProgress, onLog);
}
