// Packs the no-sim comparison tool into one file a verifier downloads and runs with python3:
//   tsx scripts/comparison-package.ts [OUT]      (default dist/comparison/medius-compare.pyz)
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { zipSync } from 'fflate';

const ROOT = join(import.meta.dirname, '..');
const COMPARISON = join(ROOT, 'comparison');
const PACKAGES = ['medius_compare', 'medius_bench', 'medius_shapes', 'suite'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__pycache__' || name === 'tests') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function packageComparison(out = join(ROOT, 'dist/comparison/medius-compare.pyz')): string {
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const fixed = { mtime: new Date('2026-01-01T00:00:00Z') };
  files['__main__.py'] = [readFileSync(join(COMPARISON, 'pyz_main.py')), fixed];
  for (const pkg of PACKAGES)
    for (const path of walk(join(COMPARISON, pkg)).sort()) files[relative(COMPARISON, path)] = [readFileSync(path), fixed];
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zipSync(files));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(packageComparison(process.argv[2]));
