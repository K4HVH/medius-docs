// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { canonical } from '../../server/stock/canon';
import { checkBoot, checkCatalog, checkPackage, createStock, type StockDeps } from '../../server/stock';

// MAKCU's firmware isn't ours to ship, so every file here is built to the toolkit's format.

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const marker = (kind: 'U' | 'L', role: number) => Buffer.concat([Buffer.from(`MKC${kind}IMG1`, 'ascii'), u32(role), u32(2)]);

// An MKU1 v2 package: the USB1 image (role 1), then the USB3 image (role 2).
function pkg(over: { roles?: [number[], number[]]; corrupt?: 'magic' | 'header' | 'usb1' } = {}): Buffer {
  const image = (roles: number[]) => Buffer.concat([Buffer.from([0xe9, 0, 0, 0]), ...roles.map((r) => marker('U', r)), Buffer.alloc(600, 7)]);
  const [r1, r3] = over.roles ?? [[1], [2]];
  const a = image(r1);
  const b = image(r3);
  const head = Buffer.concat([u32(over.corrupt === 'magic' ? 0x12345678 : 827673421), u32(2), u32(a.length), u32(crc32(a)), u32(b.length), u32(crc32(b)), u32(7)]);
  const out = Buffer.concat([head, u32(crc32(head)), a, b]);
  if (over.corrupt === 'header') out[20] ^= 1;
  if (over.corrupt === 'usb1') out[40] ^= 1;
  return out;
}

// An ESP32-S3 second-stage bootloader: one segment in loader IRAM holding the entry and the port's marker.
function boot(role: number, over: { markers?: number; corrupt?: 'chip' | 'checksum' | 'hash' | 'outside' | 'entry' } = {}): Buffer {
  const at = over.corrupt === 'outside' ? 0x40000000 : 0x403d6000;
  const body = Buffer.concat([...Array.from({ length: over.markers ?? 1 }, () => marker('L', role)), Buffer.alloc(32, 0x11)]);
  const head = Buffer.alloc(24);
  head[0] = 0xe9;
  head[1] = 1;
  head[2] = 2;
  head[3] = 0x2f;
  head.writeUInt32LE(over.corrupt === 'entry' ? 0x3fc00000 : at + 4, 4);
  head[12] = over.corrupt === 'chip' ? 0 : 9;
  head[23] = 1;
  let ck = 0xef;
  for (const x of body) ck ^= x;
  const segs = Buffer.concat([head, u32(at), u32(body.length), body]);
  const fin = Math.floor((segs.length + 16) / 16) * 16;
  const padded = Buffer.concat([segs, Buffer.alloc(fin - segs.length)]);
  padded[fin - 1] = over.corrupt === 'checksum' ? ck ^ 1 : ck;
  const hash = createHash('sha256').update(padded).digest();
  if (over.corrupt === 'hash') hash[0] ^= 1;
  return Buffer.concat([padded, hash]);
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const KEYS = generateKeyPairSync('ed25519');
const PUB = (KEYS.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(12).toString('hex');
const OTHER = generateKeyPairSync('ed25519');

type Doc = Record<string, unknown>;
const signed = (doc: Doc, key = KEYS.privateKey) => {
  const body = canonical(JSON.stringify(doc));
  return JSON.stringify({ ...doc, signature: sign(null, body, key).toString('hex') });
};

const PKG = pkg();
const USB1 = boot(1);
const USB3 = boot(2);
const catalogDoc = (over: Doc = {}, rom: Doc = {}): Doc => ({
  app: 'makcu-devinfo',
  kind: 'firmware-catalog',
  published: '2026-10-06',
  builds: [
    { id: 'v4.093', version: 4093, label: 'Older', file: 'makcu-update-v4.093.bin', size: PKG.length, sha256: sha(PKG), official: false },
    { id: 'v4.094', version: 4094, label: 'Release', notes: 'Fixes.', file: 'makcu-update-v4.094.bin', size: PKG.length, sha256: sha(PKG), official: true },
  ],
  repair_rom: {
    build: 'v4.078',
    min_toolkit: '1.11.8',
    usb1: { file: 'boot-usb1-v4.041-r1118.bin', size: USB1.length, sha256: sha(USB1) },
    usb3: { file: 'boot-usb3-v4.041-r1118.bin', size: USB3.length, sha256: sha(USB3) },
    pairs: ['v4.094', 'v4.085'],
    ...rom,
  },
  ...over,
});

describe('canonical', () => {
  it('writes the bytes Python does: sorted by code point, non-ASCII kept, numbers as Python prints them', () => {
    const cases: [string, string][] = [
      ['{"b":1,"a":[3,2,{"z":null,"y":true}],"c":"x"}', '{"a":[3,2,{"y":true,"z":null}],"b":1,"c":"x"}'],
      ['{"notes_zh":"修复：鼠标","é":"é","\\ud83d\\ude00":"emoji","\\uffff":"bmp"}', '{"notes_zh":"修复：鼠标","é":"é","￿":"bmp","😀":"emoji"}'],
      ['{"f":1.0,"g":0.1,"h":1e-7,"i":123456789012345678901234567890,"j":-0.0,"k":1e22,"l":2.5e-5}', '{"f":1.0,"g":0.1,"h":1e-07,"i":123456789012345678901234567890,"j":-0.0,"k":1e+22,"l":2.5e-05}'],
      ['{"ctl":"a\\u0001b\\u2028c\\u007f","q":"\\"\\\\/"}', '{"ctl":"a\\u0001b c\u007f","q":"\\"\\\\/"}'],
    ];
    for (const [doc, want] of cases) expect(new TextDecoder().decode(canonical(doc))).toBe(want);
  });

  it('leaves the signature out', () => {
    expect(new TextDecoder().decode(canonical('{"b":1,"signature":"ff","a":2}'))).toBe('{"a":2,"b":1}');
  });
});

describe('checkCatalog', () => {
  it('names the official build and both bootloaders from a catalog signed with the key', () => {
    const offer = checkCatalog(signed(catalogDoc()), PUB);
    expect(offer).toMatchObject({
      build: { id: 'v4.094', label: 'Release', file: 'makcu-update-v4.094.bin' },
      usb1: { file: 'boot-usb1-v4.041-r1118.bin' },
      usb3: { file: 'boot-usb3-v4.041-r1118.bin' },
    });
  });

  it('refuses a catalog changed after signing, or signed with another key', () => {
    const text = signed(catalogDoc());
    expect(checkCatalog(text.replace('"official":true', '"official":false'), PUB)).toEqual({ error: expect.stringMatching(/signature/) });
    expect(checkCatalog(signed(catalogDoc(), OTHER.privateKey), PUB)).toEqual({ error: expect.stringMatching(/signature/) });
    expect(checkCatalog('{"app":"makcu-devinfo"', PUB)).toEqual({ error: expect.stringMatching(/read/) });
  });

  it('refuses a catalog with no official build, a withdrawn one, or one the bootloaders do not pair with', () => {
    const builds = (official: Doc) => [{ id: 'v4.094', version: 4094, label: 'x', file: 'makcu-update-v4.094.bin', size: PKG.length, sha256: sha(PKG), ...official }];
    expect(checkCatalog(signed(catalogDoc({ builds: builds({ official: false }) })), PUB)).toEqual({ error: expect.stringMatching(/official/) });
    expect(checkCatalog(signed(catalogDoc({ builds: builds({ official: true, withdrawn: true }) })), PUB)).toEqual({ error: expect.stringMatching(/withdrawn/) });
    expect(checkCatalog(signed(catalogDoc({}, { pairs: ['v4.085'] })), PUB)).toEqual({ error: expect.stringMatching(/pair/) });
  });

  it('pairs the official build by pair_min when the list leaves it out', () => {
    expect(checkCatalog(signed(catalogDoc({}, { pairs: [], pair_min: 'v4.090' })), PUB)).not.toHaveProperty('error');
    expect(checkCatalog(signed(catalogDoc({}, { pairs: [], pair_min: 'v4.095' })), PUB)).toEqual({ error: expect.stringMatching(/pair/) });
  });

  it('refuses a repair flash newer than the one this page knows', () => {
    expect(checkCatalog(signed(catalogDoc({}, { min_toolkit: '1.16.0' })), PUB)).toEqual({ error: expect.stringMatching(/toolkit|flash/) });
  });

  it('refuses a file name, size or hash that is not one', () => {
    for (const file of ['../x.bin', 'a/b.bin', 'a\\b.bin', 'x.exe', '.bin']) {
      expect(checkCatalog(signed(catalogDoc({}, { usb1: { file, size: USB1.length, sha256: sha(USB1) } })), PUB), file).toEqual({ error: expect.any(String) });
    }
    expect(checkCatalog(signed(catalogDoc({}, { usb1: { file: 'b.bin', size: 99999, sha256: sha(USB1) } })), PUB)).toEqual({ error: expect.any(String) });
    expect(checkCatalog(signed(catalogDoc({}, { usb1: { file: 'b.bin', size: USB1.length, sha256: 'zz' } })), PUB)).toEqual({ error: expect.any(String) });
  });
});

describe('checkPackage and checkBoot', () => {
  it('passes the files as built', () => {
    expect(checkPackage(PKG)).toBeNull();
    expect(checkBoot(USB1, 1)).toBeNull();
    expect(checkBoot(USB3, 2)).toBeNull();
  });

  it('names what is wrong with a package', () => {
    expect(checkPackage(pkg({ corrupt: 'magic' }))).toMatch(/MKU1/);
    expect(checkPackage(pkg({ corrupt: 'header' }))).toMatch(/header CRC/);
    expect(checkPackage(pkg({ corrupt: 'usb1' }))).toMatch(/USB1 image CRC/);
    expect(checkPackage(pkg({ roles: [[2], [2]] }))).toMatch(/USB1 image: wrong image roles/);
    expect(checkPackage(pkg({ roles: [[1], [2, 1]] }))).toMatch(/USB3 image: wrong image roles/);
    expect(checkPackage(PKG.subarray(0, PKG.length - 1))).toMatch(/MKU1/);
  });

  it('names what is wrong with a bootloader, the other port first of all', () => {
    expect(checkBoot(USB1, 2)).toMatch(/other port/);
    expect(checkBoot(boot(1, { corrupt: 'chip' }), 1)).toMatch(/ESP32-S3/);
    expect(checkBoot(boot(1, { corrupt: 'outside' }), 1)).toMatch(/outside loader RAM/);
    expect(checkBoot(boot(1, { corrupt: 'checksum' }), 1)).toMatch(/checksum/);
    expect(checkBoot(boot(1, { corrupt: 'hash' }), 1)).toMatch(/hash/);
    expect(checkBoot(boot(1, { corrupt: 'entry' }), 1)).toMatch(/entry point/);
    expect(checkBoot(boot(1, { markers: 0 }), 1)).toMatch(/role marker/);
    expect(checkBoot(boot(1, { markers: 2 }), 1)).toMatch(/role marker/);
  });
});

// A makcu.com that answers from a table, counting what it was asked for.
function makcu(files: Record<string, Buffer | string | (() => Promise<Response>)>, opts: { down?: string[] } = {}) {
  const asked: string[] = [];
  let t = 0;
  const deps: StockDeps = {
    key: PUB,
    now: () => t,
    fetch: async (url: string) => {
      asked.push(url);
      if (opts.down?.some((d) => url.startsWith(d))) throw new TypeError('fetch failed');
      const name = Object.keys(files).find((k) => url.endsWith(`/${k}`));
      if (!name) return new Response('Not found', { status: 404 });
      const v = files[name];
      return typeof v === 'function' ? v() : new Response(typeof v === 'string' ? v : new Uint8Array(v));
    },
  };
  return { deps, asked, later: (ms: number) => (t += ms) };
}

const get = (stock: ReturnType<typeof createStock>, path: string) => stock(new Request(`https://medius.k4tech.net${path}`));
const FILES = () => ({
  'catalog.json': signed(catalogDoc()),
  'makcu-update-v4.094.bin': PKG,
  'boot-usb1-v4.041-r1118.bin': USB1,
  'boot-usb3-v4.041-r1118.bin': USB3,
});

describe('the stock routes', () => {
  it('answers the official build and its files, which pass their checks', async () => {
    const stock = createStock(makcu(FILES()).deps);
    const cat = (await get(stock, '/api/stock/catalog'))!;
    expect(cat.status).toBe(200);
    expect(await cat.json()).toMatchObject({ build: { id: 'v4.094' }, files: { package: 'makcu-update-v4.094.bin', usb1: 'boot-usb1-v4.041-r1118.bin' } });
    for (const [name, bytes] of [['makcu-update-v4.094.bin', PKG], ['boot-usb3-v4.041-r1118.bin', USB3]] as const) {
      const res = (await get(stock, `/api/stock/file/${name}`))!;
      expect(res.status, name).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
    }
  });

  it('leaves other paths alone and answers GET alone', async () => {
    const stock = createStock(makcu(FILES()).deps);
    expect(await get(stock, '/api/firmware/releases')).toBeNull();
    expect((await stock(new Request('https://medius.k4tech.net/api/stock/catalog', { method: 'POST' })))!.status).toBe(405);
  });

  it('serves no name the catalog does not list, however it is spelt', async () => {
    const stock = createStock(makcu(FILES()).deps);
    for (const p of ['makcu-update-v4.093.bin', '..%2Fcatalog.json', '%2e%2e%2fx.bin', 'catalog.json', '']) {
      expect((await get(stock, `/api/stock/file/${p}`))!.status, p).toBe(404);
    }
  });

  it('reads the fallback address when makcu.com does not answer', async () => {
    const m = makcu(FILES(), { down: ['https://makcu.com/'] });
    const stock = createStock(m.deps);
    expect((await get(stock, '/api/stock/catalog'))!.status).toBe(200);
    expect(m.asked.some((u) => u.includes('sslip.io'))).toBe(true);
    expect((await get(stock, '/api/stock/file/boot-usb1-v4.041-r1118.bin'))!.status).toBe(200);
  });

  it('answers 502 with the reason for a catalog that fails its check, and for a file that does', async () => {
    const tampered = createStock(makcu({ ...FILES(), 'catalog.json': signed(catalogDoc()).replace('Release', 'Evil') }).deps);
    const bad = (await get(tampered, '/api/stock/catalog'))!;
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toMatch(/signature/);
    const swapped = createStock(makcu({ ...FILES(), 'boot-usb1-v4.041-r1118.bin': USB3 }).deps);
    expect((await get(swapped, '/api/stock/file/boot-usb1-v4.041-r1118.bin'))!.status).toBe(502);
    const short = createStock(makcu({ ...FILES(), 'makcu-update-v4.094.bin': PKG.subarray(0, 100) }).deps);
    expect((await get(short, '/api/stock/file/makcu-update-v4.094.bin'))!.status).toBe(502);
  });

  it('stops reading a file past the size the catalog gives it', async () => {
    let sent = 0;
    const endless = () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            pull(c) {
              sent += 65536;
              c.enqueue(new Uint8Array(65536));
              if (sent > 64 * 1024 * 1024) c.close();
            },
          }),
        ),
      );
    const stock = createStock(makcu({ ...FILES(), 'makcu-update-v4.094.bin': endless }).deps);
    expect((await get(stock, '/api/stock/file/makcu-update-v4.094.bin'))!.status).toBe(502);
    expect(sent).toBeLessThan(2 * 1024 * 1024);
  });

  it('refuses a catalog past 2 MiB without reading it all', async () => {
    const huge = () => Promise.resolve(new Response('x'.repeat(3 * 1024 * 1024)));
    const stock = createStock(makcu({ ...FILES(), 'catalog.json': huge }).deps);
    expect((await get(stock, '/api/stock/catalog'))!.status).toBe(502);
  });

  it('reads the catalog once for requests that come together, and again a minute on', async () => {
    const m = makcu(FILES());
    const stock = createStock(m.deps);
    await Promise.all([get(stock, '/api/stock/catalog'), get(stock, '/api/stock/catalog'), get(stock, '/api/stock/file/boot-usb1-v4.041-r1118.bin')]);
    expect(m.asked.filter((u) => u.endsWith('catalog.json'))).toHaveLength(1);
    m.later(61_000);
    await get(stock, '/api/stock/catalog');
    expect(m.asked.filter((u) => u.endsWith('catalog.json'))).toHaveLength(2);
  });
});
