// The comparison's results, as medius-fw docs/comparison/results.schema.md defines them (format 2).

export type Box = 'stock' | 'medius';

export interface Ref {
  file: string;
  ptr: string;
  unit?: string;
}

export type Value = ({ value: number; of?: number } | { lo: number; hi: number }) & { src: Ref[] };

export interface Outcome {
  is: string;
  src: Ref[];
}

interface RowBase {
  id: string;
  label: string;
  note?: string;
}
export interface MeasureRow extends RowBase {
  stock: Value;
  medius: Value;
}
export interface OutcomeRow extends RowBase {
  stock: Outcome;
  medius: Outcome;
}
export interface FeatureRow extends RowBase {
  stock: string | null;
  medius: string | null;
}
export interface SettingsRow {
  id: string;
  box: Box;
  label: string;
  default?: true;
  values: Record<string, Value>;
}

export interface Column {
  id: string;
  label: string;
  unit: string;
  better?: 'lower' | 'higher';
}

interface TableBase {
  label: string;
  key: string;
}
export interface MeasureTable extends TableBase {
  kind: 'measure';
  unit: string;
  better?: 'lower' | 'higher';
  stat?: string;
  layer?: string;
  n?: string;
  hubs?: 'both';
  commands?: Record<Box, string>;
  rows: MeasureRow[];
}
export interface OutcomeTable extends TableBase {
  kind: 'outcome';
  outcomes: string[];
  ranked?: false;
  commands?: Record<Box, string>;
  rows: OutcomeRow[];
}
export interface FeatureTable extends TableBase {
  kind: 'feature';
  ranked?: false;
  rows: FeatureRow[];
}
export interface SettingsTable extends TableBase {
  kind: 'settings';
  columns: Column[];
  layer?: string;
  n?: string;
  rows: SettingsRow[];
}
export type Table = MeasureTable | OutcomeTable | FeatureTable | SettingsTable;
export type PairRow = MeasureRow | OutcomeRow | FeatureRow;

export interface Section {
  id: string;
  title: string;
  about: string;
  tables: Table[];
}

export interface Category {
  id: string;
  title: string;
  sections: Section[];
}

export interface Defect {
  id: string;
  box: Box;
  text: string;
  // Every row it decides, the one that shows it first.
  rows: string[];
}

export interface Pending {
  id: string;
  category: string;
  test: string;
  needs: string;
}

export interface Results {
  format: 2;
  firmware: Record<Box, string>;
  rig: string;
  layers: Record<string, string>;
  categories: Category[];
  defects: Defect[];
  pending: Pending[];
}
