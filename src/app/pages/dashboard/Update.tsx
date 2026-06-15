import { Match, Show, Switch, createEffect, createResource, createSignal } from 'solid-js';
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

type Step = 'choose' | 'main' | 'mouse' | 'done';
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

  // Reset the unplug gate each time we enter the mouse-side step.
  createEffect(() => {
    if (step() === 'mouse') setUnplugged(false);
  });

  const latest = () => releases()?.[0] ?? null;
  const lv = () => parseTag(latest()?.tag);
  const deviceAsset = () => latest()?.assets.find((a) => a.name === 'medius_device.bin') ?? null;
  const hostAsset = () => latest()?.assets.find((a) => a.name === 'medius_host.bin') ?? null;
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
    setAlsoMouse(mode === 'both');
    setStep(mode === 'mouse' ? 'mouse' : 'main');
  };

  const installMain = async () => {
    setErr(null);
    dash.clearFlashResult();
    const a = deviceAsset();
    if (!a) return setErr('No main-chip update in this release.');
    setBusy(true);
    try {
      const ok = await dash.flashDevice(await downloadAsset(a), 'app');
      if (ok) setStep(alsoMouse() ? 'mouse' : 'done');
      else setErr(dash.error() ?? 'That did not finish. Power-cycle and try again.');
    } catch (e) {
      setErr((e as Error).message);
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
          <Show when={err()}>
            <div class="callout callout--danger" role="alert">{err()}</div>
          </Show>

          <Switch>
            <Match when={step() === 'choose'}>
              <Switch>
                <Match when={dash.status() !== 'connected'}>
                  <p>Plug in like this, then connect.</p>
                  <PortDiagram plug={['usb1', 'usb2']} />
                  <Button variant="primary" disabled={!dash.supported || busy()} onClick={() => void dash.connect()}>
                    Connect
                  </Button>
                </Match>
                <Match when={dash.status() === 'connected'}>
                  <p>
                    On{' '}
                    <Show when={dash.version()}>
                      {(v) => <Chip variant="neutral">v{versionString(v())}</Chip>}
                    </Show>
                    <Show when={latest()}>
                      {'. '}Latest is <strong>{latest()?.tag}</strong>
                      {upToDate() ? ' — up to date.' : '.'}
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
                <Button variant="primary" disabled={busy()} onClick={() => void installMain()}>
                  Install
                </Button>
              </Show>
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

            <Match when={step() === 'done'}>
              <div class="callout callout--info">Done. Plug back in normally, then reconnect.</div>
              <PortDiagram plug={['usb1', 'usb2']} />
              <Button variant="secondary" onClick={() => { setStep('choose'); dash.clearFlashResult(); }}>
                Finish
              </Button>
            </Match>
          </Switch>
        </Card>
      </Show>
    </>
  );
};

export default Update;
