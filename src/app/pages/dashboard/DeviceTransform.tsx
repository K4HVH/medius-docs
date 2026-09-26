// Moves a native field's value into another before the clone emits it. Weighing is the lock card's.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import {
  type NamedUsage,
  type Transform,
  KEYS,
  LockAxis,
  LockClass,
  MEDIA,
  TRANSFORM_MAX_ENTRIES,
  TransformOp,
  buttonsUpTo,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { UsagePicker, type PickerClass, type UsageValue } from './UsagePicker';
import { chips, label, row, section } from './ui';

const AXES: NamedUsage[] = [
  { id: LockAxis.X, name: 'X (left/right)', group: 'Axes' },
  { id: LockAxis.Y, name: 'Y (up/down)', group: 'Axes' },
  { id: LockAxis.Wheel, name: 'Wheel', group: 'Axes' },
  { id: LockAxis.Pan, name: 'Pan (horizontal scroll)', group: 'Axes' },
];

const OP_LABELS = [
  { value: String(TransformOp.Swap), label: 'Swap' },
  { value: String(TransformOp.Remap), label: 'Remap' },
];

const fieldName = (cls: number, id: number): string =>
  cls === LockClass.Axis ? (AXES.find((a) => a.id === id)?.name ?? `axis ${id}`) : usageName(cls, id);

// A chip ellipsises past 250px, so each reads as the plain move.
const describe = (t: Transform): string => {
  const src = fieldName(t.sclass, t.sid);
  const dst = fieldName(t.dclass, t.did);
  return t.op === TransformOp.Swap ? `Swap ${src} and ${dst}` : `${src} to ${dst}`;
};

const DeviceTransform = () => {
  const dash = useDashboard();
  const caps = dash.poll('caps');
  const [op, setOp] = createSignal(String(TransformOp.Swap));
  const [source, setSource] = createSignal<UsageValue>({ cls: LockClass.Axis, id: LockAxis.X });
  const [dest, setDest] = createSignal<UsageValue>({ cls: LockClass.Axis, id: LockAxis.Y });
  const table = dash.poll('transforms');
  const cmd = createCommand(() => dash.refreshPoll('transforms'));

  const curOp = (): TransformOp => Number(op()) as TransformOp;
  const remapping = () => curOp() === TransformOp.Remap;
  const buttonSource = () => source().cls === LockClass.Button;

  // Every button the clone declares (RESP(CAPS) n_buttons).
  const buttons = () => buttonsUpTo(caps()?.mouse?.nButtons ?? 0);
  const axisClass = (): PickerClass => ({
    value: LockClass.Axis,
    label: 'Axis',
    table: AXES,
    hideId: true,
  });
  const buttonClass = (): PickerClass => ({
    value: LockClass.Button,
    label: 'Button',
    table: buttons(),
  });

  // Only a remap can start from a button.
  const sourceClasses = (): PickerClass[] => (remapping() ? [axisClass(), buttonClass()] : [axisClass()]);

  // An axis writes an axis; a button writes a button, or a key or media usage on the clone's keyboard
  // and consumer interfaces.
  const destClasses = (): PickerClass[] =>
    remapping() && buttonSource()
      ? [
          buttonClass(),
          { value: LockClass.Key, label: 'Key', table: KEYS },
          { value: LockClass.Media, label: 'Media', table: MEDIA },
        ]
      : [axisClass()];

  const firstAxisOtherThan = (id: number) => (id === LockAxis.X ? LockAxis.Y : LockAxis.X);

  // A swap renders no class radios, so the field labels tell the two pickers apart.
  const srcLabel = () => (remapping() ? 'Source' : 'Axis');
  const dstLabel = () => (remapping() ? 'Target' : 'With axis');

  // Leaving Remap strands a button source, and an unmatched radio keeps sending the old field, so fall
  // back to X and Y.
  const chooseOp = (v: string) => {
    setOp(v);
    if (Number(v) !== TransformOp.Remap && buttonSource()) {
      setSource({ cls: LockClass.Axis, id: LockAxis.X });
      setDest({ cls: LockClass.Axis, id: LockAxis.Y });
    }
  };

  // A new source class changes what the destination can be, so the destination follows.
  const chooseSource = (v: UsageValue) => {
    const was = source().cls;
    setSource(v);
    if (v.cls === was) return;
    setDest(
      v.cls === LockClass.Button
        ? { cls: LockClass.Button, id: buttons()[0]?.id ?? 0 }
        : { cls: LockClass.Axis, id: firstAxisOtherThan(v.id) },
    );
  };

  const build = (): Transform => {
    const s = source();
    const d = dest();
    return { op: curOp(), sclass: s.cls, sid: s.id, dclass: d.cls, did: d.id };
  };

  const apply = () => {
    // The box drops a field named as both ends with no reply, so refuse it here.
    const s = source();
    const d = dest();
    if (s.cls === d.cls && s.id === d.id) {
      cmd.run(() =>
        Promise.reject(
          new Error(
            remapping()
              ? 'A remap needs two different fields. To weigh one in place, use Input locks.'
              : 'A swap needs two different axes.',
          ),
        ),
      );
      return;
    }
    cmd.run(() => dash.link()!.setTransform(build()));
  };
  const remove = (t: Transform) => cmd.run(() => dash.link()!.removeTransform(t));
  const clearAll = () => cmd.run(() => dash.link()!.clearTransforms());

  const active = createMemo(() => table()?.entries ?? []);
  const full = createMemo(() => table()?.tableFull ?? false);

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="transforms" data-search-target>
        <Card>
          <CardHeader title="Transforms" subtitle="Move native inputs between fields" />

          <div style={section}>
            <div style={label}>Operation</div>
            <RadioGroup name="transform-op" value={op()} onChange={chooseOp} options={OP_LABELS} />
          </div>

          <div style={section}>
            <UsagePicker
              classes={sourceClasses()}
              name="transform-source"
              value={source()}
              onChange={chooseSource}
              classLabel="From"
              usageLabel={srcLabel()}
            />
          </div>

          <div style={section}>
            <UsagePicker
              classes={destClasses()}
              name="transform-dest"
              value={dest()}
              onChange={(v) => setDest(v)}
              classLabel="To"
              usageLabel={dstLabel()}
            />
          </div>

          <Show when={buttonSource()}>
            <p>A button is one bit, so it arrives whole or not at all.</p>
          </Show>

          <div style={{ ...section, ...row }}>
            <Button variant="primary" disabled={cmd.busy()} onClick={apply}>
              Apply
            </Button>
            <Button variant="secondary" disabled={cmd.busy() || active().length === 0} onClick={clearAll}>
              Clear all
            </Button>
          </div>

          <Show when={full()}>
            <div class="callout callout--warning" style={section}>
              The {TRANSFORM_MAX_ENTRIES}-entry table is full. Remove an entry first.
            </div>
          </Show>
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {cmd.error()}
            </div>
          </Show>

          <div style={section}>
            <div style={label}>
              Active ({active().length} of {TRANSFORM_MAX_ENTRIES})
            </div>
            <Show when={active().length > 0} fallback={<p>None.</p>}>
              <div style={chips}>
                <For each={active()}>
                  {(t) => (
                    <Chip variant="info" onRemove={() => remove(t)}>
                      {describe(t)}
                    </Chip>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceTransform;
