import { For, Match, Show, Switch, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { type Health, versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { PortDiagram } from './PortDiagram';
import '../../../styles/docs.css';

const healthItems = (h: Health) => [
  { label: 'Host link', value: h.linkUp },
  { label: 'Mouse attached', value: h.mouseAttached },
  { label: 'Clone configured', value: h.cloneConfigured },
  { label: 'Injection active', value: h.injectionActive },
];

const col = {
  flex: '1 1 340px',
  'min-width': '0',
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
} as const;

const row = { display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' } as const;

const Device = () => {
  const dash = useDashboard();
  const navigate = useNavigate();

  let logEl: HTMLPreElement | undefined;
  let follow = true;

  // Stay following only while the view is at (or near) the bottom.
  const onLogScroll = () => {
    if (logEl) follow = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight <= 24;
  };

  // Follow new lines like a terminal, unless the user has scrolled up.
  createEffect(() => {
    dash.deviceLog();
    if (logEl && follow) logEl.scrollTop = logEl.scrollHeight;
  });

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">
          This browser can't reach USB devices. Open the dashboard in Chrome, Edge, or Opera.
        </div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div class="callout callout--warning">
          Web Serial needs a secure context. Open this page over HTTPS, or on localhost.
        </div>
      </Show>

      <div style={{ display: 'flex', gap: 'var(--g-spacing)', 'flex-wrap': 'wrap', 'align-items': 'flex-start' }}>
        <div style={col}>
          <Card>
            <CardHeader title="Your device" subtitle="Connect over USB to view and manage your box" />
            <div aria-live="polite">
              <Switch>
                <Match when={dash.status() === 'connected'}>
                  <Show when={dash.version()}>
                    {(v) => (
                      <p>
                        Connected. Firmware <Chip variant="success">v{versionString(v())}</Chip>{' '}
                        (protocol v{v().protoVer}).
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
                </Match>

                <Match when={dash.status() === 'error'}>
                  <div class="callout callout--danger" role="alert">{dash.error()}</div>
                  <div style={row}>
                    <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
                      Try again
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { void dash.disconnect(); navigate('/dashboard/update'); }}
                    >
                      Install Medius
                    </Button>
                  </div>
                </Match>

                <Match when={dash.status() === 'disconnected'}>
                  <p>Plug in like this, then connect.</p>
                  <PortDiagram plug={['usb1', 'usb2']} />
                  <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
                    Connect
                  </Button>
                </Match>
              </Switch>
            </div>
          </Card>

          <Show when={dash.status() === 'connected'}>
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
          </Show>
        </div>

        <div style={col}>
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
      </div>
    </>
  );
};

export default Device;
