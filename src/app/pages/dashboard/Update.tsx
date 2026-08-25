import { Match, Show, Switch, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Progress } from '../../../components/feedback/Progress';
import { Chip } from '../../../components/display/Chip';
import { versionString } from '../../../dashboard/protocol';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
import { PortDiagram } from './PortDiagram';
import '../../../styles/docs.css';

type Step = 'choose' | 'update' | 'done' | 'sent';
const parseTag = (tag?: string) => {
  const m = tag?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};
const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

const Update = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [step, setStep] = createSignal<Step>('choose');
  const [which, setWhich] = createSignal<'both' | 'main' | 'mouse'>('both');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

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

  // A resource whose fetch rejected re-throws on every read, including from a `disabled=` prop
  // during render, and there is no ErrorBoundary anywhere: one unguarded read freezes the page.
  const latest = () => {
    try {
      return releases()?.[0] ?? null;
    } catch {
      return null;
    }
  };
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
    setBusy(true);
    try {
      const da = deviceAsset();
      const ha = hostAsset();
      // Three different situations, and only the first is fixed by waiting. Point at the other
      // choice only when it would actually work, and name where that choice lives: it is on the
      // previous screen, not this one.
      if (!latest() || (!da && !ha)) {
        setErr("There's no update available right now. Try again in a few minutes.");
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
      const outcome = await dash.updateOverControl(images);
      if (outcome === 'verified') setStep('done');
      else if (outcome === 'sent') setStep('sent');
      else if (!dash.error()) setErr("That didn't finish. The box kept the firmware it was running.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Updating" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Update" subtitle="Get the latest firmware" />
          <Show when={err()}>
            {(msg) => <div class="callout callout--danger" role="alert">{msg()}</div>}
          </Show>

          <Switch>
            <Match when={step() === 'choose'}>
              <Switch>
                <Match when={dash.status() !== 'connected'}>
                  <ConnectPanel />
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
                  <div style={row}>
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
              <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} />
              <Show when={dash.status() === 'connected'} fallback={<ConnectPanel />}>
                <Button
                  variant="primary"
                  disabled={busy() || releases.loading}
                  onClick={() => void runUpdate()}
                >
                  {busy() ? 'Updating...' : 'Update'}
                </Button>
              </Show>
              <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
                <Button
                  variant="subtle"
                  size="compact"
                  disabled={busy()}
                  onClick={() => { setErr(null); setStep('choose'); }}
                >
                  Back
                </Button>
              </div>
            </Match>

            <Match when={step() === 'sent'}>
              {/* The transfer and the activate went through and then nothing answered, so what is
                  running now is exactly what this cannot say. The instruction itself lives in the
                  shared error, which ConnectPanel renders on whatever page the user wanders to. */}
              <Show
                when={dash.status() === 'connected'}
                fallback={<ConnectPanel />}
              >
                <div class="callout callout--info">
                  Your box is back
                  <Show when={dash.version()}>
                    {(v) => <> on <strong>v{versionString(v())}</strong></>}
                  </Show>
                  .
                </div>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  Finish
                </Button>
              </Show>
            </Match>

            <Match when={step() === 'done'}>
              <Show when={dash.status() === 'connected'} fallback={<ConnectPanel />}>
                <Show
                  when={which() === 'mouse' || upToDate()}
                  fallback={
                    <div class="callout callout--warning">
                      The box came back on{' '}
                      <Show when={dash.version()}>
                        {(v) => <strong>v{versionString(v())}</strong>}
                      </Show>
                      , not the version that was sent. It reverts anything that will not run, so it
                      is still working — try the update again.
                    </div>
                  }
                >
                  <div class="callout callout--info">
                    Updated and verified.{' '}
                    <Show when={dash.version()}>
                      {(v) => <>Now on <strong>v{versionString(v())}</strong>.</>}
                    </Show>
                  </div>
                </Show>
                <Button
                  variant="primary"
                  onClick={() => { dash.clearFlashResult(); setStep('choose'); navigate('/dashboard'); }}
                >
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

export default Update;
