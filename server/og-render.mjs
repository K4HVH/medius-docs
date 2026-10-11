// The link cards' renderer, on its own thread: a drawing takes about 0.1 s, which would hold every other
// request on the server's. Plain JavaScript, so Node (dev server, tests) and Bun run it as it is.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

await initWasm(readFileSync(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')));

parentPort.on('message', ({ id, svg }) => {
  const r = new Resvg(svg, { fitTo: { mode: 'original' } });
  try {
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
    r.free();
  }
});
