// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseEvent } from '../../server/stats/validate';

const box = { type: 'box', mac: '588C81E08244', fw: '3.4.4', hostFw: '3.4.4', proto: 9, os: 'linux', browser: 'chrome' };
const device = { type: 'device', mac: '588c81e08244', vid: 0x046d, pid: 0xc08b, kind: 2, product: 'G502 HERO' };
const flash = {
  type: 'flash',
  mac: '588c81e08244',
  page: 'update',
  route: 'usb2',
  chips: 'both',
  source: 'release',
  kind: null,
  to: { device: '3.4.4', host: '3.4.4' },
  from: { device: '3.4.2', host: '3.4.2' },
  result: 'verified',
  ms: 41000,
};

const refused = (e: unknown) => expect(typeof parseEvent(e)).toBe('string');

describe('parseEvent', () => {
  it('takes a valid event of each type, with the MAC lowercased', () => {
    expect(parseEvent(box)).toEqual({ ...box, mac: '588c81e08244' });
    expect(parseEvent(device)).toEqual(device);
    expect(parseEvent(flash)).toEqual(flash);
  });

  it('drops fields it does not know', () => {
    expect(parseEvent({ ...box, name: 'Desk', ip: '1.2.3.4' })).toEqual({ ...box, mac: '588c81e08244' });
  });

  it('refuses anything that is not an event object', () => {
    refused(null);
    refused('box');
    refused([box]);
    refused({ ...box, type: 'session' });
  });

  it('refuses a malformed or all-zero MAC on a box or a device', () => {
    refused({ ...box, mac: '588c81e0824' });
    refused({ ...box, mac: '588c81e0824g' });
    refused({ ...box, mac: '58:8c:81:e0:82:44' });
    refused({ ...box, mac: '000000000000' });
    refused({ ...device, mac: '000000000000' });
    refused({ ...device, mac: null });
  });

  it('takes a flash with no MAC, but not a malformed one', () => {
    expect(parseEvent({ ...flash, mac: null })).toEqual({ ...flash, mac: null });
    refused({ ...flash, mac: 'nope' });
  });

  it('refuses versions out of range or malformed', () => {
    refused({ ...box, fw: '3.4' });
    refused({ ...box, fw: '3.4.256' });
    refused({ ...box, fw: 'v3.4.4' });
    refused({ ...box, hostFw: '1.2.3.4' });
    refused({ ...flash, to: { device: '3.4.x', host: null } });
    refused({ ...flash, to: null });
    expect(parseEvent({ ...box, hostFw: null })).toEqual({ ...box, mac: '588c81e08244', hostFw: null });
  });

  it('refuses a protocol outside a byte', () => {
    refused({ ...box, proto: 256 });
    refused({ ...box, proto: -1 });
    refused({ ...box, proto: 1.5 });
  });

  it('refuses enum values it does not list', () => {
    refused({ ...box, os: 'beos' });
    refused({ ...box, browser: 'firefox' });
    refused({ ...flash, page: 'control' });
    refused({ ...flash, route: 'usb3' });
    refused({ ...flash, chips: 'all' });
    refused({ ...flash, source: 'url' });
    refused({ ...flash, kind: 'bootloader' });
    refused({ ...flash, result: 'ok' });
  });

  it('refuses a device with VID and PID both zero, or a kind past mouse', () => {
    refused({ ...device, vid: 0, pid: 0 });
    refused({ ...device, vid: 0x10000 });
    refused({ ...device, kind: 3 });
    expect(parseEvent({ ...device, vid: 0 })).toEqual({ ...device, vid: 0 });
  });

  it('cleans the product string', () => {
    const p = (product: unknown) => (parseEvent({ ...device, product }) as { product: string | null }).product;
    expect(p('  G502\u0000 HERO\n ')).toBe('G502 HERO');
    expect(p('x'.repeat(300))).toBe('x'.repeat(126));
    expect(p('   ')).toBeNull();
    expect(p(null)).toBeNull();
    refused({ ...device, product: 42 });
  });

  it('refuses a duration past an hour or below zero', () => {
    refused({ ...flash, ms: 3_600_001 });
    refused({ ...flash, ms: -1 });
    expect(parseEvent({ ...flash, ms: 3_600_000 })).toEqual({ ...flash, ms: 3_600_000 });
  });
});
