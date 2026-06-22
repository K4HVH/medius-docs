import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Combobox } from '../../../components/inputs/Combobox';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { LockDirection, LockTarget, lockSet } from '../../../dashboard/protocol';
import { useDashboard } from './context';

const TARGETS: { value: string; label: string; target: LockTarget }[] = [
  { value: 'x', label: 'Move left/right (X)', target: LockTarget.X },
  { value: 'y', label: 'Move up/down (Y)', target: LockTarget.Y },
  { value: 'wheel', label: 'Scroll wheel', target: LockTarget.Wheel },
  { value: 'left', label: 'Left button', target: LockTarget.Left },
  { value: 'right', label: 'Right button', target: LockTarget.Right },
  { value: 'middle', label: 'Middle button', target: LockTarget.Middle },
  { value: 'side1', label: 'Side button 1', target: LockTarget.Side1 },
  { value: 'side2', label: 'Side button 2', target: LockTarget.Side2 },
];

const DIRECTIONS: Record<string, LockDirection> = {
  both: LockDirection.Both,
  positive: LockDirection.Positive,
  negative: LockDirection.Negative,
};

const dirLabel = (d: LockDirection): string =>
  d === LockDirection.Positive ? '+' : d === LockDirection.Negative ? '−' : '';

// Buttons lock by edge (press/release); axes and the wheel lock by sign (+/−).
const dirChipLabel = (t: LockTarget, d: LockDirection): string =>
  t >= LockTarget.Left
    ? d === LockDirection.Positive ? 'press' : 'release'
    : dirLabel(d);

const targetName = (t: LockTarget): string =>
  TARGETS.find((o) => o.target === t)?.label ?? `target ${t}`;

const label = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.8rem)',
  'margin-bottom': '4px',
} as const;

const DeviceLock = () => {
  const dash = useDashboard();
  const [target, setTarget] = createSignal('x');
  const [direction, setDirection] = createSignal('both');
  const [mask, setMask] = createSignal(0);

  const targetEnum = () => TARGETS.find((o) => o.value === target())?.target ?? LockTarget.X;
  const dirEnum = () => DIRECTIONS[direction()];

  const refresh = async () => {
    try {
      const locks = await dash.link()?.queryLocks();
      if (locks) setMask(locks.mask);
    } catch {
      // A transient miss is fine; the next refresh tries again.
    }
  };

  const lock = async () => {
    await dash.link()?.lock(targetEnum(), dirEnum());
    await refresh();
  };

  const unlock = async () => {
    await dash.link()?.unlock(targetEnum(), dirEnum());
    await refresh();
  };

  // List every locked target+direction in the current mask.
  const active = () => {
    const out: string[] = [];
    const m = { mask: mask() };
    for (const { target: t } of TARGETS) {
      for (const d of [LockDirection.Positive, LockDirection.Negative]) {
        if (lockSet(m, t, d)) out.push(`${targetName(t)} ${dirChipLabel(t, d)}`.trim());
      }
    }
    return out;
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    void refresh();
    timer = setInterval(() => void refresh(), 1000);
  });
  onCleanup(() => {
    if (timer !== null) clearInterval(timer);
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input locks" subtitle="Block the physical mouse from one input" />
        <p>
          Lock an input and the real mouse can't drive it, while you still can over the control link.
          Locks clear on their own if the dashboard disconnects.
        </p>
        <div style={label}>Which input</div>
        <Combobox
          value={target()}
          onChange={(v) => setTarget(Array.isArray(v) ? v[0] : v)}
          options={TARGETS.map(({ value, label: l }) => ({ value, label: l }))}
        />
        <div style={{ margin: 'var(--g-spacing) 0' }}>
          <div style={label}>Direction</div>
          <RadioGroup
            name="lock-direction"
            value={direction()}
            onChange={setDirection}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'positive', label: 'Positive / press' },
              { value: 'negative', label: 'Negative / release' },
            ]}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
          <Button variant="primary" onClick={() => void lock()}>Lock</Button>
          <Button variant="secondary" onClick={() => void unlock()}>Unlock</Button>
        </div>
        <div style={{ 'margin-top': 'var(--g-spacing)' }}>
          <div style={label}>Active locks</div>
          <Show when={active().length > 0} fallback={<p>Nothing locked.</p>}>
            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' }}>
              <For each={active()}>{(item) => <Chip variant="warning">{item}</Chip>}</For>
            </div>
          </Show>
        </div>
      </Card>
    </Show>
  );
};

export default DeviceLock;
