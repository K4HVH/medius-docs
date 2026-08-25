import { Match, Show, Switch, createEffect, createResource, createSignal } from 'solid-js';
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
import { requestRomPort } from '../../../dashboard/serial';
import { useNavigate } from '@solidjs/router';
import { useDashboard } from './context';
import { BAD_BROWSER, BAD_CONTEXT } from './ConnectPanel';
import { PortDiagram, holdButton } from './PortDiagram';
import { UnplugWatch } from './UnplugWatch';
import '../../../styles/docs.css';

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

// One manual flasher with full control: any chip, app or factory, release or upload, written over
// the download path (works even on a dead box).
const Advanced = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [chip, setChip] = createSignal<FlashChip>('device');
  const [kind, setKind] = createSignal<FlashKind>('factory');
  const [source, setSource] = createSignal<'release' | 'upload'>('release');
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [done, setDone] = createSignal(false);
  // What was actually written, captured when the flash starts. Reading the live combobox afterwards
  // let a mid-flash switch write an app image at offset 0 and name the wrong cable on the way out.
  const [flashed, setFlashed] = createSignal<{ chip: FlashChip; kind: FlashKind }>({
    chip: 'device',
    kind: 'factory',
  });
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  // Kept apart from `err` so switching chip clears the flash failure that named the other socket
  // without also wiping why the chosen file was refused.
  const [fileErr, setFileErr] = createSignal<string | null>(null);
  // FileUpload calls onError and THEN onChange for the same selection, so onFiles has to know a
  // rejection has just landed. Covers a mixed drop too, where one file is kept and one refused.
  let rejectedThisPick = false;
  const [unplugged, setUnplugged] = createSignal(false);

  // Re-arm the unplug gate whenever the chosen chip changes.
  // Leaving the release path abandons whatever the upload path complained about.
  createEffect(() => {
    if (source() !== 'upload') setFileErr(null);
  });

  createEffect(() => {
    chip();
    setUnplugged(false);
    // The old failure named the other chip's socket; leaving it up puts two contradictory
    // hold-this-button instructions on screen at once. `fileErr` is untouched: it is about the file,
    // which the chip has nothing to do with.
    setErr(null);
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
  const nameFor = (c: FlashChip, k: FlashKind) => `medius_${c}${k === 'factory' ? '-factory' : ''}.bin`;
  const assetName = () => nameFor(chip(), kind());
  const asset = () => latest()?.assets.find((a) => a.name === assetName()) ?? null;
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

  // Which selection a read belongs to. A slow read of an earlier file resolving after a newer one
  // was picked would otherwise arm the earlier file's bytes under the newer file's name, which is
  // the whole hazard this clearing is for.
  let pick = 0;
  const onFiles = (fs: File[]) => {
    const mine = ++pick;
    setFiles(fs);
    setImage(null);
    if (!rejectedThisPick) setFileErr(null);
    rejectedThisPick = false;
    const f = fs[0];
    if (!f) return;
    void f
      .arrayBuffer()
      .then((b) => {
        if (mine !== pick) return;
        setImage(new Uint8Array(b));
      })
      .catch(() => {
        if (mine !== pick) return;
        setImage(null);
        setFileErr('That file could not be read. Pick it again.');
      });
  };

  const canFlash = () =>
    source() === 'upload' ? !!image() && validationError() === null : !!asset() && !releases.loading;

  const flash = async () => {
    setErr(null);
    setFileErr(null);
    dash.clearFlashResult();
    const target = { chip: chip(), kind: kind() };
    setFlashed(target);
    setBusy(true);
    try {
      // Both chips flash over their own native USB in ROM download: the device chip on USB1, the
      // host chip on USB3, each entered by holding the button beside that socket while plugging in.
      const port = await requestRomPort();
      const a = latest()?.assets.find((x) => x.name === nameFor(target.chip, target.kind)) ?? null;
      const img = source() === 'upload' ? image() : a ? await downloadAsset(a) : null;
      if (!img) return setErr('No image selected.');
      const ok = await dash.flashNative(port, img, target.kind);
      if (ok) setDone(true);
      else setErr(dash.error() ?? `That did not finish. ${holdButton(target.chip === 'host' ? 'usb3' : 'usb1')}, then press Flash.`);
    } catch (e) {
      setErr(isUserCancel(e) ? `Nothing to flash. ${holdButton(target.chip === 'host' ? 'usb3' : 'usb1')}, then press Flash.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
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
          <CardHeader title="Flashing" subtitle="Don't unplug or leave this page" />
          <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
        </Card>
      </Show>

      <Show when={dash.supported && dash.secure && dash.status() !== 'flashing'}>
        <Card>
          <CardHeader title="Advanced" subtitle="Manual flash, any chip or image" />
          <Show when={err() ?? fileErr()}>
            {(msg) => <div class="callout callout--danger" role="alert">{msg()}</div>}
          </Show>

          <Switch>
            <Match when={done()}>
              <div class="callout callout--danger">
                Take the cable you just used out of this computer first. USB1 and USB3 plugged into
                the same computer at once can kill it.
              </div>
              <PortDiagram out={flashed().chip === 'host' ? ['usb3'] : ['usb1']} />
              <div class="callout callout--info">Then plug in like this.</div>
              <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} />
              <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  Go to my box
                </Button>
                <Button
                  variant="subtle"
                  size="compact"
                  onClick={() => {
                    // Re-arm the gate: the screen above has just said to plug the other cable back
                    // in, and the effect that resets this only fires on a chip CHANGE.
                    setUnplugged(false);
                    setDone(false);
                  }}
                >
                  Flash another
                </Button>
              </div>
            </Match>

            <Match when={!done()}>
              <div class="api-response-label">CHIP</div>
              <Combobox
                options={[
                  { value: 'device', label: 'Main chip (USB1 + USB2)' },
                  { value: 'host', label: 'Mouse-side chip (USB3)' },
                ]}
                value={chip()}
                disabled={busy()}
                onChange={(v) => setChip(v as FlashChip)}
              />

              <div class="api-response-label">IMAGE</div>
              <Combobox
                options={[
                  { value: 'factory', label: 'Factory - full image at 0x0' },
                  { value: 'app', label: 'Application - app only at 0x10000' },
                ]}
                value={kind()}
                disabled={busy()}
                onChange={(v) => setKind(v as FlashKind)}
              />

              <div class="api-response-label">SOURCE</div>
              <Combobox
                options={[
                  { value: 'release', label: 'Latest release' },
                  { value: 'upload', label: 'Upload a file' },
                ]}
                value={source()}
                disabled={busy()}
                onChange={(v) => setSource(v as 'release' | 'upload')}
              />

              <Show when={source() === 'release'}>
                <Switch>
                  <Match when={releases.loading}>
                    <p>Loading releases...</p>
                  </Match>
                  <Match when={releases.error}>
                    <div class="callout callout--warning">
                      Could not reach the firmware downloads. Choose Upload a file instead.
                    </div>
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
                  disabled={busy()}
                  onChange={onFiles}
                  onError={(m: string) => {
                    rejectedThisPick = true;
                    setFileErr(m);
                  }}
                  label="Firmware .bin"
                />
                <Show when={kind() === 'app'}>
                  <div class="callout callout--info">
                    An application image keeps the partition layout already on the chip. Write the
                    factory image if the box has never had one, or it will have a single app slot and
                    cannot be updated over the control port.
                  </div>
                </Show>
                <Show when={validationError()}>
                  <div class="callout callout--danger" role="alert">{validationError()}</div>
                </Show>
                <Show when={mismatch()}>
                  <div class="callout callout--warning">
                    This file looks like a {kind() === 'app' ? 'factory' : 'application'} image.
                  </div>
                </Show>
              </Show>

              <p style={{ 'margin-top': 'var(--g-spacing)' }}>Get the chip into update mode:</p>
              <Show
                when={unplugged()}
                fallback={<UnplugWatch onUnplugged={() => setUnplugged(true)} />}
              >
                <PortDiagram
                  plug={chip() === 'host' ? ['usb3'] : ['usb1']}
                  out={chip() === 'host' ? ['usb1', 'usb2'] : ['usb2', 'usb3']}
                  where={chip() === 'host' ? { usb3: 'This computer' } : { usb1: 'This computer' }}
                  boot={chip() === 'host' ? 'usb3' : 'usb1'}
                />
                <div class="callout callout--danger">
                  USB1 and USB3 plugged into the same computer at once can kill it.
                </div>
                <Button variant="primary" disabled={busy() || !canFlash()} onClick={() => void flash()}>
                  Flash
                </Button>
              </Show>
            </Match>
          </Switch>
        </Card>
      </Show>
    </>
  );
};

export default Advanced;
