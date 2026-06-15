import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Progress } from '../../../components/feedback/Progress';
import { Chip } from '../../../components/display/Chip';
import { versionString } from '../../../dashboard/protocol';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import '../../../styles/docs.css';

type Step = 'start' | 'host-cable' | 'host-done' | 'device' | 'finish';

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

const parseTag = (tag?: string) => {
  const m = tag?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};

const phaseLabel: Record<string, string> = {
  rebooting: 'Getting ready...',
  connecting: 'Talking to the box...',
  writing: 'Installing...',
  done: 'Done',
};

const Update = () => {
  const dash = useDashboard();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('start');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  const latest = () => releases()?.[0] ?? null;
  const latestVer = () => parseTag(latest()?.tag);
  const deviceAsset = (): FirmwareAsset | null =>
    latest()?.assets.find((a) => a.name === 'medius_device.bin') ?? null;
  const hostAsset = (): FirmwareAsset | null =>
    latest()?.assets.find((a) => a.name === 'medius_host.bin') ?? null;

  const upToDate = () => {
    const c = dash.version();
    const l = latestVer();
    return c && l && c.fwMajor === l.major && c.fwMinor === l.minor && c.fwPatch === l.patch;
  };

  const pct = () => {
    const p = dash.flashProgress();
    if (p?.phase === 'writing' && p.total) return Math.round(((p.written ?? 0) / p.total) * 100);
    return undefined;
  };

  const begin = async (scope: 'both' | 'device') => {
    setErr(null);
    dash.clearFlashResult();
    if (scope === 'device') {
      setStep('device');
      return;
    }
    setBusy(true);
    try {
      await dash.rebootForHostFlash();
      setStep('host-cable');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flashHost = async () => {
    setErr(null);
    dash.clearFlashResult();
    const asset = hostAsset();
    if (!asset) {
      setErr('This release has no mouse-side update.');
      return;
    }
    setBusy(true);
    try {
      const port = await requestRomPort();
      const image = await downloadAsset(asset);
      const ok = await dash.flashNative(port, image, 'app');
      if (ok) setStep('host-done');
      else
        setErr(
          'The mouse-side update did not finish. The box is partway through; try again, or use Recover.',
        );
    } catch (e) {
      if (!isUserCancel(e)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flashDevice = async () => {
    setErr(null);
    dash.clearFlashResult();
    const asset = deviceAsset();
    if (!asset) {
      setErr('This release has no main-chip update.');
      return;
    }
    setBusy(true);
    try {
      const image = await downloadAsset(asset);
      const ok = await dash.flashDevice(image, 'app');
      if (ok) setStep('finish');
      else
        setErr(
          'The main-chip update did not finish. Power-cycle the box and try again, or use Recover.',
        );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">
          This browser can't reach USB devices. Open the dashboard in Chrome, Edge, or Opera.
        </div>
      </Show>

      {/* While a part is installing, show progress and nothing else. */}
      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Installing..." subtitle="This takes a minute" />
          <p aria-live="polite">{phaseLabel[dash.flashProgress()?.phase ?? 'connecting']}</p>
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
          <div class="callout callout--warning">
            Do not unplug the box or leave this page while it's installing.
          </div>
        </Card>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Update your box" subtitle="Get the latest firmware" />

          <Show when={err()}>
            <div class="callout callout--danger" role="alert">{err()}</div>
          </Show>

          <Switch>
            {/* Not connected yet */}
            <Match when={dash.status() !== 'connected' && step() === 'start'}>
              <p>
                Plug your box into this computer with the <strong>USB2</strong> (control) cable, then
                connect.
              </p>
              <Button
                variant="primary"
                disabled={!dash.supported || busy()}
                onClick={() => void dash.connect()}
              >
                Connect
              </Button>
            </Match>

            {/* Connected, choose what to update */}
            <Match when={dash.status() === 'connected' && step() === 'start'}>
              <Show when={releases.loading}>
                <p>Checking for updates...</p>
              </Show>
              <Show when={releases.error}>
                <div class="callout callout--warning">
                  Couldn't reach the update server. You can still install a file from the{' '}
                  <A href="/dashboard/advanced">Advanced</A> page.
                </div>
              </Show>
              <Show when={latest()}>
                <p>
                  Your box is on{' '}
                  <Show when={dash.version()}>
                    {(v) => <Chip variant="neutral">v{versionString(v())}</Chip>}
                  </Show>{' '}
                  <Show when={upToDate()} fallback={<>. The latest is <strong>{latest()?.tag}</strong>.</>}>
                    . That's the latest, you're up to date.
                  </Show>
                </p>
                <p>
                  An update has two parts: the mouse-side chip and the main chip. Doing both keeps
                  them matched.
                </p>
                <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                  <Button variant="primary" disabled={busy()} onClick={() => void begin('both')}>
                    {upToDate() ? 'Reinstall both parts' : 'Update both parts'}
                  </Button>
                  <Button variant="secondary" disabled={busy()} onClick={() => void begin('device')}>
                    Main chip only
                  </Button>
                </div>
                <p style={{ 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' }}>
                  "Main chip only" skips the mouse-side chip, which can leave the two parts on
                  different versions. Do both unless you know you only need the main one.
                </p>
              </Show>
            </Match>

            {/* Host: cable move + flash */}
            <Match when={step() === 'host-cable'}>
              <p><strong>Step 1 of 2: the mouse-side chip.</strong></p>
              <ol>
                <li>Unplug your mouse from the box's <strong>USB3</strong> (mouse) port.</li>
                <li>Connect the box's <strong>USB3</strong> port to this computer with a cable.</li>
                <li>Make sure the <strong>USB1</strong> (game PC) port is not connected to this computer.</li>
              </ol>
              <div class="callout callout--danger">
                USB1 and USB3 must never be on the same computer at once, or it can shut down.
              </div>
              <Button variant="primary" disabled={busy()} onClick={() => void flashHost()}>
                Install on the mouse-side chip
              </Button>
              <p style={{ 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' }}>
                Changed your mind? Nothing's been written yet, so you can unplug the box and plug it
                back in to start over. If a box ever won't turn on after an update,{' '}
                <A href="/dashboard/recovery">recover it here</A>.
              </p>
            </Match>

            <Match when={step() === 'host-done'}>
              <div class="callout callout--info">Mouse-side chip done.</div>
              <p>Unplug the cable from the <strong>USB3</strong> port. Then continue.</p>
              <Button variant="primary" onClick={() => setStep('device')}>
                Continue to the main chip
              </Button>
            </Match>

            {/* Device flash over the control cable */}
            <Match when={step() === 'device'}>
              <p>
                <strong>Step 2 of 2: the main chip.</strong> This uses the USB2 (control) cable
                that's already connected, no cable changes.
              </p>
              <Show when={dash.status() !== 'connected'}>
                <div class="callout callout--warning">
                  The box isn't connected. Go to the <A href="/dashboard">Device</A> tab, connect,
                  then come back.
                </div>
              </Show>
              <Button
                variant="primary"
                disabled={busy() || dash.status() !== 'connected'}
                onClick={() => void flashDevice()}
              >
                Install on the main chip
              </Button>
            </Match>

            {/* Done */}
            <Match when={step() === 'finish'}>
              <div class="callout callout--info">
                All done and verified. Unplug the box, plug it back in, then reconnect on the{' '}
                <A href="/dashboard">Device</A> tab to check the new version.
              </div>
              <Button variant="secondary" onClick={() => { setStep('start'); dash.clearFlashResult(); }}>
                Start over
              </Button>
            </Match>
          </Switch>

          <p style={{ 'margin-top': 'var(--g-spacing)', color: 'var(--g-text-secondary)' }}>
            Box won't connect? <A href="/dashboard/recovery">Recover it</A>. Know what you're doing?{' '}
            <A href="/dashboard/advanced">Advanced flashing</A>.
          </p>
        </Card>
      </Show>
    </>
  );
};

export default Update;
