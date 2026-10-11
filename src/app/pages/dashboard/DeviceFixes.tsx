import { type Accessor, Match, type Setter, Show, Switch, createMemo, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { anyPending } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { boxId } from './session';
import { Panel } from '../../shell/Panel';
import { type FixIO, type Offer, type Outcome, type Signals, allowImperfect, logitechFix, offerFor, offerKey } from './fixes';

const KEPT = 'medius.fixes.kept';

// Offers put away with "Keep as it is", by device and fix, and Logitech mice the fix showed can't go
// faster. Storage that throws (a private window) keeps them for this page alone; a device the box reads no
// ids for is kept for this page alone too, since every such device reads the same.
const remembered = new Set<string>();
const kept = (): Set<string> => {
  try {
    for (const k of JSON.parse(localStorage.getItem(KEPT) ?? '[]') as string[]) remembered.add(k);
  } catch {
    // remembered alone
  }
  return remembered;
};
const keep = (k: string) => {
  remembered.add(k);
  if (k.startsWith('unread/')) return;
  try {
    localStorage.setItem(KEPT, JSON.stringify([...kept()].filter((x) => !x.startsWith('unread/'))));
  } catch {
    // remembered alone
  }
};
const offerSlot = (s: Signals, o: Offer) => `${offerKey(s)}/${o.kind}${o.kind === 'imperfect' && o.update ? '-update' : ''}`;
const tried = (s: Signals) => `${offerKey(s)}/logitech-tried`;

// A fix under way or just done, kept per box so the panel going away (another page, the box answering
// late) neither loses it nor lets a second one start beside it.
interface Run {
  shown: Accessor<Offer | null>;
  setShown: Setter<Offer | null>;
  running: Accessor<boolean>;
  setRunning: Setter<boolean>;
  result: Accessor<Outcome | null>;
  setResult: Setter<Outcome | null>;
}
const runs = new Map<string, Run>();
const runFor = (box: string): Run => {
  let r = runs.get(box);
  if (!r) {
    const [shown, setShown] = createSignal<Offer | null>(null);
    const [running, setRunning] = createSignal(false);
    const [result, setResult] = createSignal<Outcome | null>(null);
    r = { shown, setShown, running, setRunning, result, setResult };
    runs.set(box, r);
  }
  return r;
};

const title = (o: Offer): string =>
  o.kind === 'imperfect' ? 'Imperfect clone needed' : o.kind === 'logitech' ? `Logitech mouse at ${o.hz} Hz` : 'Razer mouse at 125 Hz';

const said = (o: Outcome): string =>
  ({
    fast: 'Done. The mouse runs at 1000 Hz through the box.',
    capped: `Done. This mouse's USB speed caps it at ${'hz' in o ? o.hz : 0} Hz through the box.`,
    native: `This mouse can't go faster through the box, so it stays at ${'hz' in o ? o.hz : 0} Hz.`,
    replug: `Saved, but the box reports ${'hz' in o ? o.hz : 0} Hz. Unplug the mouse from the box and plug it back in.`,
    gone: "Saved, but the mouse hasn't come back. Unplug it from the box and plug it back in.",
    allowed: 'Done. Imperfect clone is on and the device is cloned.',
    checking: 'The box is still checking its new firmware. Try again in a minute.',
    refused: "The box didn't take the setting. Try again.",
    silent: "The box isn't answering.",
    changed: 'A different device is plugged in now, so nothing was changed.',
  })[o.kind];

const GOOD: ReadonlySet<Outcome['kind']> = new Set(['fast', 'capped', 'native', 'allowed']);

// The Overview's offer of a setting the connected device needs, made from what the box reports.
export default function DeviceFixes() {
  const dash = useDashboard();
  const navigate = useNavigate();
  const imperfect = dash.poll('imperfect');
  const emit = dash.poll('emit');
  const device = dash.poll('deviceInfo');
  const rate = dash.poll('rate');
  const signals = (): Signals => ({ version: dash.version(), device: device(), imperfect: imperfect(), emit: emit(), rate: rate() });
  const run = () => runFor(boxId(dash.version()) ?? 'none');
  const [put, setPut] = createSignal(0);
  const offer = createMemo(() => {
    put();
    const s = signals();
    const o = offerFor(s);
    if (!o || kept().has(offerSlot(s, o))) return null;
    return o.kind === 'logitech' && kept().has(tried(s)) ? null : o;
  });
  const current = () => (run().running() || run().result() ? run().shown() : offer());
  let status: HTMLParagraphElement | undefined;

  const io: FixIO = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    confirmed: async () => {
      const l = dash.link();
      return l ? !anyPending(await l.queryFirmware(1000)) : null;
    },
    emit: async () => (await dash.link()?.queryEmitPace(1000)) ?? null,
    imperfect: async () => (await dash.link()?.queryImperfect(1000)) ?? null,
    setEmit: async (mode, rateHz, forceHz) => {
      await dash.link()?.setEmitPace(mode, rateHz, forceHz);
    },
    allowImperfect: async () => {
      await dash.link()?.allowImperfectClones(true);
    },
  };

  // What the box says now, read fresh: the polls run seconds behind, and the device may have changed.
  const fresh = async (): Promise<Signals> => {
    const l = dash.link();
    const read = <T,>(p: Promise<T> | undefined) => (p ?? Promise.resolve(null)).catch(() => null);
    const [d, i, e] = await Promise.all([read(l?.queryDeviceInfo(1000)), read(l?.queryImperfect(1000)), read(l?.queryEmitPace(1000))]);
    return { ...signals(), device: d, imperfect: i, emit: e };
  };

  const apply = (o: Offer) => {
    const r = run();
    if (r.running()) return;
    const at = signals();
    r.setShown(o);
    r.setResult(null);
    r.setRunning(true);
    status?.focus();
    void (async (): Promise<Outcome> => {
      const now = await fresh();
      if (!now.imperfect && !now.emit) return { kind: 'silent' };
      const still = offerFor(now);
      if (!still || still.kind !== o.kind || offerKey(now) !== offerKey(at)) return { kind: 'changed' };
      return o.kind === 'logitech' ? logitechFix(io) : allowImperfect(io);
    })()
      .catch((): Outcome => ({ kind: 'silent' }))
      .then((out) => {
        if (out.kind === 'native') {
          keep(tried(at));
          setPut((n) => n + 1);
        }
        r.setResult(out);
        r.setRunning(false);
        dash.refreshPoll('imperfect');
        dash.refreshPoll('emit');
      });
  };
  // The panel goes with the offer: focus moves to the Overview tab, which stays.
  const leave = () => queueMicrotask(() => document.querySelector<HTMLElement>('[data-tab="overview"]')?.focus());
  const keepAsItIs = (o: Offer) => {
    keep(offerSlot(signals(), o));
    setPut((n) => n + 1);
    leave();
  };
  const close = () => {
    run().setResult(null);
    run().setShown(null);
    leave();
  };

  return (
    <Show when={current()}>
      {(o) => (
        <Panel id="device-fix" title={title(o())} wide transient>
          <Switch>
            <Match when={run().result()}>
              {(r) => (
                <div class="acts">
                  <Button variant={GOOD.has(r().kind) ? 'primary' : 'secondary'} onClick={close}>
                    Close
                  </Button>
                </div>
              )}
            </Match>
            <Match when={o().kind === 'imperfect' && (o() as { update: boolean }).update}>
              <p>
                This device needs Imperfect clone. Update the box first: on this firmware, Windows keeps resetting some
                of these devices.
              </p>
              <div class="acts">
                <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                  Update
                </Button>
                <Button variant="secondary" loading={run().running()} disabled={run().running()} onClick={() => apply(o())}>
                  {run().running() ? 'Applying...' : 'Allow imperfect anyway'}
                </Button>
                <Show when={!run().running()}>
                  <Button variant="secondary" onClick={() => keepAsItIs(o())}>
                    Keep as it is
                  </Button>
                </Show>
              </div>
            </Match>
            <Match when={o().kind === 'imperfect'}>
              <p>This device does nothing through the box until Imperfect clone is on.</p>
              <Actions label="Allow imperfect" running={run().running()} onApply={() => apply(o())} onKeep={() => keepAsItIs(o())} />
            </Match>
            <Match when={o().kind === 'logitech'}>
              <p>
                Logitech mice often declare 125 Hz but can run at 1000 Hz. This turns Imperfect clone on and sets the
                Wire rate and Emit rate to 1000 Hz. A mouse that can't go faster is put back as it was.
              </p>
              <Actions label="Force 1000 Hz" running={run().running()} onApply={() => apply(o())} onKeep={() => keepAsItIs(o())} />
            </Match>
            <Match when={o().kind === 'razer'}>
              <p>
                If this is one of Razer's 8K mice, plug it into the PC, set it to 8000 Hz in Razer Synapse, then plug it
                back into the box. It runs at 1000 Hz through the box. If you set 125 Hz on purpose, ignore this.
              </p>
              <div class="acts">
                <Button variant="secondary" onClick={() => keepAsItIs(o())}>
                  Keep as it is
                </Button>
              </div>
            </Match>
          </Switch>
          {/* There before it speaks, so a screen reader hears what it says. */}
          <p role="status" tabindex="-1" ref={status} classList={{ mut: run().running() }}>
            {run().result() ? said(run().result()!) : run().running() ? 'Restarting the box. This takes up to a minute.' : ''}
          </p>
        </Panel>
      )}
    </Show>
  );
}

const Actions = (props: { label: string; running: boolean; onApply: () => void; onKeep: () => void }) => (
  <div class="acts">
    <Button variant="primary" loading={props.running} disabled={props.running} onClick={props.onApply}>
      {props.running ? 'Applying...' : props.label}
    </Button>
    <Show when={!props.running}>
      <Button variant="secondary" onClick={props.onKeep}>
        Keep as it is
      </Button>
    </Show>
  </div>
);
