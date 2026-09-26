import { Show } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import {
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
import { Section } from './Section';

// bcdUSB is binary-coded decimal: 0x0200 -> "2.00", 0x0201 -> "2.01".
const bcd = (n: number) => `${n >> 8}.${(n >> 4) & 0xf}${n & 0xf}`;

const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;
// 2px, not 6px: at 6px one section's rows read as separate items.
const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '2px 0',
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

const CapChip = (props: { on: boolean; children: unknown }) => (
  <Chip variant={props.on ? 'success' : 'neutral'}>{props.children as never}</Chip>
);

const DeviceInfo = () => {
  const dash = useDashboard();
  const mouseAttached = () => dash.health()?.mouseAttached === true;
  // The shared poller: five round trips per tick, and the Options card polls `imperfect` too.
  const device = dash.poll('deviceInfo');
  const caps = dash.poll('caps');
  const rate = dash.poll('rate');
  const stats = dash.poll('stats');
  const imperfect = dash.poll('imperfect');

  return (
    <>
      <div id="capabilities" data-search-target>
        <Card>
          <CardHeader title="Capabilities" subtitle="Detected and cloned device" />
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
                  <Row label="USB ID">
                    <code>{vidPid(device()!)}</code>
                    <span style={muted}> · USB {bcd(device()!.bcdUsb)}</span>
                  </Row>
                </Show>
                <Show when={dash.version?.()?.mac?.length}>
                  <Row label="Box ID">
                    <code>{macHex(dash.version()!)}</code>
                  </Row>
                </Show>
                <Show when={dash.version?.()?.name}>
                  <Row label="Box name">
                    <code>{dash.version()!.name}</code>
                  </Row>
                </Show>

                <Show when={hasMouse(c())}>
                  <Section title="Mouse">
                  <Row label="Buttons">{c().mouse.nButtons}</Row>
                  <Row label="Interfaces">
                    {c().mouse.nHid}
                    {isComposite(c().mouse) ? ' · composite' : ''}
                  </Row>
                  <div style={chipRow}>
                    <CapChip on={c().mouse.hasX}>X axis</CapChip>
                    <CapChip on={c().mouse.hasY}>Y axis</CapChip>
                    <CapChip on={c().mouse.hasWheel}>Wheel</CapChip>
                    <CapChip on={c().mouse.hasPan}>Pan</CapChip>
                    <CapChip on={c().mouse.hasReportId}>Report ID</CapChip>
                  </div>
                  </Section>
                </Show>

                <Show when={hasKeyboard(c())}>
                  <Section title="Keyboard">
                  <Row label="Rollover">
                    {c().keyboard.nkro ? 'NKRO' : `${c().keyboard.nKeys}-key`}
                  </Row>
                  <div style={chipRow}>
                    <CapChip on={c().keyboard.hasConsumer}>Media keys</CapChip>
                    <CapChip on={c().keyboard.hasSystem}>System keys</CapChip>
                    <CapChip on={c().keyboard.hasReportId}>Report ID</CapChip>
                  </div>
                  </Section>
                </Show>

                <Show when={imperfect()}>
                  {(imp) => (
                    <>
                      <Section title="Clone">
                      <Row label="Full clone">
                        <Show
                          when={imp().overCapacity || imp().cloneImperfect}
                          fallback={<Chip variant="success">Yes</Chip>}
                        >
                          <Chip variant="warning">
                            {imp().overCapacity ? 'No · over box capacity, or high speed' : 'No · not an exact copy'}
                          </Chip>
                        </Show>
                      </Row>
                      <Row label="Serial number">
                        <Chip variant={device()?.hasSerial ? 'success' : 'neutral'}>
                          {device()?.hasSerial ? 'Cloned' : 'None'}
                        </Chip>
                      </Row>
                      </Section>
                    </>
                  )}
                </Show>
              </>
            )}
          </Show>
        </Card>
      </div>

      <div id="performance" data-search-target>
        <Card>
          <CardHeader title="Performance" subtitle="Report rate and delivery" />
          <Show when={rate()} fallback={<Row label="Report rate">Not measured</Row>}>
            {(r) => (
              <Row label="Report rate">
                <Show
                  when={!r().changeDriven}
                  fallback={
                    <span style={muted}>
                      On key change (~{Math.round(1_000_000 / r().pollPeriodUs)} Hz polled)
                    </span>
                  }
                >
                  <Show when={mouseAttached()} fallback={<span style={muted}>No mouse</span>}>
                    <Show when={nativeHz(r()) !== null} fallback={<span style={muted}>Waiting...</span>}>
                      {nativeHz(r())} Hz
                    </Show>
                  </Show>
                </Show>
              </Row>
            )}
          </Show>
          <Show when={stats()}>
            {(s) => (
              <>
                <Row label="PC delivery">
                  <Chip variant={s().txDrops > 0 || s().txWedges > 0 ? 'warning' : 'success'}>
                    {s().txDrops} dropped, {s().txWedges} recovered
                  </Chip>
                </Row>
                <Row label="Device link">
                  <Chip variant={s().linkRxDrops > 0 ? 'warning' : 'success'}>
                    {s().linkRxDrops} dropped
                  </Chip>
                </Row>
                <Row label="Host link">
                  <Chip variant={s().hostRxDrops > 0 ? 'warning' : 'success'}>
                    {s().hostRxDrops} dropped
                  </Chip>
                </Row>
                {/* Relay drops are stream load, so info rather than warning. */}
                <Row label="Relay">
                  <Chip variant={s().relayDrops > 0 ? 'info' : 'success'}>
                    {s().relayDrops} dropped
                  </Chip>
                </Row>
              </>
            )}
          </Show>
        </Card>
      </div>
    </>
  );
};

export default DeviceInfo;
