import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import {
  type Caps,
  type ImperfectStatus,
  type MouseInfo,
  type Rate,
  type Stats,
  hasKeyboard,
  hasMouse,
  nativeHz,
  vidPid,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';

const INFO_POLL_MS = 2000;

const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;
const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;

const Row = (props: { label: string; children: unknown }) => (
  <div style={field}>
    <span style={muted}>{props.label}</span>
    <span>{props.children as never}</span>
  </div>
);

const DeviceInfo = () => {
  const dash = useDashboard();
  const mouseAttached = () => dash.health()?.mouseAttached === true;
  const [mouse, setMouse] = createSignal<MouseInfo | null>(null);
  const [caps, setCaps] = createSignal<Caps | null>(null);
  const [rate, setRate] = createSignal<Rate | null>(null);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [imperfect, setImperfect] = createSignal<ImperfectStatus | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const stop = () => {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  createEffect(() => {
    const link = dash.link();
    stop();
    if (dash.status() !== 'connected' || !link) {
      setMouse(null);
      setCaps(null);
      setRate(null);
      setStats(null);
      setImperfect(null);
      return;
    }
    running = true;
    const tick = async () => {
      if (!running || dash.link() !== link) return;
      try {
        setMouse(await link.queryMouseInfo());
        setCaps(await link.queryCaps());
        setRate(await link.queryRate());
        setStats(await link.queryStats());
        setImperfect(await link.queryImperfect());
      } catch {
        // transient; try again next tick
      }
      if (running && dash.link() === link) timer = setTimeout(() => void tick(), INFO_POLL_MS);
    };
    void tick();
    onCleanup(stop);
  });

  const usbId = () => (mouse()?.vid ? vidPid(mouse()!) : null);

  return (
    <>
      <Card>
        <CardHeader title="Capabilities" subtitle="What the box detected and clones" />
        <Show when={caps()} fallback={<Row label="Device">none cloned</Row>}>
          {(c) => (
            <>
              <Show when={hasMouse(c())}>
                <Row label="Mouse">
                  <Show when={usbId()}>
                    <code>{usbId()}</code>{' '}
                  </Show>
                  {c().mouse.nButtons} btn{c().mouse.hasWheel ? ' / wheel' : ''} / {c().mouse.nHid} iface
                  {c().mouse.nHid === 1 ? '' : 's'}
                </Row>
              </Show>
              <Show when={hasKeyboard(c())}>
                <Row label="Keyboard">
                  <Show when={usbId()}>
                    <code>{usbId()}</code>{' '}
                  </Show>
                  {c().keyboard.nkro ? 'NKRO' : `${c().keyboard.nKeys} keys`}
                  {c().keyboard.hasConsumer ? ' / media' : ''}
                  {c().keyboard.hasReportId ? ' / report id' : ''}
                </Row>
              </Show>
              <Show when={imperfect()}>
                {(imp) => (
                  <Row label="Full clone">
                    <Show when={imp().overCapacity} fallback={<Chip variant="success">Yes</Chip>}>
                      <Chip variant="warning">No · 1 input can't be copied</Chip>
                    </Show>
                  </Row>
                )}
              </Show>
            </>
          )}
        </Show>
      </Card>

      <Card>
        <CardHeader title="Performance" subtitle="Report rate and delivery" />
        <Show when={rate()} fallback={<Row label="Report rate">—</Row>}>
          {(r) => (
            <Row label="Report rate">
              <Show
                when={!r().changeDriven}
                fallback={
                  <span style={muted}>
                    on key change (~{Math.round(1_000_000 / r().pollPeriodUs)} Hz polled)
                  </span>
                }
              >
                <Show when={mouseAttached()} fallback={<span style={muted}>no mouse</span>}>
                  <Show when={nativeHz(r()) !== null} fallback={<span style={muted}>waiting…</span>}>
                    {nativeHz(r())} Hz
                  </Show>
                </Show>
              </Show>
            </Row>
          )}
        </Show>
        <Show when={stats()}>
          {(s) => (
            <Row label="Delivery">
              <Show
                when={s().txDrops === 0 && s().txWedges === 0}
                fallback={
                  <Chip variant="warning">
                    {s().txDrops} dropped, {s().txWedges} recovered
                  </Chip>
                }
              >
                <Chip variant="success">Healthy</Chip>
              </Show>
            </Row>
          )}
        </Show>
      </Card>
    </>
  );
};

export default DeviceInfo;
