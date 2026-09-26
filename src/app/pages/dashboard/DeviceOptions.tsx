// Each control reads its value back from the box until touched. A hardcoded default here once made
// Apply reconfigure a box that looked unchanged.
import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { TextField } from '../../../components/inputs/TextField';
import {
  type EmitPace,
  type Spread,
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
  learned: "Matches native report rate.",
  interval: 'Follows the declared poll rate.',
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
  stock: 'Native texture, upstream smoother.',
  despiked: 'Native texture, ramped onset.',
  unsmoothed: 'Native texture, no smoother.',
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

const SPREAD_PERCENTS: Record<string, number> = { off: 0, half: 50, full: 100 };

const SPREAD_BLURB: Record<string, string> = {
  off: 'Injected motion on one report.',
  half: 'Injected motion over half the command interval.',
  full: 'Injected motion over the whole command interval.',
};

// A percent outside the three, set by another client, keeps its own entry.
const spreadKeyFor = (percent: number): string =>
  percent === 0 ? 'off' : percent === 50 ? 'half' : percent === 100 ? 'full' : 'custom';

const spreadLabel = (sp: Spread): string => {
  if (sp.percent === 0) return 'Off';
  const base = sp.percent === 50 ? 'Half' : sp.percent === 100 ? 'Full' : `${sp.percent}%`;
  return sp.spanUs > 0 ? `${base} · ${(sp.spanUs / 1000).toFixed(1)} ms` : base;
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
  const spread = dash.poll('spread');
  const version = dash.poll('version');
  const cmd = createCommand();

  // Each control reads back from the box until edited, then holds the edit until applied, so a poll
  // can't overwrite typing.
  const [nameEdit, setNameEdit] = createSignal<string | null>(null);
  const [rideEdit, setRideEdit] = createSignal<number | null>(null);
  const [bearEdit, setBearEdit] = createSignal<number | null>(null);
  const [bearMode, setBearMode] = createSignal<string | null>(null);
  const [modeEdit, setModeEdit] = createSignal<string | null>(null);
  const [renderEdit, setRenderEdit] = createSignal<string | null>(null);
  const [fullEdit, setFullEdit] = createSignal<boolean | null>(null);
  const [spreadEdit, setSpreadEdit] = createSignal<string | null>(null);
  const [hzEdit, setHzEdit] = createSignal<number | null>(null);
  const [forceEdit, setForceEdit] = createSignal<number | null>(null);
  const [forceOnEdit, setForceOnEdit] = createSignal<boolean | null>(null);

  // An unapplied edit offers Revert and marks the status chip.
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
  const spreadDirty = () => spreadEdit() !== null;
  const revertSpread = () => setSpreadEdit(null);

  const name = () => nameEdit() ?? version()?.name ?? '';
  const rideWindow = () => rideEdit() ?? (ride() && ride()! > 0 ? ride()! : 20);
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
  // A box never in Fixed mode reports 0, below the field minimum, so `||` falls through to 500.
  const hz = () => hzEdit() ?? (emit()?.fixedHz || 500);
  const forceOn = () => forceOnEdit() ?? (emit()?.forceHz ?? 0) > 0;
  // `||` as above: an unforced box reports 0, which would Apply as force off under a Forced radio.
  const forceHz = () => forceEdit() ?? (emit()?.forceHz || emit()?.advertisedHz || 1000);

  // Each write clears its edit only once sent, so a failure leaves the edit showing.
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

  const spreadKey = () => spreadEdit() ?? spreadKeyFor(spread()?.percent ?? 100);

  const applySpread = () =>
    cmd.run(async () => {
      await dash.link()!.setSpread(SPREAD_PERCENTS[spreadKey()] ?? spread()?.percent ?? 100);
      setSpreadEdit(null);
      dash.refreshPoll('spread');
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
          <CardHeader title="Options" subtitle="Saved on the box" />
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert">{cmd.error()}</div>
          </Show>

          <Section title="Box name" first>
          <p>
            Up to {NAME_MAX} letters, numbers and symbols. Unset, the box derives one from its id.
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
          <Show when={version()} fallback={<p style={status}>Reading...</p>}>
            <div style={status}>
              <Chip variant="neutral">{version()!.name}</Chip>
            </div>
          </Show>

          </Section>

          <div id="imperfect-clone" data-search-target>
            <Section title="Imperfect clone">
            <p>
              Clones a device the box can't copy exactly, and unlocks the advanced control tab.
            </p>
            <div style={controls}>
              <Button variant="primary" disabled={cmd.busy()} onClick={() => allowImperfect(true)}>
                Allow imperfect
              </Button>
              <Button variant="secondary" disabled={cmd.busy()} onClick={() => allowImperfect(false)}>
                Faithful only
              </Button>
            </div>
            <Show when={imperfect()} fallback={<p style={status}>Reading...</p>}>
              {(s) => (
                <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Chip variant={s().allowed ? 'success' : 'neutral'}>
                    {s().allowed ? 'Allowed' : 'Faithful only'}
                  </Chip>
                  <Show when={s().overCapacity}>
                    <Chip variant="warning">Device over box capacity, or high speed</Chip>
                  </Show>
                </div>
              )}
            </Show>

            </Section>
          </div>

          <div id="movement-riding" data-search-target>
            <Section title="Movement riding">
            <p>
              Injected motion waits up to the window for physical motion and is dropped if none
              arrives, keeping native report timing.
            </p>
            <div style={controls}>
              <div style={{ 'max-width': '8rem' }}>
                <NumberInput
                  label="Window (ms)"
                  value={rideWindow()}
                  min={1}
                  max={65535}
                  precision={0}
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
            <Show when={ride() !== null} fallback={<p style={status}>Reading...</p>}>
              <div style={status}>
                <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
                  {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
                </Chip>
                <Show when={rideDirty()}>
                  <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>not applied</span>
                </Show>
              </div>
            </Show>

            </Section>
          </div>

          <div id="bearing" data-search-target>
            <Section title="Bearing">
            <p>
              The reference for the with and against lock directions: the injected direction on each
              axis, held for the window.
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
                ? 'Only the part of the physical delta along the injected vector is weighed.'
                : 'Each axis is weighed against its own bearing.'}
            </p>
            <div style={controls}>
              <div style={{ 'max-width': '8rem' }}>
                <NumberInput
                  label="Window (ms)"
                  value={bearWindow()}
                  min={1}
                  max={65535}
                  precision={0}
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
            <Show when={bearing() !== null} fallback={<p style={status}>Reading...</p>}>
              <div style={status}>
                <Chip variant={bearing()!.windowMs > 0 ? 'success' : 'neutral'}>
                  {bearing()!.windowMs > 0
                    ? `${bearing()!.mode === BearingMode.Vector ? 'Vector' : 'Per axis'} · ${bearing()!.windowMs} ms`
                    : 'Off'}
                </Chip>
                <Show when={bearDirty()}>
                  <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>not applied</span>
                </Show>
              </div>
            </Show>
            </Section>
          </div>

          <div id="render" data-search-target>
            <Section title="Render">
            <p>
              Emits injected motion with native report texture, and picks which motion is rendered.
              One Apply saves both.
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
              <div class="api-response-label" style={section}>Rendered motion</div>
              <RadioGroup
                name="render-full"
                value={fullOn() ? 'both' : 'injected'}
                onChange={(v) => setFullEdit(v === 'both')}
                options={[
                  { value: 'injected', label: 'Injected only' },
                  { value: 'both', label: 'Injected and native' },
                ]}
              />
              <p style={muted}>
                {!fullOn()
                  ? "Native motion is relayed untouched."
                  : renderKey() === 'off'
                    ? 'Renders nothing while the mode is off.'
                    : 'Both go through the model as one stream.'}
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
            <Show when={render()} fallback={<p style={status}>Reading...</p>}>
              {(r) => (
                <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Chip variant={r().mode === RenderMode.Off || r().mode === null ? 'neutral' : 'success'}>
                    {r().mode != null ? RENDER_LABEL[r().mode!] || 'Off' : 'Unknown'}
                  </Chip>
                  <Show when={r().full}>
                    {/* Until a profile arms, the box relays however this is set. */}
                    <Chip variant={r().mode === RenderMode.Off || !r().ready ? 'neutral' : 'success'}>
                      {r().mode === RenderMode.Off || !r().ready
                        ? 'Native motion relayed'
                        : 'Native motion rendered'}
                    </Chip>
                  </Show>
                  <Show when={r().mode !== RenderMode.Off && !r().ready}>
                    <Chip variant="warning">Move the mouse to start</Chip>
                  </Show>
                  <Show when={renderDirty()}>
                    <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>
                      not applied
                    </span>
                  </Show>
                </div>
              )}
            </Show>
            </Section>
          </div>

          <div id="spread" data-search-target>
            <Section title="Spread">
            <p>
              Releases injected motion across the interval between host commands, so injected reports
              carry native per-report magnitude.
            </p>
            <RadioGroup
              name="spread-percent"
              value={spreadKey()}
              onChange={setSpreadEdit}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'half', label: 'Half' },
                { value: 'full', label: 'Full' },
              ]}
            />
            <p style={muted}>{SPREAD_BLURB[spreadKey()] ?? 'Injected motion over its own share of the command interval.'}</p>
            <div style={controls}>
              <Button variant="primary" disabled={cmd.busy()} onClick={applySpread}>
                Apply
              </Button>
              <Show when={spreadDirty()}>
                <Button variant="subtle" onClick={revertSpread}>
                  Revert
                </Button>
              </Show>
            </div>
            <Show when={spread()} fallback={<p style={status}>Reading...</p>}>
              {(sp) => (
                <div style={status}>
                  <Chip variant={sp().percent === 0 ? 'neutral' : 'success'}>{spreadLabel(sp())}</Chip>
                  {/* The box learns the interval from injection, so nothing spreads until some arrives. */}
                  <Show when={sp().percent > 0 && sp().spanUs === 0}>
                    <Chip variant="warning">Waiting for injection</Chip>
                  </Show>
                  <Show when={spreadDirty()}>
                    <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>not applied</span>
                  </Show>
                </div>
              )}
            </Show>
            </Section>
          </div>

          <div id="emit-rate" data-search-target>
            <Section title="Emit rate">
            <p>
              Paces injected motion as a ceiling, and sets the clone's wire rate. One Apply saves both.
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
                  { value: 'device', label: 'Native' },
                  { value: 'forced', label: 'Forced' },
                ]}
              />
              <p style={muted}>
                {forceOn()
                  ? 'Advertises the interval you pick.'
                  : 'Advertises the interval the device declares.'}
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
                    precision={0}
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
                    precision={0}
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
            <Show when={emit()} fallback={<p style={status}>Reading...</p>}>
              {(s) => (
                <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Chip variant={s().mode === EmitMode.Learned || s().mode === null ? 'neutral' : 'success'}>
                    {emitLabel(s())}
                  </Chip>
                  <Show when={s().advertisedHz > 0}>
                    <Chip variant={s().forceActive ? 'success' : 'neutral'}>
                      {s().forceActive
                        ? `Forced \u00b7 ${s().advertisedHz} Hz`
                        : `Native \u00b7 ${s().advertisedHz} Hz`}
                    </Chip>
                  </Show>
                  <Show when={s().forceHz > 0 && !s().forceActive}>
                    <Chip variant="warning">Set, but needs Allow imperfect</Chip>
                  </Show>
                  <Show when={emitDirty()}>
                    <span style={{ ...muted, 'margin-left': 'var(--g-spacing-sm)' }}>
                      not applied
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
