import { Match, Show, Switch, createResource, createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Combobox } from '../../../components/inputs/Combobox';
import { FileUpload } from '../../../components/inputs/FileUpload';
import { Progress } from '../../../components/feedback/Progress';
import { Dialog, DialogFooter, DialogHeader } from '../../../components/feedback/Dialog';
import {
  APP_FLASH_ADDR,
  FACTORY_FLASH_ADDR,
  FLASH_SIZE_BYTES,
  type FlashKind,
  looksLikeWrongKind,
  validateImage,
} from '../../../dashboard/flash';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { useDashboard } from './context';
import '../../../styles/docs.css';

type Source = 'release' | 'upload';

const toHexAddr = (n: number) => `0x${n.toString(16)}`;
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);

const phaseLabel: Record<string, string> = {
  rebooting: 'Rebooting into download mode...',
  connecting: 'Connecting to the bootloader...',
  writing: 'Writing firmware...',
  done: 'Done',
};

// The device-chip asset names in a release.
const assetName = (kind: FlashKind) => `medius_device${kind === 'factory' ? '-factory' : ''}.bin`;

const Flash = () => {
  const dash = useDashboard();
  const [kind, setKind] = createSignal<FlashKind>('app');
  const [source, setSource] = createSignal<Source>('release');
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [stepError, setStepError] = createSignal<string | null>(null);
  const [releases] = createResource(fetchReleases);

  onMount(() => {
    // Drop a stale done/error banner when returning to a fresh, disconnected page.
    if (dash.status() === 'disconnected') dash.clearFlashResult();
  });

  const file = () => files()[0] ?? null;
  const address = () => (kind() === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);

  const latestRelease = () => releases()?.[0] ?? null;
  const selectedAsset = (): FirmwareAsset | null => {
    const r = latestRelease();
    if (!r) return null;
    return r.assets.find((a) => a.name === assetName(kind())) ?? null;
  };

  const validationError = () => {
    const img = image();
    return img ? validateImage(img, kind()) : null;
  };
  const mismatch = () => {
    const img = image();
    return img ? looksLikeWrongKind(img, kind()) : false;
  };

  const onFiles = (fs: File[]) => {
    setFiles(fs);
    const f = fs[0];
    if (!f) {
      setImage(null);
      return;
    }
    void f.arrayBuffer().then((b) => setImage(new Uint8Array(b)));
  };

  const canFlash = () => {
    if (source() === 'upload') return !!image() && validationError() === null;
    return !!selectedAsset() && !releases.loading;
  };

  const view = () => {
    const s = dash.status();
    if (s === 'flashing') return 'flashing';
    if (s === 'error') return 'error';
    if (dash.flashProgress()?.phase === 'done') return 'done';
    if (s === 'connected') return 'ready';
    return 'disconnected';
  };

  const pct = () => {
    const p = dash.flashProgress();
    if (p?.phase === 'writing' && p.total) return Math.round(((p.written ?? 0) / p.total) * 100);
    return undefined;
  };

  const startFlash = async () => {
    setConfirmOpen(false);
    setStepError(null);
    try {
      let img = source() === 'upload' ? image() : null;
      if (source() === 'release') {
        const a = selectedAsset();
        if (!a) return;
        img = await downloadAsset(a);
      }
      if (!img) return;
      await dash.flashDevice(img, kind());
    } catch (e) {
      setStepError((e as Error).message);
    }
  };

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">
          This browser can't reach USB devices. Open the dashboard in Chrome, Edge, or Opera.
        </div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div class="callout callout--warning">
          Web Serial needs a secure context. Open this page over HTTPS, or on localhost.
        </div>
      </Show>

      <Card>
        <CardHeader title="Flash the device chip" subtitle="Update or recover the box over USB" />
        <Switch>
          <Match when={view() === 'disconnected'}>
            <p>
              Connect to your box first. Open the <A href="/dashboard">Device</A> tab and click
              Connect, then come back here.
            </p>
          </Match>

          <Match when={view() === 'error'}>
            <div class="callout callout--danger" role="alert">{dash.error()}</div>
            <p>
              If writing had already started, the firmware may be incomplete. Power-cycle the box,
              then run a <strong>Full / recovery</strong> flash (factory image at 0x0). If it failed
              before writing, a power-cycle and reconnect on the <A href="/dashboard">Device</A> tab
              is enough.
            </p>
          </Match>

          <Match when={view() === 'done'}>
            <div class="callout callout--info">
              Flash complete and verified. Unplug and replug the box to run the new firmware, then
              reconnect on the <A href="/dashboard">Device</A> tab.
            </div>
          </Match>

          <Match when={view() === 'flashing'}>
            <p aria-live="polite">{phaseLabel[dash.flashProgress()?.phase ?? 'rebooting']}</p>
            <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
            <div class="callout callout--warning">
              Do not unplug the box or leave this page while it is flashing.
            </div>
            <FlashLog lines={dash.flashLog()} />
          </Match>

          <Match when={view() === 'ready'}>
            <div class="callout callout--warning">
              Flashing reboots the box into its bootloader, so the control link drops. When it
              finishes you'll power-cycle the box to run the new firmware.
            </div>

            <div class="api-response-label">FIRMWARE TYPE</div>
            <Combobox
              options={[
                { value: 'app', label: 'Update - application only (most updates)' },
                { value: 'factory', label: 'Full / recovery - factory image (blank or bricked)' },
              ]}
              value={kind()}
              onChange={(v) => setKind(v as FlashKind)}
            />
            <p style={{ color: 'var(--g-text-secondary)' }}>
              {kind() === 'factory'
                ? 'The factory image includes the bootloader and partition table, written at 0x0. Use it for a blank or bricked board, or a full reflash.'
                : 'The application image is just the Medius firmware, written at 0x10000. Use it for normal updates on a working board.'}
            </p>

            <div class="api-response-label">IMAGE SOURCE</div>
            <Combobox
              options={[
                { value: 'release', label: 'Latest release' },
                { value: 'upload', label: 'Upload a file' },
              ]}
              value={source()}
              onChange={(v) => setSource(v as Source)}
            />

            <Show when={source() === 'release'}>
              <Switch>
                <Match when={releases.loading}>
                  <p>Loading releases...</p>
                </Match>
                <Match when={releases.error}>
                  <div class="callout callout--warning">
                    Couldn't fetch releases:{' '}
                    {releases.error instanceof Error
                      ? releases.error.message
                      : String(releases.error)}
                    . Switch the source to "Upload a file" and provide the .bin yourself.
                  </div>
                </Match>
                <Match when={selectedAsset()}>
                  {(a) => (
                    <p>
                      Will flash <code>{a().name}</code> ({fmtBytes(a().size)}) from{' '}
                      <strong>{latestRelease()?.tag}</strong>.
                    </p>
                  )}
                </Match>
                <Match when={latestRelease() && !selectedAsset()}>
                  <div class="callout callout--warning">
                    The latest release has no <code>{assetName(kind())}</code>. Use a different type
                    or upload a file.
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
            </Show>

            <Show when={stepError()}>
              <div class="callout callout--danger" role="alert">{stepError()}</div>
            </Show>

            <div style={{ 'margin-top': 'var(--g-spacing)' }}>
              <Button variant="primary" disabled={!canFlash()} onClick={() => setConfirmOpen(true)}>
                Flash
              </Button>
            </div>
          </Match>
        </Switch>
      </Card>

      <Dialog open={confirmOpen()} onClose={() => setConfirmOpen(false)} size="small">
        <DialogHeader title="Confirm flash" onClose={() => setConfirmOpen(false)} />
        <table class="api-params">
          <tbody>
            <tr><td>Chip</td><td>Device chip (over the control port)</td></tr>
            <tr><td>Type</td><td>{kind() === 'factory' ? 'Full / recovery' : 'Application update'}</td></tr>
            <tr><td>Address</td><td><code>{toHexAddr(address())}</code></td></tr>
            <tr>
              <td>Image</td>
              <td>
                <Show when={source() === 'upload'} fallback={<>{selectedAsset()?.name} ({latestRelease()?.tag})</>}>
                  {file()?.name} ({fmtBytes(file()?.size ?? 0)})
                </Show>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="callout callout--danger">
          Flashing the wrong image stops the box from booting. Recover with a Full / recovery flash.
        </div>
        <Show when={source() === 'upload' && mismatch()}>
          <div class="callout callout--warning">
            This file looks like a {kind() === 'app' ? 'factory' : 'application'} image, but you
            picked {kind() === 'app' ? 'Application update' : 'Full / recovery'}. Double-check
            before flashing.
          </div>
        </Show>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void startFlash()}>
            Flash now
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
};

const FlashLog = (props: { lines: string[] }) => (
  <pre
    class="diagram"
    style={{ 'max-height': '220px', overflow: 'auto', 'white-space': 'pre-wrap' }}
  >
    {props.lines.join('\n')}
  </pre>
);

export default Flash;
