import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { type CardContent, cardHash } from '../src/app/card/content';
import { loadFace } from '../src/app/card/layout';
import { type Faces, cardSvg } from '../src/app/card/svg';

// Link cards at /og/{page}.png (home at /og/index.png), drawn on first request and kept by the hash of
// what they show. An address carrying that hash names one drawing for good; any other is kept five minutes.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=300';
const KEPT = 400;

let faces: Promise<Faces> | undefined;
const drawn = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

function ready(): Promise<Faces> {
  faces ??= (async () => {
    await initWasm(readFileSync(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')));
    const face = (name: string) => loadFace(readFileSync(new URL(`./og/fonts/${name}.ttf`, import.meta.url)));
    return { regular: face('inter-400'), bold: face('inter-700'), mono: face('plex-mono-500') };
  })().catch((e: unknown) => {
    faces = undefined;
    throw e;
  });
  return faces;
}

export async function drawCard(c: CardContent): Promise<Uint8Array<ArrayBuffer>> {
  const svg = cardSvg(c, await ready());
  const r = new Resvg(svg, { fitTo: { mode: 'original' } });
  try {
    const image = r.render();
    try {
      return new Uint8Array(image.asPng());
    } finally {
      image.free();
    }
  } finally {
    r.free();
  }
}

// Requests for one card while it is drawn share the drawing. The oldest drawing goes once KEPT are held;
// a card whose words change (a stats count) leaves its old drawing behind.
function draw(c: CardContent, hash: string): Promise<Uint8Array<ArrayBuffer>> {
  let png = drawn.get(hash);
  if (png) {
    drawn.delete(hash);
  } else {
    png = drawCard(c);
    png.catch(() => drawn.delete(hash));
  }
  drawn.set(hash, png);
  if (drawn.size > KEPT) drawn.delete(drawn.keys().next().value!);
  return png;
}

export async function handleOg(req: Request, lookup: (path: string) => Promise<CardContent | null>): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/og/') || !url.pathname.endsWith('.png')) return null;
  const stem = url.pathname.slice('/og'.length, -'.png'.length);
  const card = await lookup(stem === '/index' ? '/' : stem);
  if (!card) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const hash = cardHash(card);
  const png = await draw(card, hash);
  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': url.searchParams.get('v') === hash ? IMMUTABLE : SHORT },
  });
}
