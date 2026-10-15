import { createEffect, createMemo, createSignal, Index, onCleanup, Show } from 'solid-js';

export interface SelectOption {
  value: string;
  label: string;
  // Shown after the label in brackets, such as a box's name; never searched.
  note?: string;
  disabled?: boolean;
}

const shownLabel = (o: SelectOption) => (o.note ? <>{o.label}<span data-search-skip> ({o.note})</span></> : o.label);

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
  let panel: HTMLDivElement | undefined;
  const [up, setUp] = createSignal(false);
  const [room, setRoom] = createSignal<number | null>(null);

  const current = () => props.options.find((o) => o.value === props.value);
  const q = () => (props.onQuery ? props.query ?? '' : query());
  const shown = createMemo(() => {
    if (props.onQuery) return props.options;
    const f = query().trim().toLowerCase();
    return props.options.filter(
      (o) => !f || o.label.toLowerCase().includes(f) || o.value.toLowerCase().includes(f) || !!o.note?.toLowerCase().includes(f),
    );
  });

  const close = (refocus = false) => {
    setOpen(false);
    if (props.onQuery) props.onQuery('');
    else setQuery('');
    setKb(-1);
    if (refocus) button?.focus();
  };
  // The list opens under the button, or over it when it doesn't fit below and does fit between the button and
  // the bars stuck over the top of the page; fitting neither, it takes the roomier side and scrolls within it.
  // Focusing it never scrolls the page from under the pointer.
  const show = () => {
    if (props.disabled) return;
    setUp(false);
    setRoom(null);
    setOpen(true);
    setKb(Math.max(0, shown().findIndex((o) => o.value === props.value)));
    queueMicrotask(() => {
      const r = root?.getBoundingClientRect();
      const need = panel?.offsetHeight ?? 0;
      if (r) {
        const bars = [...document.querySelectorAll('.nav, .docbar, .ptabs')].map((e) => e.getBoundingClientRect().bottom);
        const below = innerHeight - r.bottom - 8;
        const above = r.top - Math.max(0, ...bars.filter((y) => y <= r.top)) - 8;
        if (need > below) {
          const upward = need <= above || above > below;
          setUp(upward);
          // Never under three options' height, however little room there is.
          if (need > (upward ? above : below)) setRoom(Math.max(120, upward ? above : below));
        }
      }
      (input ?? list)?.focus({ preventScroll: true });
    });
  };
  const pick = (o: SelectOption) => {
    if (props.disabled || o.disabled) return;
    if (o.value !== props.value) props.onChange?.(o.value);
    close(true);
  };
  createEffect(() => {
    if (props.disabled && open()) close();
  });
  const active = () => (kb() >= 0 && shown()[kb()] ? `${id}-o-${kb()}` : undefined);
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
    <div
      ref={root}
      class={`dd${props.class ? ` ${props.class}` : ''}`}
      classList={{ open: open(), 'dd--disabled': props.disabled, 'dd--long': !!props.filter }}
      onFocusOut={onFocusOut}
    >
      {/* The button reads as its field and the value picked: "Direction Both". */}
      <Show when={props.label}>
        <span id={`${id}-n`} hidden data-search-skip>
          {props.label}
        </span>
      </Show>
      <button
        ref={button}
        type="button"
        class="dd-b"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={`${id}-list`}
        aria-labelledby={props.label ? `${id}-n ${id}-v` : `${id}-v`}
        data-search-text={props.options.map((o) => o.label).join('\n')}
        disabled={props.disabled}
        onClick={() => (open() ? close() : show())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !open()) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span id={`${id}-v`} data-search-skip>
          {current() ? shownLabel(current()!) : (props.placeholder ?? 'Select...')}
        </span>
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
      {/* As wide as the longest option, so a pick never changes the width; a long list that filters is not. The
          labels are drawn by CSS, so they are no text to search, read out or find. */}
      <Show when={!props.filter}>
        <span class="dd-z" aria-hidden="true">
          <Index each={props.options}>{(o) => <span data-w={o().note ? `${o().label} (${o().note})` : o().label} />}</Index>
        </span>
      </Show>
      <Show when={open()}>
        {/* The filter is a combobox over the listbox, which holds the options alone; either one names the
            option the arrows are on, for a screen reader. */}
        <div
          ref={panel}
          class="dd-l"
          classList={{ up: up() }}
          style={room() !== null ? { 'max-height': `${room()}px` } : undefined}
          onKeyDown={onListKey}
        >
          <Show when={props.filter}>
            <input
              ref={input}
              class="dd-f"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={`${id}-list`}
              aria-activedescendant={active()}
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
          <div
            role="listbox"
            id={`${id}-list`}
            ref={list}
            tabIndex={-1}
            aria-label={props.label}
            aria-activedescendant={props.filter ? undefined : active()}
          >
            {/* By place, so a poll returning the same options as new objects keeps the one under the pointer. */}
            <Index each={shown()}>
              {(o, i) => (
                <button
                  type="button"
                  role="option"
                  id={`${id}-o-${i}`}
                  tabIndex={-1}
                  aria-selected={o().value === props.value}
                  disabled={o().disabled}
                  classList={{ kb: kb() === i }}
                  onPointerMove={() => setKb(i)}
                  onClick={() => pick(o())}
                >
                  {shownLabel(o())}
                </button>
              )}
            </Index>
          </div>
          <Show when={shown().length === 0}>
            <p class="dd-none">No matches.</p>
          </Show>
          <Show when={props.footer}>
            <p class="dd-none">{props.footer}</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
