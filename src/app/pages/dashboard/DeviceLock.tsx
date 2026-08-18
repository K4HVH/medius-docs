// Weigh what the real device drives while the control link still drives it too.
//
// The picker covers the whole lock address space. It used to offer eight fixed mouse targets, which
// left keys, media usages, and the whole-class blanket unreachable from here even though the active
// list below could already render them when another client set them.
//
// Blocking and passing are the two ends of one scale, so the buttons below are the ends and the slider
// is everything between. The two bearing-relative directions only mean anything while the box is
// injecting, so they are offered on axes alone.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { Slider } from '../../../components/inputs/Slider';
import {
  type LockEntry,
  type NamedUsage,
  BUTTONS,
  Direction,
  KEYS,
  LOCK_ID_ALL,
  LOCK_SCALE_BLOCK,
  LOCK_SCALE_MAX,
  LOCK_SCALE_PASS,
  LockAxis,
  LockClass,
  MEDIA,
  isRelativeDirection,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { UsagePicker, type PickerClass, type UsageValue } from './UsagePicker';
import { chips, label, row, section } from './ui';

const AXES: NamedUsage[] = [
  { id: LockAxis.X, name: 'Move left/right (X)', group: 'Axes' },
  { id: LockAxis.Y, name: 'Move up/down (Y)', group: 'Axes' },
  { id: LockAxis.Wheel, name: 'Scroll wheel', group: 'Axes' },
];

const CLASSES: PickerClass[] = [
  { value: LockClass.Axis, label: 'Axis', table: AXES, blanket: LOCK_ID_ALL, blanketLabel: 'Every axis', hideId: true },
  { value: LockClass.Button, label: 'Button', table: BUTTONS, blanket: LOCK_ID_ALL, blanketLabel: 'Every button' },
  { value: LockClass.Key, label: 'Key', table: KEYS, blanket: LOCK_ID_ALL, blanketLabel: 'Every key' },
  { value: LockClass.Media, label: 'Media', table: MEDIA, blanket: LOCK_ID_ALL, blanketLabel: 'Every media key' },
];

const BLANKET_NAMES: Record<number, string> = {
  [LockClass.Button]: 'buttons',
  [LockClass.Key]: 'keys',
  [LockClass.Media]: 'media keys',
  [LockClass.Axis]: 'axes',
};

// An axis locks by sign; a momentary usage locks by edge. One direction byte, two vocabularies, plus
// the two that name a sign relative to the bearing rather than a fixed one.
const dirName = (cls: number, d: Direction): string => {
  if (d === Direction.With) return 'with the aim';
  if (d === Direction.Against) return 'against the aim';
  if (d === Direction.Both) return 'both';
  if (cls === LockClass.Axis) return d === Direction.Positive ? 'positive' : 'negative';
  return d === Direction.Positive ? 'press' : 'release';
};

const targetName = (cls: number, id: number): string => {
  if (id === LOCK_ID_ALL) return `all ${BLANKET_NAMES[cls] ?? 'inputs'}`;
  if (cls === LockClass.Axis) return AXES.find((a) => a.id === id)?.name ?? `axis ${id}`;
  return usageName(cls, id);
};

const DeviceLock = () => {
  const dash = useDashboard();
  const [target, setTarget] = createSignal<UsageValue>({ cls: LockClass.Axis, id: LockAxis.X });
  const [direction, setDirection] = createSignal(String(Direction.Both));
  const [scale, setScale] = createSignal(LOCK_SCALE_PASS);
  const locks = dash.poll('locks');
  const cmd = createCommand(() => dash.refreshPoll('locks'));

  const dir = (): Direction => Number(direction()) as Direction;

  // An every-axis lock goes out as one frame per axis rather than the class wildcard. Firmware up
  // to and including the current release only accepts axis ids 0 to 2, so the wildcard is carried
  // over the wire and then dropped, and the box has no blanket representation anyway: it expands
  // one into per-axis bits and reads it back as three entries. Sending the three is identical on a
  // box that implements it and the only thing that works on one that does not.
  const targets = (): { cls: LockClass; id: number }[] => {
    const t = target();
    if (t.cls === LockClass.Axis && t.id === LOCK_ID_ALL) {
      return AXES.map((a) => ({ cls: LockClass.Axis, id: a.id }));
    }
    return [{ cls: t.cls as LockClass, id: t.id }];
  };

  const applyScale = (scale: number) =>
    cmd.run(async () => {
      const link = dash.link()!;
      for (const t of targets()) {
        await link.scale(t, dir(), scale);
      }
    });

  // Every weighed (target, direction) the box reports, whoever set it. One entry per direction, so a
  // target weighed several ways shows up several times.
  const active = createMemo(() =>
    (locks()?.entries ?? ([] as LockEntry[])).map((e) => ({
      key: `${e.cls}:${e.id}:${e.direction}`,
      text:
        e.scale === LOCK_SCALE_BLOCK
          ? `${targetName(e.cls, e.id)} ${dirName(e.cls, e.direction)}`
          : `${targetName(e.cls, e.id)} ${dirName(e.cls, e.direction)} at ${e.scale}%`,
      blocked: e.scale === LOCK_SCALE_BLOCK,
    })),
  );

  const isAxis = () => target().cls === LockClass.Axis;

  const dirLabel = () =>
    isAxis()
      ? [
          { value: String(Direction.Both), label: 'Both' },
          { value: String(Direction.Positive), label: 'Positive' },
          { value: String(Direction.Negative), label: 'Negative' },
          { value: String(Direction.With), label: 'With the aim' },
          { value: String(Direction.Against), label: 'Against the aim' },
        ]
      : [
          { value: String(Direction.Both), label: 'Both' },
          { value: String(Direction.Positive), label: 'Press' },
          { value: String(Direction.Negative), label: 'Release' },
        ];

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input locks" subtitle="Weigh what the real device drives" />
        <p>
          A weighed input keeps only that percent of what the real device sends. Injection still drives
          it either way. Everything here clears on its own if the dashboard disconnects.
        </p>

        <UsagePicker
          name="lock-target"
          classes={CLASSES}
          value={target()}
          onChange={setTarget}
          usageLabel="Which input"
        />

        <Show when={!isAxis()}>
          <p>A button, key, or media usage carries one bit, so Lock and Unlock are all it has.</p>
        </Show>

        <div style={section}>
          <div style={label}>Direction</div>
          <RadioGroup
            name="lock-direction"
            value={direction()}
            onChange={setDirection}
            options={dirLabel()}
          />
        </div>

        <Show when={isAxis()}>
          <div style={section}>
            <div style={label}>Keep {scale()}% of the real movement</div>
            <Slider
              value={scale()}
              min={LOCK_SCALE_BLOCK}
              max={LOCK_SCALE_MAX}
              step={5}
              onChange={(v) => setScale(Array.isArray(v) ? v[0] : v)}
            />
            <p>0% blocks it, 100% passes it through untouched, and above that amplifies it.</p>
          </div>
        </Show>

        <Show when={isAxis() && isRelativeDirection(dir())}>
          <div class="callout callout--info" style={section}>
            With and against are measured against the aim, the direction the box is injecting. Neither
            does anything while the box is injecting nothing, which is what hands the axis back to the
            user when injection stops.
          </div>
        </Show>

        <div style={{ ...section, ...row }}>
          <Show when={isAxis()}>
            <Button variant="primary" disabled={cmd.busy()} onClick={() => applyScale(scale())}>
              Apply {scale()}%
            </Button>
          </Show>
          <Button
            variant={isAxis() ? 'secondary' : 'primary'}
            disabled={cmd.busy()}
            onClick={() => applyScale(LOCK_SCALE_BLOCK)}
          >
            Lock
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={() => applyScale(LOCK_SCALE_PASS)}>
            Unlock
          </Button>
        </div>
        <Show when={cmd.error()}>
          <div class="callout callout--danger" role="alert" style={section}>
            {cmd.error()}
          </div>
        </Show>

        <div style={section}>
          <div style={label}>Active</div>
          <Show when={active().length > 0} fallback={<p>Everything passing untouched.</p>}>
            <div style={chips}>
              <For each={active()}>
                {(item) => <Chip variant={item.blocked ? 'warning' : 'info'}>{item.text}</Chip>}
              </For>
            </div>
          </Show>
        </div>
      </Card>
    </Show>
  );
};

export default DeviceLock;
