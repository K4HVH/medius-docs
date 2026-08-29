/// <reference types="w3c-web-serial" />
import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Progress } from '../../../components/feedback/Progress';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { BAD_BROWSER, BAD_CONTEXT, ConnectPanel } from './ConnectPanel';
import { ClearPort, InstallPorts, type PortId } from './PortDiagram';
import '../../../styles/docs.css';

type Step = 'main' | 'unplug' | 'mouse' | 'unplug3' | 'cables';

const STEPS: Step[] = ['main', 'unplug', 'mouse', 'unplug3', 'cables'];

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const HAZARD = 'USB1 and USB3 in the same computer at once can kill it.';
const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

const Setup = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('main');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  // A resource whose fetch rejected re-throws on every read, including from a `disabled=` prop
  // during render, and there is no ErrorBoundary anywhere: one unguarded read freezes the page.
  const latest = () => {
    try {
      return releases()?.[0] ?? null;
    } catch {
      return null;
    }
  };
  const counter = () => `Step ${STEPS.indexOf(step()) + 1} of ${STEPS.length}`;
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total
      ? Math.round(((p.written ?? 0) / p.total) * 100)
      : undefined;
  };

  // Write a full factory image to whichever chip is in download mode on this cable. Only one chip's
  // USB is plugged in and only its own button is held, so only one chip can answer.
  const install = async (assetName: string, next: Step) => {
    setErr(null);
    dash.clearFlashResult();
    setBusy(true);
    try {
      let asset: FirmwareAsset | null = null;
      try {
        asset = latest()?.assets.find((a) => a.name === assetName) ?? null;
      } catch {
        asset = null;
      }
      if (!asset) {
        setErr("The download isn't ready. Reload the page and try again in a few minutes.");
        return;
      }
      const port = await requestRomPort();
      const image = await downloadAsset(asset);
      if (await dash.flashNative(port, image, 'factory')) {
        // The chip has just been rewritten, so any link still open is a stale one.
        void dash.disconnect().catch(() => undefined);
        setStep(next);
      } else {
        // Read the reason BEFORE disconnecting: disconnect() nulls `error` synchronously, and the
        // messages it was discarding are the ones pressing the button again cannot fix.
        const why = dash.error();
        void dash.disconnect().catch(() => undefined);
        setErr(why ?? 'That did not finish.');
      }
    } catch (e) {
      // A cancel and an empty chooser are the same DOMException, and the second is far more likely.
      setErr(isUserCancel(e) ? 'Nothing to install to.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const go = (to: Step) => () => {
    setErr(null);
    setStep(to);
  };

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">{BAD_BROWSER}</div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div class="callout callout--warning">{BAD_CONTEXT}</div>
      </Show>

      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Installing" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.supported && dash.secure && dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Install Medius" subtitle="The ports are numbered on the box" />
          <div style={{ 'margin-bottom': 'var(--g-spacing-sm)' }}>
            <Chip variant="neutral">{counter()}</Chip>
          </div>
          <Show when={err()}>
            {(msg) => (
              <div class="callout callout--danger" role="alert">
                {msg()}
              </div>
            )}
          </Show>

          <Switch>
            <Match when={step() === 'main'}>
              <InstallPorts socket="usb1" />
              <Button
                variant="primary"
                disabled={busy() || releases.loading}
                onClick={() => void install('medius_device-factory.bin', 'unplug')}
              >
                {busy() ? 'Installing...' : 'Install'}
              </Button>
            </Match>

            <Match when={step() === 'unplug'}>
              <ClearPort socket="usb1" />
              <div class="callout callout--danger">{HAZARD}</div>
              <div style={row}>
                <Button variant="primary" onClick={go('mouse')}>
                  Done
                </Button>
                <Button variant="secondary" onClick={go('main')}>
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'mouse'}>
              <InstallPorts socket="usb3" />
              <div class="callout callout--danger">{HAZARD}</div>
              <div style={row}>
                <Button
                  variant="primary"
                  disabled={busy() || releases.loading}
                  onClick={() => void install('medius_host-factory.bin', 'unplug3')}
                >
                  {busy() ? 'Installing...' : 'Install'}
                </Button>
                <Button variant="secondary" disabled={busy()} onClick={go('unplug')}>
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'unplug3'}>
              <ClearPort socket="usb3" />
              <div class="callout callout--danger">{HAZARD}</div>
              <Button variant="primary" onClick={go('cables')}>
                Done
              </Button>
            </Match>

            <Match when={step() === 'cables'}>
              <Show
                when={dash.status() === 'connected'}
                fallback={<ConnectPanel onSetup={go('main')} />}
              >
                <div class="callout callout--info">Installed.</div>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  Finish
                </Button>
              </Show>
            </Match>
          </Switch>
        </Card>
      </Show>
    </>
  );
};

export default Setup;
