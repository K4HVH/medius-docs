// Lock and Unlock are the ends of one signed scale; the sign inverts an axis. With, against and
// reversal are offered on axes only: one bit has no bearing and nothing to reverse.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Range } from '../../shell/Range';
import {
  type LockEntry,
  type NamedUsage,
  buttonsUpTo,
  Direction,
  KEYS,
  LOCK_ID_ALL,
  LOCK_SCALE_BLOCK,
  LOCK_SCALE_MAX,
  LOCK_SCALE_MIN,
  LOCK_SCALE_PASS,
  LockAxis,
  LockClass,
  MEDIA,
  isRelativeDirection,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { displayName } from './hex';
import { UsagePicker, type PickerClass, type UsageValue } from './UsagePicker';
import { Panel, Panels } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';

const AXES: NamedUsage[] = [
  { id: LockAxis.X, name: 'X (left/right)', group: 'Axes' },
  { id: LockAxis.Y, name: 'Y (up/down)', group: 'Axes' },
  { id: LockAxis.Wheel, name: 'Wheel', group: 'Axes' },
  { id: LockAxis.Pan, name: 'Pan (horizontal scroll)', group: 'Axes' },
];

const BLANKET_NAMES: Record<number, string> = {
  [LockClass.Button]: 'buttons',
  [LockClass.Key]: 'keys',
  [LockClass.Media]: 'media keys',
  [LockClass.Axis]: 'axes',
};

// An axis locks by sign, a button or key by edge. Both, and media (which the box suppresses whole and
// reports at Both), get no direction word.
const dirName = (cls: number, d: Direction): string => {
  if (cls === LockClass.Media || d === Direction.Both) return '';
  if (d === Direction.With) return 'with injection';
  if (d === Direction.Against) return 'against injection';
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

  // Every button the clone declares (RESP(CAPS) n_buttons).
  const caps = dash.poll('caps');
  const classes = (): PickerClass[] => [
    { value: LockClass.Axis, label: 'Axis', table: AXES, blanket: LOCK_ID_ALL, blanketLabel: 'Every axis', hideId: true },
    { value: LockClass.Button, label: 'Button', table: buttonsUpTo(caps()?.mouse?.nButtons ?? 0), blanket: LOCK_ID_ALL, blanketLabel: 'Every button' },
    { value: LockClass.Key, label: 'Key', table: KEYS, blanket: LOCK_ID_ALL, blanketLabel: 'Every key' },
    { value: LockClass.Media, label: 'Media', table: MEDIA, blanket: LOCK_ID_ALL, blanketLabel: 'Every media key' },
  ];

  const dir = (): Direction => Number(direction()) as Direction;

  // One frame per axis: the box expands a wildcard into the same per-axis entries anyway, and older
  // firmware drops the axis wildcard.
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

  // One chip per weighed (target, direction) the box reports, whoever set it; a blanket key lock
  // arrives as one entry per blocked edge.
  const active = createMemo(() =>
    (locks()?.entries ?? ([] as LockEntry[])).map((e) => {
      const dn = dirName(e.cls, e.direction);
      const head = displayName(dn ? `${targetName(e.cls, e.id)} ${dn}` : targetName(e.cls, e.id));
      return {
        key: `${e.cls}:${e.id}:${e.direction}`,
        text:
          e.scale === LOCK_SCALE_BLOCK
            ? `${head} blocked`
            : e.scale < 0
              ? `${head} reversed at ${-e.scale}%`
              : `${head} at ${e.scale}%`,
        blocked: e.scale === LOCK_SCALE_BLOCK,
      };
    }),
  );

  const isAxis = () => target().cls === LockClass.Axis;
  const isMedia = () => target().cls === LockClass.Media;

  // A new class can lack the selected direction, and an unmatched radio keeps sending the old byte,
  // so fall back to Both.
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
      <Panels>
        <Panel id="input-locks" title="Lock">
          <UsagePicker
            classes={classes()}
            name="lock-target"
            value={target()}
            onChange={chooseTarget}
            usageLabel="Input"
          />

          <div class="labelled">
            <span class="field-l">Direction</span>
            <Segmented
              name="lock-direction"
              label="Direction"
              value={direction()}
              onChange={setDirection}
              options={dirLabel()}
            />
          </div>

          <Show when={isAxis()}>
            <div class="labelled">
              <span class="field-l">Keep</span>
              <Range
                label="Keep"
                value={scale()}
                min={LOCK_SCALE_MIN}
                max={LOCK_SCALE_MAX}
                step={5}
                zero={0}
                format={(v) => `${v}%`}
                onChange={setScale}
              />
            </div>
            <p class="mut">
              {scale() < 0 ? `Reverse physical motion, keeping ${Math.abs(scale())}%` : `Keep ${scale()}% of physical motion`}
            </p>
          </Show>

          <Show when={isAxis() && isRelativeDirection(dir())}>
            <p class="mut">
              With and against follow the injected direction on that axis. See{' '}
              <A href="/native/commands/lock#bearing">the bearing</A>.
            </p>
          </Show>

          <div class="acts">
            <Show when={isAxis()}>
              <Button variant="primary" disabled={cmd.busy()} onClick={() => applyScale(scale())}>
                Apply <span data-search-skip>{scale()}%</span>
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
            <div class="callout callout--danger" role="alert">
              {cmd.error()}
            </div>
          </Show>
        </Panel>

        <Panel id="active-locks" title="Active">
          <Show when={active().length > 0} fallback={<p class="mut" data-search-skip>None.</p>}>
            <div class="chips">
              <For each={active()}>
                {(item) => <Chip variant={item.blocked ? 'warning' : 'info'}>{item.text}</Chip>}
              </For>
            </div>
          </Show>
        </Panel>
      </Panels>
    </Show>
  );
};

export default DeviceLock;
