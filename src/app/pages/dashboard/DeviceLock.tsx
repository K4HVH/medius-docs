// Block the real device from driving an input while the control link still can.
//
// The picker covers the whole lock address space. It used to offer eight fixed mouse targets, which
// left keys, media usages, and the whole-class blanket unreachable from here even though the active
// list below could already render them when another client set them.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type LockEntry,
  type NamedUsage,
  BUTTONS,
  Direction,
  KEYS,
  LOCK_ID_ALL,
  LockAxis,
  LockClass,
  MEDIA,
  Press,
  Release,
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

// An axis locks by sign; a momentary usage locks by edge. One direction byte, two vocabularies.
const dirName = (cls: number, d: Direction): string => {
  if (cls === LockClass.Axis) return d === Press ? 'positive' : 'negative';
  return d === Press ? 'press' : 'release';
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

  const apply = (on: boolean) =>
    cmd.run(async () => {
      const link = dash.link()!;
      for (const t of targets()) {
        await (on ? link.lock(t, dir()) : link.unlock(t, dir()));
      }
    });

  // Every locked (target, direction) pair the box reports, whoever set it.
  const active = createMemo(() => {
    const out: { key: string; text: string }[] = [];
    for (const e of locks()?.entries ?? ([] as LockEntry[])) {
      if (e.positive) {
        out.push({ key: `${e.cls}:${e.id}:1`, text: `${targetName(e.cls, e.id)} ${dirName(e.cls, Press)}` });
      }
      if (e.negative) {
        out.push({ key: `${e.cls}:${e.id}:2`, text: `${targetName(e.cls, e.id)} ${dirName(e.cls, Release)}` });
      }
    }
    return out;
  });

  const dirLabel = () =>
    target().cls === LockClass.Axis
      ? [
          { value: String(Direction.Both), label: 'Both' },
          { value: String(Direction.Positive), label: 'Positive' },
          { value: String(Direction.Negative), label: 'Negative' },
        ]
      : [
          { value: String(Direction.Both), label: 'Both' },
          { value: String(Direction.Positive), label: 'Press' },
          { value: String(Direction.Negative), label: 'Release' },
        ];

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Input locks" subtitle="Block the real device from one input" />
        <p>
          A locked input is suppressed from the real device. Injection still drives it. Locks clear on
          their own if the dashboard disconnects.
        </p>

        <UsagePicker
          name="lock-target"
          classes={CLASSES}
          value={target()}
          onChange={setTarget}
          usageLabel="Which input"
        />

        <div style={section}>
          <div style={label}>Direction</div>
          <RadioGroup
            name="lock-direction"
            value={direction()}
            onChange={setDirection}
            options={dirLabel()}
          />
        </div>

        <div style={{ ...section, ...row }}>
          <Button variant="primary" disabled={cmd.busy()} onClick={() => apply(true)}>
            Lock
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={() => apply(false)}>
            Unlock
          </Button>
        </div>
        <Show when={cmd.error()}>
          <div class="callout callout--danger" role="alert" style={section}>
            {cmd.error()}
          </div>
        </Show>

        <div style={section}>
          <div style={label}>Active locks</div>
          <Show when={active().length > 0} fallback={<p>Nothing locked.</p>}>
            <div style={chips}>
              <For each={active()}>{(item) => <Chip variant="warning">{item.text}</Chip>}</For>
            </div>
          </Show>
        </div>
      </Card>
    </Show>
  );
};

export default DeviceLock;
