// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { packageComparison } from '../../scripts/comparison-package';

it('packs the no-sim tool and nothing of the sim', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'pyz-')), 'medius-compare.pyz');
  packageComparison(out);
  const names = Object.keys(unzipSync(readFileSync(out)));
  for (const want of ['__main__.py', 'medius_compare/cli.py', 'medius_bench/__init__.py', 'medius_shapes/core.py', 'suite/wire-rtt/test.toml'])
    expect(names).toContain(want);
  expect(names.filter((n) => /compare_sim|__pycache__|(^|\/)tests\//.test(n))).toEqual([]);
});

it('runs from the single file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pyz-'));
  const out = join(dir, 'medius-compare.pyz');
  packageComparison(out);
  const help = execFileSync('python3', [out, 'report', '--help'], { env: { ...process.env, HOME: dir }, encoding: 'utf8' });
  expect(help).toMatch(/usage: medius-compare report/);
});
