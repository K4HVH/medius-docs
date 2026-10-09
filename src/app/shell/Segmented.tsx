import { createEffect, For, on, onCleanup, onMount } from 'solid-js';

export interface SegOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// One choice from a few, side by side; the fill slides to the one picked. A radio group to assistive
// technology: one tab stop, arrows move the choice.
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

  const place = () => {
    const b = root?.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
    if (!fill || !root?.offsetParent) return;
    if (!b) {
      fill.style.height = '0';
      return;
    }
    if (!placed) fill.style.transition = 'none';
    fill.style.left = `${b.offsetLeft}px`;
    fill.style.top = `${b.offsetTop}px`;
    fill.style.width = `${b.offsetWidth}px`;
    fill.style.height = `${b.offsetHeight}px`;
    if (!placed) {
      void fill.offsetWidth;
      fill.style.transition = '';
      placed = true;
    }
  };
  createEffect(on(() => [props.value, props.options.length], () => requestAnimationFrame(place)));
  onMount(() => {
    if (typeof ResizeObserver === 'undefined' || !root) return;
    const ro = new ResizeObserver(() => place());
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
      <For each={props.options}>
        {(o) => {
          const checked = () => o.value === props.value;
          const first = () => !props.options.some((x) => x.value === props.value) && props.options.find((x) => !x.disabled) === o;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={checked()}
              tabIndex={checked() || first() ? 0 : -1}
              disabled={props.disabled || o.disabled}
              data-v={o.value}
              onClick={() => pick(o)}
            >
              {o.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}
