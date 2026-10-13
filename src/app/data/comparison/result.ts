// Each row's result, worked out from its values by the rules in medius-fw docs/comparison/results.schema.md,
// and each value as the site writes it.
import type { Box, FeatureRow, MeasureRow, OutcomeRow, PairRow, Table, Value } from './types';

export type Result = Box | 'equal' | 'differs' | null;

// The lowest and highest a value covers; a count of a total as its fraction.
export function span(v: Value): [number, number] {
  if ('lo' in v) return [v.lo, v.hi];
  const x = v.of ? v.value / v.of : v.value;
  return [x, x];
}

export function resultOf(table: Table, row: PairRow): Result {
  if (table.kind === 'measure') {
    if (!table.better) return null;
    const { stock, medius } = row as MeasureRow;
    const [sl, sh] = span(stock);
    const [ml, mh] = span(medius);
    if (sl <= mh && ml <= sh) return 'equal';
    return (sh < ml) === (table.better === 'lower') ? 'stock' : 'medius';
  }
  if (table.kind === 'outcome') {
    const { stock, medius } = row as OutcomeRow;
    if (stock.is === medius.is) return 'equal';
    if (table.ranked === false) return 'differs';
    return table.outcomes.indexOf(stock.is) < table.outcomes.indexOf(medius.is) ? 'stock' : 'medius';
  }
  if (table.kind === 'feature') {
    const { stock, medius } = row as FeatureRow;
    // Unranked, the cells say what each box has, so two different things differ.
    if (table.ranked === false) return stock === medius ? 'equal' : 'differs';
    if (stock && medius) return 'equal';
    return stock ? 'stock' : 'medius';
  }
  return null;
}

// Units written after the number; any other unit is a noun the table's label carries ("Reports per move").
const SYMBOLS = new Set(['ms', 'µs', 's', 'B', 'KB', 'Hz', 'kHz', 'Mbaud']);
const TIGHT = new Set(['/s', '%']);

// The decimals a number was stored with, written out where JavaScript would use an exponent (5e-7).
const places = (n: number) => {
  const [mantissa, exponent] = String(n).split('e');
  const decimals = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, decimals - Number(exponent ?? 0));
};

// Thousands with commas, to the decimals given: a range's ends share them, as 8.60-8.66.
const number = (n: number, decimals = places(n)) => {
  const [whole, frac] = n.toFixed(decimals).split('.');
  return Number(whole).toLocaleString('en-US') + (frac ? `.${frac}` : '');
};

const withUnit = (text: string, unit: string) => (TIGHT.has(unit) ? `${text}${unit}` : SYMBOLS.has(unit) ? `${text} ${unit}` : text);

export function showValue(v: Value, unit: string): string {
  if ('lo' in v) {
    const d = Math.max(places(v.lo), places(v.hi));
    // A hyphen between negative ends reads as a minus sign, so they get "to".
    const join = v.lo < 0 || v.hi < 0 ? ' to ' : '-';
    return withUnit(v.lo === v.hi ? number(v.lo) : `${number(v.lo, d)}${join}${number(v.hi, d)}`, unit);
  }
  if (v.of !== undefined) return `${number(v.value)} of ${number(v.of)}`;
  return withUnit(number(v.value), unit);
}
