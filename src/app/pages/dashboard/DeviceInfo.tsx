import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import {
  type Caps,
  type MouseInfo,
  type Rate,
  type Stats,
  isComposite,
  nativeHz,
  vidPid,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';

const INFO_POLL_MS = 2000;

// bcdUSB is binary-coded decimal: 0x0200 -> "2.00", 0x0201 -> "2.01".
const bcd = (n: number) => `${n >> 8}.${(n >> 4) & 0xf}${n & 0xf}`;

const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;
const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;
const note = { ...muted, 'font-size': 'var(--font-size-xs, 0.8rem)' } as const;

const Row = (props: { label: string; children: unknown }) => (
  <div style={field}>
    <span style={muted}>{props.label}</span>
    <span>{props.children as never}</span>
  </div>
);

const DeviceInfo = () => {
  const dash = useDashboard();
  const [mouse, setMouse] = createSignal<MouseInfo | null>(null);
  const [caps, setCaps] = createSignal<Caps | null>(null);
  const [rate, setRate] = createSignal<Rate | null>(null);
  const [stats, setStats] = createSignal<Stats | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const stop = () => {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  // Read the four device-info queries every couple of seconds while connected. A transient miss is
  // ignored; a real drop unmounts this panel.
  createEffect(() => {
    const link = dash.link();
    stop();
    if (dash.status() !== 'connected' || !link) {
      setMouse(null);
      setCaps(null);
      setRate(null);
      setStats(null);
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
      } catch {
        // transient; try again next tick
      }
      if (running && dash.link() === link) timer = setTimeout(() => void tick(), INFO_POLL_MS);
    };
    void tick();
    onCleanup(stop);
  });

  return (
    <>
      <Card>
        <CardHeader title="Your mouse" subtitle="What the box detected and shows the game" />
        <p style={muted}>
          The box reads your real mouse and hands the game an identical copy. Here's what it sees.
        </p>
        <Show when={mouse()} fallback={<p>Reading...</p>}>
          {(m) => (
            <Show when={m().vid !== 0} fallback={<p>No mouse is plugged into the box yet.</p>}>
              <Row label="USB id">
                <code>{vidPid(m())}</code>
              </Row>
              <Show when={caps()}>
                {(c) => (
                  <>
                    <Row label="Buttons">{c().nButtons}</Row>
                    <Row label="Scroll wheel">{c().hasWheel ? 'Yes' : 'No'}</Row>
                    <p style={{ ...note, 'margin-top': 'var(--g-spacing-sm)' }}>
                      USB {bcd(m().bcdUsb)} · {c().nHid} interface{c().nHid === 1 ? '' : 's'}
                      {isComposite(c()) ? ' (composite)' : ''}
                      {m().hasSerial ? ' · has a serial number' : ''}
                    </p>
                  </>
                )}
              </Show>
            </Show>
          )}
        </Show>
      </Card>

      <Card>
        <CardHeader title="Performance" subtitle="How fast your mouse reports, and whether the box keeps up" />
        <p style={muted}>
          The report rate is how many times a second your mouse tells the PC where it is. The box should
          pass every update through without dropping any.
        </p>
        <Show when={rate()} fallback={<p>Reading...</p>}>
          {(r) => (
            <Row label="Report rate">
              <Show when={nativeHz(r()) !== null} fallback={<span style={muted}>learning...</span>}>
                {nativeHz(r())} Hz
              </Show>
            </Row>
          )}
        </Show>
        <Show when={stats()}>
          {(s) => (
            <>
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
              <p style={note}>
                {s().injectEmits} injected updates passed through · {s().resetCount} reconnects since power-on
              </p>
            </>
          )}
        </Show>
      </Card>
    </>
  );
};

export default DeviceInfo;
