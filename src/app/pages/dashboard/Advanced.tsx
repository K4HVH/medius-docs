import { Match, Show, Switch, createEffect, createResource, createSignal, type JSX } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { FileUpload } from '../../../components/inputs/FileUpload';
import {
  FLASH_SIZE_BYTES,
  type FlashChip,
  type FlashKind,
  type FlashPhase,
  looksLikeWrongKind,
  romRefusal,
  validateImage,
} from '../../../dashboard/flash';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { requestRomPort } from '../../../dashboard/serial';
import { useNavigate } from '@solidjs/router';
import { BoxScope, useBoxes, useNativeFlash } from './context';
import { Usb2Flash } from './AdvancedUsb2';
import { BAD_BROWSER, BAD_CONTEXT } from './ConnectPanel';
import { InstallPorts, WiringPorts } from './PortDiagram';
import { Panel, Panels } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';
import { Select } from '../../shell/Select';

const WAIT: Partial<Record<FlashPhase, string>> = {
  rebooting: 'Rebooting',
  connecting: 'Connecting',
  restarting: 'Restarting',
  verifying: 'Verifying',
};

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);

// Manual flash of the selected box over USB2, or of either chip in ROM download over USB1 or USB3,
// which works on a dead box. Update's Manual tab.
const ManualFlash = () => {
  const native = useNativeFlash();
  const boxes = useBoxes();
  // The selected box, read through the registry: inside BoxScope a box coming or going would remount the
  // page and lose a ROM flash half set up, which unplugging USB2 for it does.
  const dash = () => boxes.scope();
  const [via, setVia] = createSignal<'usb2' | 'rom'>(
    dash().update()?.page === 'advanced' || dash().status() === 'connected' || dash().status() === 'flashing'
      ? 'usb2'
      : 'rom',
  );
  const [usb2Busy, setUsb2Busy] = createSignal(false);
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [chip, setChip] = createSignal<FlashChip>('device');
  const [kind, setKind] = createSignal<FlashKind>('factory');
  const [source, setSource] = createSignal<'release' | 'upload'>('release');
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [done, setDone] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  // Apart from `err`, so a chip switch clears the flash failure but keeps the file refusal.
  const [fileErr, setFileErr] = createSignal<string | null>(null);
  // FileUpload calls onError THEN onChange for one selection (a mixed drop included), so onFiles
  // must not clear that rejection.
  let rejectedThisPick = false;

  createEffect(() => {
    if (source() !== 'upload') setFileErr(null);
  });

  // The previous chip's failure names the other socket, contradicting the diagram.
  createEffect(() => {
    chip();
    setErr(null);
  });

  // A rejected resource re-throws on every read, render included, and there is no ErrorBoundary:
  // one unguarded read freezes the page.
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
    return img ? (validateImage(img, kind()) ?? romRefusal(img, chip())) : null;
  };
  const mismatch = () => {
    const img = image();
    return img ? looksLikeWrongKind(img, kind()) : false;
  };
  const progress = () => (native.running() ? native.progress() : dash().updateProgress());
  const pct = () => {
    const p = progress();
    return p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : p?.phase === 'done' ? 100 : undefined;
  };
  // A phase with no count shows its name over the running segment.
  const wait = () => (pct() === undefined ? (WAIT[progress()?.phase ?? 'connecting'] ?? 'Connecting') : null);
  const updating = () => dash().status() === 'flashing';

  // Tags each read with its selection, so a slow earlier read can't arm its bytes under a newer
  // file's name.
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
        // `pick` doesn't move with SOURCE, so a slow read can land after the upload path, with no
        // picker left to point at.
        if (mine !== pick || source() !== 'upload') return;
        setImage(null);
        setFileErr('That file could not be read. Pick it again.');
      });
  };

  const viaField = () => (
    <div class="labelled">
      <span class="field-l">Via</span>
      <Select
        label="Via"
        options={[
          { value: 'usb2', label: dash().name() ? `Control port, USB2 (${dash().name()})` : 'Control port, USB2' },
          { value: 'rom', label: 'ROM download, USB1 or USB3' },
        ]}
        value={via()}
        disabled={busy() || usb2Busy()}
        onChange={(v) => setVia(v as 'usb2' | 'rom')}
      />
    </div>
  );

  const canFlash = () =>
    source() === 'upload' ? !!image() && validationError() === null : !!asset() && !releases.loading;

  const flash = async () => {
    setErr(null);
    setFileErr(null);
    native.clear();
    // Captured before the awaits so the image and its offset come from one reading.
    const target = { chip: chip(), kind: kind(), source: source() };
    setBusy(true);
    try {
      // ROM download over each chip's native USB: device chip on USB1, host chip on USB3, entered by
      // holding the button beside that socket while plugging in.
      const port = await requestRomPort();
      const a = latest()?.assets.find((x) => x.name === nameFor(target.chip, target.kind)) ?? null;
      const img = target.source === 'upload' ? image() : a ? await downloadAsset(a) : null;
      if (!img) return setErr('No image selected.');
      const ok = await native.flash(port, img, target.kind, {
        page: 'advanced',
        chip: target.chip,
        source: target.source === 'upload' ? 'file' : 'release',
      });
      if (ok) setDone(true);
      else setErr(native.error() ?? 'That did not finish.');
    } catch (e) {
      setErr(isUserCancel(e) ? 'Nothing to flash.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The form shows in any browser; Flash needs Web Serial on a secure page.
  const blocked = () => (!boxes.supported ? BAD_BROWSER : !boxes.secure ? BAD_CONTEXT : null);

  const choice = (label: string, el: JSX.Element) => (
    <div class="labelled">
      <span class="field-l">{label}</span>
      {el}
    </div>
  );

  return (
    <Panels>
      <Show when={native.running() || updating()}>
        <Panel id="flashing" wide>
          <p class="cue">Flashing</p>
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
        </Panel>
      </Show>

      <Show when={!native.running() && !updating()}>
        <Panel id="manual-flash" wide>
          <Show
            when={via() === 'rom'}
            fallback={
              <BoxScope>
                <Usb2Flash via={viaField} onBusy={setUsb2Busy} />
              </BoxScope>
            }
          >
            <Show when={err() ?? fileErr()}>
              {(msg) => <div class="callout callout--danger" role="alert">{msg()}</div>}
            </Show>

            <Switch>
              <Match when={done()}>
                <p class="state">
                  <span class="dot ok" />
                  Done.
                </p>
                <WiringPorts />
                <div class="acts">
                  <Button variant="primary" onClick={() => navigate('/dashboard')}>
                    Go to my box
                  </Button>
                  <Button variant="secondary" onClick={() => setDone(false)}>
                    Flash another
                  </Button>
                </div>
              </Match>

              <Match when={!done()}>
                {viaField()}
                {choice(
                  'Chip',
                  <Select
                    label="Chip"
                    options={[
                      { value: 'device', label: 'Main chip (USB1 + USB2)' },
                      { value: 'host', label: 'Mouse-side chip (USB3)' },
                    ]}
                    value={chip()}
                    disabled={busy()}
                    onChange={(v) => setChip(v as FlashChip)}
                  />,
                )}
                {choice(
                  'Image',
                  <Select
                    label="Image"
                    options={[
                      { value: 'factory', label: 'Factory (full image at 0x0)' },
                      { value: 'app', label: 'Application (app only at 0x10000)' },
                    ]}
                    value={kind()}
                    disabled={busy()}
                    onChange={(v) => setKind(v as FlashKind)}
                  />,
                )}
                {choice(
                  'Source',
                  <Segmented
                    name="Source"
                    options={[
                      { value: 'release', label: 'Latest release' },
                      { value: 'upload', label: 'Upload a file' },
                    ]}
                    value={source()}
                    disabled={busy()}
                    onChange={(v) => setSource(v as 'release' | 'upload')}
                  />,
                )}

                <Show when={source() === 'release'}>
                  <Switch>
                    <Match when={releases.loading}>
                      <p class="mut">Loading releases...</p>
                    </Match>
                    <Match when={releases.error}>
                      <div class="callout callout--warning">Couldn't reach the firmware downloads. Choose Upload a file.</div>
                    </Match>
                    <Match when={asset()}>
                      {(a) => (
                        <p class="mut">
                          <code>{a().name}</code> ({fmtBytes(a().size)}) from {latest()?.tag}
                        </p>
                      )}
                    </Match>
                    <Match when={!asset()}>
                      <div class="callout callout--warning">
                        No <code>{assetName()}</code> in the latest release. Upload one.
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
                    <div class="callout callout--info">A box that never had the factory image needs it first.</div>
                  </Show>
                  <Show when={validationError()}>
                    <div class="callout callout--danger" role="alert">
                      {validationError()}
                    </div>
                  </Show>
                  <Show when={mismatch()}>
                    <div class="callout callout--warning">
                      This file looks like {kind() === 'app' ? 'a factory' : 'an application'} image.
                    </div>
                  </Show>
                </Show>

                <InstallPorts socket={chip() === 'host' ? 'usb3' : 'usb1'} />
                <Show
                  when={blocked()}
                  fallback={
                    <div class="acts">
                      <Button variant="primary" disabled={busy() || !canFlash()} onClick={() => void flash()}>
                        Flash
                      </Button>
                    </div>
                  }
                >
                  {(reason) => (
                    <div class="callout callout--warning" role="alert">
                      {reason()}
                    </div>
                  )}
                </Show>
              </Match>
            </Switch>
          </Show>
        </Panel>
      </Show>
    </Panels>
  );
};

export default ManualFlash;
