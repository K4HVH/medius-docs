// Helpers the advanced-control cards share: the hex and number field parsers, and the casing that
// turns the protocol's own names into option labels. Each card used to carry its own copy of both.

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

// A small integer from a decimal or 0x-prefixed field; null on anything else.
export const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const v = /^0x/i.test(t) ? parseInt(t.slice(2), 16) : Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};

// The protocol names things in lowercase wire vocabulary. Sentence case is what an option label wears
// everywhere else on the dashboard, except where the wire name is an acronym or a hyphenated pair.
const SPECIAL: Record<string, string> = {
  ok: 'OK',
  nak: 'NAK',
  'reply-patch': 'Reply patch',
  'reply-replace': 'Reply replace',
};

export const displayName = (t: string): string => SPECIAL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
