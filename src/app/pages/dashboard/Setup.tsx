/// <reference types="w3c-web-serial" />
import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Progress } from '../../../components/feedback/Progress';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import type { FlashChip } from '../../../dashboard/flash';
import { type ConnectVerdict, requestRomPort } from '../../../dashboard/serial';
import { type BoxEntry, type Snapshot, useBoxes, useNativeFlash } from './context';
import { BAD_BROWSER, BAD_CONTEXT, ConnectView } from './ConnectPanel';
import { ClearPort, InstallPorts, type PortId } from './PortDiagram';
import { PageHeader } from '../../shell/PageHeader';

type Step = 'main' | 'unplug' | 'mouse' | 'unplug3' | 'cables';

const STEPS: Step[] = ['main', 'unplug', 'mouse', 'unplug3', 'cables'];

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const HAZARD = 'USB1 and USB3 in one computer can kill it.';
const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

const Setup = () => {
  const native = useNativeFlash();
  const boxes = useBoxes();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('main');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  const [installed, setInstalled] = createSignal<BoxEntry | null>(null);
  const [finding, setFinding] = createSignal(false);
  const [found, setFound] = createSignal<ConnectVerdict | null>(null);
  // Taken at the first install: the box installed is one that answers after it.
  let before: Snapshot | null = null;

  // A rejected resource re-throws on every read, render included, and there is no ErrorBoundary:
  // one unguarded read freezes the page.
  const latest = () => {
    try {
      return releases()?.[0] ?? null;
    } catch {
      return null;
    }
  };
  const counter = () => `Step ${STEPS.indexOf(step()) + 1} of ${STEPS.length}`;
  const pct = () => {
    const p = native.progress();
    return p?.phase === 'writing' && p.total
      ? Math.round(((p.written ?? 0) / p.total) * 100)
      : undefined;
  };

  // Only one chip's USB is plugged in with its button held, so only that chip answers.
  const install = async (chip: FlashChip, next: Step) => {
    const assetName = `medius_${chip}-factory.bin`;
    setErr(null);
    native.clear();
    before ??= boxes.snapshot();
    setBusy(true);
    try {
      let asset: FirmwareAsset | null = null;
      try {
        asset = latest()?.assets.find((a) => a.name === assetName) ?? null;
      } catch {
        asset = null;
      }
      if (!asset) {
        setErr("The download isn't ready. Reload and try again in a few minutes.");
        return;
      }
      const port = await requestRomPort();
      const image = await downloadAsset(asset);
      if (await native.flash(port, image, 'factory', { page: 'setup', chip, source: 'release' })) setStep(next);
      else setErr(native.error() ?? 'That did not finish.');
    } catch (e) {
      // A cancel and an empty chooser throw the same DOMException; the second is likelier.
      setErr(isUserCancel(e) ? 'Nothing to install to.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const find = async () => {
    setFinding(true);
    setFound(null);
    const v = await boxes.connectNew(before ?? boxes.snapshot());
    setFound(v);
    setInstalled(v ? null : boxes.selected());
    setFinding(false);
  };

  const go = (to: Step) => () => {
    setErr(null);
    setStep(to);
  };

  // The first step shows in any browser; Install needs Web Serial on a secure page.
  const blocked = () => (!boxes.supported ? BAD_BROWSER : !boxes.secure ? BAD_CONTEXT : null);

  return (
    <>
      <PageHeader />
      <Show when={native.running()}>
        <div id="installing" data-search-target>
          <Card>
            <CardHeader title="Installing" subtitle="Don't unplug or leave this page" />
            <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
          </Card>
        </div>
      </Show>

      <Show when={!native.running()}>
        <div id="install" data-search-target>
          <Card>
            <CardHeader title="Install Medius" subtitle="Ports are numbered on the box" />
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
                <Show
                  when={blocked()}
                  fallback={
                    <Button
                      variant="primary"
                      disabled={busy() || releases.loading}
                      onClick={() => void install('device', 'unplug')}
                    >
                      {busy() ? 'Installing...' : 'Install'}
                    </Button>
                  }
                >
                  {(reason) => <div class="callout callout--warning" role="alert">{reason()}</div>}
                </Show>
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
                    onClick={() => void install('host', 'unplug3')}
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
                  when={installed()?.session.status() === 'connected'}
                  fallback={
                    <ConnectView
                      supported={boxes.supported}
                      secure={boxes.secure}
                      error={null}
                      verdict={found()}
                      busy={finding()}
                      connect={() => void find()}
                      onSetup={go('main')}
                    />
                  }
                >
                  <div class="callout callout--info">Installed.</div>
                  <Button variant="primary" onClick={() => navigate('/dashboard')}>
                    Finish
                  </Button>
                </Show>
              </Match>
            </Switch>
          </Card>
        </div>
      </Show>
    </>
  );
};

export default Setup;
