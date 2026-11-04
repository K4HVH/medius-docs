// Builds the comparison's results.json from the tests' declarations and the run files the comparison tool wrote,
// and tool.json beside it (what the Method page lists that the results don't carry: the tool's tests, the run files):
//   tsx scripts/comparison-generate.ts [--runs DIR] [--out FILE]
// Prints each row whose runs disagreed, and every fault. A fault leaves both files unwritten and exits 1.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'smol-toml';
import type { CategoryDecl, FactTable, GenerateInput, RunFileDoc, TestDecl, ToolData } from '../src/app/data/comparison/generate';
import { generate, toolTests } from '../src/app/data/comparison/generate';
import type { Defect, FeatureRow, Pending } from '../src/app/data/comparison/types';

const ROOT = join(import.meta.dirname, '..');
const COMPARISON = join(ROOT, 'comparison');

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const toml = (path: string) => parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
const files = (dir: string, ext: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

export function readInput(runsDir: string): GenerateInput {
  const data = join(COMPARISON, 'data');
  const site = toml(join(data, 'site.toml'));
  const facts: FactTable[] = files(join(data, 'facts'), '.toml').flatMap((f) =>
    ((toml(join(data, 'facts', f)).tables as Record<string, unknown>[]) ?? []).map((t) => ({
      section: t.section as string,
      order: t.order as number,
      table: {
        kind: 'feature' as const,
        label: t.label as string,
        key: t.key as string,
        ...(t.ranked === false ? { ranked: false as const } : {}),
        rows: (t.rows as Record<string, unknown>[]).map(
          (r): FeatureRow => ({
            id: r.id as string,
            label: r.label as string,
            ...(r.note ? { note: r.note as string } : {}),
            stock: (r.stock as string | undefined) ?? null,
            medius: (r.medius as string | undefined) ?? null,
          }),
        ),
      },
    })),
  );
  const suite = join(COMPARISON, 'suite');
  const tests = readdirSync(suite)
    .filter((d) => existsSync(join(suite, d, 'test.toml')))
    .sort()
    .map((d) => ({ tables: [], ...toml(join(suite, d, 'test.toml')) }) as unknown as TestDecl);
  const runs = ['stock', 'medius', 'native'].flatMap((box) =>
    files(join(runsDir, box), '.json').map((f) => ({
      path: relative(join(runsDir, '..'), join(runsDir, box, f)),
      doc: JSON.parse(readFileSync(join(runsDir, box, f), 'utf8')) as RunFileDoc,
    })),
  );
  return {
    site: { firmware: site.firmware as GenerateInput['site']['firmware'], rig: (site.site as { rig: string }).rig },
    layers: toml(join(data, 'layers.toml')) as Record<string, string>,
    categories: toml(join(data, 'categories.toml')).categories as CategoryDecl[],
    defects: (toml(join(data, 'defects.toml')).defects as Defect[]) ?? [],
    pending: (toml(join(data, 'pending.toml')).pending as Pending[]) ?? [],
    facts,
    tests,
    runs,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runsDir = arg('--runs', join(COMPARISON, 'runs'));
  const out = arg('--out', join(ROOT, 'src/app/data/comparison/results.json'));
  const tool = join(dirname(out), 'tool.json');
  const input = readInput(runsDir);
  const { results, varied, faults } = generate(input);
  for (const v of varied) console.log(`varied across runs: ${v}`);
  if (faults.length) {
    for (const f of faults) console.error(f);
    console.error(`${faults.length} faults; ${out} and ${tool} not written`);
    process.exit(1);
  }
  writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
  const data: ToolData = { tests: toolTests(input.tests, results), runs: input.runs.map(({ path, doc }) => ({ box: doc.box, file: path })) };
  writeFileSync(tool, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${out}: ${results.categories.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.tables.reduce((k, t) => k + t.rows.length, 0), 0), 0)} rows`);
}
