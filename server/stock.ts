import { createHash, createPublicKey, verify } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { canonical } from './stock/canon';
import { clientOf } from './client';

// MAKCU's stock firmware for the Flash page: read from MAKCU's signed catalog on request (makcu.com blocks
// other sites' pages from reading it), checked as makcu-toolkit 1.15.20 checks it, and passed on unstored.

const ROOTS = ['https://makcu.com/devinfo', 'https://makcu.15-204-2-173.sslip.io/devinfo'];
// The catalog's signing key, as makcu-toolkit carries it.
export const MAKCU_KEY = '2fc038fdabd2a997cbb80c056da05edf81ea49ddde247d5a8b8fa099871812ca';
// The newest repair flash this page performs: the toolkit's at 1.15.20 (same as at 1.13.4: erase, the pair
// package at 0x4000, the port's bootloader at 0x0, the same image checks).
const TOOLKIT = [1, 15, 20];
const CATALOG_MAX = 2 * 1024 * 1024;
// Timeouts inside Bun's 10 s request limit: one per catalog address, then one for a file.
const CATALOG_MS = 4_000;
const FILE_MS = 8_000;
// How long the checked catalog and each checked file stay in memory, so requests arriving together share a read.
const FRESH_MS = 60_000;
const FAILED_MS = 10_000;
// Requests one address may make per window, so the relay can't be turned against makcu.com.
const SHARE = 30;
const SHARE_MS = 10 * 60_000;
const ADDRESSES = 10_000;
const AGENT = 'medius-dashboard (+https://medius.k4tech.net)';

export interface StockFile {
  file: string;
  size: number;
  sha256: string;
}

// Only the build's id is passed on from the catalog's text, and only in its "v4.094" shape. The rest (notes,
// labels) is MAKCU's wording about MAKCU's firmware.
export interface StockOffer {
  build: StockFile & { id: string };
  usb1: StockFile;
  usb3: StockFile;
}

type Doc = Record<string, unknown>;
const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);

// A catalog entry's file: a plain .bin name, a size in bounds, a SHA-256.
function entry(v: unknown, min: number, max: number): StockFile | null {
  if (!isDoc(v)) return null;
  const { file, size, sha256 } = v;
  if (typeof file !== 'string' || !/^[^/\\]+\.bin$/.test(file) || file === '.bin' || file.includes('..')) return null;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < min || size > max) return null;
  if (typeof sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(sha256)) return null;
  return { file, size, sha256: sha256.toLowerCase() };
}

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
const dotted = (s: string) => s.replace(/^v/, '').split('.').map(Number);
const newer = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
};
const BUILD_ID = /^v\d+\.\d{3}$/;

export function checkCatalog(text: string, key = MAKCU_KEY): StockOffer | { error: string } {
  let body: Uint8Array;
  let doc: unknown;
  try {
    body = canonical(text);
    doc = JSON.parse(text);
  } catch {
    return { error: "MAKCU's catalog couldn't be read" };
  }
  if (!isDoc(doc) || typeof doc.signature !== 'string' || !/^[0-9a-fA-F]{128}$/.test(doc.signature))
    return { error: "MAKCU's catalog carries no signature" };
  const pub = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(key, 'hex')]), format: 'der', type: 'spki' });
  if (!verify(null, body, pub, Buffer.from(doc.signature, 'hex'))) return { error: "MAKCU's catalog signature doesn't check out" };
  if (doc.app !== 'makcu-devinfo' || doc.kind !== 'firmware-catalog' || !Array.isArray(doc.builds))
    return { error: "MAKCU's catalog isn't a firmware catalog" };

  const official = doc.builds.find((b): b is Doc => isDoc(b) && !!b.official);
  if (!official) return { error: "MAKCU's catalog marks no build official" };
  if (official.withdrawn) return { error: "MAKCU's official build is withdrawn" };
  const file = entry(official, 1000, 1048576);
  if (!file || typeof official.id !== 'string' || !BUILD_ID.test(official.id)) return { error: "MAKCU's official build has a malformed entry" };

  const rom = doc.repair_rom;
  if (!isDoc(rom)) return { error: "MAKCU's catalog has no repair flash" };
  if (typeof rom.min_toolkit === 'string' && newer(dotted(rom.min_toolkit), TOOLKIT))
    return { error: "MAKCU's repair flash needs a newer toolkit than the one this page follows" };
  const usb1 = entry(rom.usb1, 24, 16384);
  const usb3 = entry(rom.usb3, 24, 16384);
  if (!usb1 || !usb3) return { error: "MAKCU's repair bootloaders have malformed entries" };
  // As the toolkit reads it: the listed builds, and every signed build numbered pair_min or later.
  const listed = Array.isArray(rom.pairs) && rom.pairs.includes(official.id);
  const fromMin =
    typeof rom.pair_min === 'number' && typeof official.version === 'number' && official.version >= rom.pair_min && typeof official.signature === 'string';
  if (!listed && !fromMin) return { error: `MAKCU's repair bootloaders don't pair with the official build ${official.id}` };

  return { build: { ...file, id: official.id }, usb1, usb3 };
}

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
// "MKC" + kind + "IMG1": the role markers MAKCU's images and bootloaders carry.
const mark = (b: Uint8Array, o: number, kind: string) => {
  const want = `MKC${kind}IMG1`;
  for (let i = 0; i < 8; i++) if (b[o + i] !== want.charCodeAt(i)) return false;
  return true;
};

// One image of a package: its role's marker and none of the other role's.
function imageRoles(b: Uint8Array, role: number): string | null {
  let mine = false;
  let other = false;
  for (let o = 0; o + 16 <= b.length; o++) {
    if (b[o] !== 77 || !mark(b, o, 'U') || u32(b, o + 12) !== 2) continue;
    if (u32(b, o + 8) === role && o % 4 === 0) mine = true;
    if (u32(b, o + 8) === 3 - role) other = true;
  }
  return mine && !other ? null : 'wrong image roles';
}

// An MKU1 v2 package: a 32-byte header, then the USB1 image (role 1), then the USB3 image (role 2).
export function checkPackage(b: Uint8Array): string | null {
  if (b.length < 32) return 'not an MKU1 v2 package';
  const [magic, version, a, ac, n3, bc, ident, hc] = Array.from({ length: 8 }, (_, i) => u32(b, i * 4));
  if (!(magic === 827673421 && version === 2 && ident && a <= 524288 && n3 <= 524288 && b.length === 32 + a + n3 && b.length <= 1048576))
    return 'not an MKU1 v2 package';
  if (crc32(b.subarray(0, 28)) >>> 0 !== hc) return 'header CRC mismatch';
  const usb1 = b.subarray(32, 32 + a);
  const usb3 = b.subarray(32 + a);
  if (crc32(usb1) >>> 0 !== ac) return 'USB1 image CRC mismatch';
  if (crc32(usb3) >>> 0 !== bc) return 'USB3 image CRC mismatch';
  const r1 = imageRoles(usb1, 1);
  if (r1) return `USB1 image: ${r1}`;
  const r3 = imageRoles(usb3, 2);
  return r3 ? `USB3 image: ${r3}` : null;
}

const IN_DRAM = (a: number, len: number) => a >= 0x3fce8000 && a + len <= 0x3fce9000;
const IN_IRAM = (a: number, len: number) => a >= 0x403d5e00 && a + len <= 0x403d8000;

// An ESP32-S3 second-stage bootloader for one port: its segments in loader RAM, the entry in IRAM, the
// checksum and SHA-256 the ROM checks, and that port's marker, once.
export function checkBoot(b: Uint8Array, role: number): string | null {
  const n = b.length;
  if (n < 24 || n > 16384 || b[0] !== 0xe9 || b[1] < 1 || b[1] > 16 || b[2] !== 2 || b[3] !== 0x2f || b[12] !== 9 || b[13] !== 0 || b[23] !== 1)
    return 'not an ESP32-S3 bootloader';
  let off = 24;
  let ck = 0xef;
  const segs: [number, number][] = [];
  for (let s = 0; s < b[1]; s++) {
    if (off + 8 > n) return 'malformed segment table';
    const a = u32(b, off);
    const len = u32(b, off + 4);
    off += 8;
    if (!len || a % 4 || len % 4 || off + len > n) return 'malformed segment table';
    if (!IN_DRAM(a, len) && !IN_IRAM(a, len)) return 'segment outside loader RAM';
    segs.push([a, a + len]);
    for (let i = off; i < off + len; i++) ck ^= b[i];
    off += len;
  }
  const fin = Math.floor((off + 16) / 16) * 16;
  if (n !== fin + 32 || b[fin - 1] !== ck) return 'checksum mismatch';
  for (let i = off; i < fin - 1; i++) if (b[i]) return 'nonzero padding';
  const entryAt = u32(b, 4);
  if (entryAt % 4 || !segs.some(([a, e]) => a >= 0x40370000 && a <= entryAt && entryAt < e)) return 'entry point outside IRAM';
  // IRAM and DRAM are one memory at two addresses: compare segments on the data bus.
  const bus = segs.map(([a, e]) => (a >= 0x40370000 ? [a - 0x6f0000, e - 0x6f0000] : [a, e])).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  for (let s = 1; s < bus.length; s++) if (bus[s - 1][1] > bus[s][0]) return 'overlapping segments';
  let marks = 0;
  for (let i = 0; i + 16 <= n; i += 4) {
    if (b[i] !== 77 || !mark(b, i, 'L')) continue;
    if (u32(b, i + 8) !== role || u32(b, i + 12) !== 2) return 'bootloader for the other port';
    marks++;
  }
  if (marks !== 1) return 'role marker missing or repeated';
  return createHash('sha256').update(b.subarray(0, fin)).digest().equals(Buffer.from(b.subarray(fin))) ? null : 'image hash mismatch';
}

export interface StockDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  key: string;
}

// The body, or null once it passes `max` bytes (the read is then dropped).
async function capped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > max) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

type Read = { offer: StockOffer; root: string } | { error: string };
type Got = { bytes: Uint8Array<ArrayBuffer> } | { error: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// `ip`: the connection's address, from the server. Cloudflare's visitor address takes precedence over it; with
// neither, nothing is limited. A new address waits while 10,000 are held.
export function createStock(deps: StockDeps = { fetch: (u, i) => fetch(u, i), now: Date.now, key: MAKCU_KEY }) {
  let kept: { at: number; read: Promise<Read> } | null = null;
  const files = new Map<string, { at: number; got: Promise<Got> }>();
  const shares = new Map<string, { from: number; n: number }>();

  // Accepts only an https answer, redirects included.
  const get = async (url: string, ms: number) => {
    const res = await deps.fetch(url, { headers: { 'user-agent': AGENT, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
    if (res.url && !res.url.startsWith('https://')) throw new Error('left https');
    return res;
  };

  const readCatalog = async (): Promise<Read> => {
    let failed: Read = { error: "MAKCU's catalog couldn't be reached" };
    for (const root of ROOTS) {
      try {
        const res = await get(`${root}/firmware/catalog.json`, CATALOG_MS);
        if (!res.ok) {
          await res.body?.cancel().catch(() => undefined);
          continue;
        }
        const bytes = await capped(res, CATALOG_MAX);
        if (!bytes) {
          failed = { error: "MAKCU's catalog is larger than this page reads" };
          continue;
        }
        const offer = checkCatalog(new TextDecoder().decode(bytes), deps.key);
        if (!('error' in offer)) return { offer, root };
        // The other address may hold a good one: the toolkit tries it too.
        failed = offer;
      } catch {
        // the next address
      }
    }
    return failed;
  };

  // A failed read is kept for 10 s, a good one for a minute.
  const catalog = (): Promise<Read> => {
    if (!kept || deps.now() - kept.at >= FRESH_MS) {
      const k = { at: deps.now(), read: readCatalog() };
      void k.read.then((r) => {
        if ('error' in r) k.at -= FRESH_MS - FAILED_MS;
      });
      kept = k;
    }
    return kept.read;
  };

  const readFile = async (root: string, want: StockFile, check: (b: Uint8Array) => string | null): Promise<Got> => {
    const name = want.file;
    let bytes: Uint8Array<ArrayBuffer> | null;
    try {
      const res = await get(`${root}/firmware/${name}`, FILE_MS);
      bytes = res.ok ? await capped(res, want.size) : null;
    } catch {
      bytes = null;
    }
    if (!bytes) return { error: `${name} couldn't be read from MAKCU` };
    if (bytes.length !== want.size || createHash('sha256').update(bytes).digest('hex') !== want.sha256)
      return { error: `${name} doesn't match MAKCU's signed catalog` };
    const why = check(bytes);
    return why ? { error: `${name}: ${why}` } : { bytes };
  };

  const file = async (name: string, head: boolean): Promise<Response> => {
    const read = await catalog();
    if ('error' in read) return json(502, { error: read.error });
    const { offer, root } = read;
    const which = name === offer.build.file ? 'package' : name === offer.usb1.file ? 'usb1' : name === offer.usb3.file ? 'usb3' : null;
    if (!which) return json(404, { error: 'Not a file the catalog lists' });
    const want = which === 'package' ? offer.build : offer[which];
    const headers = { 'content-type': 'application/octet-stream', 'content-length': String(want.size), 'cache-control': 'no-store' };
    if (head) return new Response(null, { headers });
    const key = `${root}/${want.sha256}`;
    let f = files.get(key);
    if (!f || deps.now() - f.at >= FRESH_MS) {
      for (const [k, v] of files) if (deps.now() - v.at >= FRESH_MS) files.delete(k);
      f = { at: deps.now(), got: readFile(root, want, (b) => (which === 'package' ? checkPackage(b) : checkBoot(b, which === 'usb1' ? 1 : 2))) };
      files.set(key, f);
    }
    const got = await f.got;
    if ('error' in got) {
      files.delete(key);
      return json(502, { error: got.error });
    }
    return new Response(got.bytes, { headers });
  };

  const allowed = (ip: string | undefined) => {
    if (!ip) return true;
    const key = clientOf(ip);
    const now = deps.now();
    const s = shares.get(key);
    if (s && now - s.from < SHARE_MS) return ++s.n <= SHARE;
    if (!s && shares.size >= ADDRESSES) return false;
    const share = { from: now, n: 1 };
    shares.set(key, share);
    // Dropped when its share ends, whether the address asked again or not: the privacy page says 10 minutes.
    setTimeout(() => shares.get(key) === share && shares.delete(key), SHARE_MS).unref();
    return true;
  };

  return async (req: Request, ip?: string): Promise<Response | null> => {
    const path = new URL(req.url).pathname;
    if (path !== '/api/stock/catalog' && !path.startsWith('/api/stock/file/')) return null;
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Use GET.', { status: 405, headers: { 'cache-control': 'no-store' } });
    if (!allowed(req.headers.get('cf-connecting-ip') ?? ip)) return json(429, { error: 'Too many requests. Try again in a few minutes.' });
    if (path === '/api/stock/catalog') {
      const read = await catalog();
      if ('error' in read) return json(502, { error: read.error });
      const { build, usb1, usb3 } = read.offer;
      const named = (f: StockFile) => ({ name: f.file, size: f.size });
      return json(200, { id: build.id, files: { package: named(build), usb1: named(usb1), usb3: named(usb3) } });
    }
    return file(path.slice('/api/stock/file/'.length), req.method === 'HEAD');
  };
}
