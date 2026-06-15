import { describe, it, expect } from 'vitest';
import {
  APP_FLASH_ADDR,
  FLASH_SIZE_BYTES,
  looksLikeWrongKind,
  validateImage,
} from '../../src/dashboard/flash';

// A bare app image: 0xE9 magic, no partition table at 0x8000.
const appImage = (len = 2048) => {
  const b = new Uint8Array(len);
  b[0] = 0xe9;
  return b;
};

// A factory image: 0xE9 magic plus the partition-table magic (0xAA 0x50) at 0x8000.
const factoryImage = (len = 0x11000) => {
  const b = new Uint8Array(len);
  b[0] = 0xe9;
  b[0x8000] = 0xaa;
  b[0x8001] = 0x50;
  return b;
};

describe('validateImage', () => {
  it('rejects a file that is too small', () => {
    expect(validateImage(new Uint8Array(500), 'app')).toMatch(/too small/);
  });

  it('rejects a file without the 0xE9 image magic', () => {
    const b = appImage();
    b[0] = 0x00;
    expect(validateImage(b, 'app')).toMatch(/0xE9/);
  });

  it('rejects an image that overruns the flash at its offset', () => {
    const tooBig = new Uint8Array(FLASH_SIZE_BYTES - APP_FLASH_ADDR + 1);
    tooBig[0] = 0xe9;
    expect(validateImage(tooBig, 'app')).toMatch(/too large/);
  });

  it('accepts a valid app image', () => {
    expect(validateImage(appImage(), 'app')).toBeNull();
  });

  it('accepts a valid factory image', () => {
    expect(validateImage(factoryImage(), 'factory')).toBeNull();
  });
});

describe('looksLikeWrongKind', () => {
  it('flags a factory-shaped image chosen as an app update', () => {
    expect(looksLikeWrongKind(factoryImage(), 'app')).toBe(true);
  });

  it('accepts a factory-shaped image chosen as factory', () => {
    expect(looksLikeWrongKind(factoryImage(), 'factory')).toBe(false);
  });

  it('flags an app-shaped image chosen as factory', () => {
    expect(looksLikeWrongKind(appImage(), 'factory')).toBe(true);
  });

  it('accepts an app-shaped image chosen as an app update', () => {
    expect(looksLikeWrongKind(appImage(), 'app')).toBe(false);
  });
});
