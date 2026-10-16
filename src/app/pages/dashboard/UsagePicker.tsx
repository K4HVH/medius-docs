// A class, then a usage in it. The filter also matches the hex id, so an unnamed Consumer usage can be
// picked.

import { Index, Show, createMemo, createSignal } from 'solid-js';
import { Chip } from '../../../components/display/Chip';
import type { NamedUsage } from '../../../dashboard/protocol';
import { Segmented } from '../../shell/Segmented';
import { Select } from '../../shell/Select';

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
    // The wildcard leads the list unless the filter excludes it.
    const blanket = c.blanketLabel ?? `Every ${c.label.toLowerCase()}`;
    if (c.blanket !== undefined && (!q || blanket.toLowerCase().includes(q))) out.push({ value: String(c.blanket), label: blanket });
    for (const u of c.table) {
      const hex = `0x${u.id.toString(16)}`;
      if (q && !u.name.toLowerCase().includes(q) && !hex.includes(q) && String(u.id) !== q) continue;
      out.push({ value: String(u.id), label: c.hideId ? u.name : `${u.name}  (${hex})` });
    }
    return out;
  });

  // The footer counts what the cut hides, or the hidden usages would look unpickable. A selected option
  // past the cut stays as the last entry, so Enter still takes the first match.
  const shown = createMemo(() => {
    const all = options();
    const head = all.slice(0, MAX_OPTIONS);
    const selected = String(props.value.id);
    if (head.some((o) => o.value === selected)) return head;
    const keep = all.find((o) => o.value === selected);
    return keep ? [...head.slice(0, MAX_OPTIONS - 1), keep] : head;
  });
  const cut = createMemo(() => Math.max(0, options().length - shown().length));

  // A new class starts on its first usage, never the wildcard: the box drops, with no error, a blanket it
  // doesn't implement.
  const pickClass = (v: string) => {
    const c = props.classes.find((x) => String(x.value) === v);
    if (!c) return;
    setFilter('');
    props.onChange({ cls: c.value, id: c.table[0]?.id ?? c.blanket ?? 0 });
  };

  return (
    <>
      <Show when={props.classes.length > 1}>
        <div class="labelled">
          <span class="field-l">{props.classLabel ?? 'Class'}</span>
          <Segmented
            name={props.name}
            label={props.classLabel ?? 'Class'}
            value={String(props.value.cls)}
            onChange={pickClass}
            options={props.classes.map((c) => ({ value: String(c.value), label: c.label }))}
          />
        </div>
      </Show>
      <div class="labelled">
        <span class="field-l">{props.usageLabel ?? 'Input'}</span>
        <Select
          value={String(props.value.id)}
          options={shown()}
          onChange={(v) => props.onChange({ cls: props.value.cls, id: Number(v) })}
          filter="Filter by name or id"
          query={filter()}
          onQuery={setFilter}
          footer={cut() > 0 ? `${cut()} more ${cut() === 1 ? 'match' : 'matches'}. Narrow the filter.` : undefined}
          label={props.usageLabel ?? 'Input'}
        />
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
  <div class="chips">
    <Index each={props.items}>
      {(it) => (
        <Chip
          variant={props.variant ?? 'neutral'}
          onRemove={props.onRemove ? () => props.onRemove?.(it().key) : undefined}
        >
          {it().text}
        </Chip>
      )}
    </Index>
  </div>
);
