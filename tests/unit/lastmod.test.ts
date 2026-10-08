import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module, run by node in CI
import { mapRoutesToFiles } from '../../scripts/lastmod.mjs';

const app = readFileSync(join(__dirname, '../../src/app/App.tsx'), 'utf8');

describe('mapRoutesToFiles', () => {
  const map = mapRoutesToFiles(app) as Record<string, string>;

  it('maps each route to the page component file that renders it', () => {
    expect(map['/native/commands/inject']).toBe('src/app/pages/native/commands/Inject.tsx');
    expect(map['/dashboard']).toBe('src/app/pages/dashboard/Device.tsx');
    expect(map['/']).toBe('src/app/pages/Home.tsx');
  });

  it('skips the layouts and the catch-all', () => {
    expect(Object.values(map)).not.toContain('src/app/pages/DocsLayout.tsx');
    expect(map['*']).toBeUndefined();
  });
});
