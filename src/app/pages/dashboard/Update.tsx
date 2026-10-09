import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, on, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { type Version, versionString } from '../../../dashboard/protocol';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { parseVersion } from '../../../dashboard/flash';
import { BoxScope, useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
import { WiringPorts } from './PortDiagram';
import ManualFlash from './Advanced';
import { PageHeader } from '../../shell/PageHeader';
import { PageTabs, Pane } from '../../shell/PageTabs';
import { prefersReducedMotion } from '../../shell/motion';

type Step = 'choose' | 'update' | 'done' | 'sent';
type Which = 'both' | 'main' | 'mouse';
type Stage = 'host' | 'device' | 'restart' | 'verify';

const LABEL: Record<Which, string> = { both: 'Update both chips', main: 'Update main chip', mouse: 'Update mouse-side chip' };
const STAGE_LABEL: Record<Stage, string> = { host: 'Mouse-side chip', device: 'Main chip', restart: 'Restart', verify: 'Verify' };
// The mouse-side chip writes first: the main chip's running firmware relays its image.
const stagesFor = (device: boolean, host: boolean): Stage[] => [
  ...(host ? (['host'] as const) : []),
  ...(device ? (['device'] as const) : []),
  'restart',
  'verify',
];

// The stage strip and the progress under it, while an update runs. Each chip's write counts from 0 to
// 100%; between stages the filled line leaves to the right and the figure fades before the next count
// starts; restarting and verifying are waits, a segment running the line.
const Progress = (props: { stages: Stage[] }) => {
  const dash = useDashboard();
  const stage = createMemo((): Stage | null => {
    const p = dash.updateProgress();
    if (!p) return null;
    if (p.phase === 'writing') return p.chip ?? 'device';
    if (p.phase === 'restarting') return 'restart';
    if (p.phase === 'verifying' || p.phase === 'done') return 'verify';
    return null;
  });
  const live = () => {
    const p = dash.updateProgress();
    return p?.phase === 'writing' && p.total ? Math.min(1, (p.written ?? 0) / p.total) : 0;
  };
  // What shows: a stage keeps showing, full, for the changeover before the next one replaces it.
  const [shown, setShown] = createSignal<Stage | null>(stage());
  const [out, setOut] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(stage, (next, prev) => {
      if (!prev || !next || prev === next || prefersReducedMotion()) {
        setShown(next);
        return;
      }
      setOut(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setOut(false);
        setShown(next);
      }, 420);
    }),
  );
  onCleanup(() => clearTimeout(timer));
  const writing = () => shown() !== 'restart' && shown() !== 'verify';
  const fill = () => (out() ? 1 : writing() ? live() : 0);
  const index = () => (shown() ? props.stages.indexOf(shown()!) : -1);

  return (
    <>
      <div class="stages">
        <For each={props.stages}>
          {(s, i) => (
            <span classList={{ now: i() === index(), done: i() < index() }}>
              <em>{i() + 1}</em>
              <i>{STAGE_LABEL[s]}</i>
            </span>
          )}
        </For>
      </div>
      <div class="step">
        <p class="cue">Updating</p>
        <p class="sub2">Don't unplug or close this tab</p>
        <div class="prog">
          <div class="pct" classList={{ fade: out() }}>
            <Show when={writing()} fallback={shown() === 'restart' ? 'Restarting' : 'Verifying'}>
              {Math.round(fill() * 100)}
              <small>%</small>
            </Show>
          </div>
          <div class="track" classList={{ out: out(), wait: !out() && !writing() }}>
            <i style={{ '--p': fill() }} />
          </div>
        </div>
      </div>
    </>
  );
};

// The latest release onto the connected box, over the control port.
export const Latest = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('choose');
  const [which, setWhich] = createSignal<Which>('both');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  // A refresh mid-transfer wastes it on a half-written spare slot. The running slot is untouched and
  // the box times the session out.
  createEffect(() => {
    if (dash.status() !== 'flashing') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    onCleanup(() => window.removeEventListener('beforeunload', handler));
  });

  createEffect(() => {
    if (dash.status() === 'connected') void dash.readFirmwareInfo();
  });

  // A rejected resource re-throws on every read, render included, and there is no ErrorBoundary:
  // one unguarded read freezes the page.
  const latest = () => {
    try {
      return releases()?.[0] ?? null;
    } catch {
      return null;
    }
  };
  const lv = () => parseVersion(latest()?.tag);
  const deviceAsset = () => latest()?.assets.find((a) => a.name === 'medius_device.bin') ?? null;
  const hostAsset = () => latest()?.assets.find((a) => a.name === 'medius_host.bin') ?? null;
  const matches = (c: { major: number; minor: number; patch: number } | null | undefined) => {
    const l = lv();
    return !!(c && l && c.major === l.major && c.minor === l.minor && c.patch === l.patch);
  };
  const deviceOnRelease = () => {
    const c = dash.version();
    return matches(c ? { major: c.fwMajor, minor: c.fwMinor, patch: c.fwPatch } : null);
  };
  const hostOnRelease = () => matches(dash.firmwareInfo()?.host);
  // A reverted chip still completes the handshake; only the version each ASKED chip reports proves
  // the update.
  const landed = () => {
    const r = run();
    return (!r?.device || deviceOnRelease()) && (!r?.host || hostOnRelease());
  };
  // From the session, so it survives a tab change or box switch. A run the Manual tab started shows there.
  const run = () => {
    const r = dash.update();
    return r?.page === 'update' ? r : null;
  };
  const view = (): Step => {
    const outcome = run()?.outcome;
    return outcome === 'verified' ? 'done' : outcome === 'sent' ? 'sent' : step();
  };

  // Both endings report the outcome only through this.
  const Landed = () => (
    <Show
      when={landed()}
      fallback={<div class="callout callout--warning">The box came back, but not on the version sent. Try the update again.</div>}
    >
      <p class="state">
        <span class="dot ok" />
        Updated and verified.
      </p>
    </Show>
  );

  // A result of the Manual tab's stays for that tab to show.
  const clearOwn = () => {
    if (dash.update()?.page === 'update') dash.clearUpdate();
  };

  const choose = (mode: Which) => {
    setErr(null);
    clearOwn();
    setWhich(mode);
    setStep('update');
  };

  const finish = () => {
    clearOwn();
    setStep('choose');
    navigate('/dashboard');
  };

  // Over the connected control port: each chip writes its spare slot and boots it, and the box
  // reverts anything that won't run. The mouse-side image is relayed over the inter-chip link.
  const runUpdate = async () => {
    setErr(null);
    clearOwn();
    const wantDevice = which() !== 'mouse';
    const wantHost = which() !== 'main';
    setBusy(true);
    try {
      const da = deviceAsset();
      const ha = hostAsset();
      // Only the first is fixed by waiting. The other two name the choice that works, which is on
      // the previous screen.
      if (!latest() || (!da && !ha)) {
        setErr('No update available right now. Try again in a few minutes.');
        return;
      }
      if (wantDevice && !da) {
        setErr('This release has nothing for the main chip. Press Back and choose Mouse-side only.');
        return;
      }
      if (wantHost && !ha) {
        setErr('This release has nothing for the mouse-side chip. Press Back and choose Main only.');
        return;
      }
      const images: { device?: Uint8Array; host?: Uint8Array } = {};
      if (wantDevice && da) images.device = await downloadAsset(da);
      if (wantHost && ha) images.host = await downloadAsset(ha);
      const outcome = await dash.updateOverControl(images, 'update');
      if (outcome === 'failed' && !dash.error()) setErr("That didn't finish. The box kept its running firmware.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const running = () => dash.status() === 'flashing';
  // The box answers nothing while it restarts; the figure keeps the version it ran until the new one answers.
  const shownVersion = createMemo<Version | null>((prev) => dash.version() ?? prev ?? null, null);
  const runStages = () => {
    const r = dash.update();
    return stagesFor(r?.device ?? which() !== 'mouse', r?.host ?? which() !== 'main');
  };

  return (
    <>
      <Show when={dash.status() === 'connected' || running()}>
        <dl class="vit two caps">
          <div>
            <dt>Running</dt>
            <dd class="big">{shownVersion() ? `v${versionString(shownVersion()!)}` : '...'}</dd>
          </div>
          <div>
            <dt>Latest</dt>
            <dd class="big">{latest()?.tag ?? (releases.loading ? '...' : 'Unavailable')}</dd>
          </div>
        </dl>
      </Show>

      <div class="flow" id="update" data-search-target>
        <Show when={err()}>{(msg) => <div class="callout callout--danger" role="alert">{msg()}</div>}</Show>
        <Switch>
          <Match when={running()}>
            <Progress stages={runStages()} />
          </Match>

          <Match when={view() === 'choose'}>
            <Show when={dash.status() === 'connected'} fallback={<div class="boxstate"><ConnectPanel /></div>}>
              <div class="acts">
                <Button variant="primary" disabled={busy()} onClick={() => choose('both')}>
                  Update both chips
                </Button>
                <Button variant="secondary" disabled={busy()} onClick={() => choose('main')}>
                  Main only
                </Button>
                <Button variant="secondary" disabled={busy()} onClick={() => choose('mouse')}>
                  Mouse-side only
                </Button>
              </div>
            </Show>
          </Match>

          <Match when={view() === 'update'}>
            <Show when={dash.status() === 'connected'} fallback={<div class="boxstate"><ConnectPanel /></div>}>
              <WiringPorts chips={which() === 'both' ? ['main', 'mouse'] : which() === 'main' ? ['main'] : ['mouse']} />
            </Show>
            <div class="acts">
              <Show when={dash.status() === 'connected'}>
                <Button variant="primary" disabled={busy() || releases.loading} onClick={() => void runUpdate()}>
                  {busy() ? 'Updating...' : LABEL[which()]}
                </Button>
              </Show>
              <Button
                variant="secondary"
                disabled={busy()}
                onClick={() => {
                  setErr(null);
                  setStep('choose');
                }}
              >
                Back
              </Button>
            </div>
          </Match>

          {/* Transfer and activate went through, then nothing replied, so the running version is unknown.
              The instruction is in the shared error that ConnectPanel renders. */}
          <Match when={view() === 'sent' || view() === 'done'}>
            <Show when={dash.status() === 'connected'} fallback={<div class="boxstate"><ConnectPanel /></div>}>
              <Landed />
              <div class="acts">
                <Button variant="primary" onClick={finish}>
                  Finish
                </Button>
              </div>
            </Show>
          </Match>
        </Switch>
      </div>
    </>
  );
};

// The latest release in one step, or any image by hand. The Manual tab sits outside the box scope: a
// box coming or going would otherwise remount it and lose a ROM flash half set up, which unplugging
// USB2 for it does.
const Update = () => (
  <>
    <PageHeader />
    <PageTabs
      id="update"
      tabs={[
        { key: 'latest', label: 'Latest' },
        { key: 'manual', label: 'Manual' },
      ]}
    >
      <Pane key="latest">
        <BoxScope>
          <Latest />
        </BoxScope>
      </Pane>
      <Pane key="manual">
        <ManualFlash />
      </Pane>
    </PageTabs>
  </>
);

export default Update;
