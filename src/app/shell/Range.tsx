import { Show } from 'solid-js';

// A slider on a hairline: the fill runs from zero (or the low end) to a square handle, and the value
// reads beside it. A native range input under the drawing takes the pointer and the arrow keys.
export function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  zero?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const at = (v: number) => (props.max > props.min ? (Math.min(props.max, Math.max(props.min, v)) - props.min) / (props.max - props.min) : 0);
  const p = () => at(props.value);
  const z = () => at(props.zero ?? props.min);
  const text = () => (props.format ? props.format(props.value) : String(props.value));
  return (
    <div class="sl" classList={{ dis: props.disabled }}>
      <div class="sl-t" style={{ '--p': p() }}>
        <Show when={props.zero !== undefined}>
          <i class="sl-z" style={{ '--z': z() }} />
        </Show>
        <i class="sl-fill" style={{ '--a': Math.min(p(), z()), '--w': Math.abs(p() - z()) }} />
        <b class="sl-h" />
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value}
          disabled={props.disabled}
          aria-label={props.label}
          aria-valuetext={text()}
          onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        />
      </div>
      <output>{text()}</output>
    </div>
  );
}
