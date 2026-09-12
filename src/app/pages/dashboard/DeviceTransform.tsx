// Rewrite a relative axis on the wire: invert it, weigh it by a signed percent, swap two axes, or
// remap one into another. A transform runs on the semantic path before rendering and is clamped to the
// destination axis's declared range, so it stays faithful and needs no imperfect-clone opt-in.
//
// The panel covers the axis operations, which are the headline cases. A cross-class remap (a button
// onto a key or media usage) is available through the library and C API; it needs a usage picker this
// GUI does not carry.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { Slider } from '../../../components/inputs/Slider';
import {
  type Transform,
  LockAxis,
  LockClass,
  TransformOp,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, label, row, section } from './ui';

const AXES = [
  { id: LockAxis.X, name: 'X' },
  { id: LockAxis.Y, name: 'Y' },
  { id: LockAxis.Wheel, name: 'Wheel' },
  { id: LockAxis.Pan, name: 'Pan' },
];

const axisName = (id: number): string => AXES.find((a) => a.id === id)?.name ?? `axis ${id}`;

const OP_LABELS = [
  { value: String(TransformOp.Invert), label: 'Invert' },
  { value: String(TransformOp.Scale), label: 'Scale' },
  { value: String(TransformOp.Swap), label: 'Swap' },
  { value: String(TransformOp.Remap), label: 'Remap' },
];

// A read-back entry describes itself: an axis field is `axis N`, and the op plus scale name the rest.
const describe = (t: Transform): string => {
  const src = t.sclass === LockClass.Axis ? axisName(t.sid) : `${t.sclass}:${t.sid}`;
  const dst = t.dclass === LockClass.Axis ? axisName(t.did) : `${t.dclass}:${t.did}`;
  switch (t.op) {
    case TransformOp.Invert:
      return `Invert ${src}`;
    case TransformOp.Scale:
      return `Scale ${src} ${t.scale}%`;
    case TransformOp.Swap:
      return `Swap ${src} and ${dst}`;
    case TransformOp.Remap:
      return t.scale === 100 ? `Remap ${src} to ${dst}` : `Remap ${src} to ${dst} at ${t.scale}%`;
    default:
      return `${src} to ${dst}`;
  }
};

const DeviceTransform = () => {
  const dash = useDashboard();
  const [op, setOp] = createSignal(String(TransformOp.Invert));
  const [source, setSource] = createSignal(LockAxis.X);
  const [dest, setDest] = createSignal(LockAxis.Y);
  const [scale, setScale] = createSignal(150);
  const table = dash.poll('transforms');
  const cmd = createCommand(() => dash.refreshPoll('transforms'));

  const curOp = (): TransformOp => Number(op()) as TransformOp;
  const twoAxis = () => curOp() === TransformOp.Swap || curOp() === TransformOp.Remap;
  const scaled = () => curOp() === TransformOp.Scale;

  const axisOptions = () => AXES.map((a) => ({ value: String(a.id), label: a.name }));

  // The wire fields: invert and scale share source and dest (one axis); swap and remap write the second
  // axis. Invert ignores the scale but the box refuses a zero, so it carries the 100 placeholder.
  const build = (): Transform => {
    const one = curOp() === TransformOp.Invert || scaled();
    return {
      op: curOp(),
      sclass: LockClass.Axis,
      sid: source(),
      dclass: LockClass.Axis,
      did: one ? source() : dest(),
      scale: scaled() ? scale() : 100,
    };
  };

  const apply = () =>
    cmd.run(async () => {
      await dash.link()!.setTransform(build());
    });
  const remove = (t: Transform) =>
    cmd.run(async () => {
      await dash.link()!.removeTransform(t);
    });
  const clearAll = () =>
    cmd.run(async () => {
      await dash.link()!.clearTransforms();
    });

  const active = createMemo(() => table()?.entries ?? []);
  const full = createMemo(() => table()?.tableFull ?? false);

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="transforms" data-search-target>
        <Card>
          <CardHeader title="Transforms" subtitle="Invert, scale, swap, or remap an axis on the wire" />

          <div style={section}>
            <div style={label}>Operation</div>
            <RadioGroup name="transform-op" value={op()} onChange={setOp} options={OP_LABELS} />
          </div>

          <div style={section}>
            <div style={label}>{twoAxis() ? 'From axis' : 'Axis'}</div>
            <RadioGroup
              name="transform-source"
              value={String(source())}
              onChange={(v) => setSource(Number(v))}
              options={axisOptions()}
            />
          </div>

          <Show when={twoAxis()}>
            <div style={section}>
              <div style={label}>{curOp() === TransformOp.Swap ? 'With axis' : 'To axis'}</div>
              <RadioGroup
                name="transform-dest"
                value={String(dest())}
                onChange={(v) => setDest(Number(v))}
                options={axisOptions()}
              />
            </div>
          </Show>

          <Show when={scaled()}>
            <div style={section}>
              <div style={label}>Keep {scale()}% (negative flips the axis)</div>
              <Slider
                value={scale()}
                min={-200}
                max={300}
                step={10}
                onChange={(v) => setScale(Array.isArray(v) ? v[0] : v)}
              />
            </div>
          </Show>

          <Show when={curOp() === TransformOp.Invert}>
            <div class="callout callout--info" style={section}>
              Invert emits the report the device produces when moved the other way. The scale does not
              apply.
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
              The box holds eight transforms and the table is full. Remove one before adding another.
            </div>
          </Show>
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {cmd.error()}
            </div>
          </Show>

          <div style={section}>
            <div style={label}>Active</div>
            <Show when={active().length > 0} fallback={<p>No transforms. Every axis passes through as the device sends it.</p>}>
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

          <p>
            Cross-class remaps and the signed scale are in{' '}
            <A href="/library/transform">the library reference</A>.
          </p>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceTransform;
