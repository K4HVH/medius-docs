import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import {
  type Caps,
  type DeviceInfo as DeviceInfoValue,
  type ImperfectStatus,
  type Rate,
  type Stats,
  DeviceKind,
  deviceKindLabel,
  hasKeyboard,
  hasMouse,
  isComposite,
  macHex,
  nativeHz,
  vidPid,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';

const INFO_POLL_MS = 2000;

// bcdUSB is binary-coded decimal: 0x0200 -> "2.00", 0x0201 -> "2.01".
const bcd = (n: number) => `${n >> 8}.${(n >> 4) & 0xf}${n & 0xf}`;

const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;
const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;
const sectionLabel = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.75rem)',
  'font-weight': '600',
  'letter-spacing': '0.05em',
  'text-transform': 'uppercase',
  margin: 'var(--g-spacing) 0 var(--g-spacing-sm)',
} as const;
const chipRow = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: 'var(--g-spacing-sm)',
  'padding-top': '4px',
} as const;

const Row = (props: { label: string; children: unknown }) => (
  <div style={field}>
    <span style={muted}>{props.label}</span>
    <span>{props.children as never}</span>
  </div>
);

// A capability chip: lit (success) when present, dim (neutral) when absent.
const CapChip = (props: { on: boolean; children: unknown }) => (
  <Chip variant={props.on ? 'success' : 'neutral'}>{props.children as never}</Chip>
);

const DeviceInfo = () => {
  const dash = useDashboard();
  const mouseAttached = () => dash.health()?.mouseAttached === true;
  const [device, setDevice] = createSignal<DeviceInfoValue | null>(null);
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
      setDevice(null);
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
        setDevice(await link.queryDeviceInfo());
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

  return (
    <>
      <Card>
        <CardHeader title="Capabilities" subtitle="What the box detected and clones to the game" />
        <Show when={caps()} fallback={<p style={muted}>No device cloned yet.</p>}>
          {(c) => (
            <>
              <Show when={device()?.product}>
                <Row label="Product">{device()!.product}</Row>
              </Show>
              <Show when={device() && device()!.kind !== DeviceKind.Unknown}>
                <Row label="Kind">
                  <Chip variant="neutral">{deviceKindLabel(device()!.kind)}</Chip>
                </Row>
              </Show>
              <Show when={device()?.vid}>
                <Row label="USB id">
                  <code>{vidPid(device()!)}</code>
                  <span style={muted}> · USB {bcd(device()!.bcdUsb)}</span>
                </Row>
              </Show>
              <Show when={dash.version?.()?.mac?.length}>
                <Row label="Box id">
                  <code>{macHex(dash.version()!)}</code>
                </Row>
              </Show>

              <Show when={hasMouse(c())}>
                <div style={sectionLabel}>Mouse</div>
                <Row label="Buttons">{c().mouse.nButtons}</Row>
                <Row label="Interfaces">
                  {c().mouse.nHid}
                  {isComposite(c().mouse) ? ' · composite' : ''}
                </Row>
                <div style={chipRow}>
                  <CapChip on={c().mouse.hasX}>X axis</CapChip>
                  <CapChip on={c().mouse.hasY}>Y axis</CapChip>
                  <CapChip on={c().mouse.hasWheel}>Wheel</CapChip>
                  <CapChip on={c().mouse.hasReportId}>Report ID</CapChip>
                </div>
              </Show>

              <Show when={hasKeyboard(c())}>
                <div style={sectionLabel}>Keyboard</div>
                <Row label="Rollover">
                  {c().keyboard.nkro ? 'NKRO' : `${c().keyboard.nKeys}-key`}
                </Row>
                <div style={chipRow}>
                  <CapChip on={c().keyboard.hasConsumer}>Media keys</CapChip>
                  <CapChip on={c().keyboard.hasSystem}>System keys</CapChip>
                  <CapChip on={c().keyboard.hasReportId}>Report ID</CapChip>
                </div>
              </Show>

              <Show when={imperfect()}>
                {(imp) => (
                  <>
                    <div style={sectionLabel}>Clone</div>
                    <Row label="Full clone">
                      <Show
                        when={imp().overCapacity}
                        fallback={<Chip variant="success">Yes</Chip>}
                      >
                        <Chip variant="warning">No · 1 input can't be copied</Chip>
                      </Show>
                    </Row>
                    <Row label="Serial number">
                      <Chip variant={device()?.hasSerial ? 'success' : 'neutral'}>
                        {device()?.hasSerial ? 'Cloned' : 'None'}
                      </Chip>
                    </Row>
                  </>
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
