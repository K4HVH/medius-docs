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
import { WiringPorts } from './PortDiagram';
import '../../../styles/docs.css';

type Step = 'choose' | 'update' | 'done' | 'sent';
const parseTag = (tag?: string) => {
  const m = tag?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
};
type Ver = { major: number; minor: number; patch: number };
const before = (a: Ver, b: Ver) =>
  a.major !== b.major ? a.major < b.major : a.minor !== b.minor ? a.minor < b.minor : a.patch < b.patch;
// A main chip from 3.4.0 runs the inter-chip link at a rate only a mouse-side chip from 3.4.0 goes looking for.
const LINK_WALK = { major: 3, minor: 4, patch: 0 };

const NO_UPDATE = "There's no update available right now. Try again in a few minutes.";
const HOST_MISSING =
  "The mouse-side chip isn't answering. Unplug the box, plug it back in, then connect. If it still isn't answering, open Set up.";
type Choice = 'both' | 'main' | 'mouse';
type Gate = { da: boolean; ha: boolean; hostMissing: boolean; mainAlone: boolean; hostFirst: boolean };
const LABEL: Record<Choice, string> = { both: 'Update both chips', main: 'Main only', mouse: 'Mouse-side only' };
const allowed = (c: Choice, g: Gate) =>
  c === 'main' ? g.da && !g.mainAlone : g.ha && !g.hostFirst && !g.hostMissing && (c === 'mouse' || g.da);
// Point at the other choice only when it would go through, so two refusals never send someone in a circle.
function refusal(c: Choice, g: Gate): string {
  // Nothing this page offers reaches a mouse-side chip that is not on the link.
  if (g.hostMissing && (c !== 'main' || g.mainAlone)) return HOST_MISSING;
  const offer = (other: Choice, why: string) =>
    allowed(other, g) ? `${why} Press Back and choose ${LABEL[other]}.` : NO_UPDATE;
  if (c !== 'mouse' && !g.da) return offer('mouse', 'This release has nothing for the main chip.');
  if (c !== 'main' && !g.ha) return offer('main', 'This release has nothing for the mouse-side chip.');
  if (c === 'main') return offer('both', 'The mouse-side chip needs this update too.');
  return offer('main', 'Update the main chip first.');
}
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

  // Re-read until the mouse-side chip reports: after a reconnect it can be seconds behind the main chip,
  // and a missing one is read below as a chip that is not answering.
  const [checking, setChecking] = createSignal(false);
  createEffect(() => {
    if (dash.status() !== 'connected') return;
    let live = true;
    onCleanup(() => {
      live = false;
    });
    setChecking(true);
    void (async () => {
      for (let i = 0; i < 12 && live; i++) {
        if ((await dash.readFirmwareInfo())?.host) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (live) setChecking(false);
    })();
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
  const matches = (c: { major: number; minor: number; patch: number } | null | undefined) => {
    const l = lv();
    return !!(c && l && c.major === l.major && c.minor === l.minor && c.patch === l.patch);
  };
  const deviceOnRelease = () => {
    const c = dash.version();
    return matches(c ? { major: c.fwMajor, minor: c.fwMinor, patch: c.fwPatch } : null);
  };
  const hostOnRelease = () => matches(dash.firmwareInfo()?.host);
  // What each chip that was ASKED to change reports now. A chip that reverted completes a
  // handshake, so the handshake is not the evidence: the version it reports is.
  const landed = () => {
    if (which() === 'main') return deviceOnRelease();
    if (which() === 'mouse') return hostOnRelease();
    return deviceOnRelease() && hostOnRelease();
  };
  const upToDate = () => deviceOnRelease();
  const pct = () => {
    const p = dash.flashProgress();
    return p?.phase === 'writing' && p.total ? Math.round(((p.written ?? 0) / p.total) * 100) : undefined;
  };

  // The one place either ending says what happened. Both used to claim it separately, and the
  // sent arm was still signing a reverted box off as finished after the done arm stopped.
  const hostSilent = () => dash.firmwareInfo()?.host == null;
  const Landed = () => (
    <Switch>
      <Match when={hostSilent() && checking()}>{null}</Match>
      <Match when={hostSilent()}>
        <div class="callout callout--warning">{HOST_MISSING}</div>
      </Match>
      <Match when={landed()}>
        <div class="callout callout--info">
          Updated and verified.{' '}
          <Show when={dash.version()}>
            {(v) => <>Your box is on <strong>v{versionString(v())}</strong>.</>}
          </Show>
        </div>
      </Match>
      <Match when={!landed()}>
        <div class="callout callout--warning">
          The box came back, but not on the version that was sent. It reverts anything that will not
          run, so it is still working. Try the update again.
        </div>
      </Match>
    </Switch>
  );

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
      const rel = lv();
      if (!latest() || !rel || (!da && !ha)) {
        setErr(NO_UPDATE);
        return;
      }
      // Read fresh, and give a mouse-side chip that is still coming up a moment to answer: the read taken
      // on connect can predate it.
      let info = await dash.readFirmwareInfo();
      for (let i = 0; i < 4 && !info?.host; i++) {
        await new Promise((r) => setTimeout(r, 500));
        info = await dash.readFirmwareInfo();
      }
      const v = dash.version();
      const deviceOld =
        v !== null && before({ major: v.fwMajor, minor: v.fwMinor, patch: v.fwPatch }, LINK_WALK);
      const releaseOld = before(rel, LINK_WALK);
      const hostOld = !info?.host || before(info.host, LINK_WALK);
      const gate = {
        da: !!da,
        ha: !!ha,
        hostMissing: !info?.host,
        // Onto 3.4.0 the main chip alone leaves an older mouse-side chip unable to find the link.
        mainAlone: !releaseOld && deviceOld && hostOld,
        // Back below it the mouse-side chip is committed first, while the main chip still runs 3.4.0.
        hostFirst: releaseOld && v !== null && !deviceOld,
      };
      if (!allowed(which(), gate)) {
        setErr(refusal(which(), gate));
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
        <div id="updating" data-search-target>
          <Card>
            <CardHeader title="Updating" subtitle="Don't unplug or leave this page" />
            <Progress type="linear" value={pct()} showLabel={pct() !== undefined} />
          </Card>
        </div>
      </Show>

      <Show when={dash.status() !== 'flashing'}>
        <div id="update" data-search-target>
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
                    </p>
                    <Show when={latest()}>
                      <p>
                        Latest is <strong>{latest()?.tag}</strong>
                        {upToDate() ? ', up to date.' : '.'}
                      </p>
                    </Show>
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
                <Show when={dash.status() === 'connected'} fallback={<ConnectPanel />}>
                  <WiringPorts />
                </Show>
                <div style={row}>
                  <Show when={dash.status() === 'connected'}>
                    <Button
                      variant="primary"
                      disabled={busy() || releases.loading}
                      onClick={() => void runUpdate()}
                    >
                      {busy() ? 'Updating...' : 'Update'}
                    </Button>
                  </Show>
                  <Button
                    variant="secondary"
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
                    shared error, which ConnectPanel renders on every page that offers Connect. */}
                <Show
                  when={dash.status() === 'connected'}
                  fallback={<ConnectPanel />}
                >
                  <Landed />
                  <Button variant="primary" onClick={() => navigate('/dashboard')}>
                    Finish
                  </Button>
                </Show>
              </Match>

              <Match when={step() === 'done'}>
                <Show when={dash.status() === 'connected'} fallback={<ConnectPanel />}>
                  <Landed />
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
        </div>
      </Show>
    </>
  );
};

export default Update;
