import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import type { RouteSectionProps } from '@solidjs/router';
import type { Component } from 'solid-js';
import { lazyPage, pageKey } from '../../src/app/lazyPages';

const Page: Component<RouteSectionProps> = () => <p>the page</p>;

describe('lazyPage', () => {
  it('fetches a page again after a failed fetch, and renders it in the same moment once it is in', async () => {
    let offline = true;
    const load = vi.fn(async () => {
      if (offline) throw new Error('offline');
      return { default: Page };
    });
    const P = lazyPage(load);
    await expect(P.preload()).rejects.toThrow('offline');
    offline = false;
    await P.preload();
    const r = render(() => <P {...({} as RouteSectionProps)} />);
    expect(r.container.textContent).toBe('the page');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('leaves nothing unhandled when a fetch no one waits on fails, as a hover does', async () => {
    const P = lazyPage(async () => {
      throw new Error('offline');
    });
    void P.preload();
    await new Promise((r) => setTimeout(r, 20));
  });
});

describe('pageKey', () => {
  it('finds a page the way the router does, whatever its case and slashes', () => {
    expect(pageKey('/Dashboard/')).toBe('/dashboard');
    expect(pageKey('/library//Move')).toBe('/library/move');
    expect(pageKey('/')).toBe('/');
    expect(pageKey('/zzz')).toBe('/zzz');
  });
});

describe('the page table', () => {
  const app = join(__dirname, '../../src/app');
  const table = readFileSync(join(app, 'lazyPages.ts'), 'utf8');
  const rows = [...table.matchAll(/'([^']+)': (\w+)\(\(\) => import\('\.\/(pages\/[^']+)'\)\)/g)].map(([, path, wrap, file]) => ({ path, wrap, file: `${file}.tsx` }));
  const showsCode = (file: string) => readFileSync(join(app, file), 'utf8').includes('language-');

  it('brings the highlighter with exactly the pages that show code', () => {
    expect(rows.filter((r) => showsCode(r.file) !== (r.wrap === 'codePage')).map((r) => r.path)).toEqual([]);
  });

  it('finds code shown only by the pages in it, where the table can see it', () => {
    const src = join(app, '..');
    const files = (readdirSync(src, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => relative(app, join(src, f)));
    const listed = new Set(rows.map((r) => r.file));
    expect(files.filter((f) => showsCode(f) && !listed.has(f) && f !== 'pages/DocsLayout.tsx')).toEqual([]);
  });
});

