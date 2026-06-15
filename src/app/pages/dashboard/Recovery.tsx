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
  type FlashChip,
  type FlashKind,
  looksLikeWrongKind,
  validateImage,
} from '../../../dashboard/flash';
import { type FirmwareAsset, downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useDashboard } from './context';
import '../../../styles/docs.css';

const toHexAddr = (n: number) => `0x${n.toString(16)}`;
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);
const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

const phaseLabel: Record<string, string> = {
  rebooting: 'Preparing...',
  connecting: 'Connecting to the bootloader...',
  writing: 'Writing firmware...',
  done: 'Done',
};

const Recovery = () => {
  const dash = useDashboard();
  const [chip, setChip] = createSignal<FlashChip>('device');
  const [kind, setKind] = createSignal<FlashKind>('factory');
  const [source, setSource] = createSignal<'release' | 'upload'>('release');
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [stepError, setStepError] = createSignal<string | null>(null);
  const [usb1Ack, setUsb1Ack] = createSignal(false);
  const [releases] = createResource(fetchReleases);

  onMount(() => {
    if (dash.status() === 'disconnected') dash.clearFlashResult();
  });

  const file = () => files()[0] ?? null;
  const address = () => (kind() === 'factory' ? FACTORY_FLASH_ADDR : APP_FLASH_ADDR);
  const usbPort = () => (chip() === 'host' ? 'USB3 (the mouse port)' : 'USB1 (the clone port)');
  const assetName = () => `medius_${chip()}${kind() === 'factory' ? '-factory' : ''}.bin`;

  const latestRelease = () => releases()?.[0] ?? null;
  const selectedAsset = (): FirmwareAsset | null =>
    latestRelease()?.assets.find((a) => a.name === assetName()) ?? null;

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
    if (chip() === 'host' && !usb1Ack()) return false;
    if (source() === 'upload') return !!image() && validationError() === null;
    return !!selectedAsset() && !releases.loading;
  };

  const view = () => {
    const s = dash.status();
    if (s === 'flashing') return 'flashing';
    if (s === 'error') return 'error';
    if (dash.flashProgress()?.phase === 'done') return 'done';
    return 'ready';
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
      const port = await requestRomPort();
      let img = source() === 'upload' ? image() : null;
      if (source() === 'release') {
        const a = selectedAsset();
        if (!a) return;
        img = await downloadAsset(a);
      }
      if (!img) return;
      await dash.flashNative(port, img, kind());
    } catch (e) {
      if (!isUserCancel(e)) setStepError((e as Error).message);
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
        <CardHeader
          title="Recover or flash over USB"
          subtitle="For a box that won't connect, or to flash the host chip"
        />
        <Switch>
          <Match when={view() === 'error'}>
            <div class="callout callout--danger" role="alert">{dash.error()}</div>
            <p>
              Power-cycle the box and try again. If it still won't boot, repeat with a{' '}
              <strong>Full / recovery</strong> image.
            </p>
          </Match>

          <Match when={view() === 'done'}>
            <div class="callout callout--info">
              Flash complete and verified. Unplug and replug the box to run the new firmware.
            </div>
          </Match>

          <Match when={view() === 'flashing'}>
            <p aria-live="polite">{phaseLabel[dash.flashProgress()?.phase ?? 'connecting']}</p>
            <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
            <div class="callout callout--warning">
              Do not unplug the box or leave this page while it is flashing.
            </div>
            <FlashLog lines={dash.flashLog()} />
          </Match>

          <Match when={view() === 'ready'}>
            <p>
              This flashes a chip over its own USB while it sits in the ROM bootloader. Use it to
              recover a box that won't connect on the <A href="/dashboard">Device</A> tab, or to
              flash the host chip.
            </p>

            <div class="api-response-label">CHIP</div>
            <Combobox
              options={[
                { value: 'device', label: 'Device chip (USB1, faces the game PC)' },
                { value: 'host', label: 'Host chip (USB3, faces the mouse)' },
              ]}
              value={chip()}
              onChange={(v) => setChip(v as FlashChip)}
            />

            <Show when={chip() === 'host'}>
              <div class="callout callout--danger">
                USB3 carries a power hazard. Keep USB1 (the clone) unplugged from this computer the
                whole time USB3 is connected, or the machine can shut down.
                <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
                  <label style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'align-items': 'center' }}>
                    <input
                      type="checkbox"
                      checked={usb1Ack()}
                      onChange={(e) => setUsb1Ack(e.currentTarget.checked)}
                    />
                    I confirm USB1 (the clone) is unplugged from this computer.
                  </label>
                </div>
              </div>
            </Show>

            <div class="api-response-label">FIRMWARE TYPE</div>
            <Combobox
              options={[
                { value: 'factory', label: 'Full / recovery - factory image (blank or bricked)' },
                { value: 'app', label: 'Update - application only' },
              ]}
              value={kind()}
              onChange={(v) => setKind(v as FlashKind)}
            />

            <div class="api-response-label">IMAGE SOURCE</div>
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
                <Match when={releases.error}>
                  <div class="callout callout--warning">
                    Couldn't fetch releases:{' '}
                    {releases.error instanceof Error
                      ? releases.error.message
                      : String(releases.error)}
                    . Switch the source to "Upload a file".
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
                    The latest release has no <code>{assetName()}</code>. Upload a file instead.
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

            <div class="api-response-label">PUT THE CHIP IN DOWNLOAD MODE</div>
            <ol>
              <li>Unplug every cable from the box.</li>
              <li>Make sure no other ESP-based device is plugged into this computer.</li>
              <Show when={chip() === 'host'}>
                <li>Make sure USB1 (the clone) is not plugged into this computer.</li>
              </Show>
              <li>Hold the {chip()} chip's BOOT button.</li>
              <li>While holding BOOT, plug the box's {usbPort()} into this computer.</li>
              <li>Click Flash, then pick the ESP device from the list.</li>
            </ol>

            <Show when={stepError()}>
              <div class="callout callout--danger" role="alert">{stepError()}</div>
            </Show>

            <Button variant="primary" disabled={!canFlash()} onClick={() => setConfirmOpen(true)}>
              Flash
            </Button>
          </Match>
        </Switch>
      </Card>

      <Dialog open={confirmOpen()} onClose={() => setConfirmOpen(false)} size="small">
        <DialogHeader title="Confirm flash" onClose={() => setConfirmOpen(false)} />
        <table class="api-params">
          <tbody>
            <tr><td>Chip</td><td>{chip() === 'host' ? 'Host chip (USB3)' : 'Device chip (USB1)'}</td></tr>
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
          Flashing the wrong image stops the chip from booting. The box must be in download mode
          (BOOT held while plugging in) for this to work.
        </div>
        <Show when={source() === 'upload' && mismatch()}>
          <div class="callout callout--warning">
            This file looks like a {kind() === 'app' ? 'factory' : 'application'} image, but you
            picked {kind() === 'app' ? 'Application update' : 'Full / recovery'}. Double-check first.
          </div>
        </Show>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void startFlash()}>
            Select port and flash
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

export default Recovery;
