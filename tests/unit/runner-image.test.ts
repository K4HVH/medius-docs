import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { builtinModules } from 'node:module';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '../..');

// What the Dockerfile's runtime stage copies from the build stage, as repo-relative paths.
function runnerCopies(): string[] {
  const docker = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
  const runner = docker.slice(docker.lastIndexOf('\nFROM '));
  return [...runner.matchAll(/^COPY --from=builder\S*(?:\s+--\S+)*\s+\/app\/(\S+)\s+\S+$/gm)].map((m) => m[1]);
}

// Every file and package serve.ts loads at run time. `import type` is erased by Bun, so it is skipped.
function runtimeGraph(): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const walk = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith('.')) {
        const base = resolve(dirname(file), spec);
        const hit = [`${base}.ts`, `${base}.tsx`, base, join(base, 'index.ts')].find((p) => existsSync(p) && statSync(p).isFile());
        if (!hit) throw new Error(`${relative(ROOT, file)}: cannot resolve ${spec}`);
        walk(hit);
      } else {
        packages.add(spec);
      }
    }
  };
  walk(join(ROOT, 'serve.ts'));
  return { files: [...files].map((f) => relative(ROOT, f)), packages: [...packages] };
}

describe('the production image', () => {
  const copies = runnerCopies();
  const covered = (path: string) => copies.some((c) => path === c || path.startsWith(c + '/'));
  const graph = runtimeGraph();

  it('copies every file serve.ts loads', () => {
    expect(graph.files.filter((f) => !covered(f))).toEqual([]);
  });

  it('copies every package serve.ts loads that Bun does not provide', () => {
    const builtin = (p: string) => p.startsWith('node:') || p.startsWith('bun:') || p === 'bun' || builtinModules.includes(p);
    const missing = graph.packages.filter((p) => !builtin(p) && !covered(`node_modules/${p.split('/')[0]}`));
    expect(missing).toEqual([]);
  });
});
