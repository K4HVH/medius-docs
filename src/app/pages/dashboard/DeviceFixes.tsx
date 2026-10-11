import { Match, Show, Switch, createMemo, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { anyPending } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { Panel } from '../../shell/Panel';
import { type FixIO, type Offer, type Outcome, allowImperfect, logitechFix, offerFor, offerKey } from './fixes';

const KEPT = 'medius.fixes.kept';

// Offers put away with "Keep as it is", by device and fix. Storage that throws (a private window) keeps
// them for this page alone.
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
  try {
    localStorage.setItem(KEPT, JSON.stringify([...kept()]));
  } catch {
    // remembered alone
  }
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
    allowed: 'Done. Imperfect clone is on, and the box clones the device.',
    checking: 'The box is still checking its new firmware. Try again in a minute.',
    refused: "The box didn't take the setting. Try again.",
    silent: "The box isn't answering.",
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
  const signals = () => ({ version: dash.version(), device: device(), imperfect: imperfect(), emit: emit(), rate: rate() });
  const [put, setPut] = createSignal(0);
  const offer = createMemo(() => {
    put();
    const s = signals();
    const o = offerFor(s);
    return o && !kept().has(`${offerKey(s)}/${o.kind}`) ? o : null;
  });
  const [running, setRunning] = createSignal(false);
  const [result, setResult] = createSignal<Outcome | null>(null);
  // The offer a result answers, held while the box restarts and the offer itself goes.
  const [shown, setShown] = createSignal<Offer | null>(null);
  const current = () => (running() || result() ? shown() : offer());

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

  const apply = (o: Offer) => {
    setShown(o);
    setResult(null);
    setRunning(true);
    void (o.kind === 'logitech' ? logitechFix(io) : allowImperfect(io))
      .catch((): Outcome => ({ kind: 'silent' }))
      .then((r) => {
        setResult(r);
        setRunning(false);
        dash.refreshPoll('imperfect');
        dash.refreshPoll('emit');
      });
  };
  const keepAsItIs = (o: Offer) => {
    keep(`${offerKey(signals())}/${o.kind}`);
    setPut((n) => n + 1);
  };
  const close = () => {
    setResult(null);
    setShown(null);
  };

  return (
    <Show when={current()}>
      {(o) => (
        <Panel id="device-fix" title={title(o())} wide transient>
          <Switch>
            <Match when={result()}>
              {(r) => (
                <>
                  <p role="status">{said(r())}</p>
                  <div class="acts">
                    <Button variant={GOOD.has(r().kind) ? 'primary' : 'secondary'} onClick={close}>
                      Close
                    </Button>
                  </div>
                </>
              )}
            </Match>
            <Match when={o().kind === 'imperfect' && (o() as { update: boolean }).update}>
              <p>
                This device needs imperfect clone, and imperfect clone needs v3.4.4 or later for it: older firmware
                leaves one of its endpoints unanswered, and Windows then resets it. Update first.
              </p>
              <div class="acts">
                <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                  Update
                </Button>
                <Button variant="secondary" onClick={() => keepAsItIs(o())}>
                  Keep as it is
                </Button>
              </div>
            </Match>
            <Match when={o().kind === 'imperfect'}>
              <p>This device is past what the box copies exactly, so it does nothing through the box until imperfect clone is on.</p>
              <Actions label="Allow imperfect" running={running()} onApply={() => apply(o())} onKeep={() => keepAsItIs(o())} />
            </Match>
            <Match when={o().kind === 'logitech'}>
              <p>
                Logitech mice declare a low rate through the box though they report faster. The Logitech fix turns
                imperfect clone on, forces the wire rate to 1000 Hz and paces injected motion at 1000 Hz.
              </p>
              <Actions label="Force 1000 Hz" running={running()} onApply={() => apply(o())} onKeep={() => keepAsItIs(o())} />
            </Match>
            <Match when={o().kind === 'razer'}>
              <p>
                Plug it into the PC, set it to 8000 Hz in Razer Synapse, then plug it back into the box: through the
                box it then runs at 1000 Hz.
              </p>
              <div class="acts">
                <Button variant="secondary" onClick={() => keepAsItIs(o())}>
                  Keep as it is
                </Button>
              </div>
            </Match>
          </Switch>
        </Panel>
      )}
    </Show>
  );
}

const Actions = (props: { label: string; running: boolean; onApply: () => void; onKeep: () => void }) => (
  <>
    <Show when={props.running}>
      <p class="mut" role="status">
        The box restarts to clone the device again. This takes up to a minute.
      </p>
    </Show>
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
  </>
);
