// Flash constants and types, free of the heavy esptool-js dependency so the
// UI can import them without pulling esptool into the main bundle.

import type { SerialLink } from '../serial';

// ESP32-S3 layout: bootloader at 0x0, app at 0x10000.
export const APP_FLASH_ADDR = 0x10000;
export const FACTORY_FLASH_ADDR = 0x0;

export type FlashKind = 'app' | 'factory';
export type FlashPhase = 'rebooting' | 'connecting' | 'writing' | 'done';

export interface FlashProgress {
  phase: FlashPhase;
  written?: number;
  total?: number;
}

export interface FlashDeviceParams {
  link: SerialLink;
  image: Uint8Array;
  kind: FlashKind;
  onProgress?: (p: FlashProgress) => void;
  onLog?: (line: string) => void;
}

// ESP32-S3 with 4 MB flash.
export const FLASH_SIZE_BYTES = 4 * 1024 * 1024;
const ESP_IMAGE_MAGIC = 0xe9;
const PARTITION_TABLE_OFFSET = 0x8000;

// Hard checks that reject a file that cannot be a valid image for this chip.
// Returns an error message, or null if the image passes.
export function validateImage(image: Uint8Array, kind: FlashKind): string | null {
  if (image.length < 1024) {
    return 'This file is too small to be a firmware image.';
  }
  if (image[0] !== ESP_IMAGE_MAGIC) {
    return 'This does not look like an ESP32-S3 firmware image (it should start with byte 0xE9).';
  }
  const address = kind === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR;
  if (address + image.length > FLASH_SIZE_BYTES) {
    return 'This image is too large to fit the 4 MB flash at the chosen offset.';
  }
  return null;
}

function hasPartitionTable(image: Uint8Array): boolean {
  return (
    image.length > PARTITION_TABLE_OFFSET + 1 &&
    image[PARTITION_TABLE_OFFSET] === 0xaa &&
    image[PARTITION_TABLE_OFFSET + 1] === 0x50
  );
}

// Soft heuristic: a factory image embeds a partition table at 0x8000, an app
// image does not. Used to warn on a likely app/factory mix-up (not authoritative).
export function looksLikeWrongKind(image: Uint8Array, kind: FlashKind): boolean {
  const factoryShaped = hasPartitionTable(image);
  if (kind === 'app' && factoryShaped) return true;
  if (kind === 'factory' && !factoryShaped) return true;
  return false;
}
