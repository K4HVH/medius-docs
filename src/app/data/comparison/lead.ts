// Whether a box leads a measured row: runs pooled by random effects (DerSimonian-Laird), judged by Student's t.
import type { Box } from './types';

// A run's statistic, and its sampling variance where the run records its sample count and spread.
export interface RunStat {
  y: number;
  v?: number;
}

// The standard error of each statistic in standard deviations over the root of its count.
export const SE_FACTOR: Record<string, number> = { mean: 1, p50: 1.2533, p95: 2.1098, p99: 3.7322 };

const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function critical(df: number): number {
  const d = Math.max(1, Math.floor(df));
  return d <= T95.length ? T95[d - 1] : 1.96;
}

export interface Pooled {
  mu: number;
  variance: number;
  tau2: number;
}

// `tau2`: the spread between runs, given for a box that ran once (the other box's); estimated from the runs otherwise.
export function pooled(runs: RunStat[], tau2?: number): Pooled | undefined {
  const k = runs.length;
  if (!k) return undefined;
  const ys = runs.map((r) => r.y);
  const known = runs.every((r) => r.v !== undefined && r.v > 0);
  const vs = runs.map((r) => (known ? (r.v as number) : 0));
  if (tau2 === undefined) {
    if (k < 2) return undefined;
    if (known) {
      const w = vs.map((v) => 1 / v);
      const sw = w.reduce((a, b) => a + b, 0);
      const mw = w.reduce((a, wi, i) => a + wi * ys[i], 0) / sw;
      const q = w.reduce((a, wi, i) => a + wi * (ys[i] - mw) ** 2, 0);
      const c = sw - w.reduce((a, wi) => a + wi * wi, 0) / sw;
      tau2 = c > 0 ? Math.max(0, (q - (k - 1)) / c) : 0;
    } else {
      const m = ys.reduce((a, b) => a + b, 0) / k;
      tau2 = ys.reduce((a, y) => a + (y - m) ** 2, 0) / (k - 1);
    }
  }
  const t = tau2;
  if (vs.every((v) => v + t === 0)) return { mu: ys.reduce((a, b) => a + b, 0) / k, variance: 0, tau2: t };
  const w = vs.map((v) => 1 / (v + t));
  const sw = w.reduce((a, b) => a + b, 0);
  return { mu: w.reduce((a, wi, i) => a + wi * ys[i], 0) / sw, variance: 1 / sw, tau2: t };
}

function both(stock: RunStat[], medius: RunStat[]): { s: Pooled; m: Pooled; df: number } | undefined {
  let s = pooled(stock);
  let m = pooled(medius);
  if (!s && m) s = pooled(stock, m.tau2);
  if (!m && s) m = pooled(medius, s.tau2);
  if (!s || !m) return undefined;
  return { s, m, df: Math.max(0, stock.length - 1) + Math.max(0, medius.length - 1) };
}

function verdict(d: number, se: number, df: number): Box | 'equal' {
  if (d === 0) return 'equal';
  if (se > 0 && Math.abs(d) <= critical(df) * se) return 'equal';
  return d > 0 ? 'stock' : 'medius';
}

// `ref`: in a table ranked nearer, what the row is ranked against: the native reference's runs, or a set number.
export function leadOf(
  better: 'lower' | 'higher' | 'nearer',
  stock: RunStat[],
  medius: RunStat[],
  ref?: { runs?: RunStat[]; target?: number },
): Box | 'equal' {
  const runsMean = (rs: RunStat[]) => rs.reduce((a, r) => a + r.y, 0) / rs.length;
  const est = both(stock, medius);
  if (!est) {
    const [s, m] = [stock[0]?.y ?? 0, medius[0]?.y ?? 0];
    const at = ref?.target ?? (ref?.runs?.length ? runsMean(ref.runs) : 0);
    const d = better === 'nearer' ? Math.abs(m - at) - Math.abs(s - at) : better === 'lower' ? m - s : s - m;
    return verdict(d, 0, 1);
  }
  const { s, m, df } = est;
  if (better === 'nearer') {
    let at = ref?.target;
    let refVar = 0;
    if (at === undefined && ref?.runs?.length) {
      const r = pooled(ref.runs, ref.runs.length < 2 ? (s.tau2 + m.tau2) / 2 : undefined);
      at = r ? r.mu : runsMean(ref.runs);
      refVar = r ? r.variance : 0;
    }
    at ??= 0;
    // Either side of the reference, the gap between the two distances moves twice as far as the reference does.
    const across = (s.mu - at) * (m.mu - at) < 0;
    const se = Math.sqrt(s.variance + m.variance + (across ? 4 * refVar : 0));
    return verdict(Math.abs(m.mu - at) - Math.abs(s.mu - at), se, df);
  }
  return verdict(better === 'lower' ? m.mu - s.mu : s.mu - m.mu, Math.sqrt(s.variance + m.variance), df);
}
