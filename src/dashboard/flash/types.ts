/// <reference types="w3c-web-serial" />
// Free of the ROM client, so the UI imports this without the bundle cost.

// ESP32-S3 layout: bootloader at 0x0, app at 0x10000.
export const APP_FLASH_ADDR = 0x10000;
export const FACTORY_FLASH_ADDR = 0x0;

export type FlashKind = 'app' | 'factory';
// An update over the control port also restarts the box and verifies what it runs.
export type FlashPhase = 'rebooting' | 'connecting' | 'erasing' | 'writing' | 'restarting' | 'verifying' | 'done';

export interface FlashProgress {
  phase: FlashPhase;
  // Which chip an update over the control port is writing: the mouse-side chip first.
  chip?: 'host' | 'device';
  written?: number;
  total?: number;
}

// MAKCU's stock firmware for one chip: the package both chips take, and that chip's bootloader.
export interface FlashStockParams {
  port: SerialPort;
  chip: FlashChip;
  pkg: Uint8Array;
  boot: Uint8Array;
  // Flash a chip MAKCU's bootloader names as the other one: the owner said so.
  anyway?: boolean;
  // Whether a MAC is a known box's main chip.
  knownMain?: (mac: string) => boolean;
  onProgress?: (p: FlashProgress) => void;
  onMac?: (mac: string | null) => void;
}

export interface FlashNativeParams {
  port: SerialPort;
  image: Uint8Array;
  kind: FlashKind;
  onProgress?: (p: FlashProgress) => void;
  // The chip's factory MAC, once the ROM answers; null when its eFuses read as zero.
  onMac?: (mac: string | null) => void;
}

export type FlashChip = 'device' | 'host';

// ESP32-S3 with 4 MB flash.
export const FLASH_SIZE_BYTES = 4 * 1024 * 1024;
const ESP_IMAGE_MAGIC = 0xe9;
export const PARTITION_TABLE_OFFSET = 0x8000;

// Why a file can't be an image for this chip, or null.
export function validateImage(image: Uint8Array, kind: FlashKind): string | null {
  if (image.length < 1024) {
    return 'This file is too small to be a firmware image.';
  }
  if (image[0] !== ESP_IMAGE_MAGIC) {
    return 'Not an ESP32-S3 firmware image: it should start with byte 0xE9.';
  }
  const address = kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR;
  if (address + image.length > FLASH_SIZE_BYTES) {
    return 'This image is too large for the 4 MB flash at this offset.';
  }
  return null;
}

export function hasPartitionTable(image: Uint8Array): boolean {
  return (
    image.length > PARTITION_TABLE_OFFSET + 1 &&
    image[PARTITION_TABLE_OFFSET] === 0xaa &&
    image[PARTITION_TABLE_OFFSET + 1] === 0x50
  );
}

// Warning heuristic: a factory image embeds a partition table at 0x8000, an app image does not.
export function looksLikeWrongKind(image: Uint8Array, kind: FlashKind): boolean {
  // A file that is no image at all looks like neither kind.
  if (image.length < 1024 || image[0] !== ESP_IMAGE_MAGIC) return false;
  const factoryShaped = hasPartitionTable(image);
  if (kind === 'app' && factoryShaped) return true;
  if (kind === 'factory' && !factoryShaped) return true;
  return false;
}

export const CHIP_NAME: Record<FlashChip, string> = { device: 'main chip', host: 'mouse-side chip' };
const CHIP_PORT: Record<FlashChip, string> = { device: 'USB1', host: 'USB3' };

// The chip picked in the port list is some other Espressif part.
export class NotTheBox extends Error {
  constructor() {
    super("This isn't an ESP32-S3, so it isn't one of the box's chips. Pick the box in the list.");
  }
}

// `sure`: Medius's image or the box's MAC named the chip. MAKCU's bootloader names it less surely: a stock
// flash of the wrong chip puts the other port's there, so the owner is asked rather than refused.
export class WrongChipError extends Error {
  constructor(
    readonly found: FlashChip,
    readonly sure: boolean,
  ) {
    super(
      sure
        ? `This is the ${CHIP_NAME[found]}. Pick it above, or plug in ${CHIP_PORT[found === 'device' ? 'host' : 'device']} with the button beside it held.`
        : `MAKCU's bootloader on this chip is the ${CHIP_NAME[found]}'s, not the ${CHIP_NAME[found === 'device' ? 'host' : 'device']}'s.`,
    );
  }
}
