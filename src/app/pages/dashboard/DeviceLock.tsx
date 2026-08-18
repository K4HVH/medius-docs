// Weigh what the real device drives while the control link still drives it too.
//
// The picker covers the whole lock address space. It used to offer eight fixed mouse targets, which
// left keys, media usages, and the whole-class blanket unreachable from here even though the active
// list below could already render them when another client set them.
//
// Blocking and passing are the two ends of one scale. The buttons are shortcuts to those two named
// constants, which the slider's own range reaches as well. The two bearing-relative directions mean
// nothing without a bearing, so they are offered on axes alone.

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

// An axis locks by sign; a button or key locks by edge. One direction byte, two vocabularies, plus
// the two that name a sign relative to the bearing rather than a fixed one. Media is the one class
// with no edges at all: the box suppresses the usage whole and reports it as Both, so naming a
// direction here would read as a distinction the box does not make.
const dirName = (cls: number, d: Direction): string => {
  if (cls === LockClass.Media) return '';
  if (d === Direction.With) return 'with injection';
  if (d === Direction.Against) return 'against injection';
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

  // An every-axis lock goes out as one frame per axis rather than the class wildcard. The box has no
  // blanket representation for the mouse classes: it expands one into per-target scales and reads it
  // back as three entries either way. Firmware that predates the axis blanket drops the wildcard on
  // arrival, so the three frames are both equivalent and the only form that works everywhere.
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
  // target weighed several ways shows up several times. A blanket key lock arrives as one entry per
  // blocked edge, which reads out here as "all keys press" rather than one both-edge chip.
  const active = createMemo(() =>
    (locks()?.entries ?? ([] as LockEntry[])).map((e) => {
      const dn = dirName(e.cls, e.direction);
      const head = dn ? `${targetName(e.cls, e.id)} ${dn}` : targetName(e.cls, e.id);
      return {
        key: `${e.cls}:${e.id}:${e.direction}`,
        text: e.scale === LOCK_SCALE_BLOCK ? head : `${head} at ${e.scale}%`,
        blocked: e.scale === LOCK_SCALE_BLOCK,
      };
    }),
  );

  const isAxis = () => target().cls === LockClass.Axis;
  const isMedia = () => target().cls === LockClass.Media;

  // Picking a class can strand the selected direction on an option the new class does not offer, and
  // a radio with no matching option keeps sending the old byte. Fall back to Both, which every class
  // takes.
  const chooseTarget = (v: UsageValue) => {
    setTarget(v);
    if (v.cls === LockClass.Media || (v.cls !== LockClass.Axis && isRelativeDirection(dir()))) {
      setDirection(String(Direction.Both));
    }
  };

  const dirLabel = () =>
    isAxis()
      ? [
          { value: String(Direction.Both), label: 'Both' },
          { value: String(Direction.Positive), label: 'Positive' },
          { value: String(Direction.Negative), label: 'Negative' },
          { value: String(Direction.With), label: 'With injection' },
          { value: String(Direction.Against), label: 'Against injection' },
        ]
      : isMedia()
        ? [{ value: String(Direction.Both), label: 'The whole usage' }]
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
          A weighed input keeps that percent of what the real device sends, and above 100 amplifies
          it. Injection still drives
          it either way. Everything here clears on its own if the dashboard disconnects.
        </p>

        <UsagePicker
          name="lock-target"
          classes={CLASSES}
          value={target()}
          onChange={chooseTarget}
          usageLabel="Which input"
        />

        <Show when={!isAxis()}>
          <p>A button, key, or media usage carries one bit, so Lock and Unlock are all it has.</p>
        </Show>

        <Show when={isMedia()}>
          <p>A media usage has no press and release edges. The box suppresses it whole.</p>
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

        <Show when={isAxis() && dir() === Direction.Both}>
          <div class="callout callout--info" style={section}>
            Both writes the percentage to the two fixed signs and a full pass to with and against, so
            it means the same whether or not the box is injecting. A Both at 100% still clears all
            four.
          </div>
        </Show>

        <Show when={isAxis() && isRelativeDirection(dir())}>
          <div class="callout callout--info" style={section}>
            With and against are measured against the bearing: the sign the box is currently
            injecting on that axis. Neither applies once the bearing window elapses with nothing
            injected, leaving only the fixed-sign scale.
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
