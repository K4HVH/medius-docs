import { For, onCleanup, onMount } from 'solid-js';
import { prefersReducedMotion } from './motion';

export interface ByteField {
  value: string;
  name: string;
}

const FRAMING = new Set(['sof', 'type', 'seq', 'len', 'crc16']);

// Past this many characters a value is wider than a phone's strip.
const LONG = 20;

const bytesIn = (value: string) => Math.max(1, value.trim().split(/\s+/).length);

// A frame on the wire: each value over its field name, the payload lit apart from the framing. The cells
// light in wire order when the strip comes into view, and again on hover.
export function ByteStrip(props: { fields: ByteField[] }) {
  let strip: HTMLDivElement | undefined;
  let busy = false;
  let seen = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (f: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      f();
    }, ms);
    timers.add(t);
  };

  const sweep = () => {
    if (busy || !strip) return;
    busy = true;
    const cells = [...strip.children];
    const light = (c: Element, i: number) => {
      c.classList.add('hit');
      later(() => {
        c.classList.remove('hit');
        if (i === cells.length - 1) busy = false;
      }, 160);
    };
    cells.forEach((c, i) => (i ? later(() => light(c, i), i * 90) : light(c, i)));
  };

  onMount(() => {
    if (!strip || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          later(sweep, seen ? 150 : 650);
          seen = true;
        }
      },
      { threshold: 0.6 },
    );
    io.observe(strip);
    strip.addEventListener('pointerenter', sweep);
    onCleanup(() => {
      io.disconnect();
      strip?.removeEventListener('pointerenter', sweep);
    });
  });
  onCleanup(() => timers.forEach(clearTimeout));

  return (
    <div class="bytes" ref={strip}>
      <For each={props.fields}>
        {(f) => (
          <div
            classList={{ pl: !FRAMING.has(f.name.toLowerCase()), long: f.value.length > LONG }}
            style={{ '--w': String(bytesIn(f.value)) }}
          >
            <b>{f.value}</b>
            <span>{f.name}</span>
          </div>
        )}
      </For>
    </div>
  );
}
