// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { BLUE, cardHash, type CardContent } from '../../src/app/card/content';

const drawn = vi.hoisted(() => ({ n: 0 }));
vi.mock('@resvg/resvg-wasm', async (load) => {
  const real = await load<typeof import('@resvg/resvg-wasm')>();
  class Counted extends real.Resvg {
    constructor(...args: ConstructorParameters<typeof real.Resvg>) {
      super(...args);
      drawn.n++;
    }
  }
  return { ...real, Resvg: Counted };
});

const { drawCard, handleOg } = await import('../../server/og');

const lock: CardContent = {
  crumb: 'Native API / Commands',
  title: 'Lock',
  description: 'LOCK (0x0A): set how much of one physical input reaches the game PC.',
  address: 'medius.k4tech.net/native/commands/lock',
  fact: ['MAKCU', 'firmware'],
  colour: BLUE,
};

const size = (png: Uint8Array) => {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20) };
};
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const lookup = async (path: string) => (path === '/native/commands/lock' ? lock : path === '/' ? { ...lock, title: 'Home' } : null);
const get = (path: string) => handleOg(new Request(`https://medius.k4tech.net${path}`), lookup);

describe('drawCard', () => {
  it('draws a 1200 x 630 PNG', async () => {
    const png = await drawCard(lock);
    expect([...png.slice(0, 8)]).toEqual(PNG);
    expect(size(png)).toEqual({ w: 1200, h: 630 });
  });

  it('draws a title holding characters the fonts lack', async () => {
    const png = await drawCard({ ...lock, title: 'Mouse 中文 Ж' });
    expect(size(png)).toEqual({ w: 1200, h: 630 });
  });
});

describe('handleOg', () => {
  it('leaves other paths alone', async () => {
    expect(await get('/native/commands/lock')).toBeNull();
    expect(await get('/og/native/commands/lock')).toBeNull();
  });

  it('answers only GET and HEAD', async () => {
    expect(await handleOg(new Request('https://medius.k4tech.net/og/index.png', { method: 'POST' }), lookup)).toBeNull();
    expect((await handleOg(new Request('https://medius.k4tech.net/og/index.png', { method: 'HEAD' }), lookup))!.status).toBe(200);
  });

  it('answers 404 for a page with no card', async () => {
    expect((await get('/og/nope.png'))!.status).toBe(404);
  });

  it('keeps a card at its hash for good', async () => {
    const res = (await get(`/og/native/commands/lock.png?v=${cardHash(lock)}`))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(size(new Uint8Array(await res.arrayBuffer()))).toEqual({ w: 1200, h: 630 });
  });

  it('keeps a card asked for without its hash, or by an old one, five minutes', async () => {
    for (const q of ['', '?v=00000000']) {
      const res = (await get(`/og/native/commands/lock.png${q}`))!;
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    }
  });

  it('reads home at index', async () => {
    expect((await get('/og/index.png'))!.status).toBe(200);
  });

  it('draws a card once and answers again from memory', async () => {
    const card = { ...lock, title: 'Drawn once' };
    const one = async (path: string) => (path === '/x' ? card : null);
    const before = drawn.n;
    const [a, b] = await Promise.all([
      handleOg(new Request('https://medius.k4tech.net/og/x.png'), one),
      handleOg(new Request('https://medius.k4tech.net/og/x.png'), one),
    ]);
    await handleOg(new Request('https://medius.k4tech.net/og/x.png'), one);
    expect(drawn.n - before).toBe(1);
    expect(new Uint8Array(await a!.arrayBuffer())).toEqual(new Uint8Array(await b!.arrayBuffer()));
  });
});
