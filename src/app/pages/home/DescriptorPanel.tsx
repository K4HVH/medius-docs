import { createMemo, createSignal, For, onCleanup, onMount } from 'solid-js';
import type { DescriptorSample } from '../../data/sampleTypes';
import { prefersReducedMotion } from '../../shell/motion';

const TABS = [
  { key: 'device', tab: 'Device', name: 'Device' },
  { key: 'configuration', tab: 'Config', name: 'Configuration' },
  { key: 'interface', tab: 'Interface', name: 'Interface' },
  { key: 'hid', tab: 'HID', name: 'HID' },
  { key: 'endpoint', tab: 'Endpoint', name: 'Endpoint' },
] as const;

const CYCLE_MS = 6000;
const bytesIn = (hex: string) => hex.split(' ').length;

// A captured mouse's descriptors beside its clone's, field by field. The count and the rows check off
// together once the panel is on screen, then the panel steps through the descriptors every six seconds
// while it stays there, unless the pointer or keyboard focus is on it or a tab was picked.
export function DescriptorPanel(props: { sample: DescriptorSample }) {
  const reduce = prefersReducedMotion();
  const fields = (k: number) => props.sample.descriptors[TABS[k].key];
  const totalOf = (k: number) => fields(k).reduce((s, f) => s + bytesIn(f.mouse), 0);
  const longest = createMemo(() => Math.max(...TABS.map((_, k) => fields(k).length)));

  const [selected, setSelected] = createSignal(0);
  const [shown, setShown] = createSignal(0);
  const [entering, setEntering] = createSignal(false);
  const [swap, setSwap] = createSignal(false);
  const [count, setCount] = createSignal<number | null>(reduce ? totalOf(0) : null);
  const [checked, setChecked] = createSignal(reduce ? Infinity : 0);
  const [hits, setHits] = createSignal<ReadonlySet<number>>(new Set());
  const [picked, setPicked] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  // Fresh row objects each time, so a switch always brings new rows in.
  const rows = createMemo(() => {
    const n = shown();
    const list: ({ field: string; mouse: string; clone: string } | null)[] = fields(n).map((f) => ({ ...f }));
    while (list.length < longest()) list.push(null);
    return list;
  });

  let section: HTMLElement | undefined;
  let countEl: HTMLSpanElement | undefined;
  let scoreB: HTMLElement | undefined;
  let gen = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let prog = 0;
  const later = (g: number, fn: () => void, ms: number) => timers.push(setTimeout(() => g === gen && fn(), ms));

  // The count's box is as wide as the widest number it passes through, so the slash never moves while it
  // counts.
  const sizeCount = (total: number, instant: boolean) => {
    if (!countEl?.parentNode) return;
    const probe = countEl.cloneNode() as HTMLSpanElement;
    probe.style.cssText = 'position:absolute;visibility:hidden;min-width:0';
    countEl.parentNode.appendChild(probe);
    let w = 0;
    for (let i = 0; i <= total; i++) {
      probe.textContent = String(i);
      w = Math.max(w, probe.getBoundingClientRect().width);
    }
    probe.remove();
    if (instant) {
      countEl.style.transition = 'none';
      countEl.style.minWidth = `${w}px`;
      void countEl.offsetWidth;
      countEl.style.transition = '';
    } else countEl.style.minWidth = `${w}px`;
  };

  const runCompare = (g: number) => {
    let total = 0;
    fields(shown()).forEach((f, i) =>
      later(
        g,
        () => {
          setHits((s) => new Set(s).add(i));
          setChecked(i + 1);
          total += bytesIn(f.mouse);
          setCount(total);
          later(
            g,
            () =>
              setHits((s) => {
                const next = new Set(s);
                next.delete(i);
                return next;
              }),
            140,
          );
        },
        120 + i * 85,
      ),
    );
  };

  const render = (n: number, animate: boolean) => {
    setSelected(n);
    setShown(n);
    prog = 0;
    setProgress(0);
    sizeCount(totalOf(n), false);
    setEntering(animate);
    if (animate) {
      setCount(0);
      setChecked(0);
      const g = gen;
      later(g, () => runCompare(g), 280);
    } else {
      setCount(totalOf(n));
      setChecked(Infinity);
    }
  };

  // Each switch owns the count: a newer one cancels every step of the one before.
  const show = (n: number, animate: boolean) => {
    gen++;
    const g = gen;
    timers.forEach(clearTimeout);
    timers = [];
    setHits(new Set<number>());
    if (!animate) return render(n, false);
    setSelected(n);
    prog = 0;
    setProgress(0);
    setSwap(true);
    later(
      g,
      () => {
        setSwap(false);
        render(n, true);
      },
      160,
    );
  };

  const pick = (n: number) => {
    setPicked(true);
    show(n, !reduce);
  };

  onMount(() => {
    sizeCount(totalOf(0), true);
    void document.fonts?.ready.then(() => sizeCount(totalOf(shown()), true));
    if (reduce || typeof IntersectionObserver === 'undefined' || !section || !scoreB) return;
    const panel = section;
    let started = false;
    let inView = false;
    let hover = false;
    let focus = false;
    const boot: ReturnType<typeof setTimeout>[] = [];
    const onEnter = () => (hover = true);
    const onLeave = () => (hover = false);
    const onFocusIn = () => (focus = true);
    const onFocusOut = (e: FocusEvent) => (focus = panel.contains(e.relatedTarget as Node | null));
    panel.addEventListener('pointerenter', onEnter);
    panel.addEventListener('pointerleave', onLeave);
    panel.addEventListener('focusin', onFocusIn);
    panel.addEventListener('focusout', onFocusOut);
    const view = new IntersectionObserver(
      (es) => {
        inView = es[0].isIntersecting;
        if (!inView && picked()) setPicked(false);
      },
      { threshold: 0.35 },
    );
    view.observe(section);
    // The first count starts once the number is wholly on screen; a tab picked before then takes its place.
    const first = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        first.disconnect();
        boot.push(
          setTimeout(() => {
            if (!gen) {
              setCount(0);
              runCompare(gen);
            }
            boot.push(setTimeout(() => (started = true), 1500));
          }, 650),
        );
      },
      { threshold: 1 },
    );
    first.observe(scoreB);
    let last = performance.now();
    let raf = 0;
    const cycle = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      if (started && inView && !hover && !focus && !picked() && !document.hidden) {
        prog += dt;
        setProgress(Math.min(1, prog / CYCLE_MS));
        if (prog >= CYCLE_MS) show((selected() + 1) % TABS.length, true);
      }
      raf = requestAnimationFrame(cycle);
    };
    raf = requestAnimationFrame(cycle);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      boot.forEach(clearTimeout);
      view.disconnect();
      first.disconnect();
      panel.removeEventListener('pointerenter', onEnter);
      panel.removeEventListener('pointerleave', onLeave);
      panel.removeEventListener('focusin', onFocusIn);
      panel.removeEventListener('focusout', onFocusOut);
    });
  });
  onCleanup(() => timers.forEach(clearTimeout));

  const bar = (i: number) => (i !== selected() ? 0 : picked() ? 1 : progress());

  return (
    <section class="desc frame" classList={{ swap: swap() }} ref={section} aria-labelledby="desc-label">
      <div class="score">
        <p class="label" id="desc-label">
          {TABS[shown()].name} descriptor
        </p>
        <b ref={scoreB}>
          <span ref={countEl} classList={{ wait: count() === null }}>
            {count() ?? '--'}
          </span>
          <i>/{totalOf(shown())}</i>
        </b>
        <span class="caps">Bytes matched</span>
      </div>
      <div class="dside">
        <div class="dtabs" role="tablist">
          <For each={TABS}>
            {(t, i) => (
              <button type="button" role="tab" aria-selected={selected() === i() ? 'true' : 'false'} onClick={() => pick(i())}>
                {t.tab}
                <i class="bar" style={{ transform: `scaleX(${bar(i()).toFixed(4)})` }} />
              </button>
            )}
          </For>
        </div>
        <div class="cmp" classList={{ pending: count() === null }}>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>
                  Mouse<span class="wide"> · hex</span>
                </th>
                <th>
                  Clone<span class="wide"> · hex</span>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={rows()}>
                {(f, i) =>
                  f ? (
                    <tr
                      classList={{ in: entering(), hit: hits().has(i()) }}
                      style={entering() ? { '--d': `${i() * 35}ms` } : undefined}
                    >
                      <td>{f.field}</td>
                      <td class="v">{f.mouse}</td>
                      <td class="v">{f.clone}</td>
                      <td class="eq" classList={{ off: i() >= checked() }}>
                        =
                      </td>
                    </tr>
                  ) : (
                    <tr class="pad" aria-hidden="true">
                      <td>&nbsp;</td>
                      <td />
                      <td />
                      <td />
                    </tr>
                  )
                }
              </For>
            </tbody>
          </table>
        </div>
        <p class="desc-src caps">
          {props.sample.device} · {props.sample.vidpid} · v{props.sample.firmware} · captured {props.sample.captured}
        </p>
      </div>
    </section>
  );
}
