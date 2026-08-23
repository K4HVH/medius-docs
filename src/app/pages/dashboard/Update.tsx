/// <reference types="w3c-web-serial" />
import { Match, Show, Switch, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Progress } from '../../../components/feedback/Progress';
import { Chip } from '../../../components/display/Chip';
import { versionString } from '../../../dashboard/protocol';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { PortDiagram } from './PortDiagram';
import { UnplugWatch } from './UnplugWatch';
import '../../../styles/docs.css';

type Step = 'choose' | 'update' | 'setupMain' | 'setupMouse' | 'done';
const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const parseTag = (tag?: string) => {
  const m = tag?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

const Update = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('choose');
  const [which, setWhich] = createSignal<'both' | 'main' | 'mouse'>('both');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  const [unplugged, setUnplugged] = createSignal(false);

  // Re-arm the unplug gate on each step that needs a fresh BOOT-button plug-in. Only the first-install
  // path has one now: updating an existing box never touches a cable.
  createEffect(() => {
    const s = step();
    if (s === 'setupMain' || s === 'setupMouse') setUnplugged(false);
  });

  // An update writes flash on both chips, so a refresh mid-transfer leaves a half-written spare slot.
  // Nothing is bricked (the running slot is untouched and the box times the session out), but the
  // transfer is wasted, so it is worth a prompt.
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

  const latest = () => releases()?.[0] ?? null;
  const lv = () => parseTag(latest()?.tag);
  const deviceAsset = () => latest()?.assets.find((a) => a.name === 'medius_device.bin') ?? null;
  const hostAsset = () => latest()?.assets.find((a) => a.name === 'medius_host.bin') ?? null;
  const deviceFactoryAsset = () =>
    latest()?.assets.find((a) => a.name === 'medius_device-factory.bin') ?? null;
  const hostFactoryAsset = () =>
    latest()?.assets.find((a) => a.name === 'medius_host-factory.bin') ?? null;
  const upToDate = () => {
    const c = dash.version();
    const l = lv();
    return !!(c && l && c.fwMajor === l.major && c.fwMinor === l.minor && c.fwPatch === l.patch);
  };
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : undefined;
  };

  const choose = (mode: 'both' | 'main' | 'mouse') => {
    setErr(null);
    dash.clearFlashResult();
    setWhich(mode);
    setStep('update');
  };

  // Update over the control port the box is already connected on. Both chips write the slot they are
  // not running and boot it, and the box reverts anything that will not run. No reboot into ROM
  // download, no second port grant, no cable move: the mouse-side chip's image is relayed over the
  // inter-chip link, which is the only route to it.
  const runUpdate = async () => {
    setErr(null);
    dash.clearFlashResult();
    const wantDevice = which() !== 'mouse';
    const wantHost = which() !== 'main';
    const da = deviceAsset();
    const ha = hostAsset();
    if (wantDevice && !da) return setErr('No main-chip update in this release.');
    if (wantHost && !ha) return setErr('No mouse-side update in this release.');
    setBusy(true);
    try {
      const images: { device?: Uint8Array; host?: Uint8Array } = {};
      if (wantDevice && da) images.device = await downloadAsset(da);
      if (wantHost && ha) images.host = await downloadAsset(ha);
      const ok = await dash.updateOverControl(images);
      if (ok) setStep('done');
      else setErr(dash.error() ?? "That didn't finish. The box kept the firmware it was running.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // First-time / repair install: write the full factory image to a chip over its
  // own USB (BOOT-button download). Works from a stock, blank, or bricked box,
  // where the control link and reboot-over-cable are unavailable.
  const setupChip = async (
    asset: ReturnType<typeof deviceFactoryAsset>,
    missing: string,
    next: Step,
  ) => {
    setErr(null);
    dash.clearFlashResult();
    if (!asset) return setErr(missing);
    setBusy(true);
    try {
      const port = await requestRomPort();
      const ok = await dash.flashNative(port, await downloadAsset(asset), 'factory');
      if (ok) setStep(next);
      else setErr(dash.error() ?? "That didn't finish. Hold the BOOT button and try again.");
    } catch (e) {
      if (!isUserCancel(e)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setupMain = () =>
    setupChip(deviceFactoryAsset(), 'No main-chip factory image in this release.', 'setupMouse');
  const setupMouse = () =>
    setupChip(hostFactoryAsset(), 'No mouse-side factory image in this release.', 'done');

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">Open the dashboard in Chrome, Edge, or Opera.</div>
      </Show>

      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Installing" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Update" subtitle="Get the latest firmware" />
          <Show when={err() ?? (dash.status() === 'error' ? dash.error() : null)}>
            {(msg) => <div class="callout callout--danger" role="alert">{msg()}</div>}
          </Show>

          <Switch>
            <Match when={step() === 'choose'}>
              <Switch>
                <Match when={dash.status() !== 'connected'}>
                  <p>Already running Medius? Plug in like this and connect.</p>
                  <PortDiagram plug={['usb1', 'usb2']} />
                  <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                    <Button
                      variant="primary"
                      loading={dash.status() === 'connecting'}
                      disabled={!dash.supported || busy() || dash.status() === 'connecting'}
                      onClick={() => void dash.connect()}
                    >
                      {dash.status() === 'connecting'
                        ? 'Connecting...'
                        : dash.status() === 'error'
                          ? 'Try again'
                          : 'Connect'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy()}
                      onClick={() => { void dash.disconnect(); setErr(null); setStep('setupMain'); }}
                    >
                      Set up a new box
                    </Button>
                  </div>
                </Match>
                <Match when={dash.status() === 'connected'}>
                  <p>
                    On{' '}
                    <Show when={dash.version()}>
                      {(v) => <Chip variant="neutral">v{versionString(v())}</Chip>}
                    </Show>
                    <Show when={latest()}>
                      {'. '}Latest is <strong>{latest()?.tag}</strong>
                      {upToDate() ? ', up to date.' : '.'}
                    </Show>
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
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
                </Match>
              </Switch>
            </Match>

            <Match when={step() === 'update'}>
              <p>
                Everything happens over the cable you are already connected on. The mouse stops working
                for a few seconds, then comes back.
              </p>
              <PortDiagram plug={['usb1', 'usb2']} />
              <Show
                when={dash.status() === 'connected'}
                fallback={
                  <p style={muted}>Not connected. <A href="/dashboard">Connect first</A>.</p>
                }
              >
                <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Button variant="primary" disabled={busy()} onClick={() => void runUpdate()}>
                    {busy() ? 'Updating...' : 'Update'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy()}
                    onClick={() => { setErr(null); setStep('choose'); }}
                  >
                    Back
                  </Button>
                </div>
              </Show>
            </Match>

            <Match when={step() === 'setupMain'}>
              <p><strong>Step 1 of 2: main chip.</strong></p>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch autoWatch={false} onUnplugged={() => setUnplugged(true)} />}
              >
                <PortDiagram plug={['usb1']} boot="main" />
                <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Button variant="primary" disabled={busy()} onClick={() => void setupMain()}>
                    Install
                  </Button>
                  <Button variant="secondary" disabled={busy()} onClick={() => { setErr(null); setStep('choose'); }}>
                    Back
                  </Button>
                </div>
              </Show>
            </Match>

            <Match when={step() === 'setupMouse'}>
              <p><strong>Step 2 of 2: mouse-side chip.</strong></p>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch autoWatch={false} onUnplugged={() => setUnplugged(true)} />}
              >
                <PortDiagram plug={['usb3']} boot="mouse" />
                <div class="callout callout--danger">Never plug USB1 and USB3 into the same PC.</div>
                <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Button variant="primary" disabled={busy()} onClick={() => void setupMouse()}>
                    Install
                  </Button>
                  <Button variant="secondary" disabled={busy()} onClick={() => { setErr(null); setStep('choose'); }}>
                    Back
                  </Button>
                </div>
              </Show>
            </Match>

            <Match when={step() === 'done'}>
              <Show
                when={dash.status() === 'connected'}
                fallback={
                  <>
                    <div class="callout callout--info">Firmware installed. Plug in like this.</div>
                    <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} />
                  </>
                }
              >
                <div class="callout callout--info">
                  Updated and verified.{' '}
                  <Show when={dash.version()}>
                    {(v) => <>Now on <strong>v{versionString(v())}</strong>.</>}
                  </Show>
                </div>
              </Show>
              <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap', 'margin-top': 'var(--g-spacing-sm)' }}>
                <Show when={dash.status() !== 'connected'}>
                  <Button
                    variant="primary"
                    loading={dash.status() === 'connecting'}
                    disabled={!dash.supported || dash.status() === 'connecting'}
                    onClick={() => void dash.connect()}
                  >
                    {dash.status() === 'connecting'
                      ? 'Connecting...'
                      : dash.status() === 'error'
                        ? 'Try again'
                        : 'Connect'}
                  </Button>
                </Show>
                <Button variant="secondary" onClick={() => { dash.clearFlashResult(); setMainCtrl(null); setStep('choose'); navigate('/dashboard'); }}>
                  Finish
                </Button>
              </div>
            </Match>
          </Switch>
        </Card>
      </Show>
    </>
  );
};

export default Update;
