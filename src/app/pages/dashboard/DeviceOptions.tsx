// The box's persistent options: set on the device, survive a reboot.
//
// Every control here reads its value back from the box until you touch it. It used to open on a
// hardcoded default instead, so a box paced at Fixed 250 Hz showed a radio reading Learned directly
// above a chip reading Fixed 250 Hz, and pressing Apply on what looked like a no-op reconfigured it.

import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import { type EmitPace, EmitMode, NAME_MAX } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Section } from './Section';
import { controls, muted, section, status } from './ui';

const EMIT_MODES: Record<string, EmitMode> = {
  learned: EmitMode.Learned,
  interval: EmitMode.Interval,
  fixed: EmitMode.Fixed,
};

const MODE_NAMES: Record<number, string> = {
  [EmitMode.Learned]: 'learned',
  [EmitMode.Interval]: 'interval',
  [EmitMode.Fixed]: 'fixed',
};

const emitLabel = (e: EmitPace): string => {
  switch (e.mode) {
    case EmitMode.Learned:
      return 'Learned';
    case EmitMode.Interval:
      return e.resolvedHz > 0 ? `Interval · ${e.resolvedHz} Hz` : 'Interval';
    case EmitMode.Fixed:
      return `Fixed · ${e.resolvedHz || e.fixedHz} Hz`;
    default:
      return 'Unknown';
  }
};

const DeviceOptions = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const ride = dash.poll('moveRide');
  const emit = dash.poll('emit');
  const version = dash.poll('version');
  const cmd = createCommand();

  // Each control follows the box until the user edits it, then holds their edit until it is applied.
  // Without the second half, a poll landing mid-edit would overwrite what they were typing.
  const [nameEdit, setNameEdit] = createSignal<string | null>(null);
  const [rideEdit, setRideEdit] = createSignal<number | null>(null);
  const [modeEdit, setModeEdit] = createSignal<string | null>(null);
  const [hzEdit, setHzEdit] = createSignal<number | null>(null);

  const name = () => nameEdit() ?? version()?.name ?? '';
  const rideWindow = () => rideEdit() ?? (ride() && ride()! > 0 ? ride()! : 20);
  const mode = () => modeEdit() ?? MODE_NAMES[emit()?.mode ?? EmitMode.Learned] ?? 'learned';
  // A box that has never been in Fixed mode reports 0 here, which is below the field's own minimum
  // and would be sent as a 0 Hz Apply, so 0 falls through to the default rather than being shown.
  const hz = () => hzEdit() ?? (emit()?.fixedHz || 500);

  // Each write clears its own edit only once the frame is away. A failure leaves the edit showing,
  // so the field still holds what the user asked for rather than snapping back as if it landed.
  const applyName = () => {
    const v = name().trim();
    if (v.length === 0) return;
    cmd.run(async () => {
      await dash.link()!.setName(v);
      setNameEdit(null);
      dash.refreshPoll('version');
    });
  };

  const clearName = () =>
    cmd.run(async () => {
      await dash.link()!.clearName();
      setNameEdit(null);
      dash.refreshPoll('version');
    });

  const allowImperfect = (allow: boolean) =>
    cmd.run(async () => {
      await dash.link()!.allowImperfectClones(allow);
      dash.refreshPoll('imperfect');
    });

  const setRiding = (ms: number) =>
    cmd.run(async () => {
      await dash.link()!.setMovementRiding(ms);
      setRideEdit(null);
      dash.refreshPoll('moveRide');
    });

  const applyEmit = () =>
    cmd.run(async () => {
      const m = EMIT_MODES[mode()];
      await dash.link()!.setEmitPace(m, m === EmitMode.Fixed ? hz() : 0);
      setModeEdit(null);
      setHzEdit(null);
      dash.refreshPoll('emit');
    });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Options" subtitle="Persistent settings saved on the box" />

        <Section title="Box name" first>
        <p>
          Leave it unset and the box derives one from its id, like "Medius-1A2B". Up to {NAME_MAX}{' '}
          letters, numbers, and symbols.
        </p>
        <div style={controls}>
          <div style={{ 'max-width': '16rem', flex: '1 1 12rem' }}>
            <TextField
              label="Name"
              value={name()}
              maxLength={NAME_MAX}
              placeholder="Medius-1A2B"
              onChange={setNameEdit}
            />
          </div>
          <Button variant="primary" disabled={cmd.busy()} onClick={applyName}>
            Set
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={clearName}>
            Clear
          </Button>
        </div>
        <Show when={version()} fallback={<p style={status}>Reading status...</p>}>
          <div style={status}>
            <Chip variant="neutral">{version()!.name}</Chip>
          </div>
        </Show>

        </Section>

        <Section title="Imperfect clone">
        <p>
          Some devices need more inputs than the box can copy, so it refuses them by default. Allow it
          and the box clones the device anyway with one input dropped, then reboots to apply.
        </p>
        <div style={controls}>
          <Button variant="primary" disabled={cmd.busy()} onClick={() => allowImperfect(true)}>
            Allow imperfect
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={() => allowImperfect(false)}>
            Faithful only
          </Button>
        </div>
        <Show when={imperfect()} fallback={<p style={status}>Reading status...</p>}>
          {(s) => (
            <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
              <Chip variant={s().allowed ? 'success' : 'neutral'}>
                {s().allowed ? 'Allowed' : 'Faithful only'}
              </Chip>
              <Show when={s().overCapacity}>
                <Chip variant="warning">Attached device needs an input the box can't copy</Chip>
              </Show>
            </div>
          )}
        </Show>

        </Section>

        <Section title="Movement riding">
        <p>
          Injected motion is only emitted alongside a real mouse move within the window, and is dropped
          if none arrives, so it keeps the real device's report timing. Off by default, and a move can
          opt out of it.
        </p>
        <div style={controls}>
          <div style={{ 'max-width': '8rem' }}>
            <NumberInput
              label="Window (ms)"
              value={rideWindow()}
              min={1}
              max={65535}
              onChange={(v) => setRideEdit(v ?? 1)}
            />
          </div>
          <Button variant="primary" disabled={cmd.busy()} onClick={() => setRiding(rideWindow())}>
            Turn on
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={() => setRiding(0)}>
            Turn off
          </Button>
        </div>
        <Show when={ride() !== null} fallback={<p style={status}>Reading status...</p>}>
          <div style={status}>
            <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
              {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
            </Chip>
          </div>
        </Show>

        </Section>

        <Section title="Emit rate">
        <p>
          What paces injected motion. Learned matches the mouse's own report rate, Interval follows
          its USB poll rate, and Fixed pins it to a rate you pick. It sets a ceiling only.
        </p>
        <RadioGroup
          name="emit-mode"
          value={mode()}
          onChange={setModeEdit}
          options={[
            { value: 'learned', label: 'Learned' },
            { value: 'interval', label: 'Interval' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        <div style={{ ...controls, 'margin-top': 'var(--g-spacing-sm)' }}>
          <Show when={mode() === 'fixed'}>
            <div style={{ 'max-width': '8rem' }}>
              <NumberInput
                label="Rate (Hz)"
                value={hz()}
                min={1}
                max={1000}
                onChange={(v) => setHzEdit(v ?? 1)}
              />
            </div>
          </Show>
          <Button variant="primary" disabled={cmd.busy()} onClick={applyEmit}>
            Apply
          </Button>
          <Show when={modeEdit() !== null || hzEdit() !== null}>
            <Button
              variant="subtle"
              onClick={() => {
                setModeEdit(null);
                setHzEdit(null);
              }}
            >
              Revert
            </Button>
          </Show>
        </div>
        <Show when={cmd.error()}>
          <div class="callout callout--danger" role="alert" style={section}>
            {cmd.error()}
          </div>
        </Show>
        <Show when={emit()} fallback={<p style={status}>Reading status...</p>}>
          {(s) => (
            <div style={status}>
              <Chip variant={s().mode === EmitMode.Learned || s().mode === null ? 'neutral' : 'success'}>
                {emitLabel(s())}
              </Chip>
              <Show when={modeEdit() !== null || hzEdit() !== null}>
                <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>
                  not applied yet
                </span>
              </Show>
            </div>
          )}
        </Show>
        </Section>
      </Card>
    </Show>
  );
};

export default DeviceOptions;
