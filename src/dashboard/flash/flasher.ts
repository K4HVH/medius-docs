// esptool-js flashing over a chip's native USB. Loaded lazily (dynamic import)
// so esptool-js stays out of the main bundle. Both chips flash over their own
// USB-Serial-JTAG: DTR/RTS over the CH343 do not reset this board, but the
// USB-OTG reset does, so a native flash is the only path that reboots to run.

import { ESPLoader, type FlashOptions, type IEspLoaderTerminal, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import {
  APP_FLASH_ADDR,
  FACTORY_FLASH_ADDR,
  type FlashKind,
  type FlashNativeParams,
  type FlashProgress,
  validateImage,
} from './types';

// Native USB ignores the serial baud and breaks on a baud change, so stay at the
// ROM baud (no changeBaud).
const NATIVE_BAUD = 115200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function md5Hex(image: Uint8Array): string {
  const copy = new Uint8Array(image);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}

const addressFor = (kind: FlashKind) => (kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);

// esptool a chip already in ROM download mode on a native USB `port`.
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
  const loader = new ESPLoader({ transport, baudrate: NATIVE_BAUD, terminal });
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
    onProgress?.({ phase: 'done' });
    // Reboot into the new firmware. esptool-js's own USB-OTG hard_reset only
    // deasserts RTS (no edge); esptool.py pulses it. Replicate the pulse: assert
    // RTS to reset, then release, with DTR held low so it boots to run.
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

// Flash a chip already in ROM download on its native USB port. Used for the
// device chip (after a reboot-to-download or the LEFT BOOT button) and the host
// chip (RIGHT BOOT button), and for recovery.
export async function flashNativePort(params: FlashNativeParams): Promise<void> {
  const { port, image, kind, onProgress, onLog } = params;
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  await runEsptool(port, image, addressFor(kind), onProgress, onLog);
}
