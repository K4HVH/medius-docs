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
import { fetchStockCatalog, fetchStockFile } from '../../../dashboard/flash/stock';
import { requestRomPort } from '../../../dashboard/serial';
import { useNavigate } from '@solidjs/router';
import { BoxScope, useBoxes, useNativeFlash } from './context';
import { Usb2Flash } from './AdvancedUsb2';
import { BAD_BROWSER, BAD_CONTEXT } from './ConnectPanel';
import { InstallPorts, WiringPorts } from './PortDiagram';
import { Panel, Panels } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';
import { Select } from '../../shell/Select';

// Over USB2 both chips may be written in turn; each count names its chip.
const CHIP_CUE: Record<string, string> = { host: 'Flashing the mouse-side chip', device: 'Flashing the main chip' };

const CHIP_NAME: Record<FlashChip, string> = { device: 'main chip', host: 'mouse-side chip' };
const OTHER: Record<FlashChip, FlashChip> = { device: 'host', host: 'device' };

const WAIT: Partial<Record<FlashPhase, string>> = {
  rebooting: 'Rebooting',
  connecting: 'Connecting',
  erasing: 'Erasing',
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
  const [source, setSource] = createSignal<'release' | 'upload' | 'stock'>('release');
  // MAKCU's catalog, read once MAKCU stock is picked; the chips flashed with it on this visit.
  const [stock, { refetch: readStock }] = createResource(() => source() === 'stock' || null, fetchStockCatalog);
  const stockBuild = () => {
    try {
      return stock() ?? null;
    } catch {
      return null;
    }
  };
  const [stocked, setStocked] = createSignal<ReadonlySet<FlashChip>>(new Set());
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
          { value: 'usb2', label: 'Control port, USB2', note: dash().name() || undefined },
          { value: 'rom', label: 'ROM download, USB1 or USB3' },
        ]}
        value={via()}
        disabled={busy() || usb2Busy()}
        onChange={(v) => setVia(v as 'usb2' | 'rom')}
      />
    </div>
  );

  const canFlash = () =>
    source() === 'stock'
      ? !!stockBuild()
      : source() === 'upload'
        ? !!image() && validationError() === null
        : !!asset() && !releases.loading;

  // `anyway`: the chip the owner said to flash though MAKCU's bootloader on it names the other.
  let anyway: FlashChip | null = null;
  const flash = async () => {
    setErr(null);
    setFileErr(null);
    native.clear();
    // Captured before the awaits so the image and its offset come from one reading.
    const target = { chip: chip(), kind: kind(), source: source() };
    // The owner's say-so is for this attempt alone.
    const told = anyway === target.chip;
    anyway = null;
    setBusy(true);
    try {
      // ROM download over each chip's native USB: device chip on USB1, host chip on USB3, entered by
      // holding the button beside that socket while plugging in.
      const port = await requestRomPort();
      const cat = target.source === 'stock' ? stockBuild() : null;
      if (cat) {
        let files: [Uint8Array, Uint8Array];
        try {
          files = await Promise.all([fetchStockFile(cat.files.package), fetchStockFile(cat.files[target.chip === 'device' ? 'usb1' : 'usb3'])]);
        } catch (e) {
          // MAKCU's official build may have changed since the catalog was read: show the one in force.
          void readStock();
          throw e;
        }
        const [pkg, boot] = files;
        const knownMain = (mac: string) => boxes.entries().some((e) => e.key === mac);
        if (await native.flashStock(port, target.chip, pkg, boot, 'advanced', { anyway: told, knownMain })) {
          setStocked((s) => new Set([...s, target.chip]));
          setDone(true);
          return;
        }
        // Past the erase, the chip may hold nothing that boots: it can't be bricked, and either firmware puts it right.
        const erased = ['erasing', 'writing'].includes(native.progress()?.phase ?? '');
        return setErr(
          `${native.error() ?? 'That did not finish.'}${erased ? ` The ${CHIP_NAME[target.chip]} may be erased. Flash it again, or put Medius back with Set up.` : ''}`,
        );
      }
      const a = latest()?.assets.find((x) => x.name === nameFor(target.chip, target.kind)) ?? null;
      const img = target.source === 'upload' ? image() : a ? await downloadAsset(a) : null;
      if (!img) return setErr('No image selected.');
      const ok = await native.flash(port, img, target.kind, {
        page: 'advanced',
        chip: target.chip,
        source: target.source === 'upload' ? 'file' : 'release',
      });
      if (ok) {
        // That chip runs Medius again.
        setStocked((s) => new Set([...s].filter((c) => c !== target.chip)));
        setDone(true);
      }
      else setErr(native.error() ?? 'That did not finish.');
    } catch (e) {
      setErr(isUserCancel(e) ? 'No port was picked. Press Flash, then pick the box in the list.' : (e as Error).message);
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
          <p class="cue">{CHIP_CUE[progress()?.phase === 'writing' ? (progress()?.chip ?? '') : ''] ?? 'Flashing'}</p>
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
            <Switch>
              <Match when={done() && source() === 'stock'}>
                <Show
                  when={stocked().size === 2}
                  fallback={
                    <>
                      <p class="state">
                        <span class="dot ok" />
                        The {CHIP_NAME[chip()]} runs MAKCU's firmware. Now the {CHIP_NAME[OTHER[chip()]]}: the box passes nothing until both
                        match.
                      </p>
                      <div class="acts">
                        <Button
                          variant="primary"
                          onClick={() => {
                            setChip(OTHER[chip()]);
                            setDone(false);
                          }}
                        >
                          Flash the {CHIP_NAME[OTHER[chip()]]}
                        </Button>
                      </div>
                    </>
                  }
                >
                  <p class="state">
                    <span class="dot ok" />
                    Both chips run MAKCU's firmware. Unplug the box for 10 s, then plug in USB1 and USB2, without the button. This dashboard
                    can't talk to MAKCU's firmware; Set up puts Medius back.
                  </p>
                  <div class="acts">
                    <Button variant="primary" onClick={() => navigate('/dashboard/setup')}>
                      Set up
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setStocked(new Set<FlashChip>());
                        setDone(false);
                      }}
                    >
                      Flash another
                    </Button>
                  </div>
                </Show>
              </Match>

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
                <Show when={source() !== 'stock'}>
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
                </Show>
                {choice(
                  'Source',
                  <Segmented
                    name="Source"
                    options={[
                      { value: 'release', label: 'Latest release' },
                      { value: 'upload', label: 'Upload a file' },
                      { value: 'stock', label: 'MAKCU stock' },
                    ]}
                    value={source()}
                    disabled={busy()}
                    onChange={(v) => setSource(v as 'release' | 'upload' | 'stock')}
                  />,
                )}

                <Show when={source() === 'stock'}>
                  <Switch>
                    <Match when={stock.loading}>
                      <p class="mut" data-search-skip>Reading MAKCU's catalog...</p>
                    </Match>
                    <Match when={stock.error as Error | undefined}>
                      {(e) => <div class="callout callout--warning">{e().message}</div>}
                    </Match>
                    <Match when={stockBuild()}>
                      {(c) => (
                        <>
                          <p class="mut">
                            MAKCU {c().build.id}, the official build, with the {CHIP_NAME[chip()]}'s bootloader, from MAKCU's signed catalog.
                          </p>
                          <div class="callout callout--info">
                            This erases the whole chip, settings included. Once both chips have it, the box runs MAKCU's firmware, which this
                            dashboard can't talk to. Set up puts Medius back.
                          </div>
                        </>
                      )}
                    </Match>
                  </Switch>
                </Show>

                <Show when={source() === 'release'}>
                  <Switch>
                    <Match when={releases.loading}>
                      <p class="mut" data-search-skip>Loading releases...</p>
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
                  <Show when={fileErr()}>
                    {(msg) => (
                      <div class="callout callout--danger" role="alert">
                        {msg()}
                      </div>
                    )}
                  </Show>
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
                    <>
                      <div class="acts">
                        <Button variant="primary" disabled={busy() || !canFlash()} onClick={() => void flash()}>
                          Flash
                        </Button>
                      </div>
                      <Show when={err()}>
                        {(msg) => (
                          <div class="callout callout--danger" role="alert">
                            {msg()}
                          </div>
                        )}
                      </Show>
                      <Show when={source() === 'stock' && native.wrongChip()?.sure === false}>
                        <p>An earlier stock flash of the wrong chip leaves that mark. If this is the {CHIP_NAME[chip()]}, flash it as one.</p>
                        <div class="acts">
                          <Button
                            variant="secondary"
                            disabled={busy()}
                            onClick={() => {
                              anyway = chip();
                              void flash();
                            }}
                          >
                            Flash it as the {CHIP_NAME[chip()]}
                          </Button>
                        </div>
                      </Show>
                    </>
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
