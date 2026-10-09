import { Show, type JSX } from 'solid-js';
import { Chip } from '../../../components/display/Chip';
import {
  DeviceKind,
  deviceKindLabel,
  hasKeyboard,
  hasMouse,
  isCloned,
  isComposite,
  macHex,
  nativeHz,
  vidPid,
} from '../../../dashboard/protocol';
import { Panel } from '../../shell/Panel';
import { useDashboard } from './context';

// bcdUSB is binary-coded decimal: 0x0200 -> "2.00", 0x0201 -> "2.01".
const bcd = (n: number) => `${n >> 8}.${(n >> 4) & 0xf}${n & 0xf}`;

// A label and its value, one row of a panel's table.
const Row = (props: { label: string; children: JSX.Element }) => (
  <tr>
    <td>{props.label}</td>
    <td>{props.children}</td>
  </tr>
);

const CapChip = (props: { on: boolean; children: JSX.Element }) => (
  <Chip variant={props.on ? 'success' : 'neutral'}>{props.children}</Chip>
);

export const CapabilitiesPanel = () => {
  const dash = useDashboard();
  const mouseAttached = () => dash.health()?.mouseAttached === true;
  // The shared poller: the Options panels poll `imperfect` too.
  const device = dash.poll('deviceInfo');
  const caps = dash.poll('caps');
  const imperfect = dash.poll('imperfect');

  return (
    <Panel id="capabilities" title="Capabilities">
      <Show when={caps()} fallback={<p class="mut">No device cloned yet.</p>}>
        {(c) => (
          <>
            <Show when={device() && !isCloned(device()!)}>
              <p class="mut">
                {mouseAttached() ? 'A device is attached but not cloned; the box log says why.' : 'No device cloned yet.'}
              </p>
            </Show>
            <table class="vals">
              <tbody>
                <Show when={device()?.product}>
                  <Row label="Product">{device()!.product}</Row>
                </Show>
                <Show when={device() && device()!.kind !== DeviceKind.Unknown}>
                  <Row label="Kind">
                    <Chip variant="neutral">{deviceKindLabel(device()!.kind)}</Chip>
                  </Row>
                </Show>
                <Show when={device() && isCloned(device()!)}>
                  <Row label="USB ID">
                    <code>{vidPid(device()!)}</code>
                    <span class="mut"> · USB {bcd(device()!.bcdUsb)}</span>
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
                <Show when={device() && isCloned(device()!) && !hasMouse(c()) && !hasKeyboard(c())}>
                  <Row label="Input">
                    <span class="mut">Cloned, with no input features to inject into</span>
                  </Row>
                </Show>
              </tbody>
            </table>

            <Show when={hasMouse(c())}>
              <p class="sublabel">Mouse</p>
              <table class="vals">
                <tbody>
                  <Row label="Buttons">{c().mouse.nButtons}</Row>
                  <Row label="Interfaces">
                    {c().mouse.nHid}
                    {isComposite(c().mouse) ? ' · composite' : ''}
                  </Row>
                  <Row label="Fields">
                    <div class="chips">
                      <CapChip on={c().mouse.hasX}>X axis</CapChip>
                      <CapChip on={c().mouse.hasY}>Y axis</CapChip>
                      <CapChip on={c().mouse.hasWheel}>Wheel</CapChip>
                      <CapChip on={c().mouse.hasPan}>Pan</CapChip>
                      <CapChip on={c().mouse.hasReportId}>Report ID</CapChip>
                    </div>
                  </Row>
                </tbody>
              </table>
            </Show>

            <Show when={hasKeyboard(c())}>
              <p class="sublabel">Keyboard</p>
              <table class="vals">
                <tbody>
                  <Row label="Rollover">{c().keyboard.nkro ? 'NKRO' : `${c().keyboard.nKeys}-key`}</Row>
                  <Row label="Fields">
                    <div class="chips">
                      <CapChip on={c().keyboard.hasConsumer}>Media keys</CapChip>
                      <CapChip on={c().keyboard.hasSystem}>System keys</CapChip>
                      <CapChip on={c().keyboard.hasReportId}>Report ID</CapChip>
                    </div>
                  </Row>
                </tbody>
              </table>
            </Show>

            <Show when={imperfect()}>
              {(imp) => (
                <Show when={(device() && isCloned(device()!)) || imp().overCapacity}>
                  <p class="sublabel">Clone</p>
                  <table class="vals">
                    <tbody>
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
                      <Show when={device() && isCloned(device()!)}>
                        <Row label="Serial number">
                          <Chip variant={device()?.hasSerial ? 'success' : 'neutral'}>
                            {device()?.hasSerial ? 'Cloned' : 'None'}
                          </Chip>
                        </Row>
                      </Show>
                    </tbody>
                  </table>
                </Show>
              )}
            </Show>
          </>
        )}
      </Show>
    </Panel>
  );
};

export const PerformancePanel = () => {
  const dash = useDashboard();
  const mouseAttached = () => dash.health()?.mouseAttached === true;
  const rate = dash.poll('rate');
  const stats = dash.poll('stats');

  return (
    <Panel id="performance" title="Performance">
      <table class="vals">
        <tbody>
          <Show when={rate()} fallback={<Row label="Report rate">Not measured</Row>}>
            {(r) => (
              <Row label="Report rate">
                <Show
                  when={!r().changeDriven}
                  fallback={<span class="mut">On key change (~{Math.round(1_000_000 / r().pollPeriodUs)} Hz polled)</span>}
                >
                  <Show when={mouseAttached()} fallback={<span class="mut">No mouse</span>}>
                    <Show when={nativeHz(r()) !== null} fallback={<span class="mut">Waiting...</span>}>
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
                  <Chip variant={s().linkRxDrops > 0 ? 'warning' : 'success'}>{s().linkRxDrops} dropped</Chip>
                </Row>
                <Row label="Host link">
                  <Chip variant={s().hostRxDrops > 0 ? 'warning' : 'success'}>{s().hostRxDrops} dropped</Chip>
                </Row>
                {/* Relay drops are stream load, so info rather than warning. */}
                <Row label="Relay">
                  <Chip variant={s().relayDrops > 0 ? 'info' : 'success'}>{s().relayDrops} dropped</Chip>
                </Row>
              </>
            )}
          </Show>
        </tbody>
      </table>
    </Panel>
  );
};

const DeviceInfo = () => (
  <>
    <CapabilitiesPanel />
    <PerformancePanel />
  </>
);

export default DeviceInfo;
