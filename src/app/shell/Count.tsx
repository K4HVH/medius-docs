import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js';
import { prefersReducedMotion } from './motion';

// A figure that counts up to its value, eased, once it is on screen. A later value shows at once.
export function Count(props: { to: number; format: (n: number) => string; ms?: number }) {
  const [n, setN] = createSignal(props.to);
  let el: HTMLElement | undefined;
  createEffect(on(() => props.to, (to) => setN(to), { defer: true }));
  onMount(() => {
    if (!el || props.to <= 0 || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const to = props.to;
      const ms = props.ms ?? 1000;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        setN(Math.round(to * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    onCleanup(() => {
      io.disconnect();
      cancelAnimationFrame(raf);
    });
  });
  return <b ref={el}>{props.format(n())}</b>;
}
