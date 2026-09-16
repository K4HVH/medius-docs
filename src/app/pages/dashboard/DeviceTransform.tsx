// Change what a field the real device drives does before the clone emits it.
//
// The picker is the shared one, so a remap reaches a key or a media usage and not only another axis.
// A button carries one bit rather than a magnitude, so a button source goes out at a full pass and
// the scale is withheld; a swap and an axis remap both take one, which is why the slider is not tied
// to the scale operation alone.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { Slider } from '../../../components/inputs/Slider';
import {
  type NamedUsage,
  type Transform,
  KEYS,
  LOCK_SCALE_MAX,
  LOCK_SCALE_PASS,
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
  { value: String(TransformOp.Scale), label: 'Scale' },
  { value: String(TransformOp.Swap), label: 'Swap' },
  { value: String(TransformOp.Remap), label: 'Remap' },
];

// An axis reads as its own name; every other class shares the injection tables, so the usage names
// there are the ones the rest of the dashboard already prints.
const fieldName = (cls: number, id: number): string =>
  cls === LockClass.Axis ? (AXES.find((a) => a.id === id)?.name ?? `axis ${id}`) : usageName(cls, id);

// A read-back entry names itself. A chip is capped at 250px and ellipsises past it, so the percent
// is dropped when it is the identity and the entry reads as the plain move.
const describe = (t: Transform): string => {
  const src = fieldName(t.sclass, t.sid);
  const dst = fieldName(t.dclass, t.did);
  const at = t.scale === LOCK_SCALE_PASS ? '' : ` at ${t.scale}%`;
  switch (t.op) {
    case TransformOp.Scale:
      return `${src} at ${t.scale}%`;
    case TransformOp.Swap:
      return `Swap ${src} and ${dst}${at}`;
    case TransformOp.Remap:
      return `${src} to ${dst}${at}`;
    default:
      return `${src} to ${dst}`;
  }
};

const DeviceTransform = () => {
  const dash = useDashboard();
  const caps = dash.poll('caps');
  const [op, setOp] = createSignal(String(TransformOp.Scale));
  const [source, setSource] = createSignal<UsageValue>({ cls: LockClass.Axis, id: LockAxis.X });
  const [dest, setDest] = createSignal<UsageValue>({ cls: LockClass.Axis, id: LockAxis.Y });
  const [scale, setScale] = createSignal(150);
  const table = dash.poll('transforms');
  const cmd = createCommand(() => dash.refreshPoll('transforms'));

  const curOp = (): TransformOp => Number(op()) as TransformOp;
  const remapping = () => curOp() === TransformOp.Remap;
  const twoFields = () => curOp() !== TransformOp.Scale;
  const buttonSource = () => source().cls === LockClass.Button;
  const scaled = () => !buttonSource();

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

  // Scale and swap are axis work; a remap is the one operation that can start from a button.
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

  // Both pickers are one class deep on a scale and a swap, so the class radio that would tell them
  // apart is not rendered. The field label carries the distinction instead.
  const srcLabel = () =>
    curOp() === TransformOp.Scale ? 'Which axis' : remapping() ? 'Move this input' : 'Swap this axis';
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

  // A scale reads and writes the same field, so its destination is its source. A button source
  // carries one bit, so it goes out at a full pass whatever the slider last held.
  const build = (): Transform => {
    const s = source();
    const d = twoFields() ? dest() : s;
    return {
      op: curOp(),
      sclass: s.cls,
      sid: s.id,
      dclass: d.cls,
      did: d.id,
      scale: scaled() ? scale() : LOCK_SCALE_PASS,
    };
  };

  const apply = () => {
    if (curOp() === TransformOp.Swap && source().id === dest().id) {
      cmd.run(() => Promise.reject(new Error('A swap needs two different axes.')));
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
          <CardHeader title="Transforms" subtitle="Reshape the real device's inputs" />

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

          <Show when={twoFields()}>
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
          </Show>

          <Show when={buttonSource()}>
            <p>A button carries one bit, so it arrives whole or not at all.</p>
          </Show>

          <Show when={scaled()}>
            <div style={section}>
              <div style={label}>Keep {scale()}% (a negative flips the direction)</div>
              <Slider
                value={scale()}
                min={-LOCK_SCALE_MAX}
                max={LOCK_SCALE_MAX}
                step={5}
                onChange={(v) => setScale(Array.isArray(v) ? v[0] : v)}
              />
            </div>
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
