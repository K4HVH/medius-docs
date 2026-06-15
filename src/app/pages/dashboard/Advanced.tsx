import { Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Combobox } from '../../../components/inputs/Combobox';
import { FileUpload } from '../../../components/inputs/FileUpload';
import { Progress } from '../../../components/feedback/Progress';
import {
  FLASH_SIZE_BYTES,
  type FlashChip,
  type FlashKind,
  looksLikeWrongKind,
  validateImage,
} from '../../../dashboard/flash';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestMediusPort, requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import { PortDiagram } from './PortDiagram';
import '../../../styles/docs.css';

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

// One manual flasher with full control: any chip, app or factory, release or
// upload, written over the BOOT-button path (works even on a dead box).
const Advanced = () => {
  const dash = useDashboard();
  const [releases] = createResource(fetchReleases);
  const [chip, setChip] = createSignal<FlashChip>('device');
  const [kind, setKind] = createSignal<FlashKind>('factory');
  const [source, setSource] = createSignal<'release' | 'upload'>('release');
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [done, setDone] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  const latest = () => releases()?.[0] ?? null;
  const assetName = () => `medius_${chip()}${kind() === 'factory' ? '-factory' : ''}.bin`;
  const asset = () => latest()?.assets.find((a) => a.name === assetName()) ?? null;
  const file = () => files()[0] ?? null;
  const validationError = () => {
    const img = image();
    return img ? validateImage(img, kind()) : null;
  };
  const mismatch = () => {
    const img = image();
    return img ? looksLikeWrongKind(img, kind()) : false;
  };
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : undefined;
  };

  const onFiles = (fs: File[]) => {
    setFiles(fs);
    const f = fs[0];
    if (!f) return setImage(null);
    void f.arrayBuffer().then((b) => setImage(new Uint8Array(b)));
  };

  const canFlash = () =>
    source() === 'upload' ? !!image() && validationError() === null : !!asset() && !releases.loading;

  const flash = async () => {
    setErr(null);
    dash.clearFlashResult();
    setBusy(true);
    try {
      const port = chip() === 'host' ? await requestRomPort() : await requestMediusPort();
      const a = asset();
      const img = source() === 'upload' ? image() : a ? await downloadAsset(a) : null;
      if (!img) return setErr('No image selected.');
      const ok = await dash.flashNative(port, img, kind());
      if (ok) setDone(true);
      else setErr('That did not finish. Hold BOOT and try again.');
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
          <CardHeader title="Flashing" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Advanced" subtitle="Manual flash, any chip or image" />
          <Show when={err()}>
            <div class="callout callout--danger" role="alert">{err()}</div>
          </Show>

          <Switch>
            <Match when={done()}>
              <div class="callout callout--info">Done. Plug back in normally, then reconnect.</div>
              <PortDiagram plug={['usb1', 'usb2']} />
              <Button variant="secondary" onClick={() => setDone(false)}>Flash another</Button>
            </Match>

            <Match when={!done()}>
              <div class="api-response-label">CHIP</div>
              <Combobox
                options={[
                  { value: 'device', label: 'Main chip (USB1 + USB2)' },
                  { value: 'host', label: 'Mouse-side chip (USB3)' },
                ]}
                value={chip()}
                onChange={(v) => setChip(v as FlashChip)}
              />

              <div class="api-response-label">IMAGE</div>
              <Combobox
                options={[
                  { value: 'factory', label: 'Factory - full image at 0x0' },
                  { value: 'app', label: 'Application - app only at 0x10000' },
                ]}
                value={kind()}
                onChange={(v) => setKind(v as FlashKind)}
              />

              <div class="api-response-label">SOURCE</div>
              <Combobox
                options={[
                  { value: 'release', label: 'Latest release' },
                  { value: 'upload', label: 'Upload a file' },
                ]}
                value={source()}
                onChange={(v) => setSource(v as 'release' | 'upload')}
              />

              <Show when={source() === 'release'}>
                <Switch>
                  <Match when={releases.loading}>
                    <p>Loading releases...</p>
                  </Match>
                  <Match when={asset()}>
                    {(a) => (
                      <p style={muted}>
                        <code>{a().name}</code> ({fmtBytes(a().size)}) from {latest()?.tag}
                      </p>
                    )}
                  </Match>
                  <Match when={!asset()}>
                    <div class="callout callout--warning">
                      No <code>{assetName()}</code> in the latest release. Upload one instead.
                    </div>
                  </Match>
                </Switch>
              </Show>

              <Show when={source() === 'upload'}>
                <FileUpload
                  accept=".bin"
                  maxSize={FLASH_SIZE_BYTES}
                  value={files()}
                  onChange={onFiles}
                  label="Firmware .bin"
                />
                <Show when={validationError()}>
                  <div class="callout callout--danger" role="alert">{validationError()}</div>
                </Show>
                <Show when={mismatch()}>
                  <div class="callout callout--warning">
                    This file looks like a {kind() === 'app' ? 'factory' : 'application'} image.
                  </div>
                </Show>
              </Show>

              <p style={{ 'margin-top': 'var(--g-spacing)' }}>Plug in and hold BOOT:</p>
              <PortDiagram
                plug={chip() === 'host' ? ['usb3'] : ['usb1', 'usb2']}
                boot={chip() === 'host' ? 'mouse' : 'main'}
              />
              <Show when={chip() === 'host'}>
                <div class="callout callout--danger">Never plug USB1 and USB3 into the same PC.</div>
              </Show>

              <Button variant="primary" disabled={busy() || !canFlash()} onClick={() => void flash()}>
                Flash
              </Button>
            </Match>
          </Switch>
        </Card>
      </Show>
    </>
  );
};

export default Advanced;
