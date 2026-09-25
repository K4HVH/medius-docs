// Helpers the advanced-control cards share: the hex and number field parsers, the setup packet's
// fields, the traffic address a rewrite rule and a packet trigger both name, and the casing that
// turns the protocol's own names into option labels.

import { CatchClass, Direction, REWRITE_CLASSES, rewriteClassName } from '../../../dashboard/protocol';

// Bytes as spaced lowercase hex, the form every hex field on these cards reads and writes.
export const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

// Parse spaced or run-together hex into bytes; an odd nibble count or a non-hex character is a null,
// which the caller reports rather than sending a half-formed frame. An empty string is an empty array.
export const parseHex = (s: string): Uint8Array | null => {
  const clean = s.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

// A match and its mask from their two hex fields, or what is wrong with them. The box compares a
// packet's head byte for byte under the mask, so the two are one length, `max` bytes at most.
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

// A small integer from a decimal or 0x-prefixed field; null on anything else.
export const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const v = /^0x/i.test(t) ? parseInt(t.slice(2), 16) : Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};

// The five setup fields keep their specification names and stay text: bmRequestType and wValue are
// read and written in hex wherever USB is documented, and a spinner showing 256 for 0x0100 would be
// the wrong instrument for a setup packet.
export const SETUP_FIELDS = [
  { key: 'type', label: 'bmRequestType', placeholder: '0x80' },
  { key: 'req', label: 'bRequest', placeholder: '6' },
  { key: 'value', label: 'wValue', placeholder: '0x0100' },
  { key: 'index', label: 'wIndex', placeholder: '0' },
  { key: 'length', label: 'wLength', placeholder: '18' },
] as const;

// The setup packet every setup editor opens on: GET_DESCRIPTOR for the 18-byte device descriptor.
export const SETUP_DEFAULT: Record<string, string> = {
  type: '0x80',
  req: '6',
  value: '0x0100',
  index: '0',
  length: '18',
};

// bmRequestType is a bitmap, so the one field nobody reads at a glance is the one worth reading
// back in words. Bit 7 is the direction, bits 6-5 the type, bits 4-0 the recipient.
const TYPE_NAME = ['standard', 'class', 'vendor', 'reserved'];
const RECIPIENT_NAME = ['the device', 'an interface', 'an endpoint', 'another target'];

// The standard requests, which are the ones a bRequest number alone will not tell you.
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

// Where a raw report's bytes land, which is the whole meaning of the direction sitting above it.
export const RAW_DIR_BLURB: Record<number, string> = {
  [Direction.Positive]: 'The report reaches the game PC.',
  [Direction.Negative]: 'The report reaches the device.',
};

// What the Out data field is for, which bit 7 of bmRequestType decides.
export const outDataBlurb = (bm: number | null): string =>
  bm !== null && (bm & 0x80) === 0
    ? 'The data stage this request carries to the device.'
    : 'Unused: this request reads, it does not write.';

// The protocol names things in lowercase wire vocabulary. Sentence case is what an option label wears
// everywhere else on the dashboard, except where the wire name is an acronym or a hyphenated pair.
const SPECIAL: Record<string, string> = {
  ok: 'OK',
  nak: 'NAK',
  'reply-patch': 'Reply patch',
  'reply-replace': 'Reply replace',
};

export const displayName = (t: string): string => SPECIAL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

// The six traffic surfaces, and what each one carries. It reads out under the class picker, the way
// the options card blurbs the render mode it is sitting on.
export const TRAFFIC_CLASS_OPTIONS = REWRITE_CLASSES.map((c) => ({
  value: String(c),
  label: displayName(rewriteClassName(c)),
}));

export const TRAFFIC_CLASS_BLURB: Record<number, string> = {
  [CatchClass.HidIn]: 'Reports as the device sends them, by interface, before the box changes anything.',
  [CatchClass.HidOut]: 'Reports the game PC sends the device, by endpoint.',
  [CatchClass.VendorInterrupt]: 'Interrupt traffic on a vendor interface.',
  [CatchClass.VendorBulk]: 'Bulk traffic on a vendor interface.',
  [CatchClass.Control]: 'Class and vendor requests on EP0, and every request on a control endpoint above it.',
  [CatchClass.Emit]: 'What the clone sends the game PC, injection included.',
};

// HID_IN addresses an interface; every other class keys on the endpoint number, HID_OUT included.
// The catch card's id table says the same, and the box looks all of them up by EP_NUM.
export const trafficIdLabel = (cls: number): string => {
  if (cls === CatchClass.HidIn) return 'Interface number';
  return cls === CatchClass.Control ? 'Endpoint number (0 is EP0)' : 'Endpoint number';
};

export const trafficDirWord = (d: number): string =>
  d === Direction.Positive ? 'in' : d === Direction.Negative ? 'out' : 'both';
