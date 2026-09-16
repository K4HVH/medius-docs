// Move what a field the real device drives into another field before the clone emits it.
//
// The picker is the shared one, so a remap reaches a key or a media usage and not only another axis.
// A transform is structural: it says where a value lands, never how much of it survives, which is the
// lock panel's and is where the signed percent lives.

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
  { id: LockAxis.X, name: 'Move left/right (X)', group: 'Axes' },
  { id: LockAxis.Y, name: 'Move up/down (Y)', group: 'Axes' },
  { id: LockAxis.Wheel, name: 'Scroll wheel', group: 'Axes' },
  { id: LockAxis.Pan, name: 'Pan (horizontal scroll)', group: 'Axes' },
];

const OP_LABELS = [
  { value: String(TransformOp.Swap), label: 'Swap' },
  { value: String(TransformOp.Remap), label: 'Remap' },
];

// An axis reads as its own name; every other class shares the injection tables, so the usage names
// there are the ones the rest of the dashboard already prints.
const fieldName = (cls: number, id: number): string =>
  cls === LockClass.Axis ? (AXES.find((a) => a.id === id)?.name ?? `axis ${id}`) : usageName(cls, id);

// A read-back entry names itself. A chip is capped at 250px and ellipsises past it, so each reads as
// the plain move it is.
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

  // The five named buttons plus a numbered entry for each button the mouse declares past them
  // (RESP(CAPS) n_buttons), so a remap can start from any button the cloned device carries.
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

  // A swap is axis work; a remap is the one operation that can start from a button.
  const sourceClasses = (): PickerClass[] => (remapping() ? [axisClass(), buttonClass()] : [axisClass()]);

  // An axis writes an axis. A button writes another button, or a key or media usage on the clone's
  // own keyboard and consumer interfaces, which is the cross-class remap.
  const destClasses = (): PickerClass[] =>
    remapping() && buttonSource()
      ? [
          buttonClass(),
          { value: LockClass.Key, label: 'Key', table: KEYS },
          { value: LockClass.Media, label: 'Media', table: MEDIA },
        ]
      : [axisClass()];

  const firstAxisOtherThan = (id: number) => (id === LockAxis.X ? LockAxis.Y : LockAxis.X);

  // Both pickers are one class deep on a swap, so the class radio that would tell them apart is not
  // rendered. The field label carries the distinction instead.
  const srcLabel = () => (remapping() ? 'Move this input' : 'Swap this axis');
  const dstLabel = () => (remapping() ? 'Into this input' : 'With this axis');

  // Leaving Remap strands a button source on an operation that only takes axes, and a radio with no
  // matching option keeps sending the old field. Fall back to the two axes both operations take.
  const chooseOp = (v: string) => {
    setOp(v);
    if (Number(v) !== TransformOp.Remap && buttonSource()) {
      setSource({ cls: LockClass.Axis, id: LockAxis.X });
      setDest({ cls: LockClass.Axis, id: LockAxis.Y });
    }
  };

  // Changing the source's class changes what the destination can be, so the destination follows it
  // rather than being left addressing a class this pair no longer admits.
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
    // Both operations MOVE a value, so a field named as both ends is not an operation at all and the
    // box refuses it. Say so here rather than sending a frame that silently does nothing.
    const s = source();
    const d = dest();
    if (s.cls === d.cls && s.id === d.id) {
      cmd.run(() =>
        Promise.reject(
          new Error(
            remapping()
              ? 'A remap needs two different fields. To weigh one in place, use the input scale.'
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
          <CardHeader title="Transforms" subtitle="Move the real device's inputs between fields" />

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
            <p>A button carries one bit, so it arrives whole or not at all.</p>
          </Show>

          <p>
            A transform says where an input lands, not how much of it arrives. To weigh one, or to flip
            its direction, set its input scale below: a negative percent reverses the axis.
          </p>

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
              Its {TRANSFORM_MAX_ENTRIES}-entry table is full. Remove one before adding another.
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
            <Show when={active().length > 0} fallback={<p>Every input untouched.</p>}>
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
