import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { FeedFrame } from '../../data/sampleTypes';
import { prefersReducedMotion } from '../../shell/motion';

const ROWS = 44;
const STEP_MS = 250;
const ROW_PX = 26;

const hex3 = (n: number) => (n & 0x7ff).toString(16).toUpperCase().padStart(3, '0');

// USB1's reports from a capture, one frame a row and slowed 250 times; bytes MOVE injected are blue. The
// rows rise continuously while the feed is on screen, and stand still under reduced motion.
export function ReportFeed(props: { frames: readonly FeedFrame[] }) {
  const [head, setHead] = createSignal(ROWS - 1);
  const n = () => props.frames.length;
  const at = (i: number) => props.frames[((i % n()) + n()) % n()];
  const ep = createMemo(() => props.frames.find((f) => f.ep)?.ep ?? '81');
  const shown = () => Array.from({ length: ROWS }, (_, j) => head() - ROWS + 1 + j);
  const now = () => (n() ? at(head()) : undefined);
  let tape: HTMLDivElement | undefined;
  let rows: HTMLDivElement | undefined;

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
        <span>EP</span>
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
                const api = f.api.some(Boolean);
                return (
                  <div class="row" classList={{ now: i === head() }}>
                    <span>{hex3(i)}</span>
                    <span>{f.ep ?? ep()}</span>
                    <Show when={f.report} fallback={<span>NAK</span>}>
                      {(r) => (
                        <span>
                          <For each={r().match(/../g) ?? []}>
                            {(b, k) => (
                              <>
                                {k() ? ' ' : ''}
                                <Show when={f.api[k()]} fallback={b}>
                                  <span class="api">{b}</span>
                                </Show>
                              </>
                            )}
                          </For>
                        </span>
                      )}
                    </Show>
                    <span class="api">{api ? '+API' : ''}</span>
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
