// Copies medius-fw's comparison results into the site after checking them:
//   bun run comparison:sync [path]      (default ../medius-fw/docs/comparison/results.json)
// A file with any fault is left uncopied and its faults printed. A copied file the pages don't yet show
// (a new category, a key row gone) is named too: the tests fail until the page map in
// src/app/data/comparison/pages.ts shows it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkResults } from '../src/app/data/comparison/check';
import { COMPARISON_PAGES, KEY_ROWS, pageFaults } from '../src/app/data/comparison/pages';
import type { Results } from '../src/app/data/comparison/types';

const ROOT = join(import.meta.dirname, '..');
const FROM = resolve(process.argv[2] ?? join(ROOT, '../medius-fw/docs/comparison/results.json'));
const TO = join(ROOT, 'src/app/data/comparison/results.json');

const stop = (why: string) => {
  console.error(`${FROM}: ${why}, not copied`);
  process.exit(1);
};

let data: unknown;
try {
  data = JSON.parse(readFileSync(FROM, 'utf8'));
} catch (e) {
  stop(e instanceof Error ? e.message : String(e));
}
const faults = checkResults(data);
if (faults.length) {
  for (const f of faults) console.error(f);
  stop(`${faults.length} faults`);
}
writeFileSync(TO, `${JSON.stringify(data, null, 2)}\n`);
console.log(`${FROM} -> ${TO}`);
const unshown = pageFaults(data as Results, COMPARISON_PAGES, KEY_ROWS);
if (unshown.length) {
  console.error('The pages need changing before the tests pass:');
  for (const f of unshown) console.error(`  ${f}`);
}
