import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// jsdom applies no stylesheet, so a filter that sets `hidden` passes its unit tests even when a
// component's `display` keeps the row on screen. The theme hides the attribute for every element.
describe('theme', () => {
  it('hides anything carrying the hidden attribute, whatever its display', () => {
    const base = readFileSync(join(__dirname, '../../src/styles/theme/base.css'), 'utf8');
    expect(base).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
