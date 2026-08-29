import { For, Match, Show, Switch, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { type Health, versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import DeviceInfo from './DeviceInfo';
import DeviceOptions from './DeviceOptions';
import { BAD_BROWSER, BAD_CONTEXT, ConnectPanel } from './ConnectPanel';
import '../../../styles/docs.css';

const healthItems = (h: Health) => [
  { label: 'Host link', value: h.linkUp },
  { label: 'Mouse attached', value: h.mouseAttached },
  { label: 'Clone configured', value: h.cloneConfigured },
  { label: 'Injection active', value: h.injectionActive },
  { label: 'Rate confirmed', value: h.rateConfident },
  { label: 'Locks active', value: h.lockOn },
  { label: 'Events streaming', value: h.catchOn },
  { label: 'Keyboard attached', value: h.kbdAttached },
];

const col = {
  flex: '1 1 340px',
  'min-width': '0',
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
} as const;

const Device = () => {
  const dash = useDashboard();
  const navigate = useNavigate();

  let logEl: HTMLPreElement | undefined;
  let follow = true;

  // Stay following only while the view is at (or near) the bottom.
  const onLogScroll = () => {
    if (logEl) follow = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight <= 24;
  };

  // Scroll to the newest line unless the user has scrolled up.
  createEffect(() => {
    dash.deviceLog();
    if (logEl && follow) logEl.scrollTop = logEl.scrollHeight;
  });

  return (
    <>
      <Show when={!dash.supported}>
        <div id="unsupported" data-search-target>
          <Card>
            <CardHeader title="Browser not supported" subtitle="No box access from this browser" />
            <p>{BAD_BROWSER}</p>
          </Card>
        </div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div id="insecure" data-search-target>
          <Card>
            <CardHeader title="Page not secure" subtitle="No box access from this page" />
            <p>{BAD_CONTEXT}</p>
          </Card>
        </div>
      </Show>

      <Show when={dash.supported && dash.secure}>
        <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap', 'align-items': 'flex-start' }}>
          <div style={col}>
            <div id="your-box" data-search-target>
              <Card>
                <CardHeader title="Your box" subtitle="Connect over USB to view and manage your box" />
                <div aria-live="polite">
                  <Switch>
                    <Match when={dash.status() === 'connected'}>
                      <Show when={dash.version()}>
                        {(v) => (
                          <p>
                            Connected. Firmware <Chip variant="success">v{versionString(v())}</Chip>
                          </p>
                        )}
                      </Show>
                      <Button variant="secondary" onClick={() => void dash.disconnect()}>Disconnect</Button>
                    </Match>

                    <Match when={dash.status() === 'connecting'}>
                      <Button loading disabled>Connecting...</Button>
                    </Match>

                    <Match when={dash.status() === 'flashing'}>
                      <p>Updating. See the Update tab.</p>
                      <Button variant="primary" disabled onClick={() => navigate('/dashboard/update')}>
                        Go to Update
                      </Button>
                    </Match>

                    <Match when={dash.status() === 'error' || dash.status() === 'disconnected'}>
                      <ConnectPanel />
                    </Match>
                  </Switch>
                </div>
              </Card>
            </div>

            <Show when={dash.updateOnly()}>
              <div id="update-needed" data-search-target>
                <Card>
                  <CardHeader title="Update needed" subtitle="This box speaks an older protocol" />
                  <p>Update it to use the rest of the dashboard.</p>
                  <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                    Update
                  </Button>
                </Card>
              </div>
            </Show>

            <Show when={dash.status() === 'connected' && !dash.updateOnly()}>
              <div id="status" data-search-target>
                <Card>
                  <CardHeader title="Status" subtitle="Live device health" />
                  <Show when={dash.health()} fallback={<p>Reading status...</p>}>
                    {(h) => (
                      <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: 'var(--g-spacing-sm)' }}>
                        <For each={healthItems(h())}>
                          {(item) => <Chip variant={item.value ? 'success' : 'neutral'}>{item.label}</Chip>}
                        </For>
                      </div>
                    )}
                  </Show>
                </Card>
              </div>

              <DeviceInfo />
            </Show>
          </div>

          <div style={col}>
            <div id="device-log" data-search-target>
              <Card>
                <CardHeader title="Device log" subtitle="Live diagnostics from the box" />
                <Show
                  when={dash.status() === 'connected' || dash.deviceLog().length > 0}
                  fallback={<p>Connect to see the box's diagnostic messages here.</p>}
                >
                  <div style={{ 'margin-bottom': 'var(--g-spacing-sm)' }}>
                    <Button variant="subtle" size="compact" onClick={() => dash.clearDeviceLog()}>Clear</Button>
                  </div>
                  <pre
                    ref={logEl}
                    onScroll={onLogScroll}
                    class="diagram"
                    style={{ 'max-height': '360px', overflow: 'auto', 'white-space': 'pre-wrap' }}
                  >
                    <Show when={dash.deviceLog().length > 0} fallback="(no messages yet)">
                      {dash.deviceLog().join('\n')}
                    </Show>
                  </pre>
                </Show>
              </Card>
            </div>

            <Show when={dash.status() === 'connected' && !dash.updateOnly()}>
              <DeviceOptions />
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
};

export default Device;
