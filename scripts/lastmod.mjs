// Writes src/generated/lastmod.json: each route's last commit date (YYYY-MM-DD), taken from the page
// component that renders it. CI runs it with the full git history before the image build.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUTS = new Set(['DocsLayout']);

export function mapRoutesToFiles(app) {
  const imports = new Map(
    [...app.matchAll(/import (\w+) from '\.\/(pages\/[^']+)';/g)].map((m) => [m[1], `src/app/${m[2]}.tsx`]),
  );
  const map = {};
  for (const [, path, comp] of app.matchAll(/<Route path="([^"]+)" component=\{(\w+)\}/g)) {
    if (path === '*' || LAYOUTS.has(comp) || path in map) continue;
    const file = imports.get(comp);
    if (file) map[path] = file;
  }
  return map;
}

function main() {
  const app = readFileSync(join(ROOT, 'src/app/App.tsx'), 'utf8');
  const dates = {};
  for (const [path, file] of Object.entries(mapRoutesToFiles(app))) {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (date) dates[path] = date;
  }
  mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
  writeFileSync(join(ROOT, 'src/generated/lastmod.json'), JSON.stringify(dates, null, 2) + '\n');
  console.log(`lastmod: ${Object.keys(dates).length} routes dated`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
