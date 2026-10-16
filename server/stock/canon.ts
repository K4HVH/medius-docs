// The bytes MAKCU signs a catalog over: Python's json.dumps(doc minus "signature", sort_keys=True,
// separators=(",", ":"), ensure_ascii=False). Numbers keep the text they were written as, and print as
// Python prints them; keys sort by code point, as Python's do.

class PyNumber {
  constructor(readonly src: string) {}
}

// Python's repr of a float.
function pyFloat(x: number): string {
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const sign = x < 0 ? '-' : '';
  const [m, e] = Math.abs(x).toExponential().split('e');
  const digits = m.replace('.', '');
  const decpt = Number(e) + 1;
  if (decpt <= -4 || decpt > 16) {
    const exp = decpt - 1;
    const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${mant}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  if (decpt <= 0) return `${sign}0.${'0'.repeat(-decpt)}${digits}`;
  if (decpt >= digits.length) return `${sign}${digits}${'0'.repeat(decpt - digits.length)}.0`;
  return `${sign}${digits.slice(0, decpt)}.${digits.slice(decpt)}`;
}

function byCodePoint(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

function str(s: string): string {
  if (!s.isWellFormed()) throw new Error('lone surrogate');
  return JSON.stringify(s);
}

function emit(v: unknown): string {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'string') return str(v);
  if (v instanceof PyNumber) return /^-?\d+$/.test(v.src) ? BigInt(v.src).toString() : pyFloat(Number(v.src));
  if (Array.isArray(v)) return `[${v.map(emit).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort(byCodePoint)
    .map((k) => `${str(k)}:${emit(o[k])}`)
    .join(',')}}`;
}

export function canonical(text: string): Uint8Array {
  const doc = JSON.parse(text, (_k, v, ctx?: { source?: string }) => (typeof v === 'number' ? new PyNumber(ctx!.source!) : v));
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('not an object');
  delete (doc as Record<string, unknown>).signature;
  return new TextEncoder().encode(emit(doc));
}
