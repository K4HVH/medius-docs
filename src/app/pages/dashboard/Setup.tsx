/// <reference types="w3c-web-serial" />
import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { Progress } from '../../../components/feedback/Progress';
import { versionString } from '../../../dashboard/protocol';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { BAD_BROWSER, BAD_CONTEXT, ConnectPanel } from './ConnectPanel';
import { HOLD_BOTH, PortDiagram, type PortId } from './PortDiagram';
import '../../../styles/docs.css';

// Where the box ends up. It changes the last screen and nothing else: the two installs are the same
// wherever they are run from, including from the control PC, which plugs USB1 in for a minute.
type Topology = 'one-pc' | 'game-here' | 'control-here';
type Step = 'where' | 'main' | 'unplug' | 'mouse' | 'unplug3' | 'cables';

// Both gates exist for the same reason and neither can be automated: the browser sees USB2 and
// nothing else, so it cannot tell whether the other two cables are in.
const STEPS: Step[] = ['where', 'main', 'unplug', 'mouse', 'unplug3', 'cables'];

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const HAZARD = 'USB1 and USB3 plugged into the same computer at once can kill it.';
const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

// The whole option is the click target, label above its own picture, so there is no working out
// which button belongs to which diagram.
const choice = {
  display: 'block',
  width: '100%',
  'text-align': 'left',
  cursor: 'pointer',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  border: '2px solid var(--g-border-color)',
  'border-radius': 'var(--g-radius)',
  padding: 'var(--g-spacing-sm) var(--g-spacing)',
  'margin-bottom': 'var(--g-spacing)',
} as const;

const choiceLabel = { 'font-weight': '700', 'font-size': '1.05em' } as const;

const CHOICES: {
  topo: Topology;
  label: string;
  plug: PortId[];
  other: PortId[];
  where: Partial<Record<PortId, string>>;
}[] = [
  {
    topo: 'one-pc',
    label: 'Just one computer',
    plug: ['usb1', 'usb2'],
    other: [],
    where: { usb1: 'This computer', usb2: 'This computer' },
  },
  {
    topo: 'game-here',
    label: "Two computers, and I'm on the one I play on",
    plug: ['usb1'],
    other: ['usb2'],
    where: { usb1: 'This computer', usb2: 'Other computer' },
  },
  {
    topo: 'control-here',
    label: "Two computers, and I'm on the other one",
    plug: ['usb2'],
    other: ['usb1'],
    where: { usb1: 'Gaming PC', usb2: 'This computer' },
  },
];

const Setup = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('where');
  const [topo, setTopo] = createSignal<Topology>('one-pc');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  const latest = () => releases()?.[0] ?? null;
  const counter = () => `Step ${STEPS.indexOf(step()) + 1} of ${STEPS.length}`;
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total
      ? Math.round(((p.written ?? 0) / p.total) * 100)
      : undefined;
  };

  const pick = (t: Topology) => {
    setTopo(t);
    setErr(null);
    // Drop any link and any earlier failure before touching the chips. A link left open would keep
    // reporting the version of firmware that is about to be erased, and the last screen would greet
    // a finished install with a connect failure from before the wizard started.
    void dash.disconnect().catch(() => undefined);
    setStep('main');
  };

  // Write a full factory image to whichever chip is currently in ROM download on this cable. The
  // owner is never told which chip that is: both BOOT buttons are held, and only one chip's USB is
  // plugged in, so only one can answer.
  const install = async (assetName: string, next: Step) => {
    setErr(null);
    dash.clearFlashResult();
    setBusy(true);
    try {
      // A resource whose fetch failed THROWS when it is read, so this cannot sit outside a catch:
      // it threw straight past the button and left a live Install that did nothing at all. A failed
      // fetch and a release without the image are the same thing to the owner.
      let asset: FirmwareAsset | null = null;
      try {
        asset = latest()?.assets.find((a) => a.name === assetName) ?? null;
      } catch {
        asset = null;
      }
      if (!asset) {
        setErr("The download isn't ready yet. Reload the page and try again in a few minutes.");
        return;
      }
      const port = await requestRomPort();
      const image = await downloadAsset(asset);
      if (await dash.flashNative(port, image, 'factory')) {
        // The chip has just been rewritten, so anything still holding a link is holding a stale one.
        // This also catches a connect that was in flight when the wizard started.
        await dash.disconnect().catch(() => undefined);
        setStep(next);
      }
      else setErr(dash.error() ?? `That did not finish. ${HOLD_BOTH}, then press Install.`);
    } catch (e) {
      // A cancel and an empty chooser are the same DOMException, and the second is far more likely:
      // the chip is not in update mode. Say the thing that fixes both rather than nothing.
      setErr(isUserCancel(e) ? `Nothing to install to. ${HOLD_BOTH}, then press Install.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setErr(null);
    setStep('where');
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
          <CardHeader
            title="Set up your box"
            subtitle="The ports are numbered on the box itself"
          />
          <Chip variant="neutral">{counter()}</Chip>
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
              <p style={{ color: 'var(--g-text-secondary)' }}>
                The pictures show where the cables end up. The next screens install it.
              </p>
              <For each={CHOICES}>
                {(c) => (
                  <button type="button" style={choice} onClick={() => pick(c.topo)}>
                    <div style={choiceLabel}>{c.label}</div>
                    <PortDiagram plug={c.plug} other={c.other} mouse={['usb3']} where={c.where} />
                  </button>
                )}
              </For>
            </Match>

            <Match when={step() === 'main'}>
              <PortDiagram
                plug={['usb1']}
                out={['usb2', 'usb3']}
                where={{ usb1: 'This computer' }}
                boot
              />
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
              <div class="callout callout--danger">Take USB1 out of this computer. {HAZARD}</div>
              <div style={row}>
                <Button variant="primary" onClick={go('mouse')}>
                  It's unplugged
                </Button>
                <Button variant="subtle" size="compact" onClick={go('main')}>
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'mouse'}>
              <PortDiagram
                plug={['usb3']}
                out={['usb1', 'usb2']}
                where={{ usb3: 'This computer' }}
                boot
              />
              <div class="callout callout--danger">{HAZARD}</div>
              <div style={row}>
                <Button
                  variant="primary"
                  disabled={busy() || releases.loading}
                  onClick={() => void install('medius_host-factory.bin', 'unplug3')}
                >
                  {busy() ? 'Installing...' : 'Install'}
                </Button>
                <Button variant="subtle" size="compact" disabled={busy()} onClick={go('unplug')}>
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'unplug3'}>
              <PortDiagram out={['usb3']} />
              <div class="callout callout--danger">
                Take USB3 out of this computer before you plug USB1 back in. {HAZARD}
              </div>
              <Button variant="primary" onClick={go('cables')}>
                It's unplugged
              </Button>
            </Match>

            <Match when={step() === 'cables'}>
              <Show
                when={dash.status() === 'connected'}
                fallback={
                  <Switch>
                    <Match when={topo() === 'one-pc'}>
                      <ConnectPanel
                        plug={['usb1', 'usb2']}
                        where={{ usb1: 'This computer', usb2: 'This computer' }}
                        onSetup={startOver}
                      />
                    </Match>
                    <Match when={topo() === 'control-here'}>
                      <ConnectPanel
                        plug={['usb2']}
                        other={['usb1']}
                        where={{ usb1: 'Gaming PC', usb2: 'This computer' }}
                        onSetup={startOver}
                      />
                    </Match>
                    <Match when={topo() === 'game-here'}>
                      <PortDiagram
                        plug={['usb1']}
                        other={['usb2']}
                        mouse={['usb3']}
                        where={{ usb1: 'This computer', usb2: 'Other computer' }}
                      />
                      <div class="callout callout--info">
                        Open this address on the other computer:{' '}
                        <code>
                          {typeof window === 'undefined' ? '' : `${window.location.origin}/dashboard`}
                        </code>
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
                    {(v) => (
                      <>
                        Your box is on <strong>v{versionString(v())}</strong>.
                      </>
                    )}
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
