import { For, Show, createEffect, createSignal, onCleanup, type Component } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Slider } from '../../../components/inputs/Slider';
import { useDashboard } from './context';
import { EmitMode } from '../../../dashboard/protocol/opcode';
import { CatchClass, filterTrafficClass } from '../../../dashboard/protocol/types';
import { SCENARIOS, type Scenario } from './renderlab/scenarios';
import { type Slot } from './renderlab/capture';
import { inferLayout, parseMouseDelta } from './renderlab/parse';
import { TimelineLanes, MetricsPanel, DeltaHistogram, GapHistogram, DetectionLens, CursorPath } from './renderlab/views';
import '../../../styles/docs.css';

const WINDOW_MS = 3000;
const muted = { color: 'var(--g-text-muted, #8b93a7)', 'font-size': '0.9em' } as const;

const RenderLab: Component = () => {
  const dash = useDashboard();
  const connected = () => dash.status() === 'connected';
  const caps = dash.poll('caps');

  const [scenarioId, setScenarioId] = createSignal('aim');
  const scenario = () => SCENARIOS.find((s) => s.id === scenarioId()) ?? SCENARIOS[0];
  const [mag, setMag] = createSignal(5);
  const [freq, setFreq] = createSignal(0.8);
  const [slots, setSlots] = createSignal<Slot[]>([]);
  const [running, setRunning] = createSignal(false);
  const [liveRendered, setLiveRendered] = createSignal(true);
  const [status, setStatus] = createSignal('');

  // Shared capture refs. `generation` fences an in-flight run: a stale run (Stop, restart, unmount,
  // disconnect) sees its gen superseded and touches no shared state.
  const BUF_CAP = 12000;
  let cur: Slot | null = null;
  let startUs: number | null = null;
  let capStart = 0;
  let liveFlag = false;
  let activeDriver: number | undefined;
  let rafid: number | undefined;
  let generation = 0;

  const unsub = dash.subscribeEvents((ev) => {
    if (!cur || ev.kind !== 'traffic' || ev.traffic.cls !== CatchClass.Emit) return;
    const tr = ev.traffic;
    if (startUs === null) startUs = tr.tsUs;
    let d = tr.tsUs - startUs;
    if (d < 0) d += 0x100000000; // the u32 microsecond counter wrapped
    const t = d / 1000;
    const p = parseMouseDelta(tr.bytes, inferLayout(tr.trueLen, caps()?.mouse.hasReportId ?? false));
    cur.emits.push(p ? { t, dx: p.dx, dy: p.dy, d: Math.round(Math.hypot(p.dx, p.dy)), hasDelta: true } : { t, dx: 0, dy: 0, d: 0, hasDelta: false });
    if (cur.emits.length > BUF_CAP) cur.emits.splice(0, cur.emits.length - BUF_CAP);
  });

  const teardown = () => {
    generation++;
    if (activeDriver) { clearInterval(activeDriver); activeDriver = undefined; }
    if (rafid) { cancelAnimationFrame(rafid); rafid = undefined; }
    cur = null;
    dash.link()?.uncatch().catch(() => {});
    dash.link()?.setEmitPace(EmitMode.Learned, false, 0, 0).catch(() => {});
  };
  onCleanup(() => { unsub(); teardown(); });

  const setDuration = () => {
    if (!cur) return;
    const e = cur.emits;
    cur.durationMs = liveFlag && e.length > 1 ? e[e.length - 1].t - e[0].t : performance.now() - capStart;
  };
  const repaintLoop = () => {
    setDuration();
    setSlots((s) => s.slice());
    rafid = running() ? requestAnimationFrame(repaintLoop) : undefined;
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const mkSlot = (rendered: boolean): Slot => ({ label: rendered ? 'Rendered' : 'Paced', rendered, emits: [], durationMs: 0 });

  // Fill `slot` (already shown, so the timeline builds live). Every await re-checks `gen`.
  const captureInto = async (slot: Slot, ms: number, live: boolean, gen: number): Promise<void> => {
    const link = dash.link();
    if (!link) return;
    await link.setEmitPace(EmitMode.Learned, slot.rendered, 0, 0);
    if (gen !== generation) return;
    await link.catch(filterTrafficClass(CatchClass.Emit, 8));
    if (gen !== generation) return;
    cur = slot;
    startUs = null;
    capStart = performance.now();
    liveFlag = live;
    const sc = scenario();
    let pending = 0;
    const local = sc.pointerDriven
      ? undefined
      : window.setInterval(() => {
          if (gen !== generation) { clearInterval(local); return; }
          if (pending > 6) return; // don't outrun a slow write path
          const { dx, dy } = sc.tick(performance.now() - capStart, mag(), freq());
          if (dx || dy) { pending++; link.moveRel(dx, dy).catch(() => {}).finally(() => (pending -= 1)); }
        }, sc.tickMs);
    activeDriver = local;
    if (live) return;
    await sleep(ms);
    if (local) clearInterval(local);
    if (gen !== generation) return;
    setDuration();
    cur = null;
    activeDriver = undefined;
    await link.uncatch().catch(() => {});
  };

  function stopAll() {
    teardown();
    setRunning(false);
  }
  // Stop cleanly if the box drops out mid-run.
  createEffect(() => { if (!connected() && running()) stopAll(); });

  // A/B: run paced, then rendered, back to back, and show both.
  const runCompare = async () => {
    if (!connected() || running()) return;
    const gen = ++generation;
    setRunning(true);
    setSlots([]);
    repaintLoop();
    setStatus('Capturing paced…');
    const paced = mkSlot(false);
    setSlots([paced]);
    await captureInto(paced, WINDOW_MS, false, gen);
    if (gen !== generation) return;
    setStatus('Capturing rendered…');
    const rendered = mkSlot(true);
    setSlots([paced, rendered]);
    await captureInto(rendered, WINDOW_MS, false, gen);
    if (gen !== generation) return;
    setStatus(
      rendered.emits.length === 0 && paced.emits.length > 0
        ? 'Rendered emitted nothing: the box builds its model from the device\'s own motion, so move the mouse (or run Mirror) to profile it, then retry.'
        : '',
    );
    stopAll();
  };

  // Live: one continuous capture with a Rendered toggle you flip while watching.
  const runLive = async () => {
    if (!connected() || running()) return;
    const gen = ++generation;
    setRunning(true);
    setSlots([]);
    repaintLoop();
    setStatus('Live — flip Rendered to compare');
    const slot = mkSlot(liveRendered());
    setSlots([slot]);
    await captureInto(slot, 0, true, gen);
  };

  const toggleLiveRendered = async (on: boolean) => {
    setLiveRendered(on);
    if (running() && cur) {
      cur.label = on ? 'Rendered' : 'Paced';
      cur.rendered = on;
      await dash.link()?.setEmitPace(EmitMode.Learned, on, 0, 0).catch(() => {});
    }
  };

  const onPadMove = (e: PointerEvent) => {
    if (!running() || !scenario().pointerDriven) return;
    const dx = Math.round(e.movementX);
    const dy = Math.round(e.movementY);
    if (dx || dy) dash.link()?.moveRel(dx, dy).catch(() => {});
  };

  return (
    <>
      <Card>
        <CardHeader title="Render Lab" subtitle="See the difference between rendered and paced injection, live from the box" />
        <Show when={!connected()}>
          <div class="callout callout--warning"><p>Connect a box on the Device page first.</p></div>
        </Show>
        <p style={muted}>
          The lab injects a scenario and plots the box's own emitted report stream. Hold your mouse still
          for every scenario except Mirror, so the stream is the injection alone.
        </p>

        <div class="api-response-label">Scenario</div>
        <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.4rem' }}>
          <For each={SCENARIOS}>
            {(s: Scenario) => (
              <Button variant={scenarioId() === s.id ? 'primary' : 'subtle'} disabled={running()} onClick={() => setScenarioId(s.id)}>
                {s.label}
              </Button>
            )}
          </For>
        </div>
        <p style={muted}>{scenario().blurb}</p>

        <Show when={scenario().id === 'custom'}>
          <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'margin-top': '0.5rem' }}>
            <div style={{ 'min-width': '12rem' }}>
              <div style={muted}>Magnitude {mag()}</div>
              <Slider min={1} max={20} value={mag()} onChange={(v) => setMag(v as number)} disabled={running()} />
            </div>
            <div style={{ 'min-width': '12rem' }}>
              <div style={muted}>Frequency {freq().toFixed(1)} Hz</div>
              <Slider min={0.1} max={3} step={0.1} value={freq()} onChange={(v) => setFreq(v as number)} disabled={running()} />
            </div>
          </div>
        </Show>

        <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'center', 'margin-top': '0.75rem', 'flex-wrap': 'wrap' }}>
          <Show
            when={!scenario().pointerDriven}
            fallback={
              <Show when={!running()} fallback={<Button variant="danger" onClick={stopAll}>Stop</Button>}>
                <Button variant="primary" disabled={!connected()} onClick={runLive}>Start mirror</Button>
              </Show>
            }
          >
            <Button variant="primary" disabled={!connected() || running()} onClick={runCompare}>Compare paced vs rendered</Button>
            <Show when={!running()} fallback={<Button variant="danger" onClick={stopAll}>Stop</Button>}>
              <Button variant="subtle" disabled={!connected()} onClick={runLive}>Live toggle</Button>
            </Show>
          </Show>
          <Show when={slots().length > 0 && !running()}>
            <Button variant="subtle" onClick={() => setSlots([])}>Clear</Button>
          </Show>
          <span style={muted}>{status()}</span>
        </div>

        <Show when={running() && scenario().pointerDriven}>
          <div
            onPointerMove={onPadMove}
            style={{ 'margin-top': '0.75rem', height: '90px', border: '1px dashed var(--g-border, #444)', 'border-radius': '6px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', color: 'var(--g-text-muted, #8b93a7)', 'touch-action': 'none' }}
          >
            move here to inject
          </div>
        </Show>

        <Show when={!scenario().pointerDriven && running()}>
          <label style={{ display: 'flex', gap: '0.4rem', 'align-items': 'center', 'margin-top': '0.5rem', ...muted }}>
            <input type="checkbox" checked={liveRendered()} onChange={(e) => toggleLiveRendered(e.currentTarget.checked)} />
            Rendered {liveRendered() ? 'on' : 'off'}
          </label>
        </Show>
      </Card>

      <Card>
        <CardHeader title="Timeline" subtitle="Each emitted report over time; gaps are idle milliseconds" />
        <TimelineLanes slots={slots} />
        <div style={{ 'margin-top': '0.75rem' }}><MetricsPanel slots={slots} /></div>
      </Card>

      <Card>
        <CardHeader title="Detection lens" subtitle="Report density against idle fraction; the shaded box is a human hand" />
        <DetectionLens slots={slots} />
      </Card>

      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--g-spacing, 1rem)' }}>
        <Card>
          <CardHeader title="Per-report deltas" subtitle="Distribution of report magnitudes" />
          <DeltaHistogram slots={slots} />
        </Card>
        <Card>
          <CardHeader title="Report gaps" subtitle="Distribution of inter-report gaps" />
          <GapHistogram slots={slots} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Cursor path" subtitle="The trajectory each mode traces to the same place" />
        <CursorPath slots={slots} />
      </Card>
    </>
  );
};

export default RenderLab;
