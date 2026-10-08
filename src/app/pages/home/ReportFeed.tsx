import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { FeedFrame } from '../../data/sampleTypes';
import { prefersReducedMotion } from '../../shell/motion';

const ROWS = 44;
const STEP_MS = 250;
const ROW_PX = 26;
const MIN_GAP = 0.3;

const hex3 = (n: number) => (n & 0x7ff).toString(16).toUpperCase().padStart(3, '0');

// USB1's reports from a capture, one frame a row and slowed 250 times; bytes MOVE injected are blue. The
// rows rise continuously while the feed is on screen, and stand still under reduced motion.
export function ReportFeed(props: { frames: readonly FeedFrame[] }) {
  const [head, setHead] = createSignal(ROWS - 1);
  const n = () => props.frames.length;
  const at = (i: number) => props.frames[((i % n()) + n()) % n()];
  const shown = () => Array.from({ length: ROWS }, (_, j) => head() - ROWS + 1 + j);
  const now = () => (n() ? at(head()) : undefined);
  let tape: HTMLDivElement | undefined;
  let rows: HTMLDivElement | undefined;

  // A full space between bytes where the report has room; else a narrower gap, down to MIN_GAP, and only
  // then smaller type. Measured, not computed: browsers round a mono character's width differently.
  const fit = () => {
    if (!rows) return;
    rows.style.fontSize = '';
    const report = rows.querySelector('.b')?.parentElement;
    const bytes = report ? [...report.children] : [];
    if (!report || bytes.length < 2) {
      rows.style.removeProperty('--byte-gap');
      return;
    }
    const spare = () => {
      const column = report.getBoundingClientRect();
      return column.width - (bytes.at(-1)!.getBoundingClientRect().right - column.left);
    };
    rows.style.setProperty('--byte-gap', `${MIN_GAP}ch`);
    const base = parseFloat(getComputedStyle(rows).fontSize);
    if (spare() < 0 && Number.isFinite(base)) {
      let [lo, hi] = [6, base];
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        rows.style.fontSize = `${mid}px`;
        if (spare() >= 0) lo = mid;
        else hi = mid;
      }
      rows.style.fontSize = `${Math.floor(lo * 100) / 100}px`;
    }
    rows.style.setProperty('--byte-gap', '0px');
    const ch = bytes[0].getBoundingClientRect().width / 2;
    const room = Math.min(ch, Math.max(MIN_GAP * ch, spare() / (bytes.length - 1)));
    rows.style.setProperty('--byte-gap', `${Math.floor(room * 100) / 100}px`);
  };

  onMount(() => {
    fit();
    void document.fonts?.ready.then(fit);
    if (typeof ResizeObserver === 'undefined' || !tape) return;
    const ro = new ResizeObserver(fit);
    ro.observe(tape);
    onCleanup(() => ro.disconnect());
  });

  onMount(() => {
    if (!n() || prefersReducedMotion() || !tape) return;
    let last = performance.now();
    let acc = 0;
    let inView = true;
    let raf = 0;
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((es) => (inView = es[0].isIntersecting));
    io?.observe(tape);
    const loop = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      if (inView && !document.hidden) {
        acc = Math.min(acc + dt, 1000);
        while (acc >= STEP_MS) {
          acc -= STEP_MS;
          setHead((h) => h + 1);
        }
        rows?.style.setProperty('transform', `translateY(${(ROW_PX * (1 - acc / STEP_MS)).toFixed(2)}px)`);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    });
  });

  return (
    <div class="tape" ref={tape} aria-hidden="true">
      <div class="tape-head caps">
        <span>Frame</span>
        <span>Report</span>
        <span class="lamps">
          <span class="lamp" classList={{ lit: !!now()?.mouse }}>Mouse</span>
          <span class="lamp api" classList={{ lit: !!now()?.api.some(Boolean) }}>API</span>
        </span>
      </div>
      <div class="tape-body">
        <div class="rows" ref={rows}>
          <Show when={n()}>
            <For each={shown()}>
              {(i) => {
                const f = at(i);
                return (
                  <div class="row" classList={{ now: i === head() }}>
                    <span>{hex3(i)}</span>
                    <Show when={f.report} fallback={<span>NAK</span>}>
                      {(r) => (
                        <span>
                          <For each={r().match(/../g) ?? []}>
                            {(b, k) => (
                              <span class="b" classList={{ api: f.api[k()] }}>
                                {b}
                              </span>
                            )}
                          </For>
                        </span>
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
      <div class="tape-foot caps">
        USB1 · <span class="nc">1 kHz</span> · slowed 250×
      </div>
    </div>
  );
}
