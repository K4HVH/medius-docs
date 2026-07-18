import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import { EmitMode, NAME_MAX } from '../../../dashboard/protocol';
import type { EmitPace, ImperfectStatus } from '../../../dashboard/protocol';
import { useDashboard } from './context';

// One card for every persistent box option (saved on the device, survive a reboot). Each option is a
// labelled section here; the read-only summary on the Device tab mirrors the same values.

const controls = {
  display: 'flex',
  gap: 'var(--g-spacing-sm)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-end',
} as const;

const status = { 'margin-top': 'var(--g-spacing-sm)' } as const;

const EMIT_MODES: Record<string, EmitMode> = {
  learned: EmitMode.Learned,
  interval: EmitMode.Interval,
  fixed: EmitMode.Fixed,
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
  const [imperfect, setImperfect] = createSignal<ImperfectStatus | null>(null);
  const [ride, setRide] = createSignal<number | null>(null); // movement-riding window in ms, 0 = off
  const [draft, setDraft] = createSignal(20);
  const [emit, setEmit] = createSignal<EmitPace | null>(null);
  const [emitMode, setEmitMode] = createSignal('learned');
  const [hz, setHz] = createSignal(500);
  const [boxName, setBoxName] = createSignal<string | null>(null); // the box's live name, read from RESP(VERSION)
  const [nameDraft, setNameDraft] = createSignal('');

  const refresh = async () => {
    try {
      const link = dash.link();
      if (!link) return;
      setImperfect(await link.queryImperfect());
      setRide(await link.queryMovementRiding());
      setEmit(await link.queryEmitPace());
      // The name rides on RESP(VERSION) (the ASCII tail after the MAC), not a Q_OPTIONS readback.
      setBoxName((await link.queryVersion()).name);
    } catch {
      // A transient miss is fine; the next refresh tries again.
    }
  };

  const applyName = async () => {
    const name = nameDraft().trim();
    if (name.length === 0) return;
    await dash.link()?.setName(name);
    await refresh();
  };

  const clearName = async () => {
    await dash.link()?.clearName();
    setNameDraft('');
    await refresh();
  };

  const allowImperfect = async (allow: boolean) => {
    await dash.link()?.allowImperfectClones(allow);
    await refresh();
  };

  const setRiding = async (ms: number) => {
    await dash.link()?.setMovementRiding(ms);
    await refresh();
  };

  const applyEmit = async () => {
    const mode = EMIT_MODES[emitMode()];
    await dash.link()?.setEmitPace(mode, mode === EmitMode.Fixed ? hz() : 0);
    await refresh();
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    // Seed the editable draft from the name known at handshake, so the field opens on the current name.
    setNameDraft(dash.version()?.name ?? '');
    void refresh();
    timer = setInterval(() => void refresh(), 1000);
  });
  onCleanup(() => {
    if (timer !== null) clearInterval(timer);
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Options" subtitle="Persistent settings saved on the box" />

        <div class="api-response-label">Box name</div>
        <p>
          A human-readable name for the box, a friendlier alternative to its id. Leave it unset and the box
          makes one up from its id (like "Medius-1A2B"). Up to {NAME_MAX} letters, numbers, and symbols.
        </p>
        <div style={controls}>
          <div style={{ 'max-width': '16rem', flex: '1 1 12rem' }}>
            <TextField
              label="Name"
              value={nameDraft()}
              maxLength={NAME_MAX}
              placeholder="Medius-1A2B"
              onInput={setNameDraft}
            />
          </div>
          <Button variant="primary" onClick={() => void applyName()}>
            Set
          </Button>
          <Button variant="secondary" onClick={() => void clearName()}>
            Clear
          </Button>
        </div>
        <Show when={boxName() !== null} fallback={<p style={status}>Reading status...</p>}>
          <div style={status}>
            <Chip variant="neutral">{boxName()}</Chip>
          </div>
        </Show>

        <div class="api-response-label">Imperfect clone</div>
        <p>
          Some devices need more inputs than the box can copy (like the Wooting's analog stream), so the
          box refuses them by default. Allow it and the box clones the device anyway with one input
          dropped, then reboots to apply.
        </p>
        <div style={controls}>
          <Button variant="primary" onClick={() => void allowImperfect(true)}>
            Allow imperfect
          </Button>
          <Button variant="secondary" onClick={() => void allowImperfect(false)}>
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

        <div class="api-response-label">Movement riding</div>
        <p>
          Injected motion only rides a real mouse move within the window and is dropped if no move
          arrives, so it keeps the hand's report timing. It can't move the cursor on its own while it's
          on. Off by default.
        </p>
        <div style={controls}>
          <div style={{ 'max-width': '8rem' }}>
            <NumberInput
              label="Window (ms)"
              value={draft()}
              min={1}
              max={65535}
              onChange={(v) => setDraft(v ?? 1)}
            />
          </div>
          <Button variant="primary" onClick={() => void setRiding(draft())}>
            Turn on
          </Button>
          <Button variant="secondary" onClick={() => void setRiding(0)}>
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

        <div class="api-response-label">Emit rate</div>
        <p>
          How fast the box sends injected moves. Learned matches the mouse's own report rate, Interval
          follows its USB poll rate, and Fixed pins it to a rate you pick. It only sets the ceiling, so
          the box still sends only when there's a move to send. Learned by default.
        </p>
        <RadioGroup
          name="emit-mode"
          value={emitMode()}
          onChange={setEmitMode}
          options={[
            { value: 'learned', label: 'Learned' },
            { value: 'interval', label: 'Interval' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        <div style={{ ...controls, 'margin-top': 'var(--g-spacing-sm)' }}>
          <Show when={emitMode() === 'fixed'}>
            <div style={{ 'max-width': '8rem' }}>
              <NumberInput
                label="Rate (Hz)"
                value={hz()}
                min={1}
                max={1000}
                onChange={(v) => setHz(v ?? 1)}
              />
            </div>
          </Show>
          <Button variant="primary" onClick={() => void applyEmit()}>
            Apply
          </Button>
        </div>
        <Show when={emit()} fallback={<p style={status}>Reading status...</p>}>
          {(s) => (
            <div style={status}>
              <Chip variant={s().mode === EmitMode.Learned || s().mode === null ? 'neutral' : 'success'}>
                {emitLabel(s())}
              </Chip>
            </div>
          )}
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceOptions;
