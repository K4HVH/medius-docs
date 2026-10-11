import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { type CardContent, cardHash, cardKey } from '../src/app/card/content';
import { loadFace } from '../src/app/card/layout';
import { type Faces, cardSvg } from '../src/app/card/svg';

// Link cards at /og/{page}.png (home at /og/index.png), drawn on first request and kept by the hash of
// what they show. An address carrying that hash names one drawing for good; any other is kept five minutes.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=300';
// About 200 KB a drawing; a redraw takes about 0.1 s.
const KEPT = 100;

let faces: Faces | undefined;
const drawn = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

function ready(): Faces {
  const face = (name: string) => loadFace(readFileSync(new URL(`./og/fonts/${name}.ttf`, import.meta.url)));
  return (faces ??= { regular: face('inter-400'), bold: face('inter-700'), mono: face('plex-mono-500') });
}

interface Renderer {
  worker?: Worker;
  next: number;
  pending: Map<number, { resolve: (png: Uint8Array<ArrayBuffer>) => void; reject: (e: Error) => void }>;
}

// One renderer thread a process, kept on globalThis so a copy of this module loaded again (the dev server
// reloads its config) uses it too. A thread that stops fails what it held; the next drawing starts another.
const renderer: Renderer = ((globalThis as Record<symbol, Renderer>)[Symbol.for('medius.og.renderer')] ??= { next: 0, pending: new Map() });

function rasterise(svg: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!renderer.worker) {
    const w = new Worker(new URL('./og-render.mjs', import.meta.url));
    w.unref();
    const fail = (e: Error) => {
      if (renderer.worker === w) renderer.worker = undefined;
      for (const p of renderer.pending.values()) p.reject(e);
      renderer.pending.clear();
    };
    w.on('message', (m: { id: number; png?: Uint8Array<ArrayBuffer>; error?: string }) => {
      const p = renderer.pending.get(m.id);
      renderer.pending.delete(m.id);
      if (m.png) p?.resolve(m.png);
      else p?.reject(new Error(m.error));
    });
    w.on('error', fail);
    w.on('exit', (code) => fail(new Error(`card renderer stopped (${code})`)));
    renderer.worker = w;
  }
  const id = renderer.next++;
  const out = new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => renderer.pending.set(id, { resolve, reject }));
  renderer.worker.postMessage({ id, svg });
  return out;
}

export async function drawCard(c: CardContent): Promise<Uint8Array<ArrayBuffer>> {
  return rasterise(cardSvg(c, ready()));
}

// Drawings are kept by what they show (cardKey), never by the hash in their address. Requests for one card
// while it is drawn share the drawing. The oldest drawing goes once KEPT are held; a card whose words change
// (a stats count) leaves its old drawing behind.
function draw(c: CardContent, key: string): Promise<Uint8Array<ArrayBuffer>> {
  let png = drawn.get(key);
  if (png) {
    drawn.delete(key);
  } else {
    png = drawCard(c);
    png.catch(() => drawn.delete(key));
  }
  drawn.set(key, png);
  if (drawn.size > KEPT) drawn.delete(drawn.keys().next().value!);
  return png;
}

// lookup: the card at a page's path, null for none, or 'down' while the source that would know can't be read.
export async function handleOg(req: Request, lookup: (path: string) => Promise<CardContent | null | 'down'>): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/og/') || !url.pathname.endsWith('.png')) return null;
  const stem = url.pathname.slice('/og'.length, -'.png'.length);
  // A page's path, exactly: the lookup would read '' or a trailing slash as another page.
  const card = stem.length > 1 && !stem.endsWith('/') ? await lookup(stem === '/index' ? '/' : stem) : null;
  if (card === 'down') return new Response('Try again shortly.\n', { status: 503, headers: { 'retry-after': '120', 'cache-control': 'no-store' } });
  if (!card) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const hash = cardHash(card);
  const png = await draw(card, cardKey(card)).catch(() => null);
  if (!png) return new Response('Try again shortly.\n', { status: 503, headers: { 'retry-after': '120', 'cache-control': 'no-store' } });
  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': url.searchParams.get('v') === hash ? IMMUTABLE : SHORT },
  });
}
