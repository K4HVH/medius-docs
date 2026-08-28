// A captured emitted report. `t` is milliseconds from the run's first emit; `d` is the per-report
// motion magnitude (0 when the layout could not be parsed, in which case `hasDelta` is false).
export interface Emit {
  t: number;
  dx: number;
  dy: number;
  d: number;
  hasDelta: boolean;
}

// One run of one scenario in one mode.
export interface Slot {
  label: string;
  rendered: boolean;
  emits: Emit[];
  durationMs: number;
}

export interface Metrics {
  hz: number;
  idlePct: number;
  maxDelta: number;
  meanDelta: number;
  hasDelta: boolean;
  count: number;
  gaps: number[];
  deltas: number[];
  netX: number;
  netY: number;
}

const IDLE_MS = 2;

// `durationMs` is the whole capture window, not just first-emit-to-last, so trailing silence counts
// as idle. Rate and idle are taken over that window, which is what a detector would measure.
export function metricsFor(slot: Slot): Metrics {
  const e = slot.emits;
  const dur = Math.max(slot.durationMs, 1);
  const gaps: number[] = [];
  let idle = 0;
  for (let i = 1; i < e.length; i++) {
    const g = e[i].t - e[i - 1].t;
    gaps.push(g);
    if (g > IDLE_MS) idle += g;
  }
  if (e.length) {
    const trailing = dur - e[e.length - 1].t;
    if (trailing > IDLE_MS) idle += trailing;
  }
  const withDelta = e.filter((x) => x.hasDelta);
  const deltas = withDelta.map((x) => x.d);
  const maxDelta = deltas.reduce((m, d) => Math.max(m, d), 0);
  const meanDelta = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
  return {
    hz: (e.length / dur) * 1000,
    idlePct: Math.min(100, (idle / dur) * 100),
    maxDelta,
    meanDelta,
    hasDelta: withDelta.length > 0,
    count: e.length,
    gaps,
    deltas,
    netX: e.reduce((s, x) => s + x.dx, 0),
    netY: e.reduce((s, x) => s + x.dy, 0),
  };
}

// A histogram: `bins` counts across [min, max]. Used for the delta and gap distributions.
export function histogram(values: number[], min: number, max: number, bins: number): number[] {
  const out = new Array(bins).fill(0);
  if (max <= min) return out;
  for (const v of values) {
    let i = Math.floor(((v - min) / (max - min)) * bins);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    out[i]++;
  }
  return out;
}
