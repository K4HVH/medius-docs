// Pick any input the box can address: a class, then a usage inside it.
//
// Shared by injection, locks, and clip triggers because all three address inputs the same way, and
// because a fixed shortlist of buttons was the old limit that made most of the box unreachable. The
// keyboard page alone is over a hundred usages, which is more than a plain dropdown can carry, so
// the list is filtered by a text box; the filter matches the hex id too, which is how an unnamed
// Consumer usage gets picked.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { Chip } from '../../../components/display/Chip';
import { Combobox } from '../../../components/inputs/Combobox';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import type { NamedUsage } from '../../../dashboard/protocol';
import { chips, label, muted, section } from './ui';

export interface PickerClass {
  value: number;
  label: string;
  table: NamedUsage[];
  // The id sentinel that addresses every usage in the class, when the class has one.
  blanket?: number;
  blanketLabel?: string;
  // Axis names already read as names, so the hex id after them is noise rather than the
  // disambiguation it is for a keycode.
  hideId?: boolean;
}

export interface UsageValue {
  cls: number;
  id: number;
}

const MAX_OPTIONS = 60;

export const UsagePicker = (props: {
  classes: PickerClass[];
  value: UsageValue;
  onChange: (v: UsageValue) => void;
  name: string;
  classLabel?: string;
  usageLabel?: string;
}) => {
  const [filter, setFilter] = createSignal('');

  const current = (): PickerClass =>
    props.classes.find((c) => c.value === props.value.cls) ?? props.classes[0];

  const options = createMemo(() => {
    const c = current();
    const q = filter().trim().toLowerCase();
    const out: { value: string; label: string }[] = [];
    if (c.blanket !== undefined) {
      out.push({ value: String(c.blanket), label: c.blanketLabel ?? `Every ${c.label.toLowerCase()}` });
    }
    for (const u of c.table) {
      const hex = `0x${u.id.toString(16)}`;
      if (q && !u.name.toLowerCase().includes(q) && !hex.includes(q) && String(u.id) !== q) continue;
      out.push({ value: String(u.id), label: c.hideId ? u.name : `${u.name}  (${hex})` });
    }
    return out;
  });

  // Long tables are cut rather than rendered whole, and the cut is stated: a silently truncated
  // list reads as "the box cannot address the rest". The current selection is always carried, or
  // filtering past it would blank the control while the caller still held that value.
  const shown = createMemo(() => {
    const all = options();
    const head = all.slice(0, MAX_OPTIONS);
    const selected = String(props.value.id);
    if (head.some((o) => o.value === selected)) return head;
    const keep = all.find((o) => o.value === selected);
    return keep ? [keep, ...head.slice(0, MAX_OPTIONS - 1)] : head;
  });
  const cut = createMemo(() => Math.max(0, options().length - shown().length));

  // Land on the first real usage, never on the class wildcard. Defaulting to the blanket made
  // picking a class an instruction to act on all of it, which is both a surprising default and,
  // for a class whose blanket the box does not implement, one that silently does nothing.
  const pickClass = (v: string) => {
    const c = props.classes.find((x) => String(x.value) === v);
    if (!c) return;
    setFilter('');
    props.onChange({ cls: c.value, id: c.table[0]?.id ?? c.blanket ?? 0 });
  };

  return (
    <>
      <Show when={props.classes.length > 1}>
        <div style={label}>{props.classLabel ?? 'Class'}</div>
        <RadioGroup
          name={props.name}
          value={String(props.value.cls)}
          onChange={pickClass}
          options={props.classes.map((c) => ({ value: String(c.value), label: c.label }))}
        />
      </Show>
      <div style={section}>
        <div style={label}>{props.usageLabel ?? 'Which input'}</div>
        <div style={{ 'max-width': '20rem', 'margin-bottom': 'var(--g-spacing-sm)' }}>
          <TextField
            value={filter()}
            placeholder="Filter by name or id"
            onChange={setFilter}
            clearable
            size="compact"
          />
        </div>
        <Show
          when={shown().length > 0}
          fallback={<p style={muted}>Nothing matches that.</p>}
        >
          <Combobox
            value={String(props.value.id)}
            onChange={(v) => props.onChange({ cls: props.value.cls, id: Number(Array.isArray(v) ? v[0] : v) })}
            options={shown()}
          />
        </Show>
        <Show when={cut() > 0}>
          <p style={{ ...muted, 'margin-top': '4px' }}>
            {cut()} more {cut() === 1 ? 'match' : 'matches'}. Narrow the filter to reach{' '}
            {cut() === 1 ? 'it' : 'them'}.
          </p>
        </Show>
      </div>
    </>
  );
};

// A set of addressed inputs as chips, each removable. Used wherever a card shows what it holds.
export const UsageChips = (props: {
  items: { key: string; text: string }[];
  onRemove?: (key: string) => void;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}) => (
  <div style={chips}>
    <For each={props.items}>
      {(it) => (
        <Chip
          variant={props.variant ?? 'neutral'}
          onRemove={props.onRemove ? () => props.onRemove?.(it.key) : undefined}
        >
          {it.text}
        </Chip>
      )}
    </For>
  </div>
);
