// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

// A syntax error in a stylesheet drops its rule without a word in the browser; the build's minifier only warns.
const sheets = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sheets(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : [],
  );

describe('stylesheets', () => {
  it.each(sheets('src'))('%s parses whole', (file) => {
    const { warnings } = transformSync(readFileSync(file, 'utf8'), { loader: 'css', minify: true });
    expect(warnings.map((w) => `line ${w.location?.line}: ${w.text}`)).toEqual([]);
  });
});
