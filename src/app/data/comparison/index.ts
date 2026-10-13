// The comparison's results, copied from medius-fw and checked by `bun run comparison:sync`.
import raw from './results.json';
import type { Category, Group, Results, Row } from './types';

export const RESULTS = raw as unknown as Results;

const categories = new Map(RESULTS.categories.map((c) => [c.id, c]));
const rows = new Map<string, { category: Category; group: Group; row: Row }>();
for (const category of RESULTS.categories)
  for (const group of category.groups) if (group.kind === 'rows') for (const row of group.rows) rows.set(row.id, { category, group, row });

export const categoryOf = (id: string): Category | undefined => categories.get(id);
export const rowOf = (id: string) => rows.get(id);
