// The link cards' renderer, on a worker thread: a drawing takes ~0.1 s, which on the server's thread would
// hold up every other request. Plain JavaScript, so Node (dev server, tests) and Bun run it as is.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

await initWasm(readFileSync(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')));

parentPort.on('message', ({ id, svg }) => {
  let r;
  try {
    r = new Resvg(svg, { fitTo: { mode: 'original' } });
    const image = r.render();
    try {
      const png = new Uint8Array(image.asPng());
      parentPort.postMessage({ id, png }, [png.buffer]);
    } finally {
      image.free();
    }
  } catch (e) {
    parentPort.postMessage({ id, error: String(e) });
  } finally {
    r?.free();
  }
});
