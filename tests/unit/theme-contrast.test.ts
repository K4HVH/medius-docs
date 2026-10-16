import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/theme/tokens.css', 'utf8');

const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} missing`);
  return m[1];
};

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('theme contrast', () => {
  it.each(['text', 'text-2', 'muted', 'dim', 'accent'])('--%s reads on the ground at 4.5:1', (t) => {
    expect(ratio(token(t), token('ground'))).toBeGreaterThanOrEqual(4.5);
  });

  // Tables, strips and panels sit on #0a0a0a at most (rgba(10,10,10,.7) over the ground measures #070707).
  it.each(['text-2', 'muted', 'dim', 'accent'])('--%s reads on a panel at 4.5:1', (t) => {
    expect(ratio(token(t), '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
  });

  it('code comments read on a code block at 4.5:1', () => {
    const content = readFileSync('src/styles/theme/content.css', 'utf8');
    const comment = content.match(/\.token\.comment[^{]*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/)![1];
    expect(ratio(comment, '#050505')).toBeGreaterThanOrEqual(4.5);
  });
});
