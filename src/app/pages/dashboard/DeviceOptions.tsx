// Each control reads its value back from the box until touched: a hardcoded default would make Apply
// reconfigure a box that looks unchanged.
import { Show, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { TextField } from '../../../components/inputs/TextField';
import {
  type EmitPace,
  type Spread,
  BEARING_WINDOW_DEFAULT_MS,
  BearingMode,
  EmitMode,
  RenderMode,
  NAME_MAX,
  PROTO_VER,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Panel } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';
import { CopyLink } from '../../shell/CopyLink';
import { FixLink } from '../../shell/Filter';

// An option's section on the Guide's Options page.
const GuideLink = (props: { id: string }) => (
  <span class="cross" data-search-skip data-agent-hide>
    <FixLink href={`/guide/options#${props.id}`}>Guide</FixLink>
  </span>
);

const EMIT_MODES: Record<string, EmitMode> = {
  learned: EmitMode.Learned,
  interval: EmitMode.Interval,
  fixed: EmitMode.Fixed,
  rendered: EmitMode.Rendered,
};

const MODE_BLURB: Record<string, string> = {
  learned: 'The native report rate, measured as the mouse moves.',
  interval: 'The rate the clone declares.',
  fixed: 'The rate you pick.',
  rendered: 'Paced by the renderer, as on v3.3.0.',
};

const MODE_NAMES: Record<number, string> = {
  [EmitMode.Learned]: 'learned',
  [EmitMode.Interval]: 'interval',
  [EmitMode.Fixed]: 'fixed',
  [EmitMode.Rendered]: 'rendered',
};

const RENDER_MODES: Record<string, RenderMode> = {
  off: RenderMode.Off,
  stock: RenderMode.Stock,
  despiked: RenderMode.Despiked,
  unsmoothed: RenderMode.Unsmoothed,
};

const RENDER_BLURB: Record<string, string> = {
  off: 'An even stream at the Emit rate.',
  stock: "The model's original smoother.",
  despiked: 'The original smoother, ramped up over 8 ms.',
  unsmoothed: 'No smoother.',
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
  off: 'The whole delta, emitted on the next report.',
  half: 'Over half the command interval.',
  full: 'Over the whole command interval.',
};

// A percent outside the three, set by another client, gets an extra entry.
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
    case EmitMode.Rendered:
      base = e.resolvedHz > 0 ? `Rendered · ${e.resolvedHz} Hz` : 'Rendered';
      break;
    default:
      base = 'Unknown';
  }
  return base;
};

// `proto`: the box's protocol. A box on older firmware gets the options it has; Render and Spread came with
// protocol 6, and Control's Advanced tab only on the current one.
const DeviceOptions = (props: { proto?: number }) => {
  const dash = useDashboard();
  const has = (proto: number) => (props.proto ?? PROTO_VER) >= proto;
  const imperfect = dash.poll('imperfect');
  const ride = dash.poll('moveRide');
  const bearing = dash.poll('bearing');
  const emit = dash.poll('emit');
  const render = has(6) ? dash.poll('render') : () => null;
  const spread = has(6) ? dash.poll('spread') : () => null;
  const version = dash.poll('version');
  const cmd = createCommand();
  // A refused write shows in the panel whose button sent it.
  const [at, setAt] = createSignal('');
  const act = (panel: string, fn: () => Promise<unknown>) => {
    setAt(panel);
    cmd.run(fn);
  };
  const Refused = (props: { panel: string }) => (
    <Show when={at() === props.panel && cmd.error()}>
      {(msg) => (
        <div class="callout callout--danger" role="alert">
          {msg()}
        </div>
      )}
    </Show>
  );

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
    act('bearing', async () => {
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
    act('box-name', async () => {
      await dash.link()!.setName(v);
      setNameEdit(null);
      dash.refreshPoll('version');
    });
  };

  const clearName = () =>
    act('box-name', async () => {
      await dash.link()!.clearName();
      setNameEdit(null);
      dash.refreshPoll('version');
    });

  const allowImperfect = (allow: boolean) =>
    act('imperfect-clone', async () => {
      await dash.link()!.allowImperfectClones(allow);
      dash.refreshPoll('imperfect');
    });

  const setRiding = (ms: number) =>
    act('movement-riding', async () => {
      await dash.link()!.setMovementRiding(ms);
      setRideEdit(null);
      dash.refreshPoll('moveRide');
    });

  const applyEmit = () =>
    act('emit-rate', async () => {
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
    act('spread', async () => {
      await dash.link()!.setSpread(SPREAD_PERCENTS[spreadKey()] ?? spread()?.percent ?? 100);
      setSpreadEdit(null);
      dash.refreshPoll('spread');
    });

  const applyRender = () =>
    act('render', async () => {
      await dash.link()!.setRender(RENDER_MODES[renderKey()], fullOn());
      setRenderEdit(null);
      setFullEdit(null);
      dash.refreshPoll('render');
      dash.refreshPoll('emit');
    });

  return (
    <Show when={dash.status() === 'connected'}>
      <Panel id="box-name" title="Box name" aside={<GuideLink id="box-name" />}>
        <p>
          Up to {NAME_MAX} letters, numbers and symbols.
        </p>
        <div class="acts">
          <div class="fw-l">
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
        <Show when={version()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          <div class="chips">
            <Chip variant="neutral">{version()!.name}</Chip>
          </div>
        </Show>
        <Refused panel="box-name" />
      </Panel>

      <Panel id="imperfect-clone" title="Imperfect clone" aside={<GuideLink id="imperfect-clone" />}>
        <p>
          {has(PROTO_VER)
            ? 'Clones a device the box can\'t copy faithfully, and unlocks the Advanced tab on Control.'
            : 'Clones a device the box can\'t copy faithfully.'}
        </p>
        <div class="acts">
          <Button variant="primary" disabled={cmd.busy()} onClick={() => allowImperfect(true)}>
            Allow imperfect
          </Button>
          <Button variant="secondary" disabled={cmd.busy()} onClick={() => allowImperfect(false)}>
            Faithful only
          </Button>
        </div>
        <Show when={imperfect()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          {(s) => (
            <div class="chips">
              <Chip variant={s().allowed ? 'success' : 'neutral'}>
                {s().allowed ? 'Allowed' : 'Faithful only'}
              </Chip>
              <Show when={s().overCapacity}>
                <Chip variant="warning">Over capacity or high speed</Chip>
              </Show>
            </div>
          )}
        </Show>
        <Refused panel="imperfect-clone" />
      </Panel>

      <Panel id="movement-riding" title="Movement riding" aside={<GuideLink id="movement-riding" />}>
        <p>
          Injected motion waits up to the window for the next native report and rides it. Motion still
          waiting is dropped.
        </p>
        <div class="acts">
          <div class="fw-s">
            <NumberInput
              label="Window"
              suffix="ms"
              value={rideWindow()}
              min={1}
              max={65535}
              precision={0}
              onChange={(v) => setRideEdit(v ?? 1)}
            />
          </div>
          <Button variant="primary" disabled={cmd.busy()} onClick={() => setRiding(rideWindow())}>
            Apply
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
        <Show when={ride() !== null} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          <div class="chips">
            <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
              {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
            </Chip>
            <Show when={rideDirty()}>
              <span class="mut">Not applied</span>
            </Show>
          </div>
        </Show>
        <Refused panel="movement-riding" />
      </Panel>

      <Panel id="bearing" title="Bearing" aside={<GuideLink id="bearing" />}>
        <p>
          The direction of the last injected motion, kept for the window. Lock's With injection and
          Against injection scales compare native motion with it.
        </p>
        <Segmented
          name="bearing-mode"
          label="Bearing"
          value={String(bearGeometry())}
          onChange={setBearMode}
          options={[
            { value: String(BearingMode.PerAxis), label: 'Per axis' },
            { value: String(BearingMode.Vector), label: 'Vector' },
          ]}
        />
        <p class="mut">
          {bearGeometry() === BearingMode.Vector
            ? 'Only native motion along the injected direction is scaled.'
            : 'X and Y are compared with the injected direction separately.'}
        </p>
        <div class="acts">
          <div class="fw-s">
            <NumberInput
              label="Window"
              suffix="ms"
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
        <Show when={bearing() !== null} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          <div class="chips">
            <Chip variant={bearing()!.windowMs > 0 ? 'success' : 'neutral'}>
              {bearing()!.windowMs > 0
                ? `${bearing()!.mode === BearingMode.Vector ? 'Vector' : 'Per axis'} · ${bearing()!.windowMs} ms`
                : 'Off'}
            </Chip>
            <Show when={bearDirty()}>
              <span class="mut">Not applied</span>
            </Show>
          </div>
        </Show>
        <Refused panel="bearing" />
      </Panel>

      <Show when={has(6)}>
      <Panel id="render" title="Render" aside={<GuideLink id="render" />}>
        <p>
          Emits injected motion with the mouse's native report texture, learned by a model.
        </p>
        <Segmented
          name="render-mode"
          label="Render mode"
          value={renderKey()}
          onChange={setRenderEdit}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'stock', label: 'Stock' },
            { value: 'despiked', label: 'De-spiked' },
            { value: 'unsmoothed', label: 'Unsmoothed' },
          ]}
        />
        <p class="mut">{RENDER_BLURB[renderKey()]}</p>
        <div id="render-full" class="labelled" data-search-target>
          <div class="field-row">
            <span class="field-l">
              Rendered motion
              <CopyLink id="render-full" label="Rendered motion" />
            </span>
            <GuideLink id="render-full" />
          </div>
          <Segmented
            name="render-full"
            label="Rendered motion"
            value={fullOn() ? 'both' : 'injected'}
            onChange={(v) => setFullEdit(v === 'both')}
            options={[
              { value: 'injected', label: 'Injected only' },
              { value: 'both', label: 'Injected and native' },
            ]}
          />
          <p class="mut">
            {!fullOn()
              ? 'Native motion is relayed untouched.'
              : renderKey() === 'off'
                ? 'Nothing is rendered while Render is off.'
                : 'Native and injected motion are rendered as one stream.'}
          </p>
        </div>
        <div class="acts">
          <Button variant="primary" disabled={cmd.busy()} onClick={applyRender}>
            Apply
          </Button>
          <Show when={renderDirty()}>
            <Button variant="subtle" onClick={revertRender}>
              Revert
            </Button>
          </Show>
        </div>
        <Show when={render()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          {(r) => (
            <div class="chips">
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
                <Chip variant="neutral">Move the mouse to start</Chip>
              </Show>
              <Show when={renderDirty()}>
                <span class="mut">
                  Not applied
                </span>
              </Show>
            </div>
          )}
        </Show>
        <Refused panel="render" />
      </Panel>

      <Panel id="spread" title="Spread" aside={<GuideLink id="spread" />}>
        <p>
          Spreads each command's delta across the command interval, so no single report carries all of
          it.
        </p>
        <Segmented
          name="spread-percent"
          label="Spread"
          value={spreadKey()}
          onChange={setSpreadEdit}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'half', label: 'Half' },
            { value: 'full', label: 'Full' },
          ]}
        />
        <p class="mut">{SPREAD_BLURB[spreadKey()] ?? 'Over part of the command interval.'}</p>
        <div class="acts">
          <Button variant="primary" disabled={cmd.busy()} onClick={applySpread}>
            Apply
          </Button>
          <Show when={spreadDirty()}>
            <Button variant="subtle" onClick={revertSpread}>
              Revert
            </Button>
          </Show>
        </div>
        <Show when={spread()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          {(sp) => (
            <div class="chips">
              <Chip variant={sp().percent === 0 ? 'neutral' : 'success'}>{spreadLabel(sp())}</Chip>
              {/* The box learns the interval from injection, so nothing spreads until some arrives. */}
              <Show when={sp().percent > 0 && sp().spanUs === 0}>
                <Chip variant="neutral">Waiting for injection</Chip>
              </Show>
              <Show when={spreadDirty()}>
                <span class="mut">Not applied</span>
              </Show>
            </div>
          )}
        </Show>
        <Refused panel="spread" />
      </Panel>
      </Show>

      <Panel id="emit-rate" title="Emit rate" aside={<GuideLink id="emit-rate" />}>
        <p>
          The fastest the box emits injected motion, and the poll rate the clone declares.
        </p>
        <Segmented
          name="emit-mode"
          label="Emit mode"
          value={mode()}
          onChange={setModeEdit}
          options={[
            { value: 'learned', label: 'Learned' },
            { value: 'interval', label: 'Interval' },
            { value: 'fixed', label: 'Fixed' },
            ...(emit()?.mode === EmitMode.Rendered ? [{ value: 'rendered', label: 'Rendered' }] : []),
          ]}
        />
        <p class="mut">{MODE_BLURB[mode()]}</p>
        <div id="wire-rate" class="labelled" data-search-target>
          <div class="field-row">
            <span class="field-l">
              Wire rate
              <CopyLink id="wire-rate" label="Wire rate" />
            </span>
            <GuideLink id="wire-rate" />
          </div>
          <Segmented
            name="wire-rate"
            label="Wire rate"
            value={forceOn() ? 'forced' : 'device'}
            onChange={(v) => setForceOnEdit(v === 'forced')}
            options={[
              { value: 'device', label: 'Native' },
              { value: 'forced', label: 'Forced' },
            ]}
          />
          <p class="mut">
            {forceOn()
              ? 'The clone declares the rate you pick.'
              : 'The clone declares the native poll rate.'}
          </p>
        </div>
        <div class="acts">
          <Show when={mode() === 'fixed' || forceOn()}>
            <div class="fields">
              <Show when={mode() === 'fixed'}>
                <div class="fw-s">
                  <NumberInput
                    label="Emit rate"
                    suffix="Hz"
                    value={hz()}
                    min={1}
                    max={1000}
                    precision={0}
                    onChange={(v) => setHzEdit(v ?? 1)}
                  />
                </div>
              </Show>
              <Show when={forceOn()}>
                <div class="fw-s">
                  <NumberInput
                    label="Wire rate"
                    suffix="Hz"
                    value={forceHz()}
                    min={4}
                    max={1000}
                    precision={0}
                    onChange={(v) => setForceEdit(v ?? 4)}
                  />
                </div>
              </Show>
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
        <Show when={emit()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
          {(s) => (
            <div class="chips">
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
                <span class="mut">
                  Not applied
                </span>
              </Show>
            </div>
          )}
        </Show>
        <Refused panel="emit-rate" />
      </Panel>

    </Show>
  );
};

export default DeviceOptions;
