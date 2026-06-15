import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Progress } from '../../../components/feedback/Progress';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestMediusPort, requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { PortDiagram } from './PortDiagram';
import '../../../styles/docs.css';

type Chip = 'main' | 'mouse';
const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

const Recovery = () => {
  const dash = useDashboard();
  const [releases] = createResource(fetchReleases);
  const [chip, setChip] = createSignal<Chip | null>(null);
  const [done, setDone] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  const latest = () => releases()?.[0] ?? null;
  const assetName = () =>
    chip() === 'mouse' ? 'medius_host-factory.bin' : 'medius_device-factory.bin';
  const asset = () => latest()?.assets.find((a) => a.name === assetName()) ?? null;
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : undefined;
  };

  const recover = async () => {
    setErr(null);
    dash.clearFlashResult();
    const a = asset();
    if (!a) return setErr('No recovery image in this release. Use Advanced to upload one.');
    setBusy(true);
    try {
      const port = chip() === 'mouse' ? await requestRomPort() : await requestMediusPort();
      const ok = await dash.flashNative(port, await downloadAsset(a), 'factory');
      if (ok) setDone(true);
      else setErr('That did not finish. Hold BOOT and try again.');
    } catch (e) {
      if (!isUserCancel(e)) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setChip(null);
    setDone(false);
    dash.clearFlashResult();
  };

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">Open the dashboard in Chrome, Edge, or Opera.</div>
      </Show>

      <Show when={dash.status() === 'flashing'}>
        <Card>
          <CardHeader title="Recovering" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Recover" subtitle="Fix a box that won't connect or turn on" />
          <Show when={err()}>
            <div class="callout callout--danger" role="alert">{err()}</div>
          </Show>

          <Switch>
            <Match when={done()}>
              <div class="callout callout--info">Done. Plug back in normally, then reconnect.</div>
              <PortDiagram plug={['usb1', 'usb2']} />
              <Button variant="secondary" onClick={reset}>Finish</Button>
            </Match>

            <Match when={chip() === null}>
              <p>Which part won't work?</p>
              <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                <Button variant="secondary" onClick={() => setChip('main')}>Main chip</Button>
                <Button variant="secondary" onClick={() => setChip('mouse')}>Mouse-side chip</Button>
              </div>
              <p style={muted}>Not sure? Try the main chip first.</p>
            </Match>

            <Match when={chip() === 'main'}>
              <p><strong>Main chip.</strong> Plug in and hold BOOT.</p>
              <PortDiagram plug={['usb1', 'usb2']} boot="main" />
              <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)' }}>
                <Button variant="primary" disabled={busy()} onClick={() => void recover()}>Recover</Button>
                <Button variant="subtle" disabled={busy()} onClick={() => setChip(null)}>Back</Button>
              </div>
            </Match>

            <Match when={chip() === 'mouse'}>
              <p><strong>Mouse-side chip.</strong> Unplug your mouse, plug in and hold BOOT.</p>
              <PortDiagram plug={['usb3']} boot="mouse" />
              <div class="callout callout--danger">Never plug USB1 and USB3 into the same PC.</div>
              <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)' }}>
                <Button variant="primary" disabled={busy()} onClick={() => void recover()}>Recover</Button>
                <Button variant="subtle" disabled={busy()} onClick={() => setChip(null)}>Back</Button>
              </div>
            </Match>
          </Switch>

          <p style={muted}>
            Know the exact image and offset? <A href="/dashboard/advanced">Advanced</A>.
          </p>
        </Card>
      </Show>
    </>
  );
};

export default Recovery;
