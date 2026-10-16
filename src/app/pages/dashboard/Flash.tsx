import { Match, Show, Switch, createEffect, createResource, createSignal, untrack, type JSX } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { FileUpload } from '../../../components/inputs/FileUpload';
import {
  CHIP_NAME,
  FLASH_SIZE_BYTES,
  type FlashChip,
  type FlashKind,
  imageVersion,
  looksLikeWrongKind,
  romRefusal,
  validateImage,
} from '../../../dashboard/flash';
import { downloadAsset } from '../../../dashboard/firmware';
import { fetchStockCatalog, fetchStockFile } from '../../../dashboard/flash/stock';
import { type ConnectVerdict, requestRomPort } from '../../../dashboard/serial';
import { useNavigate } from '@solidjs/router';
import { BoxScope, type Snapshot, useBoxes, useNativeFlash } from './context';
import { Usb2Flash } from './FlashUsb2';
import { BAD_BROWSER, BAD_CONTEXT, notConnected } from './ConnectPanel';
import { flashPercent, flashWait } from './flashText';
import { InstallPorts, WiringPorts } from './PortDiagram';
import { createReleaseChoice } from './releaseChoice';
import { PageHeader } from '../../shell/PageHeader';
import { Panel, Panels } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';

// Over USB2 both chips may be written in turn; each count names its chip.
const CHIP_CUE: Record<string, string> = { host: 'Flashing the mouse-side chip', device: 'Flashing the main chip' };

const OTHER: Record<FlashChip, FlashChip> = { device: 'host', host: 'device' };

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);

// Any image, by hand: over USB2 to the selected box when it runs Medius, or in ROM download to either chip over
// USB1 or USB3 (this works on any box, even a dead one).
const ManualFlash = () => {
  const native = useNativeFlash();
  const boxes = useBoxes();
  // The selected box, read through the registry. Inside BoxScope a box coming or going would remount the
  // page and lose a half-set-up ROM flash, and unplugging USB2 for the ROM flash does exactly that.
  const dash = () => boxes.scope();
  // USB2 reaches a box running Medius. It is the route while the box is connected or a USB2 flash is under way,
  // until Via says otherwise. Anything else is flashed with its button held.
  const [picked, setPicked] = createSignal<'usb2' | 'rom' | null>(null);
  const usb2 = () => boxes.selectedKind() === 'medius';
  const live = () => ['connected', 'connecting', 'flashing'].includes(dash().status()) || dash().update()?.page === 'advanced';
  // A box not running Medius keeps the button-held route when the list falls back to another box (which
  // unplugging its USB2 to hold the button causes).
  createEffect(() => {
    if (boxes.selectedKind() === 'other' && untrack(picked) === null) setPicked('rom');
  });
  const route = () => (usb2() && !romUnderWay() ? (picked() ?? (live() ? 'usb2' : 'rom')) : 'rom');
  const [usb2Busy, setUsb2Busy] = createSignal(false);
  const navigate = useNavigate();
  const [chip, setChip] = createSignal<FlashChip>('device');
  const [kind, setKind] = createSignal<FlashKind>('factory');
  const [source, setSource] = createSignal<'release' | 'older' | 'upload' | 'stock'>('release');
  const fromRelease = () => source() === 'release' || source() === 'older';
  const { releases, release, earlier, where, VersionField } = createReleaseChoice(() => source() === 'older');
  // MAKCU's catalog, read once MAKCU stock is picked.
  const [stock, { refetch: readStock }] = createResource(() => source() === 'stock' || null, fetchStockCatalog);
  const stockBuild = () => {
    try {
      return stock() ?? null;
    } catch {
      return null;
    }
  };
  // What each chip runs after this visit's flash: 'stock', a Medius version ('v3.4.5'), or 'other' firmware.
  const [flashed, setFlashed] = createSignal<ReadonlyMap<FlashChip, string>>(new Map());
  const both = () => flashed().size === 2 && flashed().get('device') === flashed().get('host');
  const romUnderWay = () => busy() || done() || flashed().size > 0;
  const [files, setFiles] = createSignal<File[]>([]);
  const [image, setImage] = createSignal<Uint8Array | null>(null);
  const [done, setDone] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  // Separate from `err`, so a chip switch clears the flash failure but keeps the file refusal.
  const [fileErr, setFileErr] = createSignal<string | null>(null);
  // FileUpload calls onError, then onChange, for one selection (a mixed drop included), so onFiles
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

  const nameFor = (c: FlashChip, k: FlashKind) => `medius_${c}${k === 'factory' ? '-factory' : ''}.bin`;
  const assetName = () => nameFor(chip(), kind());
  const asset = () => release()?.assets.find((a) => a.name === assetName()) ?? null;
  const validationError = () => {
    const img = image();
    return img ? (validateImage(img, kind()) ?? romRefusal(img, chip())) : null;
  };
  const mismatch = () => {
    const img = image();
    return img ? looksLikeWrongKind(img, kind()) : false;
  };
  const progress = () => (native.running() ? native.progress() : dash().updateProgress());
  const pct = () => flashPercent(progress());
  const wait = () => flashWait(progress());
  // A ROM flash writes the chip picked; an update over USB2 names each chip as it writes it.
  const cue = () => {
    if (native.running()) return `Flashing the ${CHIP_NAME[chip()]}`;
    const p = progress();
    return CHIP_CUE[p?.phase === 'writing' ? (p.chip ?? '') : ''] ?? 'Flashing';
  };
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
        // `pick` doesn't move with Source, so a slow read can land after Source has left File, with no
        // picker left to point at.
        if (mine !== pick || source() !== 'upload') return;
        setImage(null);
        setFileErr('That file could not be read. Pick it again.');
      });
  };

  // Via is drawn once, above both forms, so switching route keeps the field and its focus. It shows until the
  // chosen flash is done: the ROM form's done screens, or a USB2 update that verified or came back connected.
  const usb2Run = () => {
    const r = dash().update();
    return r?.page === 'advanced' ? r : null;
  };
  const usb2Done = () => usb2Run()?.outcome === 'verified' || (usb2Run()?.outcome === 'sent' && dash().status() === 'connected');
  const viaField = () => (
    <Show when={usb2() && (route() === 'rom' ? !done() : !usb2Done())}>
      <div class="labelled">
        <span class="field-l">Via</span>
        <Segmented
          name="Via"
          options={[
            { value: 'usb2', label: 'Control port' },
            { value: 'rom', label: 'ROM download' },
          ]}
          value={route()}
          disabled={busy() || usb2Busy()}
          onChange={(v) => setPicked(v as 'usb2' | 'rom')}
        />
      </div>
      {/* The box's name stays out of the search index. */}
      <Show when={route() === 'usb2'} fallback={<p class="mut">Over USB1 or USB3, a chip at a time with its button held.</p>}>
        <p class="mut">
          Over USB2<span data-search-skip>{dash().name() ? ` to ${dash().name()}` : ''}</span>, with no button to hold.
        </p>
      </Show>
    </Show>
  );


  const canFlash = () =>
    source() === 'stock'
      ? !!stockBuild()
      : source() === 'upload'
        ? !!image() && validationError() === null
        : !!asset() && !releases.loading;

  // `anyway`: the chip the owner said to flash even though MAKCU's bootloader on it names the other chip.
  let anyway: FlashChip | null = null;
  // Taken at the first flash. The flashed box is one that starts answering after it, unless it is the box
  // selected at the time.
  let at: { before: Snapshot; key: string | null } | null = null;
  const flash = async () => {
    setErr(null);
    setFileErr(null);
    native.clear();
    at ??= { before: boxes.snapshot(), key: boxes.selected()?.key ?? null };
    // Captured before the awaits so the image and its offset come from one reading.
    const target = { chip: chip(), kind: kind(), source: source(), release: release() };
    let took = 'stock';
    // The owner's say-so is for this attempt alone.
    const told = anyway === target.chip;
    anyway = null;
    setBusy(true);
    try {
      // ROM download over each chip's USB port: device chip on USB1, host chip on USB3, entered by
      // holding the button beside that socket while plugging in.
      const port = await requestRomPort();
      const cat = target.source === 'stock' ? stockBuild() : null;
      if (cat) {
        let files: [Uint8Array, Uint8Array];
        try {
          files = await Promise.all([fetchStockFile(cat.files.package.name), fetchStockFile(cat.files[target.chip === 'device' ? 'usb1' : 'usb3'].name)]);
        } catch (e) {
          // MAKCU's official build may have changed since the catalog was read: show the one in force.
          void readStock();
          throw e;
        }
        const [pkg, boot] = files;
        const knownMain = (mac: string) => boxes.entries().some((e) => e.key === mac);
        if (!(await native.flashStock(port, target.chip, pkg, boot, 'advanced', { anyway: told, knownMain }))) {
          return setErr(native.error() ?? 'That did not finish.');
        }
      } else {
        const a = target.release?.assets.find((x) => x.name === nameFor(target.chip, target.kind)) ?? null;
        const img = target.source === 'upload' ? image() : a ? await downloadAsset(a) : null;
        if (!img) return setErr('No image selected.');
        const version = target.source === 'upload' ? imageVersion(img, target.kind) : target.release?.tag.replace(/^v/, '');
        took = version ? `v${version}` : 'other';
        const ok = await native.flash(port, img, target.kind, {
          page: 'advanced',
          chip: target.chip,
          source: target.source === 'upload' ? 'file' : 'release',
        });
        if (!ok) return setErr(native.error() ?? 'That did not finish.');
      }
      setFlashed((m) => new Map(m).set(target.chip, took));
      setDone(true);
    } catch (e) {
      setErr(isUserCancel(e) ? 'No port was picked. Press Flash, then pick the box in the list.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The other chip, from the same source; a picked file was the first chip's, so it is cleared.
  const flashOther = () => {
    setChip(OTHER[chip()]);
    setFiles([]);
    setImage(null);
    setDone(false);
  };
  // A new pass starts as a box does, at the main chip.
  const flashAnother = () => {
    at = null;
    setFound(null);
    setFlashed(new Map());
    setChip('device');
    setFiles([]);
    setImage(null);
    setDone(false);
  };

  // Straight to the box selected at the first flash if it runs Medius. Otherwise the box just flashed is
  // connected first, as the one that answers now.
  const [finding, setFinding] = createSignal(false);
  const [found, setFound] = createSignal<ConnectVerdict | null>(null);
  const toBox = async () => {
    if (boxes.selectedKind() === 'medius' && boxes.selected()?.key === at?.key) return navigate('/dashboard');
    setFound(null);
    setFinding(true);
    try {
      const v = await boxes.connectNew(at?.before ?? boxes.snapshot());
      if (v) setFound(v);
      else navigate('/dashboard');
    } finally {
      setFinding(false);
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
          <p class="cue">{cue()}</p>
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
          {viaField()}
          <Show
            when={route() === 'rom'}
            fallback={
              <BoxScope>
                <Usb2Flash onBusy={setUsb2Busy} />
              </BoxScope>
            }
          >
            <Switch>
              {/* The two chips run one version: one done, the other is next, from the same source. */}
              <Match when={done() && !both()}>
                <p class="state">
                  <span class="dot ok" />
                  {CHIP_NAME[chip()][0].toUpperCase() + CHIP_NAME[chip()].slice(1)} flashed and verified.
                </p>
                <div class="acts">
                  <Button variant="primary" onClick={flashOther}>
                    Flash the {CHIP_NAME[OTHER[chip()]]}
                  </Button>
                  <Button variant="secondary" onClick={flashAnother}>
                    Flash another
                  </Button>
                </div>
              </Match>

              {/* MAKCU stock, or other firmware: no Medius box to go to. */}
              <Match when={done() && !flashed().get(chip())?.startsWith('v')}>
                <p class="state">
                  <span class="dot ok" />
                  Flashed and verified.
                </p>
                <WiringPorts />
                <div class="acts">
                  <Button variant="secondary" onClick={flashAnother}>
                    Flash another
                  </Button>
                </div>
              </Match>

              <Match when={done()}>
                <p class="state">
                  <span class="dot ok" />
                  Flashed and verified.
                </p>
                <WiringPorts />
                <div class="acts">
                  <Button variant="primary" loading={finding()} disabled={finding()} onClick={() => void toBox()}>
                    {finding() ? 'Connecting...' : 'Go to my box'}
                  </Button>
                  <Button variant="secondary" disabled={finding()} onClick={flashAnother}>
                    Flash another
                  </Button>
                </div>
                <Show when={found()}>
                  {(v) => (
                    <div class="callout callout--danger" role="alert">
                      {notConnected(v())}
                    </div>
                  )}
                </Show>
              </Match>

              <Match when={!done()}>
                {choice(
                  'Chip',
                  <Segmented
                    name="Chip"
                    options={[
                      { value: 'device', label: 'Main chip' },
                      { value: 'host', label: 'Mouse-side chip' },
                    ]}
                    value={chip()}
                    disabled={busy()}
                    onChange={(v) => setChip(v as FlashChip)}
                  />,
                )}
                {choice(
                  'Source',
                  <Segmented
                    name="Source"
                    options={[
                      { value: 'release', label: 'Latest release' },
                      { value: 'older', label: 'Older release', disabled: !earlier().length },
                      { value: 'upload', label: 'File' },
                      { value: 'stock', label: 'MAKCU stock' },
                    ]}
                    value={source()}
                    disabled={busy()}
                    onChange={(v) => setSource(v as 'release' | 'older' | 'upload' | 'stock')}
                  />,
                )}
                <Show when={source() === 'older'}>
                  <VersionField disabled={busy()} />
                </Show>
                {/* Below Source, so picking MAKCU stock (no image to choose) removes nothing above Source. */}
                <Show when={source() !== 'stock'}>
                  {choice(
                    'Image',
                    <Segmented
                      name="Image"
                      options={[
                        { value: 'factory', label: 'Factory' },
                        { value: 'app', label: 'Application' },
                      ]}
                      value={kind()}
                      disabled={busy()}
                      onChange={(v) => setKind(v as FlashKind)}
                    />,
                  )}
                  <p class="mut">{kind() === 'app' ? 'The app alone, written at 0x10000.' : 'The full image, written at 0x0.'}</p>
                </Show>

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
                        <p class="mut">
                          <code>{c().files.package.name}</code> ({fmtBytes(c().files.package.size)}) from {c().id}
                        </p>
                      )}
                    </Match>
                  </Switch>
                </Show>

                <Show when={fromRelease()}>
                  <Switch>
                    <Match when={releases.loading}>
                      <p class="mut" data-search-skip>Loading releases...</p>
                    </Match>
                    <Match when={releases.error}>
                      <div class="callout callout--warning">Couldn't reach the firmware downloads. Choose File.</div>
                    </Match>
                    <Match when={asset()}>
                      {(a) => (
                        <p class="mut">
                          <code>{a().name}</code> ({fmtBytes(a().size)}) from {release()?.tag}
                        </p>
                      )}
                    </Match>
                    <Match when={!asset()}>
                      <div class="callout callout--warning">
                        No <code>{assetName()}</code> in {where()}. Upload one.
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
                        <div class="acts">
                          <Button
                            variant="secondary"
                            disabled={busy()}
                            onClick={() => {
                              anyway = chip();
                              void flash();
                            }}
                          >
                            Flash anyway
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

// The Flash page: any image to either chip, by hand.
const Flash = () => (
  <>
    <PageHeader />
    <ManualFlash />
  </>
);

export default Flash;
