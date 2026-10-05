import { For, Match, Show, Switch, createEffect, createResource, createSignal, on, onCleanup, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { Checkbox } from '../../../components/inputs/Checkbox';
import { Combobox } from '../../../components/inputs/Combobox';
import { FileUpload } from '../../../components/inputs/FileUpload';
import {
  FLASH_SIZE_BYTES,
  type FlashChip,
  type Semver,
  parseVersion,
  readAppHeader,
  usb2Refusal,
} from '../../../dashboard/flash';
import { downloadAsset, fetchReleases } from '../../../dashboard/firmware';
import { PROTO_VER } from '../../../dashboard/protocol';
import { ConnectPanel } from './ConnectPanel';
import { useDashboard } from './context';
import { checkColumn, note, row, section } from './ui';

type Chips = 'both' | FlashChip;
const NAME: Record<FlashChip, string> = { device: 'Main chip', host: 'Mouse-side chip' };
const ASSET: Record<FlashChip, string> = { device: 'medius_device.bin', host: 'medius_host.bin' };
const ORDER: FlashChip[] = ['device', 'host'];
const fmt = (v: Semver | null) => (v ? `v${v.major}.${v.minor}.${v.patch}` : 'unknown');
const same = (a: Semver | null, b: Semver | null) =>
  !!a && !!b && a.major === b.major && a.minor === b.minor && a.patch === b.patch;
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(0)} KB`);
const muted = { 'margin-top': 'var(--g-spacing-sm)', color: 'var(--g-text-secondary)' } as const;

// Flashes the selected box over USB2: the Update page's update, with any medius image.
export const Usb2Flash = (props: { via: () => JSX.Element; onBusy?: (busy: boolean) => void }) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [releases] = createResource(fetchReleases);
  const [chips, setChips] = createSignal<Chips>('both');
  const [source, setSource] = createSignal<'release' | 'upload'>('release');
  const [files, setFiles] = createSignal<Record<FlashChip, File[]>>({ device: [], host: [] });
  const [images, setImages] = createSignal<Partial<Record<FlashChip, Uint8Array>>>({});
  const [pickErr, setPickErr] = createSignal<Partial<Record<FlashChip, string>>>({});
  const [anyway, setAnyway] = createSignal(false);
  const [busy, setBusyHere] = createSignal(false);
  const setBusy = (b: boolean) => {
    setBusyHere(b);
    props.onBusy?.(b);
  };
  const [err, setErr] = createSignal<string | null>(null);

  // Read again every 2 s, so a lost reply is retried and a mouse-side chip coming or going shows.
  createEffect(() => {
    if (dash.status() !== 'connected') return;
    void dash.readFirmwareInfo();
    const t = setInterval(() => void dash.readFirmwareInfo(), 2000);
    onCleanup(() => clearInterval(t));
  });
  // Until RESP(FIRMWARE) answers, neither chip's version is known and a split can't be judged.
  const known = () => dash.firmwareInfo() !== null;

  // A rejected resource re-throws on every read, render included, and there is no ErrorBoundary:
  // one unguarded read freezes the page.
  const latest = () => {
    try {
      return releases()?.[0] ?? null;
    } catch {
      return null;
    }
  };
  const wanted = (): FlashChip[] => (chips() === 'both' ? ORDER : [chips() as FlashChip]);
  const hostMissing = () => {
    const i = dash.firmwareInfo();
    return i !== null && i.host === null;
  };
  createEffect(() => {
    if (hostMissing() && chips() !== 'device') setChips('device');
  });
  const asset = (c: FlashChip) => latest()?.assets.find((a) => a.name === ASSET[c]) ?? null;
  const current = (c: FlashChip): Semver | null => {
    const i = dash.firmwareInfo();
    const f = c === 'device' ? i?.device : i?.host;
    return f ? { major: f.major, minor: f.minor, patch: f.patch } : null;
  };
  const refusal = (c: FlashChip) => {
    const img = images()[c];
    return img ? usb2Refusal(img, c) : null;
  };
  // Null until there is something that will be sent.
  const incoming = (c: FlashChip): Semver | null => {
    if (source() === 'release') return asset(c) ? parseVersion(latest()?.tag) : null;
    const img = images()[c];
    return img && !refusal(c) ? parseVersion(readAppHeader(img, 'app')?.version) : null;
  };
  const after = (c: FlashChip) => (wanted().includes(c) ? incoming(c) : current(c));
  const split = () =>
    !hostMissing() && !!after('device') && !!after('host') && !same(after('device'), after('host'));
  // A new pair of versions clears Flash anyway.
  createEffect(on(() => `${fmt(after('device'))} ${fmt(after('host'))}`, () => setAnyway(false), { defer: true }));

  const ready = (c: FlashChip) =>
    source() === 'release' ? !!asset(c) && !releases.loading : !!images()[c] && !refusal(c);
  const canFlash = () =>
    dash.status() === 'connected' && known() && !busy() && wanted().every(ready) && (!split() || anyway());

  // Tags each read with its selection, so a slow earlier read can't arm its bytes under a newer file.
  const picks: Record<FlashChip, number> = { device: 0, host: 0 };
  // FileUpload calls onError THEN onChange for one selection, so onFiles must not clear that rejection.
  const rejected: Record<FlashChip, boolean> = { device: false, host: false };
  const onFiles = (c: FlashChip, fs: File[]) => {
    const mine = ++picks[c];
    setFiles((p) => ({ ...p, [c]: fs }));
    setImages((p) => ({ ...p, [c]: undefined }));
    if (!rejected[c]) setPickErr((p) => ({ ...p, [c]: undefined }));
    rejected[c] = false;
    const f = fs[0];
    if (!f) return;
    void f.arrayBuffer().then(
      (b) => {
        if (mine === picks[c]) setImages((p) => ({ ...p, [c]: new Uint8Array(b) }));
      },
      () => {
        if (mine === picks[c]) setPickErr((p) => ({ ...p, [c]: 'That file could not be read. Pick it again.' }));
      },
    );
  };

  const flash = async () => {
    setErr(null);
    setBusy(true);
    try {
      const sent: { device?: Uint8Array; host?: Uint8Array } = {};
      for (const c of wanted()) {
        const a = asset(c);
        const img = source() === 'upload' ? images()[c] : a ? await downloadAsset(a) : undefined;
        if (!img) return setErr('No image selected.');
        // A release is read like a file, so nothing reaches the box unchecked.
        const why = usb2Refusal(img, c);
        if (why) return setErr(why);
        sent[c] = img;
      }
      await dash.updateOverControl(sent, 'advanced');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const run = () => {
    const r = dash.update();
    return r?.page === 'advanced' ? r : null;
  };
  const sentChips = () => ORDER.filter((c) => run()?.[c]);
  const reverted = () => sentChips().filter((c) => run()?.landed?.[c] === false);
  const landed = () => sentChips().filter((c) => run()?.landed?.[c] !== false);
  // "The main chip runs v3.4.4 and the mouse-side chip v3.4.4."
  const runs = (cs: FlashChip[]) =>
    cs.length === 2
      ? `The main chip runs ${fmt(current('device'))} and the mouse-side chip ${fmt(current('host'))}.`
      : `The ${NAME[cs[0]].toLowerCase()} runs ${fmt(current(cs[0]))}.`;
  const otherWire = () => {
    const v = dash.version();
    return v && v.protoVer !== PROTO_VER ? v.protoVer : null;
  };

  const Outcome = (p: { lead: string }) => (
    <>
      <For each={reverted()}>
        {(c) => (
          <div class="callout callout--warning">
            The new image didn't run, so the {NAME[c].toLowerCase()} went back to the firmware it had. The box
            works as before.
          </div>
        )}
      </For>
      <Show when={landed().length}>
        <div class="callout callout--info">
          {reverted().length ? '' : p.lead}
          {runs(landed())}
        </div>
      </Show>
      <Show when={otherWire()}>
        {(proto) => (
          <div class="callout callout--info">
            This box speaks protocol {proto()} and this page protocol {PROTO_VER}, so the page can flash it but
            not control it.
          </div>
        )}
      </Show>
      <div style={row}>
        <Button variant="primary" onClick={() => navigate('/dashboard')}>
          Go to my box
        </Button>
        <Button variant="secondary" onClick={() => dash.clearUpdate()}>
          Flash another
        </Button>
      </div>
    </>
  );

  return (
    <Switch>
      <Match when={run()?.outcome === 'verified'}>
        <Outcome lead="Flashed and verified. " />
      </Match>

      <Match when={run()?.outcome === 'sent'}>
        <Show
          when={dash.status() === 'connected'}
          fallback={
            <>
              {props.via()}
              <div style={section}>
                <ConnectPanel />
              </div>
            </>
          }
        >
          <Outcome lead="The box is back. " />
        </Show>
      </Match>

      <Match when={true}>
        {props.via()}
        <Show
          when={dash.status() === 'connected'}
          fallback={
            <div style={section}>
              <ConnectPanel />
            </div>
          }
        >
          <div class="api-response-label" style={section}>CHIP</div>
          <Combobox
            options={[
              { value: 'both', label: 'Both chips', disabled: hostMissing() },
              { value: 'device', label: 'Main chip' },
              { value: 'host', label: 'Mouse-side chip', disabled: hostMissing() },
            ]}
            value={chips()}
            disabled={busy()}
            onChange={(v) => setChips(v as Chips)}
          />
          <Show when={hostMissing()}>
            <p style={muted}>The mouse-side chip isn't answering. Flash it over USB3.</p>
          </Show>

          <div class="api-response-label" style={section}>SOURCE</div>
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
                <div class="callout callout--warning" style={note}>
                  Couldn't reach the firmware downloads. Choose Upload a file.
                </div>
              </Match>
              <Match when={true}>
                <For each={wanted()}>
                  {(c) => (
                    <Show
                      when={asset(c)}
                      fallback={
                        <div class="callout callout--warning" style={note}>
                          No <code>{ASSET[c]}</code> in the latest release. Upload one.
                        </div>
                      }
                    >
                      {(a) => (
                        <p style={muted}>
                          <code>{a().name}</code> ({fmtBytes(a().size)}) from {latest()?.tag}
                        </p>
                      )}
                    </Show>
                  )}
                </For>
              </Match>
            </Switch>
          </Show>

          <Show when={source() === 'upload'}>
            <For each={wanted()}>
              {(c) => (
                <>
                  <div style={section}>
                    <FileUpload
                      accept=".bin"
                      maxSize={FLASH_SIZE_BYTES}
                      value={files()[c]}
                      disabled={busy()}
                      onChange={(fs) => onFiles(c, fs)}
                      onError={(m: string) => {
                        rejected[c] = true;
                        setPickErr((p) => ({ ...p, [c]: m }));
                      }}
                      label={`${NAME[c]} .bin`}
                    />
                  </div>
                  <Show when={pickErr()[c] ?? refusal(c)}>
                    {(m) => (
                      <div class="callout callout--danger" role="alert" style={note}>
                        {m()}
                      </div>
                    )}
                  </Show>
                </>
              )}
            </For>
          </Show>

          <Show when={split()}>
            <div class="callout callout--warning" style={section}>
              The main chip would run {fmt(after('device'))} and the mouse-side chip {fmt(after('host'))}. If they
              can't talk to each other, the mouse stops working and the mouse-side chip can only be flashed over
              USB3.
            </div>
            <div style={checkColumn}>
              <Checkbox checked={anyway()} disabled={busy()} onChange={setAnyway} label="Flash anyway" />
            </div>
          </Show>

          <Show when={err() ?? (run()?.outcome === 'failed' ? (dash.error() ?? "That flash didn't finish.") : null)}>
            {(m) => (
              <div class="callout callout--danger" role="alert" style={section}>
                {m()}
              </div>
            )}
          </Show>
          <Show when={!known()}>
            <p style={muted}>Reading the box's firmware...</p>
          </Show>
          <div style={{ ...section, ...row }}>
            <Button variant="primary" disabled={!canFlash()} onClick={() => void flash()}>
              Flash
            </Button>
          </div>
        </Show>
      </Match>
    </Switch>
  );
};
