import { createEffect, createSignal, onCleanup, onMount, For, type Component } from 'solid-js';
import { type Slot, type Metrics, metricsFor, histogram } from './capture';

const PACED = '#9aa4b2';
const RENDERED = '#34d399';
export const slotColor = (s: Slot) => (s.rendered ? RENDERED : PACED);

// A canvas that redraws when the accessors its `paint` reads change, and on resize, at device pixel
// ratio. `paint` gets the 2D context, CSS-pixel width/height, and the theme foreground colour.
const LabCanvas: Component<{ height: number; paint: (ctx: CanvasRenderingContext2D, w: number, h: number, fg: string) => void }> = (props) => {
  let el!: HTMLCanvasElement;
  const [w, setW] = createSignal(0);
  onMount(() => {
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    onCleanup(() => ro.disconnect());
  });
  createEffect(() => {
    const width = w();
    const h = props.height;
    if (width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(width * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    const fg = getComputedStyle(el).color || '#888';
    props.paint(ctx, width, h, fg);
  });
  return <canvas ref={el} style={{ width: '100%', height: `${props.height}px`, display: 'block' }} />;
};

// Accepts a #hex (our slot colours) or an rgb()/rgba() string (getComputedStyle always returns rgb).
const alpha = (color: string, a: number) => {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const m = color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})` : color;
};

// One lane of emitted reports over time: a vertical bar per report (height = delta when known, a fixed
// tick otherwise), so idle gaps show as empty stretches.
function paintLane(ctx: CanvasRenderingContext2D, slot: Slot, x0: number, y0: number, w: number, h: number, dur: number, dmax: number, color: string, fg: string) {
  ctx.fillStyle = alpha(fg, 0.05);
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const e of slot.emits) {
    const x = x0 + (e.t / dur) * w;
    const bh = e.hasDelta ? Math.max(1, (e.d / dmax) * (h - 4)) : h - 4;
    ctx.moveTo(x, y0 + h - 2);
    ctx.lineTo(x, y0 + h - 2 - bh);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export const TimelineLanes: Component<{ slots: () => Slot[] }> = (props) => (
  <LabCanvas
    height={140}
    paint={(ctx, w, h, fg) => {
      const s = props.slots();
      if (s.length === 0) {
        ctx.fillStyle = alpha(fg, 0.4);
        ctx.font = '13px system-ui';
        ctx.fillText('Run a scenario to capture the emitted stream.', 12, h / 2);
        return;
      }
      const dur = Math.max(...s.map((x) => x.durationMs), 1);
      const dmax = Math.max(1, ...s.flatMap((x) => x.emits.filter((e) => e.hasDelta).map((e) => e.d)));
      const laneH = (h - 8) / s.length;
      ctx.font = '11px system-ui';
      s.forEach((slot, i) => {
        const y0 = 4 + i * laneH;
        paintLane(ctx, slot, 0, y0 + 14, w, laneH - 16, dur, dmax, slotColor(slot), fg);
        const m = metricsFor(slot);
        ctx.fillStyle = slotColor(slot);
        ctx.fillText(`${slot.label}  ${m.hz.toFixed(0)} Hz  ${m.idlePct.toFixed(0)}% idle`, 4, y0 + 11);
      });
      ctx.fillStyle = alpha(fg, 0.45);
      ctx.fillText(`${dur.toFixed(0)} ms  ·  bar height = per-report delta`, w - 220, h - 3);
    }}
  />
);

function paintHistogram(ctx: CanvasRenderingContext2D, w: number, h: number, fg: string, sets: { color: string; bins: number[] }[], labels: string[]) {
  const bins = sets[0]?.bins.length ?? 0;
  const peak = Math.max(1, ...sets.flatMap((s) => s.bins));
  const bw = w / Math.max(bins, 1);
  ctx.textBaseline = 'alphabetic';
  sets.forEach((set) => {
    ctx.fillStyle = alpha(set.color, 0.55);
    set.bins.forEach((c, i) => {
      const bh = (c / peak) * (h - 22);
      ctx.fillRect(i * bw + 1, h - 16 - bh, bw - 2, bh);
    });
  });
  ctx.font = '11px system-ui';
  labels.forEach((l, i) => {
    ctx.fillStyle = sets[i]?.color ?? fg;
    ctx.fillText(l, 6 + i * 90, 13);
  });
}

export const DeltaHistogram: Component<{ slots: () => Slot[] }> = (props) => (
  <LabCanvas
    height={130}
    paint={(ctx, w, h, fg) => {
      const s = props.slots().filter((x) => metricsFor(x).hasDelta);
      if (s.length === 0) {
        ctx.fillStyle = alpha(fg, 0.4);
        ctx.font = '12px system-ui';
        ctx.fillText('No per-report deltas parsed for this device.', 12, h / 2);
        return;
      }
      const max = Math.max(1, ...s.flatMap((x) => metricsFor(x).deltas));
      const sets = s.map((x) => ({ color: slotColor(x), bins: histogram(metricsFor(x).deltas, 0, max, 24) }));
      paintHistogram(ctx, w, h, fg, sets, s.map((x) => x.label));
      ctx.fillStyle = alpha(fg, 0.45);
      ctx.fillText(`per-report delta  0 to ${max.toFixed(0)}`, w - 170, h - 3);
    }}
  />
);

export const GapHistogram: Component<{ slots: () => Slot[] }> = (props) => (
  <LabCanvas
    height={130}
    paint={(ctx, w, h, fg) => {
      const s = props.slots();
      if (s.length === 0) return;
      const max = 20;
      const sets = s.map((x) => ({ color: slotColor(x), bins: histogram(metricsFor(x).gaps, 0, max, 24) }));
      paintHistogram(ctx, w, h, fg, sets, s.map((x) => x.label));
      ctx.fillStyle = alpha(fg, 0.45);
      ctx.fillText('inter-report gap  0 to 20 ms', w - 180, h - 3);
    }}
  />
);

// Report density against idle fraction, with the hand's band shaded. Paced injection lands in the
// dense/no-idle corner; rendered moves toward the band. This is the detection tell, drawn.
export const DetectionLens: Component<{ slots: () => Slot[] }> = (props) => (
  <LabCanvas
    height={230}
    paint={(ctx, w, h, fg) => {
      const pad = 34;
      const px = (hz: number) => pad + (Math.min(hz, 1100) / 1100) * (w - pad - 10);
      const py = (idle: number) => h - pad - (Math.min(idle, 100) / 100) * (h - pad - 10);
      // the human band: ~270-360 Hz, 60-70% idle
      ctx.fillStyle = alpha(RENDERED, 0.12);
      ctx.fillRect(px(270), py(70), px(360) - px(270), py(60) - py(70));
      ctx.strokeStyle = alpha(fg, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, 6);
      ctx.lineTo(pad, h - pad);
      ctx.lineTo(w - 6, h - pad);
      ctx.stroke();
      ctx.fillStyle = alpha(fg, 0.5);
      ctx.font = '11px system-ui';
      ctx.fillText('idle %', 4, 14);
      ctx.fillText('reports/s', w - 66, h - pad + 16);
      ctx.fillText('hand', px(300) - 12, py(65));
      for (const slot of props.slots()) {
        const m = metricsFor(slot);
        const x = px(m.hz);
        const y = py(m.idlePct);
        ctx.fillStyle = slotColor(slot);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`${slot.label} (${m.hz.toFixed(0)} Hz, ${m.idlePct.toFixed(0)}%)`, x + 8, y + 4);
      }
    }}
  />
);

export const CursorPath: Component<{ slots: () => Slot[] }> = (props) => (
  <LabCanvas
    height={200}
    paint={(ctx, w, h, fg) => {
      const s = props.slots().filter((x) => metricsFor(x).hasDelta);
      if (s.length === 0) {
        ctx.fillStyle = alpha(fg, 0.4);
        ctx.font = '12px system-ui';
        ctx.fillText('No deltas to trace for this device.', 12, h / 2);
        return;
      }
      const paths = s.map((slot) => {
        let x = 0;
        let y = 0;
        const pts: [number, number][] = [[0, 0]];
        for (const e of slot.emits) {
          x += e.dx;
          y += e.dy;
          pts.push([x, y]);
        }
        return { slot, pts };
      });
      const all = paths.flatMap((p) => p.pts);
      const xs = all.map((p) => p[0]);
      const ys = all.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const sc = Math.min((w - 20) / Math.max(1, maxX - minX), (h - 20) / Math.max(1, maxY - minY));
      const tx = (x: number) => 10 + (x - minX) * sc;
      const ty = (y: number) => 10 + (y - minY) * sc;
      for (const p of paths) {
        ctx.strokeStyle = slotColor(p.slot);
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(tx(x), ty(y)) : ctx.lineTo(tx(x), ty(y))));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }}
  />
);

export const MetricsPanel: Component<{ slots: () => Slot[] }> = (props) => {
  const rows = () =>
    props.slots().map((s) => ({ label: s.label, color: slotColor(s), m: metricsFor(s) }));
  return (
    <table class="api-params">
      <thead>
        <tr><th>Mode</th><th>Reports/s</th><th>Idle %</th><th>Max delta</th><th>Mean delta</th><th>Reports</th></tr>
      </thead>
      <tbody>
        <For each={rows()}>
          {(r) => (
            <tr>
              <td style={{ color: r.color, 'font-weight': 600 }}>{r.label}</td>
              <td>{r.m.hz.toFixed(0)}</td>
              <td>{r.m.idlePct.toFixed(0)}</td>
              <td>{r.m.hasDelta ? r.m.maxDelta.toFixed(0) : '?'}</td>
              <td>{r.m.hasDelta ? r.m.meanDelta.toFixed(1) : '?'}</td>
              <td>{r.m.count}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};

export type { Metrics };
