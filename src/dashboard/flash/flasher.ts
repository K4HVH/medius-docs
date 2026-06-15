// Device-chip flashing: reboot into ROM download over the control link, then
// hand the same port to esptool-js. Mirrors the medius crate's flash flow.
// Loaded lazily (via dynamic import) so esptool-js stays out of the main bundle.

import { ESPLoader, type FlashOptions, type IEspLoaderTerminal, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { RebootTarget } from '../protocol';
import { APP_FLASH_ADDR, FACTORY_FLASH_ADDR, type FlashDeviceParams, validateImage } from './types';

const ROM_SETTLE_MS = 2000;
const FLASH_BAUD = 921600;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function md5Hex(image: Uint8Array): string {
  const copy = new Uint8Array(image);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}

// Flash the device chip over its CH343 control port. Closes the link, so the
// caller must treat the connection as gone afterwards (the chip needs a
// power-cycle to run the new firmware: no DTR/RTS reset is wired on this board).
export async function flashDeviceChip(params: FlashDeviceParams): Promise<void> {
  const { link, image, kind, onProgress, onLog } = params;
  // Validate before touching the box, so a bad file never even reboots it.
  const invalid = validateImage(image, kind);
  if (invalid) throw new Error(invalid);
  const address = kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR;
  const port = link.serialPort;

  onProgress?.({ phase: 'rebooting' });
  onLog?.('Rebooting the device chip into download mode...');
  await link.reboot(RebootTarget.DeviceDownload);
  await link.close();
  await sleep(ROM_SETTLE_MS);

  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    write: (d) => onLog?.(d),
    writeLine: (d) => onLog?.(d),
  };

  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate: FLASH_BAUD, terminal });
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
    onLog?.('Flash complete. Power-cycle the box (unplug and replug) to run the new firmware.');
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // ignore
    }
  }
}
