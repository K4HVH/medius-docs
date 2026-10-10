// Writes src/generated/lastmod.json: each route's last commit date (YYYY-MM-DD), taken from the page
// component that renders it. CI runs it with the full git history before the image build.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Each page's file, from the table of lazily loaded pages: `'/path': page(() => import('./pages/X'))`.
export function mapRoutesToFiles(table) {
  const map = {};
  for (const [, path, file] of table.matchAll(/'([^']+)': \w+\(\(\) => import\('\.\/(pages\/[^']+)'\)\)/g))
    if (!(path in map)) map[path] = `src/app/${file}.tsx`;
  return map;
}

function main() {
  const table = readFileSync(join(ROOT, 'src/app/lazyPages.ts'), 'utf8');
  const dates = {};
  for (const [path, file] of Object.entries(mapRoutesToFiles(table))) {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (date) dates[path] = date;
  }
  mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
  writeFileSync(join(ROOT, 'src/generated/lastmod.json'), JSON.stringify(dates, null, 2) + '\n');
  console.log(`lastmod: ${Object.keys(dates).length} routes dated`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
