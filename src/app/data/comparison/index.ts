// The comparison's results, copied from medius-fw and checked by `bun run comparison:sync`.
import raw from './results.json';
import type { Category, PairRow, Results, Section, SettingsTable, Table } from './types';

export const RESULTS = raw as unknown as Results;

export interface Place {
  category: Category;
  section: Section;
  table: Exclude<Table, SettingsTable>;
  row: PairRow;
}

const categories = new Map(RESULTS.categories.map((c) => [c.id, c]));
const rows = new Map<string, Place>();
for (const category of RESULTS.categories)
  for (const section of category.sections)
    for (const table of section.tables) if (table.kind !== 'settings') for (const row of table.rows) rows.set(row.id, { category, section, table, row });

export const categoryOf = (id: string): Category | undefined => categories.get(id);
// A row of a stock-against-Medius table, with where it sits.
export const placeOf = (id: string): Place | undefined => rows.get(id);
