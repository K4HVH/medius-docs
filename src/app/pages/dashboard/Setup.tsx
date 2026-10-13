/// <reference types="w3c-web-serial" />
import { For, Match, Show, Switch, createResource, createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import type { FlashChip } from '../../../dashboard/flash';
import { type ConnectVerdict, requestRomPort } from '../../../dashboard/serial';
import { type BoxEntry, type Snapshot, useBoxes, useNativeFlash } from './context';
import { BAD_BROWSER, BAD_CONTEXT, ConnectView, notConnected } from './ConnectPanel';
import { ClearPort, InstallPorts, type PortId } from './PortDiagram';
import { flashPercent, flashWait } from './flashText';
import { PageHeader } from '../../shell/PageHeader';

type Step = 'main' | 'unplug' | 'mouse' | 'unplug3' | 'cables';

const STEPS: Step[] = ['main', 'unplug', 'mouse', 'unplug3', 'cables'];

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

const Setup = () => {
  const native = useNativeFlash();
  const boxes = useBoxes();
  const navigate = useNavigate();
  const [releases, { refetch }] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('main');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  const [installed, setInstalled] = createSignal<BoxEntry | null>(null);
  const [finding, setFinding] = createSignal(false);
  const [found, setFound] = createSignal<ConnectVerdict | null>(null);
  // A box that runs Medius already, picked in the chooser: the one pick a browser needs before it sees a port. A
  // Medius box connects and takes its pages (DocsLayout); anything else is said here.
  const [linking, setLinking] = createSignal(false);
  const [linked, setLinked] = createSignal<ConnectVerdict | null>(null);
  const link = async () => {
    setLinked(null);
    setLinking(true);
    try {
      const r = await boxes.add();
      if (!r.ok) setLinked(r.verdict);
      else if (r.entry.session.status() !== 'connected') setLinked(r.entry.session.verdict() ?? { kind: 'silent' });
    } finally {
      setLinking(false);
    }
  };
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
  const pct = () => flashPercent(native.progress());
  const wait = () => flashWait(native.progress());

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
  const unlisted = () => !latest() && !releases.loading;

  // Install, or why there is nothing to install yet.
  const installOr = (chip: FlashChip, next: Step, back?: JSX.Element) => (
    <Show
      when={!unlisted()}
      fallback={
        <>
          <div class="callout callout--warning" role="alert">
            {releases.error ? "The release list didn't load. Try again in a few minutes." : 'No release is published yet.'}
          </div>
          <Show when={releases.error || back}>
            <div class="acts">
              <Show when={releases.error}>
                <Button variant="secondary" onClick={() => void refetch()}>
                  Retry
                </Button>
              </Show>
              {back}
            </div>
          </Show>
        </>
      }
    >
      <div class="acts">
        <Button variant="primary" disabled={busy() || linking() || releases.loading} onClick={() => void install(chip, next)}>
          {busy() ? 'Installing...' : 'Install'}
        </Button>
        {back}
      </div>
    </Show>
  );

  const LABELS: Record<Step, string> = {
    main: 'Main chip',
    unplug: 'Unplug USB1',
    mouse: 'Mouse-side chip',
    unplug3: 'Unplug USB3',
    cables: 'Wire the box',
  };
  const at = () => STEPS.indexOf(step());
  const finished = () => installed()?.session.status() === 'connected';

  return (
    <>
      <PageHeader />
      <div class="flow" id="install">
        <div class="stages">
          <For each={STEPS}>
            {(s, i) => (
              <span classList={{ now: !finished() && i() === at(), done: i() < at() || finished() }}>
                <em>{i() + 1}</em>
                <i>{LABELS[s]}</i>
              </span>
            )}
          </For>
        </div>

        <Show when={err()}>
          {(msg) => (
            <div class="callout callout--danger" role="alert">
              {msg()}
            </div>
          )}
        </Show>

        <Show
          when={!native.running()}
          fallback={
            <div class="step" id="installing">
              <p class="cue">Installing</p>
              <p class="sub2">Don't unplug or close this tab</p>
              <div class="prog">
                <div class="pct">
                  <Show when={wait()} fallback={<>{pct()}<small>%</small></>}>
                    {wait()}
                  </Show>
                </div>
                <div class="track" classList={{ wait: !!wait() }}>
                  <i style={{ '--p': (pct() ?? 0) / 100 }} />
                </div>
              </div>
            </div>
          }
        >
          <Switch>
            <Match when={step() === 'main'}>
              <div class="step">
                <InstallPorts socket="usb1" />
                <Show
                  when={blocked()}
                  fallback={
                    <>
                      {installOr(
                        'device',
                        'unplug',
                        <Button variant="secondary" disabled={busy() || linking()} loading={linking()} onClick={() => void link()}>
                          {linking() ? 'Connecting...' : linked() ? 'Retry' : 'Connect'}
                        </Button>,
                      )}
                      <Show when={linked()}>
                        {(v) => (
                          <div class="callout callout--danger" role="alert">
                            {notConnected(v())}
                          </div>
                        )}
                      </Show>
                    </>
                  }
                >
                  {(reason) => (
                    <div class="callout callout--warning" role="alert">
                      {reason()}
                    </div>
                  )}
                </Show>
              </div>
            </Match>

            <Match when={step() === 'unplug'}>
              <div class="step">
                <ClearPort socket="usb1" />
                <div class="acts">
                  <Button variant="primary" onClick={go('mouse')}>
                    Done
                  </Button>
                  <Button variant="secondary" onClick={go('main')}>
                    Back
                  </Button>
                </div>
              </div>
            </Match>

            <Match when={step() === 'mouse'}>
              <div class="step">
                <InstallPorts socket="usb3" />
                {installOr(
                  'host',
                  'unplug3',
                  <Button variant="secondary" disabled={busy()} onClick={go('unplug')}>
                    Back
                  </Button>,
                )}
              </div>
            </Match>

            <Match when={step() === 'unplug3'}>
              <div class="step">
                <ClearPort socket="usb3" />
                <div class="acts">
                  <Button variant="primary" onClick={go('cables')}>
                    Done
                  </Button>
                </div>
              </div>
            </Match>

            <Match when={step() === 'cables'}>
              <div class="step">
                <Show
                  when={finished()}
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
                  <p class="state">
                    <span class="dot ok" />
                    Installed.
                  </p>
                  <div class="acts">
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>
                      Finish
                    </Button>
                  </div>
                </Show>
              </div>
            </Match>
          </Switch>
        </Show>
      </div>
    </>
  );
};

export default Setup;
