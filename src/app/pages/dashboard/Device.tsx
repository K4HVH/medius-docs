import { For, Match, Show, Switch, createEffect, createSignal, on } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { type Health, PROTO_VER, versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { CapabilitiesPanel, PerformancePanel } from './DeviceInfo';
import DeviceFactoryReset from './DeviceFactoryReset';
import DeviceOptions from './DeviceOptions';
import { ConnectPanel } from './ConnectPanel';
import UpdateOnlyCard from './UpdateOnlyCard';
import { PageHeader } from '../../shell/PageHeader';
import { PageTabs, Pane } from '../../shell/PageTabs';
import { Panel, Panels, Stack } from '../../shell/Panel';
import { LogBox, logText } from '../../shell/LogBox';

const healthItems = (h: Health) => [
  { label: 'Host link', value: h.linkUp },
  { label: 'Mouse attached', value: h.mouseAttached },
  { label: 'Clone configured', value: h.cloneConfigured },
  { label: 'Injection active', value: h.injectionActive },
  { label: 'Rate confirmed', value: h.rateConfident },
  { label: 'Locks active', value: h.lockOn },
  { label: 'Events streaming', value: h.catchOn },
  { label: 'Keyboard attached', value: h.kbdAttached },
  { label: 'Rewrite rules', value: h.rewriteOn },
  { label: 'Descriptor patches', value: h.patchOn },
  { label: 'Field transforms', value: h.transformOn },
];

// "[Info] text" as its level and its text.
const logCells = (line: string): string[] => {
  const m = /^\[(\w+)\] ?(.*)$/s.exec(line);
  return m ? [m[1], m[2]] : ['', line];
};
const LEVEL_CLASS: Record<string, string> = { Info: 'lv-info', Warn: 'lv-warn', Error: 'lv-error' };

const saveText = (text: string) => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
  a.download = `medius-log-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const Device = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const connected = () => dash.status() === 'connected';
  const blink = createCommand();
  // A refusal belongs to the link it came over.
  createEffect(on(dash.link, () => blink.clear(), { defer: true }));
  const full = () => connected() && !dash.updateOnly();
  const logRows = () => dash.deviceLog().map(logCells);
  const empty = () => dash.deviceLog().length === 0;
  const [copied, setCopied] = createSignal(false);
  const named = (state: string) => (dash.version()?.name ? `${state} · ${dash.version()!.name}` : state);
  const connLine = () =>
    ({ connected: named('Connected'), flashing: named('Updating'), lost: 'Not answering', connecting: 'Connecting' })[
      dash.status() as string
    ] ?? 'Not connected';
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  // Where the clipboard is refused, the log's text is selected for the reader to copy.
  const copyLog = () => {
    const pick = () => getSelection()?.selectAllChildren(document.querySelector('#device-log .lg')!);
    if (!navigator.clipboard) return pick();
    navigator.clipboard.writeText(logText(logRows())).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), 1200);
    }, pick);
  };

  return (
    <>
      <PageHeader
        aside={
          <p class="conn" classList={{ on: connected() || dash.status() === 'flashing' }} data-search-skip>
            <span class="dot" classList={{ ok: connected(), warn: dash.status() === 'flashing' || dash.status() === 'lost' }} />
            <span>{connLine()}</span>
          </p>
        }
      />
      <PageTabs
        id="device"
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'options', label: 'Options', disabled: !full() },
          { key: 'log', label: 'Log' },
        ]}
      >
        <Pane key="overview">
          <Panels>
            <Stack wide={!full()}>
              <Panel id="your-box" title="Your box">
                <div aria-live="polite" class="boxstate">
                  <Switch>
                    <Match when={connected()}>
                      <Show when={dash.version()}>
                        {(v) => (
                          <p class="state" data-search-skip>
                            Firmware <Chip variant="success">v{versionString(v())}</Chip>
                          </p>
                        )}
                      </Show>
                      <div class="acts">
                        {/* LED isn't on the stable update path, so a newer box isn't sent it. */}
                        <Show when={(dash.version()?.protoVer ?? 0) <= PROTO_VER}>
                          <Button variant="secondary" loading={dash.identifying()} onClick={() => blink.run(dash.identify)}>
                            {dash.identifying() ? 'Identifying...' : 'Identify'}
                          </Button>
                        </Show>
                        <Button variant="secondary" onClick={() => void dash.disconnect()}>
                          Disconnect
                        </Button>
                      </div>
                      <Show when={blink.error()}>
                        {(msg) => (
                          <div class="callout callout--danger" role="alert">
                            {msg()}
                          </div>
                        )}
                      </Show>
                    </Match>

                    <Match when={dash.status() === 'connecting'}>
                      <div class="acts">
                        <Button loading disabled>
                          Connecting...
                        </Button>
                      </div>
                    </Match>

                    <Match when={dash.status() === 'flashing'}>
                      <p>Updating.</p>
                      <div class="acts">
                        <Show
                          when={dash.update()?.page === 'advanced'}
                          fallback={
                            <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                              Go to Update
                            </Button>
                          }
                        >
                          <Button variant="primary" onClick={() => navigate('/dashboard/update#manual')}>
                            Go to Manual flash
                          </Button>
                        </Show>
                      </div>
                    </Match>

                    <Match when={dash.status() === 'error' || dash.status() === 'disconnected' || dash.status() === 'lost'}>
                      <ConnectPanel />
                    </Match>
                  </Switch>
                </div>
              </Panel>

              <Show when={dash.updateOnly()}>
                <UpdateOnlyCard use="the rest of the dashboard" />
              </Show>

              <Show when={full()}>
                <Panel id="status" title="Status">
                  <Show when={dash.health()} fallback={<p class="mut" data-search-skip>Reading...</p>}>
                    {(h) => (
                      <div class="flags">
                        <For each={healthItems(h())}>
                          {(item, i) => (
                            <span class="lp" classList={{ on: item.value }} style={{ '--d': `${i() * 40}ms` }}>
                              {item.label}
                            </span>
                          )}
                        </For>
                        <span class="lp blank" aria-hidden="true" />
                      </div>
                    )}
                  </Show>
                </Panel>
                <PerformancePanel />
              </Show>
            </Stack>
            <Show when={full()}>
              <Stack>
                <CapabilitiesPanel />
              </Stack>
            </Show>
          </Panels>
        </Pane>

        <Pane key="options">
          {/* A box on another protocol takes neither: its RESET has no flags byte. */}
          <Show when={full()}>
            <Panels>
              <DeviceOptions />
              <DeviceFactoryReset />
            </Panels>
          </Show>
        </Pane>

        <Pane key="log">
          <Panel id="device-log">
            <Show when={connected() || !empty()} fallback={<p class="mut">Connect to see diagnostics.</p>}>
              <div class="logw">
                <div class="acts">
                  <Button variant="secondary" disabled={empty()} class="copy" onClick={copyLog}>
                    {copied() ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" disabled={empty()} onClick={() => saveText(logText(logRows()))}>
                    Save
                  </Button>
                  <Button variant="secondary" disabled={empty()} onClick={() => dash.clearDeviceLog()}>
                    Clear
                  </Button>
                </div>
                <LogBox
                  rows={logRows}
                  added={dash.deviceLogAdded}
                  empty="(no messages)"
                  label="Device log"
                  full
                  cellClass={(c, i) => (i === 0 ? LEVEL_CLASS[c] : undefined)}
                />
              </div>
            </Show>
          </Panel>
        </Pane>
      </PageTabs>
    </>
  );
};

export default Device;
