// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { BLUE, type CardContent } from '../../src/app/card/content';

// Two cards whose hashes collide: the hash is 32 bits, so one can be searched for.
vi.mock('../../src/app/card/content', async (load) => ({ ...(await load<object>()), cardHash: () => '0000c0de' }));
// The renderer's module outlives this one, as it does when the dev server loads its config again.
const kept = vi.hoisted(() => ({ mod: undefined as unknown }));
vi.mock('@resvg/resvg-wasm', async (load) => (kept.mod ??= await load()));

const card = (title: string): CardContent => ({
  crumb: 'Native API / Commands',
  title,
  address: 'medius.k4tech.net/native/commands/lock',
  fact: ['MAKCU', 'firmware'],
  colour: BLUE,
});
const png = async (r: Response | null) => new Uint8Array(await r!.arrayBuffer());

describe('the card store', () => {
  it('keeps a card by what it shows, so a card whose hash collides never takes its address', async () => {
    const { handleOg } = await import('../../server/og');
    const lookup = async (path: string) => (path === '/a' ? card('Lock') : path === '/b' ? card('Evil mouse') : null);
    const evil = await png(await handleOg(new Request('https://medius.k4tech.net/og/b.png?v=0000c0de'), lookup));
    const lock = await png(await handleOg(new Request('https://medius.k4tech.net/og/a.png?v=0000c0de'), lookup));
    expect(lock).not.toEqual(evil);
  });

  it('draws again once its module is loaded anew beside a renderer already started', async () => {
    const first = await import('../../server/og');
    await first.drawCard(card('Before'));
    vi.resetModules();
    const again = await import('../../server/og');
    const out = await again.drawCard(card('After'));
    expect(new DataView(out.buffer).getUint32(16)).toBe(1200);
  });

  it('asks again later for a card whose source cannot be read', async () => {
    const { handleOg } = await import('../../server/og');
    const res = (await handleOg(new Request('https://medius.k4tech.net/og/dashboard/changelog/v9.9.9.png'), async () => 'down'))!;
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
