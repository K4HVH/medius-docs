/// <reference types="w3c-web-serial" />
import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Progress } from '../../../components/feedback/Progress';
import { versionString } from '../../../dashboard/protocol';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
import { PortDiagram } from './PortDiagram';
import '../../../styles/docs.css';

// Where the box ends up. It changes the last screen and nothing else: the two installs are the same
// wherever they are run from, including from the control PC, which plugs USB1 in for a minute.
type Topology = 'one-pc' | 'game-here' | 'control-here';
type Step = 'where' | 'main' | 'unplug' | 'mouse' | 'cables';

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const HOLD_BOTH = 'Hold BOTH buttons down while you plug it in, then press Install.';
const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;
const choice = { 'margin-bottom': 'var(--g-spacing)' } as const;

const Setup = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('where');
  const [topo, setTopo] = createSignal<Topology>('one-pc');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  const latest = () => releases()?.[0] ?? null;
  const counter = () =>
    step() === 'where' ? '1 / 3' : step() === 'mouse' ? '3 / 3' : step() === 'cables' ? null : '2 / 3';
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total
      ? Math.round(((p.written ?? 0) / p.total) * 100)
      : undefined;
  };

  const pick = (t: Topology) => {
    setTopo(t);
    setErr(null);
    setStep('main');
  };

  // Write a full factory image to whichever chip is currently in ROM download on this cable. The
  // owner is never told which chip that is: both BOOT buttons are held, and only one chip's USB is
  // plugged in, so only one can answer.
  const install = async (assetName: string, next: Step) => {
    setErr(null);
    dash.clearFlashResult();
    const asset = latest()?.assets.find((a) => a.name === assetName) ?? null;
    if (!asset) return setErr('That firmware is missing from the latest release. Try again later.');
    setBusy(true);
    try {
      const port = await requestRomPort();
      const image = await downloadAsset(asset);
      if (await dash.flashNative(port, image, 'factory')) setStep(next);
      else setErr(dash.error() ?? `That did not finish. ${HOLD_BOTH}`);
    } catch (e) {
      // A cancel and an empty chooser are the same DOMException, and the second is far more likely:
      // the chip is not in update mode. Say the thing that fixes both rather than nothing.
      setErr(isUserCancel(e) ? `Nothing to install to. ${HOLD_BOTH}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setErr(null);
    setStep('where');
  };

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">
          This browser can't reach USB devices. Open this page in Chrome, Edge or Opera.
        </div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div class="callout callout--warning">Open this page over https, or on localhost.</div>
      </Show>

      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Installing" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.supported && dash.secure && dash.status() !== 'flashing'}>
        <Card>
          <CardHeader
            title="Set up your box"
            subtitle="Install Medius, then plug it in the right way round"
          />
          <Show when={counter()}>{(c) => <Chip variant="neutral">{c()}</Chip>}</Show>
          <Show when={err()}>
            {(msg) => (
              <div class="callout callout--danger" role="alert">
                {msg()}
              </div>
            )}
          </Show>

          <Switch>
            <Match when={step() === 'where'}>
              <p>Which computer is this?</p>

              <div style={choice}>
                <PortDiagram
                  plug={['usb1', 'usb2']}
                  mouse={['usb3']}
                  where={{ usb1: 'This computer', usb2: 'This computer' }}
                />
                <Button variant="primary" onClick={() => pick('one-pc')}>
                  Play and control on this computer
                </Button>
              </div>

              <div style={choice}>
                <PortDiagram
                  plug={['usb1', 'usb2']}
                  mouse={['usb3']}
                  where={{ usb1: 'This computer', usb2: 'Other computer' }}
                />
                <Button variant="secondary" onClick={() => pick('game-here')}>
                  Play here, control from another
                </Button>
              </div>

              <div style={choice}>
                <PortDiagram
                  plug={['usb1', 'usb2']}
                  mouse={['usb3']}
                  where={{ usb1: 'Other computer', usb2: 'This computer' }}
                />
                <Button variant="secondary" onClick={() => pick('control-here')}>
                  Control here, play on another
                </Button>
              </div>
            </Match>

            <Match when={step() === 'main'}>
              <PortDiagram plug={['usb1']} out={['usb2', 'usb3']} boot />
              <div style={row}>
                <Button
                  variant="primary"
                  disabled={busy() || releases.loading}
                  onClick={() => void install('medius_device-factory.bin', 'unplug')}
                >
                  {busy() ? 'Installing...' : 'Install'}
                </Button>
                <Button variant="subtle" size="compact" disabled={busy()} onClick={startOver}>
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'unplug'}>
              <PortDiagram out={['usb1']} />
              <div class="callout callout--danger">
                USB1 and USB3 in the same computer can damage it.
              </div>
              <Button variant="primary" onClick={() => { setErr(null); setStep('mouse'); }}>
                USB1 is unplugged
              </Button>
            </Match>

            <Match when={step() === 'mouse'}>
              <PortDiagram plug={['usb3']} out={['usb1', 'usb2']} boot />
              <Button
                variant="primary"
                disabled={busy() || releases.loading}
                onClick={() => void install('medius_host-factory.bin', 'cables')}
              >
                {busy() ? 'Installing...' : 'Install'}
              </Button>
            </Match>

            <Match when={step() === 'cables'}>
              <Show
                when={dash.status() === 'connected'}
                fallback={
                  <Switch>
                    <Match when={topo() === 'one-pc'}>
                      <ConnectPanel
                        where={{ usb1: 'This computer', usb2: 'This computer' }}
                        onSetup={startOver}
                      />
                    </Match>
                    <Match when={topo() === 'control-here'}>
                      <ConnectPanel
                        where={{ usb1: 'Gaming PC', usb2: 'This computer' }}
                        onSetup={startOver}
                      />
                    </Match>
                    <Match when={topo() === 'game-here'}>
                      <p>Plug in like this.</p>
                      <PortDiagram
                        plug={['usb1', 'usb2']}
                        mouse={['usb3']}
                        where={{ usb1: 'This computer', usb2: 'Other computer' }}
                      />
                      <div class="callout callout--info">
                        USB2 goes to the other computer. Open this page there to control the box:{' '}
                        <code>{typeof window === 'undefined' ? '' : window.location.href}</code>
                      </div>
                      <Button variant="primary" onClick={() => navigate('/dashboard')}>
                        Finish
                      </Button>
                    </Match>
                  </Switch>
                }
              >
                <div class="callout callout--info">
                  Done.{' '}
                  <Show when={dash.version()}>
                    {(v) => <>Your box is on <strong>v{versionString(v())}</strong>.</>}
                  </Show>
                </div>
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
