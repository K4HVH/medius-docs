import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// A tab's key is the URL hash. An element with the same id would turn every tab click into a jump to
// that element, since the layout scrolls to the element a hash names.
describe('dashboard tab keys', () => {
  it('match no element id on any dashboard page', () => {
    const dir = join(__dirname, '../../src/app/pages/dashboard');
    const src = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    const keys = new Set([...src.matchAll(/<Pane key="([a-z0-9-]+)"/g)].map((m) => m[1]));
    const ids = new Set([...src.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(10);
    expect([...keys].filter((k) => ids.has(k))).toEqual([]);
  });
});
