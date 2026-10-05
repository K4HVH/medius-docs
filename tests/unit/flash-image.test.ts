import { describe, it, expect } from 'vitest';
import {
  SLOT_BYTES,
  mediusChip,
  parseVersion,
  readAppHeader,
  romRefusal,
  usb2Refusal,
} from '../../src/dashboard/flash';

// The first 112 bytes of the v3.4.4 builds, 2026-10-04: image header, first segment header, app
// descriptor.
const DEVICE_HEAD =
  'e906021f30553740ee0000000900000000630000000000012000043cbc8000003254cdab000000000000000000000000332e342e340000000000000000000000000000000000000000000000000000006d65646975735f64657669636500000000000000000000000000000000000000';
const HOST_HEAD =
  'e906021f70533740ee0000000900000000630000000000012000033cc42601003254cdab000000000000000000000000332e342e340000000000000000000000000000000000000000000000000000006d65646975735f686f7374000000000000000000000000000000000000000000';
const real = (hex: string) => {
  const b = new Uint8Array(4096);
  b.set(hex.match(/../g)!.map((h) => parseInt(h, 16)));
  return b;
};

const app = (
  o: { project?: string; version?: string; chip?: number; magic?: number; size?: number; factory?: boolean } = {},
) => {
  const at = o.factory ? 0x10000 : 0;
  const b = new Uint8Array(o.size ?? at + 4096);
  b[at] = 0xe9;
  const dv = new DataView(b.buffer);
  dv.setUint16(at + 12, o.chip ?? 9, true);
  dv.setUint32(at + 32, o.magic ?? 0xabcd5432, true);
  new TextEncoder().encodeInto(o.version ?? '3.4.4', b.subarray(at + 48, at + 80));
  new TextEncoder().encodeInto(o.project ?? 'medius_device', b.subarray(at + 80, at + 112));
  if (o.factory) {
    b[0] = 0xe9;
    b[0x8000] = 0xaa;
    b[0x8001] = 0x50;
  }
  return b;
};

describe('readAppHeader', () => {
  it('reads the chip, project and version off the real builds', () => {
    expect(readAppHeader(real(DEVICE_HEAD), 'app')).toEqual({ chipId: 9, project: 'medius_device', version: '3.4.4' });
    expect(readAppHeader(real(HOST_HEAD), 'app')).toEqual({ chipId: 9, project: 'medius_host', version: '3.4.4' });
    expect(mediusChip(readAppHeader(real(DEVICE_HEAD), 'app'))).toBe('device');
    expect(mediusChip(readAppHeader(real(HOST_HEAD), 'app'))).toBe('host');
  });

  it("reads a factory image's application at 0x10000", () => {
    expect(readAppHeader(app({ factory: true, project: 'medius_host' }), 'factory')).toEqual({
      chipId: 9,
      project: 'medius_host',
      version: '3.4.4',
    });
  });

  it('an image without an app descriptor has no project or version', () => {
    expect(readAppHeader(app({ magic: 0, chip: 5 }), 'app')).toEqual({ chipId: 5, project: null, version: null });
    expect(mediusChip(readAppHeader(app({ magic: 0 }), 'app'))).toBeNull();
  });

  it('bytes that are not an ESP image read as nothing', () => {
    const b = app();
    b[0] = 0;
    expect(readAppHeader(b, 'app')).toBeNull();
    expect(readAppHeader(new Uint8Array(64), 'app')).toBeNull();
  });
});

describe('parseVersion', () => {
  it('takes the first three numbers, whatever surrounds them', () => {
    expect(parseVersion('v3.4.3')).toEqual({ major: 3, minor: 4, patch: 3 });
    expect(parseVersion('3.4.4-dirty')).toEqual({ major: 3, minor: 4, patch: 4 });
    expect(parseVersion('x')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
});

describe('usb2Refusal', () => {
  it('passes the real builds on the chips they are built for', () => {
    expect(usb2Refusal(real(DEVICE_HEAD), 'device')).toBeNull();
    expect(usb2Refusal(real(HOST_HEAD), 'host')).toBeNull();
  });

  it.each([
    ['a file too small to be an image', new Uint8Array(500), 'device', /too small/],
    ['a factory image, for the main chip', app({ factory: true }), 'device', /factory image\. Choose the application image, or flash it over USB1\./],
    ['a factory image, for the mouse-side chip', app({ factory: true, project: 'medius_host' }), 'host', /over USB3\./],
    ['an image larger than a spare slot', app({ size: SLOT_BYTES + 1 }), 'device', /too large for the box's spare slot/],
    ['an image for another chip family', app({ chip: 5 }), 'device', /^Not an ESP32-S3 image\.$/],
    ['an image with no app descriptor', app({ magic: 0 }), 'device', /isn't medius firmware\. Flash it over USB1\./],
    ['firmware that isn\'t medius', app({ project: 'stock_fw' }), 'host', /isn't medius firmware\. Flash it over USB3\./],
    ["the mouse-side chip's image on the main chip", app({ project: 'medius_host' }), 'device', /^This is the mouse-side chip's image\.$/],
    ["the main chip's image on the mouse-side chip", app({ project: 'medius_device' }), 'host', /^This is the main chip's image\.$/],
    ['medius before 3.2.0', app({ version: '3.1.0' }), 'device', /before 3\.2\.0 can't be updated over USB2/],
    ['medius 2.x', app({ version: '2.3.0' }), 'device', /before 3\.2\.0/],
  ] as const)('refuses %s', (_, image, chip, why) => {
    expect(usb2Refusal(image, chip)).toMatch(why);
  });

  it('passes 3.2.0, the first firmware that updates over USB2', () => {
    expect(usb2Refusal(app({ version: '3.2.0' }), 'device')).toBeNull();
  });
});

describe('romRefusal', () => {
  it('takes any firmware except medius built for the other chip', () => {
    expect(romRefusal(app({ project: 'stock_fw' }), 'device')).toBeNull();
    expect(romRefusal(app({ magic: 0 }), 'device')).toBeNull();
    expect(romRefusal(app({ project: 'medius_device' }), 'device')).toBeNull();
    expect(romRefusal(app({ factory: true, project: 'medius_host' }), 'device')).toBe(
      "This is the mouse-side chip's image.",
    );
    expect(romRefusal(app({ project: 'medius_device' }), 'host')).toBe("This is the main chip's image.");
  });

  it('reads the app where the file layout puts it, whatever Image says', () => {
    // An application image picked with Image left on Factory, and the reverse.
    expect(romRefusal(real(HOST_HEAD), 'device')).toBe("This is the mouse-side chip's image.");
    expect(romRefusal(app({ factory: true, project: 'medius_device' }), 'host')).toBe("This is the main chip's image.");
  });
});

describe('usb2Refusal on a padded factory image', () => {
  it('names a padded factory image as one, not a size problem at an offset USB2 never writes', () => {
    const big = app({ factory: true, size: 4 * 1024 * 1024 - 1024 });
    expect(usb2Refusal(big, 'device')).toBe(
      'This is a factory image. Choose the application image, or flash it over USB1.',
    );
  });
});
