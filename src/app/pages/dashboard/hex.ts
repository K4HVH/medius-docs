// Parsers and labels shared by the advanced-control cards.

import { CatchClass, Direction, REWRITE_CLASSES, rewriteClassName } from '../../../dashboard/protocol';

// Spaced lowercase hex, the form every hex field reads and writes.
export const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

// Spaced or run-together hex. Null on an odd nibble count or a non-hex character, for the caller
// to report; empty on empty.
export const parseHex = (s: string): Uint8Array | null => {
  const clean = s.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

// The box compares a packet's head byte for byte under the mask, so both are one length, at most
// `max` bytes.
export const parseMatchMask = (
  match: string,
  mask: string,
  max: number,
): { match: Uint8Array; mask: Uint8Array } | string => {
  const m = parseHex(match);
  const k = parseHex(mask);
  if (m === null || k === null) return 'Match and mask must be hex.';
  if (m.length !== k.length) return 'Match and mask must be the same length.';
  if (m.length > max) return `Match and mask must be at most ${max} bytes.`;
  return { match: m, mask: k };
};

// Decimal or 0x-prefixed; null otherwise.
export const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const v = /^0x/i.test(t) ? parseInt(t.slice(2), 16) : Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};

// Spec names, as text fields: USB documents bmRequestType and wValue in hex, and a spinner would
// show 256 for 0x0100.
export const SETUP_FIELDS = [
  { key: 'type', label: 'bmRequestType', placeholder: '0x80' },
  { key: 'req', label: 'bRequest', placeholder: '6' },
  { key: 'value', label: 'wValue', placeholder: '0x0100' },
  { key: 'index', label: 'wIndex', placeholder: '0' },
  { key: 'length', label: 'wLength', placeholder: '18' },
] as const;

// GET_DESCRIPTOR for the 18-byte device descriptor.
export const SETUP_DEFAULT: Record<string, string> = {
  type: '0x80',
  req: '6',
  value: '0x0100',
  index: '0',
  length: '18',
};

// bmRequestType: bit 7 direction, bits 6-5 type, bits 4-0 recipient.
const TYPE_NAME = ['standard', 'class', 'vendor', 'reserved'];
const RECIPIENT_NAME = ['the device', 'an interface', 'an endpoint', 'another target'];

const STANDARD_REQUEST: Record<number, string> = {
  0: 'GET_STATUS',
  1: 'CLEAR_FEATURE',
  3: 'SET_FEATURE',
  5: 'SET_ADDRESS',
  6: 'GET_DESCRIPTOR',
  7: 'SET_DESCRIPTOR',
  8: 'GET_CONFIGURATION',
  9: 'SET_CONFIGURATION',
  10: 'GET_INTERFACE',
  11: 'SET_INTERFACE',
  12: 'SYNCH_FRAME',
};

export const decodeSetup = (bm: number, req: number | null): string => {
  const dir = bm & 0x80 ? 'Device to host' : 'Host to device';
  const type = (bm >> 5) & 0x03;
  const recipient = RECIPIENT_NAME[Math.min(bm & 0x1f, 3)];
  const head = `${dir}, ${TYPE_NAME[type]}, to ${recipient}`;
  const named = type === 0 && req !== null ? STANDARD_REQUEST[req] : undefined;
  return named ? `${head}: ${named}.` : `${head}.`;
};

export const RAW_DIR_BLURB: Record<number, string> = {
  [Direction.Positive]: 'Reaches the game PC.',
  [Direction.Negative]: 'Reaches the device.',
};

// Bit 7 of bmRequestType sets whether the Out data field is used.
export const outDataBlurb = (bm: number | null): string =>
  bm !== null && (bm & 0x80) === 0
    ? 'Data stage sent to the device.'
    : 'Unused: this request reads.';

// Sentence-cases a wire name, except acronyms and hyphenated pairs.
const SPECIAL: Record<string, string> = {
  ok: 'OK',
  nak: 'NAK',
  'reply-patch': 'Reply patch',
  'reply-replace': 'Reply replace',
};

export const displayName = (t: string): string => SPECIAL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

export const TRAFFIC_CLASS_OPTIONS = REWRITE_CLASSES.map((c) => ({
  value: String(c),
  label: displayName(rewriteClassName(c)),
}));

export const TRAFFIC_CLASS_BLURB: Record<number, string> = {
  [CatchClass.HidIn]: 'Native reports by interface, before the box changes them.',
  [CatchClass.HidOut]: 'Reports from the game PC to the device, by endpoint.',
  [CatchClass.VendorInterrupt]: 'Interrupt traffic on a vendor interface.',
  [CatchClass.VendorBulk]: 'Bulk traffic on a vendor interface.',
  [CatchClass.Control]: 'Class and vendor requests on EP0, and every request on higher control endpoints.',
  [CatchClass.Emit]: 'What the clone sends the game PC, injection included.',
};

// HID_IN keys on the interface; every other class, HID_OUT included, on the endpoint number.
export const trafficIdLabel = (cls: number): string => {
  if (cls === CatchClass.HidIn) return 'Interface';
  return cls === CatchClass.Control ? 'Endpoint (0 is EP0)' : 'Endpoint';
};

export const trafficDirWord = (d: number): string =>
  d === Direction.Positive ? 'in' : d === Direction.Negative ? 'out' : 'both';
