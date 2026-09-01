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
import {
  type EmitPace,
  BEARING_WINDOW_DEFAULT_MS,
  BearingMode,
  EmitMode,
  RenderMode,
  NAME_MAX,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Section } from './Section';
import { controls, muted, section, status } from './ui';

const EMIT_MODES: Record<string, EmitMode> = {
  learned: EmitMode.Learned,
  interval: EmitMode.Interval,
  fixed: EmitMode.Fixed,
};

const MODE_BLURB: Record<string, string> = {
  learned: "Matches the mouse's own report rate.",
  interval: "Follows the mouse's USB poll rate.",
  fixed: 'Pins the rate to the number you pick.',
};

const MODE_NAMES: Record<number, string> = {
  [EmitMode.Learned]: 'learned',
  [EmitMode.Interval]: 'interval',
  [EmitMode.Fixed]: 'fixed',
};

const RENDER_MODES: Record<string, RenderMode> = {
  off: RenderMode.Off,
  stock: RenderMode.Stock,
  despiked: RenderMode.Despiked,
  unsmoothed: RenderMode.Unsmoothed,
};

const RENDER_BLURB: Record<string, string> = {
  off: 'Even fill at the paced rate.',
  stock: "Draws the mouse's own texture.",
  despiked: 'Draws it with a softer onset.',
  unsmoothed: 'Draws raw motion, no smoothing.',
};

const RENDER_NAMES: Record<number, string> = {
  [RenderMode.Off]: 'off',
  [RenderMode.Stock]: 'stock',
  [RenderMode.Despiked]: 'despiked',
  [RenderMode.Unsmoothed]: 'unsmoothed',
};

const RENDER_LABEL: Record<number, string> = {
  [RenderMode.Off]: '',
  [RenderMode.Stock]: 'Stock',
  [RenderMode.Despiked]: 'De-spiked',
  [RenderMode.Unsmoothed]: 'Unsmoothed',
};

const emitLabel = (e: EmitPace): string => {
  let base: string;
  switch (e.mode) {
    case EmitMode.Learned:
      base = 'Learned';
      break;
    case EmitMode.Interval:
      base = e.resolvedHz > 0 ? `Interval · ${e.resolvedHz} Hz` : 'Interval';
      break;
    case EmitMode.Fixed:
      base = `Fixed · ${e.resolvedHz || e.fixedHz} Hz`;
      break;
    default:
      base = 'Unknown';
  }
  return base;
};

const DeviceOptions = () => {
  const dash = useDashboard();
  const imperfect = dash.poll('imperfect');
  const ride = dash.poll('moveRide');
  const bearing = dash.poll('bearing');
  const emit = dash.poll('emit');
  const render = dash.poll('render');
  const version = dash.poll('version');
  const cmd = createCommand();

  // Each control follows the box until the user edits it, then holds their edit until it is applied.
  // Without the second half, a poll landing mid-edit would overwrite what they were typing.
  const [nameEdit, setNameEdit] = createSignal<string | null>(null);
  const [rideEdit, setRideEdit] = createSignal<number | null>(null);
  const [bearEdit, setBearEdit] = createSignal<number | null>(null);
  const [bearMode, setBearMode] = createSignal<string | null>(null);
  const [modeEdit, setModeEdit] = createSignal<string | null>(null);
  const [renderEdit, setRenderEdit] = createSignal<string | null>(null);
  const [fullEdit, setFullEdit] = createSignal<boolean | null>(null);
  const [hzEdit, setHzEdit] = createSignal<number | null>(null);
  const [forceEdit, setForceEdit] = createSignal<number | null>(null);
  const [forceOnEdit, setForceOnEdit] = createSignal<boolean | null>(null);

  // Every editable option below shares one shape: an unapplied edit offers Revert and marks the
  // status chip. Emit rate was the only one that did, so a pending bearing or riding window looked
  // applied.
  const rideDirty = () => rideEdit() !== null;
  const bearDirty = () => bearEdit() !== null || bearMode() !== null;
  const emitDirty = () =>
    modeEdit() !== null || hzEdit() !== null || forceEdit() !== null || forceOnEdit() !== null;
  const revertRide = () => setRideEdit(null);
  const revertBear = () => { setBearEdit(null); setBearMode(null); };
  const revertEmit = () => {
    setModeEdit(null); setHzEdit(null); setForceEdit(null); setForceOnEdit(null);
  };
  const renderDirty = () => renderEdit() !== null || fullEdit() !== null;
  const revertRender = () => { setRenderEdit(null); setFullEdit(null); };

  const name = () => nameEdit() ?? version()?.name ?? '';
  const rideWindow = () => rideEdit() ?? (ride() && ride()! > 0 ? ride()! : 20);
  // Reads back off the box until touched, like every other control here.
  const bearWindow = () =>
    bearEdit() ?? (bearing() && bearing()!.windowMs > 0 ? bearing()!.windowMs : BEARING_WINDOW_DEFAULT_MS);
  const bearGeometry = (): BearingMode =>
    bearMode() !== null
      ? (Number(bearMode()) as BearingMode)
      : (bearing()?.mode ?? BearingMode.PerAxis);

  const setBearing = (windowMs: number) =>
    cmd.run(async () => {
      await dash.link()!.setBearing(windowMs, bearGeometry());
      setBearEdit(null);
      setBearMode(null);
      dash.refreshPoll('bearing');
    });
  const mode = () => modeEdit() ?? MODE_NAMES[emit()?.mode ?? EmitMode.Learned] ?? 'learned';
  const renderKey = () =>
    renderEdit() ?? RENDER_NAMES[render()?.mode ?? RenderMode.Despiked] ?? 'despiked';
  const fullOn = () => fullEdit() ?? (render()?.full ?? false);
  // A box that has never been in Fixed mode reports 0 here, which is below the field's own minimum
  // and would be sent as a 0 Hz Apply, so 0 falls through to the default rather than being shown.
  const hz = () => hzEdit() ?? (emit()?.fixedHz || 500);
  const forceOn = () => forceOnEdit() ?? (emit()?.forceHz ?? 0) > 0;
  // The box's own advertised rate is the sensible starting point. || not ??, as the sibling above: an
  // unforced box reports 0 here, which is below the field's own minimum and would be sent as an Apply
  // that turns the force off while the radio says Forced.
  const forceHz = () => forceEdit() ?? (emit()?.forceHz || emit()?.advertisedHz || 1000);

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
      await dash.link()!.setEmitPace(m, m === EmitMode.Fixed ? hz() : 0, forceOn() ? forceHz() : 0);
      setModeEdit(null);
      setHzEdit(null);
      setForceEdit(null);
      setForceOnEdit(null);
      dash.refreshPoll('emit');
    });

  const applyRender = () =>
    cmd.run(async () => {
      await dash.link()!.setRender(RENDER_MODES[renderKey()], fullOn());
      setRenderEdit(null);
      setFullEdit(null);
      dash.refreshPoll('render');
      dash.refreshPoll('emit');
    });

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="options" data-search-target>
        <Card>
          <CardHeader title="Options" subtitle="Persistent settings saved on the box" />

          <Section title="Box name" first>
          <p>
            Up to {NAME_MAX} letters, numbers and symbols; left unset, the box derives one from its
            id.
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

          <div id="imperfect-clone" data-search-target>
            <Section title="Imperfect clone">
            <p>
              Clone a device that needs more inputs than the box can copy, dropping one of them; the box
              reboots to apply.
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
          </div>

          <div id="movement-riding" data-search-target>
            <Section title="Movement riding">
            <p>
              Injected motion waits for a real mouse move within the window and is dropped if none
              arrives, so it keeps the real device's report timing.
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
              <Show when={rideDirty()}>
                <Button variant="subtle" onClick={revertRide}>
                  Revert
                </Button>
              </Show>
            </div>
            <Show when={ride() !== null} fallback={<p style={status}>Reading status...</p>}>
              <div style={status}>
                <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
                  {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
                </Chip>
                <Show when={rideDirty()}>
                  <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>not applied yet</span>
                </Show>
              </div>
            </Show>

            </Section>
          </div>

          <div id="bearing" data-search-target>
            <Section title="Bearing">
            <p>
              What the with and against lock directions are measured against: the direction the box is
              injecting on that axis, held for the window.
            </p>
            <RadioGroup
              name="bearing-mode"
              value={String(bearGeometry())}
              onChange={setBearMode}
              options={[
                { value: String(BearingMode.PerAxis), label: 'Per axis' },
                { value: String(BearingMode.Vector), label: 'Vector' },
              ]}
            />
            <p style={muted}>
              {bearGeometry() === BearingMode.Vector
                ? 'The physical delta is projected onto the injected XY vector, and only the part along it is weighed.'
                : 'Each axis is weighed against its own bearing.'}
            </p>
            <div style={controls}>
              <div style={{ 'max-width': '8rem' }}>
                <NumberInput
                  label="Window (ms)"
                  value={bearWindow()}
                  min={1}
                  max={65535}
                  onChange={(v) => setBearEdit(v ?? 1)}
                />
              </div>
              <Button variant="primary" disabled={cmd.busy()} onClick={() => setBearing(bearWindow())}>
                Apply
              </Button>
              <Button variant="secondary" disabled={cmd.busy()} onClick={() => setBearing(0)}>
                Turn off
              </Button>
              <Show when={bearDirty()}>
                <Button variant="subtle" onClick={revertBear}>
                  Revert
                </Button>
              </Show>
            </div>
            <Show when={bearing() !== null} fallback={<p style={status}>Reading status...</p>}>
              <div style={status}>
                <Chip variant={bearing()!.windowMs > 0 ? 'success' : 'neutral'}>
                  {bearing()!.windowMs > 0
                    ? `${bearing()!.mode === BearingMode.Vector ? 'Vector' : 'Per axis'} · ${bearing()!.windowMs} ms`
                    : 'Off'}
                </Chip>
                <Show when={bearDirty()}>
                  <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>not applied yet</span>
                </Show>
              </div>
            </Show>
            </Section>
          </div>

          <div id="texture" data-search-target>
            <Section title="Texture">
            <p>
              Chooses what the mouse's motion looks like on the wire, and whether your own movement is
              drawn the same way as anything the box adds.
            </p>
            <RadioGroup
              name="render-mode"
              value={renderKey()}
              onChange={setRenderEdit}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'stock', label: 'Stock' },
                { value: 'despiked', label: 'De-spiked' },
                { value: 'unsmoothed', label: 'Unsmoothed' },
              ]}
            />
            <p style={muted}>{RENDER_BLURB[renderKey()]}</p>
            <div id="render-full" data-search-target>
              <div class="api-response-label" style={section}>Your own movement</div>
              <RadioGroup
                name="render-full"
                value={fullOn() ? 'drawn' : 'relayed'}
                onChange={(v) => setFullEdit(v === 'drawn')}
                options={[
                  { value: 'relayed', label: 'Passed through' },
                  { value: 'drawn', label: 'Drawn too' },
                ]}
              />
              <p style={muted}>
                {fullOn()
                  ? 'Adds about 3 ms of delay to the mouse.'
                  : 'Reaches the game exactly as the mouse sent it.'}
              </p>
            </div>
            <div style={controls}>
              <Button variant="primary" disabled={cmd.busy()} onClick={applyRender}>
                Apply
              </Button>
              <Show when={renderDirty()}>
                <Button variant="subtle" onClick={revertRender}>
                  Revert
                </Button>
              </Show>
            </div>
            <Show when={render()} fallback={<p style={status}>Reading status...</p>}>
              {(r) => (
                <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Chip variant={r().mode === RenderMode.Off || r().mode === null ? 'neutral' : 'success'}>
                    {r().mode != null ? RENDER_LABEL[r().mode!] || 'Off' : 'Unknown'}
                  </Chip>
                  <Show when={r().full}>
                    <Chip variant="success">Your movement drawn too</Chip>
                  </Show>
                  <Show when={r().mode !== RenderMode.Off && !r().ready}>
                    <Chip variant="warning">Move the mouse to start</Chip>
                  </Show>
                  <Show when={renderDirty()}>
                    <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>
                      not applied yet
                    </span>
                  </Show>
                </div>
              )}
            </Show>
            </Section>
          </div>

          <div id="emit-rate" data-search-target>
            <Section title="Emit rate">
            <p>
              Paces injected motion as a ceiling and sets the rate the clone itself runs at. Apply
              writes both together.
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
            <p style={muted}>{MODE_BLURB[mode()]}</p>
            <div id="wire-rate" data-search-target>
              <div class="api-response-label" style={section}>Wire rate</div>
              <RadioGroup
                name="wire-rate"
                value={forceOn() ? 'forced' : 'device'}
                onChange={(v) => setForceOnEdit(v === 'forced')}
                options={[
                  { value: 'device', label: "Device's own" },
                  { value: 'forced', label: 'Forced' },
                ]}
              />
              <p style={muted}>
                {forceOn()
                  ? 'Runs the clone at a rate the mouse did not ask for.'
                  : 'Runs the clone at the rate the mouse asked for.'}
              </p>
            </div>
            <div style={controls}>
              <Show when={mode() === 'fixed'}>
                <div style={{ 'max-width': '8rem' }}>
                  <NumberInput
                    label="Emit rate (Hz)"
                    value={hz()}
                    min={1}
                    max={1000}
                    onChange={(v) => setHzEdit(v ?? 1)}
                  />
                </div>
              </Show>
              <Show when={forceOn()}>
                <div style={{ 'max-width': '8rem' }}>
                  <NumberInput
                    label="Wire rate (Hz)"
                    value={forceHz()}
                    min={4}
                    max={1000}
                    onChange={(v) => setForceEdit(v ?? 4)}
                  />
                </div>
              </Show>
              <Button variant="primary" disabled={cmd.busy()} onClick={applyEmit}>
                Apply
              </Button>
              <Show when={emitDirty()}>
                <Button variant="subtle" onClick={revertEmit}>
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
                <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Chip variant={s().mode === EmitMode.Learned || s().mode === null ? 'neutral' : 'success'}>
                    {emitLabel(s())}
                  </Chip>
                  <Show when={s().advertisedHz > 0}>
                    <Chip variant={s().forceActive ? 'success' : 'neutral'}>
                      {s().forceActive
                        ? `Forced \u00b7 ${s().advertisedHz} Hz`
                        : `Device's own \u00b7 ${s().advertisedHz} Hz`}
                    </Chip>
                  </Show>
                  <Show when={s().forceHz > 0 && !s().forceActive}>
                    <Chip variant="warning">Set, but needs Allow imperfect</Chip>
                  </Show>
                  <Show when={emitDirty()}>
                    <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>
                      not applied yet
                    </span>
                  </Show>
                </div>
              )}
            </Show>
            </Section>
          </div>

        </Card>
      </div>
    </Show>
  );
};

export default DeviceOptions;
