import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

let uid = 0;

// A dropdown: the button shows the value, the list opens under it with the current one marked, and a
// long list takes a filter. Arrows move, Enter picks, Escape or leaving the control closes it. A caller
// that filters for itself (hex ids, a cap on the list) passes `query` and `onQuery`, and a `footer` to
// say what the cap left out.
export function Select(props: {
  value?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  filter?: string;
  query?: string;
  onQuery?: (q: string) => void;
  footer?: string;
  id?: string;
  label?: string;
  class?: string;
}) {
  const id = props.id ?? `sel-${++uid}`;
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [kb, setKb] = createSignal(-1);
  let root: HTMLDivElement | undefined;
  let button: HTMLButtonElement | undefined;
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;

  const current = () => props.options.find((o) => o.value === props.value);
  const q = () => (props.onQuery ? props.query ?? '' : query());
  const shown = createMemo(() => {
    if (props.onQuery) return props.options;
    const f = query().trim().toLowerCase();
    return props.options.filter((o) => !f || o.label.toLowerCase().includes(f) || o.value.toLowerCase().includes(f));
  });

  const close = (refocus = false) => {
    setOpen(false);
    if (props.onQuery) props.onQuery('');
    else setQuery('');
    setKb(-1);
    if (refocus) button?.focus();
  };
  const show = () => {
    if (props.disabled) return;
    setOpen(true);
    setKb(Math.max(0, shown().findIndex((o) => o.value === props.value)));
    queueMicrotask(() => (input ?? list)?.focus());
  };
  const pick = (o: SelectOption) => {
    if (props.disabled || o.disabled) return;
    if (o.value !== props.value) props.onChange?.(o.value);
    close(true);
  };
  createEffect(() => {
    if (props.disabled && open()) close();
  });
  const move = (step: number) => {
    const opts = shown();
    if (!opts.length) return;
    let i = kb();
    for (let n = 0; n < opts.length; n++) {
      i = (i + step + opts.length) % opts.length;
      if (!opts[i].disabled) break;
    }
    setKb(i);
    list?.querySelectorAll<HTMLElement>('[role="option"]')[i]?.scrollIntoView?.({ block: 'nearest' });
  };
  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = shown()[kb()]; if (o) pick(o); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  };
  const onFocusOut = (e: FocusEvent) => {
    if (open() && !root?.contains(e.relatedTarget as Node | null)) close();
  };
  const onDoc = (e: PointerEvent) => {
    if (open() && !root?.contains(e.target as Node)) close();
  };
  document.addEventListener('pointerdown', onDoc);
  onCleanup(() => document.removeEventListener('pointerdown', onDoc));

  return (
    <div ref={root} class={`dd${props.class ? ` ${props.class}` : ''}`} classList={{ open: open(), 'dd--disabled': props.disabled }} onFocusOut={onFocusOut}>
      <button
        ref={button}
        type="button"
        class="dd-b"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={`${id}-list`}
        aria-label={props.label}
        disabled={props.disabled}
        onClick={() => (open() ? close() : show())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !open()) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{current()?.label ?? props.placeholder ?? 'Select...'}</span>
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
      <Show when={open()}>
        <div class="dd-l" id={`${id}-list`} role="listbox" ref={list} tabIndex={-1} onKeyDown={onListKey}>
          <Show when={props.filter}>
            <input
              ref={input}
              class="dd-f"
              placeholder={props.filter}
              aria-label={props.filter}
              value={q()}
              onInput={(e) => {
                if (props.onQuery) props.onQuery(e.currentTarget.value);
                else setQuery(e.currentTarget.value);
                setKb(shown().findIndex((o) => !o.disabled));
              }}
            />
          </Show>
          <For each={shown()} fallback={<p class="dd-none">No matches.</p>}>
            {(o, i) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={o.value === props.value}
                disabled={o.disabled}
                classList={{ kb: kb() === i() }}
                onPointerMove={() => setKb(i())}
                onClick={() => pick(o)}
              >
                {o.label}
              </button>
            )}
          </For>
          <Show when={props.footer}>
            <p class="dd-none">{props.footer}</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
