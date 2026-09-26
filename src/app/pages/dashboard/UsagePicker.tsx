// A class, then a usage in it. The filter matches the hex id too, which is how an unnamed Consumer
// usage gets picked.

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
  // Id sentinel addressing every usage in the class.
  blanket?: number;
  blanketLabel?: string;
  // Axis names need no hex id after them.
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

  // The cut is counted, or a truncated list reads as unaddressable. The selection is always kept, or
  // filtering past it blanks the control.
  const shown = createMemo(() => {
    const all = options();
    const head = all.slice(0, MAX_OPTIONS);
    const selected = String(props.value.id);
    if (head.some((o) => o.value === selected)) return head;
    const keep = all.find((o) => o.value === selected);
    return keep ? [keep, ...head.slice(0, MAX_OPTIONS - 1)] : head;
  });
  const cut = createMemo(() => Math.max(0, options().length - shown().length));

  // First usage, never the wildcard: the box drops a blanket it doesn't implement with no reply.
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
        <div style={label}>{props.usageLabel ?? 'Input'}</div>
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
          fallback={<p style={muted}>No matches.</p>}
        >
          <Combobox
            value={String(props.value.id)}
            onChange={(v) => props.onChange({ cls: props.value.cls, id: Number(Array.isArray(v) ? v[0] : v) })}
            options={shown()}
          />
        </Show>
        <Show when={cut() > 0}>
          <p style={{ ...muted, 'margin-top': '4px' }}>
            {cut()} more {cut() === 1 ? 'match' : 'matches'}. Narrow the filter.
          </p>
        </Show>
      </div>
    </>
  );
};

// Removable chips for the inputs a card holds.
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
