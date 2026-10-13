// The comparison's results, as medius-fw docs/comparison/results.schema.md defines them (format 1).

export type Box = 'stock' | 'medius';
export type Verdict = 'medius' | 'stock' | 'equal' | 'mixed' | 'design' | 'unranked';

export type Cell = string | { text: string; value?: number; unit?: string };

export interface Row {
  id: string;
  test: string;
  stock: Cell;
  medius: Cell;
  verdict: Verdict;
  reason?: string;
  note?: string;
  n?: string;
  layer?: string;
  hubs?: string;
  evidence?: string[];
  date?: string;
  conditions?: Record<string, unknown>;
}

export interface GridRow {
  id: string;
  cells: Cell[];
}

export interface Chart {
  label: string;
  unit: string;
  // null where that box wasn't measured.
  points: { x: string; stock: number | null; medius: number | null }[];
}

interface GroupBase {
  id: string;
  title: string;
  about: string;
  chart?: Chart;
}
export interface RowsGroup extends GroupBase {
  kind: 'rows';
  label?: string;
  rows: Row[];
}
export interface GridGroup extends GroupBase {
  kind: 'grid';
  columns: string[];
  rows: GridRow[];
}
export type Group = RowsGroup | GridGroup;

export interface Category {
  id: string;
  title: string;
  groups: Group[];
}

export interface Defect {
  id: string;
  box: Box;
  text: string;
  category: string;
  group: string;
  row?: string;
}

export interface Pending {
  id: string;
  test: string;
  needs: string;
}

export interface Results {
  format: 1;
  firmware: Record<Box, string>;
  rig: string;
  layers: Record<string, string>;
  categories: Category[];
  defects: Defect[];
  pending: Pending[];
}
