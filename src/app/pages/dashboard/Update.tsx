/// <reference types="w3c-web-serial" />
import { Match, Show, Switch, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
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

type Step = 'choose' | 'main' | 'grantMain' | 'mouse' | 'setupMain' | 'setupMouse' | 'done';
const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const parseTag = (tag?: string) => {
  const m = tag?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

const Update = () => {
  const dash = useDashboard();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('choose');
  const [alsoMouse, setAlsoMouse] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  const [unplugged, setUnplugged] = createSignal(false);
  // The control port held across the main-chip reboot, reused to reconnect/verify
  // and to resume if the ESP32 port grant is canceled.
  const [mainCtrl, setMainCtrl] = createSignal<SerialPort | null>(null);

  // Re-arm the unplug gate on each step that needs a fresh BOOT-button plug-in.
  createEffect(() => {
    const s = step();
    if (s === 'mouse' || s === 'setupMain' || s === 'setupMouse') setUnplugged(false);
  });

  // While the main chip sits in update mode awaiting its port, warn before a
  // refresh/close that would strand it (it would then need a power-cycle).
  createEffect(() => {
    if (step() !== 'grantMain') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    onCleanup(() => window.removeEventListener('beforeunload', handler));
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
    setMainCtrl(null);
    setAlsoMouse(mode === 'both');
    setStep(mode === 'mouse' ? 'mouse' : 'main');
  };

  // Main-chip update. First call reboots the chip into update mode over the
  // control cable; `resume` re-runs the port grant + flash without rebooting
  // again (the chip is already in download), used after a canceled port grant.
  const flashMain = async (resume: boolean) => {
    setErr(null);
    dash.clearFlashResult();
    const a = deviceAsset();
    if (!a) return setErr('No main-chip update in this release.');
    setBusy(true);
    try {
      let ctrlPort = mainCtrl();
      if (!resume || !ctrlPort) {
        ctrlPort = await dash.rebootDeviceToDownload();
        setMainCtrl(ctrlPort);
      }
      // Show the update-mode screen so a canceled or slow port grant has a clear
      // home (with a deliberate retry) instead of a dead end.
      setStep('grantMain');
      const romPort = await requestRomPort();
      const image = await downloadAsset(a);
      const ok = await dash.flashDeviceNative(romPort, ctrlPort, image, 'app');
      if (ok) {
        setMainCtrl(null);
        setStep(alsoMouse() ? 'mouse' : 'done');
      } else {
        setErr(dash.error() ?? 'That did not finish. Pick the port to retry, or power-cycle the box.');
      }
    } catch (e) {
      // A canceled port grant leaves us on grantMain to retry; surface real errors.
      if (!isUserCancel(e)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const installMouse = async () => {
    setErr(null);
    dash.clearFlashResult();
    const a = hostAsset();
    if (!a) return setErr('No mouse-side update in this release.');
    setBusy(true);
    try {
      const port = await requestRomPort();
      const ok = await dash.flashNative(port, await downloadAsset(a), 'app');
      if (ok) setStep('done');
      else setErr(dash.error() ?? 'That did not finish. Hold BOOT and try again.');
    } catch (e) {
      if (!isUserCancel(e)) setErr((e as Error).message);
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
      else setErr(dash.error() ?? 'That did not finish. Hold the BOOT button and try again.');
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
                  <p style={muted}>
                    Setting it up for the first time, or fixing a box that stopped responding?
                    Set it up to install Medius.
                  </p>
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
                      Update both parts
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

            <Match when={step() === 'main'}>
              <p><strong>Main chip.</strong> Plug in like this.</p>
              <PortDiagram plug={['usb1', 'usb2']} />
              <Show
                when={dash.status() === 'connected'}
                fallback={
                  <p style={muted}>Not connected. <A href="/dashboard">Connect first</A>.</p>
                }
              >
                <p style={muted}>When the browser asks, pick the ESP32-S3 port.</p>
                <Button variant="primary" disabled={busy()} onClick={() => void flashMain(false)}>
                  Install
                </Button>
              </Show>
            </Match>

            <Match when={step() === 'grantMain'}>
              <p><strong>The box is in update mode.</strong> Pick the ESP32-S3 port to finish.</p>
              <Button variant="primary" disabled={busy()} onClick={() => void flashMain(true)}>
                {busy() ? 'Waiting for the port...' : 'Pick ESP32-S3 port'}
              </Button>
              <p style={muted}>
                Changed your mind? Power-cycle the box (unplug and replug USB1) to leave it as it was.
              </p>
            </Match>

            <Match when={step() === 'mouse'}>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch onUnplugged={() => setUnplugged(true)} />}
              >
                <p><strong>Mouse-side chip.</strong> Now plug in like this.</p>
                <PortDiagram plug={['usb3']} boot="mouse" />
                <div class="callout callout--danger">Never plug USB1 and USB3 into the same PC.</div>
                <Button variant="primary" disabled={busy()} onClick={() => void installMouse()}>
                  Install
                </Button>
              </Show>
            </Match>

            <Match when={step() === 'setupMain'}>
              <p>Installs Medius from scratch. Two chips, one at a time.</p>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch autoWatch={false} onUnplugged={() => setUnplugged(true)} />}
              >
                <p><strong>Step 1 of 2: main chip.</strong> Plug in like this.</p>
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
              <p>Main chip done.</p>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch autoWatch={false} onUnplugged={() => setUnplugged(true)} />}
              >
                <p><strong>Step 2 of 2: mouse-side chip.</strong> Plug in like this.</p>
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
                    <div class="callout callout--info">
                      Firmware installed. To use the box, plug your mouse into USB3 and cable USB1
                      and USB2 to your PC.
                    </div>
                    <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} />
                    <p style={muted}>Then connect to check the box still answers.</p>
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
                <Button variant="secondary" onClick={() => { setStep('choose'); setMainCtrl(null); dash.clearFlashResult(); }}>
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
