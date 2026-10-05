// What an ESP32-S3 app image says about itself, read before anything is sent.

import { APP_FLASH_ADDR, type FlashChip, type FlashKind, hasPartitionTable, validateImage } from './types';

const S3_CHIP_ID = 9;
const APP_DESC_MAGIC = 0xabcd5432;
// Bytes in a spare slot (OTA_SLOT_SIZE).
export const SLOT_BYTES = 0xf0000;
const PROJECTS: Record<string, FlashChip> = { medius_device: 'device', medius_host: 'host' };

export interface AppHeader {
  chipId: number;
  // Null without an app descriptor.
  project: string | null;
  version: string | null;
}

const text = (b: Uint8Array, at: number) => {
  const s = b.subarray(at, at + 32);
  const end = s.indexOf(0);
  return new TextDecoder().decode(end < 0 ? s : s.subarray(0, end));
};

export function readAppHeader(image: Uint8Array, kind: FlashKind): AppHeader | null {
  const at = kind === 'factory' ? APP_FLASH_ADDR : 0;
  if (image.length < at + 112 || image[at] !== 0xe9) return null;
  const dv = new DataView(image.buffer, image.byteOffset, image.byteLength);
  const chipId = dv.getUint16(at + 12, true);
  if (dv.getUint32(at + 32, true) !== APP_DESC_MAGIC) return { chipId, project: null, version: null };
  return { chipId, project: text(image, at + 80), version: text(image, at + 48) };
}

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(s: string | null | undefined): Semver | null {
  const m = s?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

export const mediusChip = (h: AppHeader | null): FlashChip | null => (h?.project && PROJECTS[h.project]) || null;

const socket = (chip: FlashChip) => (chip === 'host' ? 'USB3' : 'USB1');
const otherChip = (chip: FlashChip) =>
  chip === 'host' ? "This is the main chip's image." : "This is the mouse-side chip's image.";

export function usb2Refusal(image: Uint8Array, chip: FlashChip): string | null {
  const invalid = validateImage(image, 'app');
  if (invalid) return invalid;
  if (hasPartitionTable(image)) {
    return `This is a factory image. Choose the application image, or flash it over ${socket(chip)}.`;
  }
  if (image.length > SLOT_BYTES) return "This image is too large for the box's spare slot.";
  const h = readAppHeader(image, 'app');
  if (!h || h.chipId !== S3_CHIP_ID) return 'Not an ESP32-S3 image.';
  const mine = mediusChip(h);
  if (!mine) return `This isn't medius firmware. Flash it over ${socket(chip)}.`;
  if (mine !== chip) return otherChip(chip);
  const v = parseVersion(h.version);
  if (v && (v.major < 3 || (v.major === 3 && v.minor < 2))) {
    return `Firmware before 3.2.0 can't be updated over USB2. Flash it over ${socket(chip)}.`;
  }
  return null;
}

// Any firmware goes over a chip's own USB, except medius built for the other chip.
export function romRefusal(image: Uint8Array, kind: FlashKind, chip: FlashChip): string | null {
  const mine = mediusChip(readAppHeader(image, kind));
  return mine && mine !== chip ? otherChip(chip) : null;
}
