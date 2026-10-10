/// <reference types="w3c-web-serial" />
// Free of esptool-js, so the UI imports this without the bundle cost.

// ESP32-S3 layout: bootloader at 0x0, app at 0x10000.
export const APP_FLASH_ADDR = 0x10000;
export const FACTORY_FLASH_ADDR = 0x0;

export type FlashKind = 'app' | 'factory';
// An update over the control port also restarts the box and verifies what it runs.
export type FlashPhase = 'rebooting' | 'connecting' | 'writing' | 'restarting' | 'verifying' | 'done';

export interface FlashProgress {
  phase: FlashPhase;
  // Which chip an update over the control port is writing: the mouse-side chip first.
  chip?: 'host' | 'device';
  written?: number;
  total?: number;
}

export interface FlashNativeParams {
  port: SerialPort;
  image: Uint8Array;
  kind: FlashKind;
  onProgress?: (p: FlashProgress) => void;
  onLog?: (line: string) => void;
  // The chip's factory MAC, once the ROM answers; null if it can't be read.
  onMac?: (mac: string | null) => void;
}

// esptool's "58:8c:81:e0:82:44" in the form a box id takes: "588c81e08244".
export function romMac(s: string): string | null {
  const hex = s.replace(/:/g, '').toLowerCase();
  return /^[0-9a-f]{12}$/.test(hex) && hex !== '000000000000' ? hex : null;
}

export type FlashChip = 'device' | 'host';

// ESP32-S3 with 4 MB flash.
export const FLASH_SIZE_BYTES = 4 * 1024 * 1024;
const ESP_IMAGE_MAGIC = 0xe9;
const PARTITION_TABLE_OFFSET = 0x8000;

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
