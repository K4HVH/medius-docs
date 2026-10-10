import { writeFileSync } from 'node:fs';
import { createServer as listen } from 'node:net';
import { gzipSync } from 'node:zlib';
import { createServer } from 'vite';
import { buildSearchIndex } from './lib/searchBuild';
import { checkIndex, siteContext } from './lib/searchCheck';

// The site's search index into dist/: built on a dev server (the dashboard's panels show only with the
// dev build's fake box connected), then held to the checks; any failure stops the build.
// A port no one holds; Vite reads 0 as no port at all.
const port = await new Promise<number>((done) => {
  const probe = listen().listen(0, () => {
    const { port } = probe.address() as { port: number };
    probe.close(() => done(port));
  });
});
const server = await createServer({ configFile: 'vite.config.ts', logLevel: 'warn', server: { port, strictPort: true } });
await server.listen();
const base = server.resolvedUrls!.local[0].replace(/\/$/, '');
const started = performance.now();
let built;
try {
  built = await buildSearchIndex(base);
} finally {
  await server.close();
}
const { index, rendered } = built;
const problems = checkIndex(index, { ...siteContext(), rendered });
if (problems.length) {
  process.stderr.write(`search index: ${problems.length} problems\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
  process.exit(1);
}
const json = JSON.stringify(index);
writeFileSync(process.argv[2] ?? 'dist/search-index.json', json);
process.stdout.write(
  `search index: ${index.entries.length} entries, ${(json.length / 1024).toFixed(0)} KB, ${(gzipSync(json).length / 1024).toFixed(0)} KB gzipped, ${((performance.now() - started) / 1000).toFixed(1)} s\n`,
);
