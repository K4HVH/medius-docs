import { createEffect, Index, on, onCleanup, onMount } from 'solid-js';

export interface SegOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// One choice from a few, side by side; the fill slides to the one picked. Assistive technology sees a radio
// group: one tab stop, and the arrows move the choice.
export function Segmented(props: {
  name: string;
  value?: string;
  options: SegOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  class?: string;
}) {
  let root: HTMLDivElement | undefined;
  let fill: HTMLSpanElement | undefined;
  let placed = false;

  // The fill slides to a new pick. It jumps instead on its first placing, and when the options switch between
  // a row and a column, where a slide would cut across them.
  const place = (jump = false) => {
    const b = root?.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
    if (!fill || !root?.offsetParent) return;
    if (!b) {
      fill.style.height = '0';
      return;
    }
    jump ||= !placed;
    if (jump) fill.classList.add('jump');
    fill.style.left = `${b.offsetLeft}px`;
    fill.style.top = `${b.offsetTop}px`;
    fill.style.width = `${b.offsetWidth}px`;
    fill.style.height = `${b.offsetHeight}px`;
    if (jump) {
      void fill.offsetWidth;
      fill.classList.remove('jump');
      placed = true;
    }
  };
  // Options that don't fit on one row stack in one column. They are measured as a row each time the room
  // changes, and left alone while hidden, when nothing has a size to measure. The class is set outside Solid,
  // because a measure inside an effect would read a row Solid hasn't drawn yet. Returns whether it changed.
  const fit = (): boolean => {
    if (!root?.offsetParent) return false;
    const was = root.classList.contains('seg--col');
    root.classList.remove('seg--col');
    const bs = [...root.querySelectorAll('button')];
    const col = bs.some((b) => b.offsetTop !== bs[0].offsetTop);
    root.classList.toggle('seg--col', col);
    return col !== was;
  };
  const lay = () => place(fit());
  createEffect(on(() => [props.value, props.options.length], () => requestAnimationFrame(lay)));
  onMount(() => {
    // A column fills its row, so the column never reports the room growing; the window's resize does.
    const resized = () => requestAnimationFrame(lay);
    addEventListener('resize', resized);
    onCleanup(() => removeEventListener('resize', resized));
    if (typeof ResizeObserver === 'undefined' || !root) return;
    // One frame later, so the size change the column causes isn't reported back within the same delivery.
    const ro = new ResizeObserver(resized);
    ro.observe(root);
    onCleanup(() => ro.disconnect());
  });

  const pick = (o: SegOption) => {
    if (props.disabled || o.disabled || o.value === props.value) return;
    props.onChange?.(o.value);
  };
  const onKey = (e: KeyboardEvent) => {
    const opts = props.options.filter((o) => !o.disabled);
    const i = opts.findIndex((o) => o.value === props.value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || props.disabled || !opts.length) return;
    e.preventDefault();
    const next = opts[(Math.max(i, 0) + step + opts.length) % opts.length];
    pick(next);
    requestAnimationFrame(() => root?.querySelector<HTMLButtonElement>(`button[data-v="${CSS.escape(next.value)}"]`)?.focus());
  };

  return (
    <div
      ref={root}
      id={props.id}
      class={`seg${props.class ? ` ${props.class}` : ''}`}
      classList={{ 'seg--disabled': props.disabled }}
      role="radiogroup"
      aria-label={props.label ?? props.name}
      aria-disabled={props.disabled || undefined}
      onKeyDown={onKey}
    >
      <span class="seg__fill" ref={fill} aria-hidden="true" />
      {/* By place, not by object: a poll returns the same options as new objects, and new buttons would drop
          the focus and the pointer's hover. */}
      <Index each={props.options}>
        {(o, i) => {
          const checked = () => o().value === props.value;
          const first = () => !props.options.some((x) => x.value === props.value) && props.options.findIndex((x) => !x.disabled) === i;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={checked()}
              tabIndex={checked() || first() ? 0 : -1}
              disabled={props.disabled || o().disabled}
              data-v={o().value}
              onClick={() => pick(o())}
            >
              {o().label}
            </button>
          );
        }}
      </Index>
    </div>
  );
}
