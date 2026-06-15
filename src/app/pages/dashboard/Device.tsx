import { Match, Show, Switch } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import '../../../styles/docs.css';

const Device = () => {
  const dash = useDashboard();

  return (
    <>
      <Show when={!dash.supported}>
        <div class="callout callout--warning">
          This browser can't reach USB devices. The dashboard needs the Web Serial API, which only
          Chromium-based browsers (Chrome, Edge, Opera) have. Open this page in one of those.
        </div>
      </Show>
      <Show when={dash.supported && !dash.secure}>
        <div class="callout callout--warning">
          Web Serial needs a secure context. Open this page over HTTPS, or on localhost.
        </div>
      </Show>

      <Card>
        <CardHeader title="Your device" subtitle="Connect over USB to view and manage your box" />
        <div aria-live="polite">
        <Switch>
          <Match when={dash.status() === 'connected'}>
            <Show when={dash.version()}>
              {(v) => (
                <p>
                  Connected. Firmware{' '}
                  <Chip variant="success">v{versionString(v())}</Chip> (protocol v{v().protoVer}).
                </p>
              )}
            </Show>
            <Button variant="secondary" onClick={() => void dash.disconnect()}>
              Disconnect
            </Button>
          </Match>

          <Match when={dash.status() === 'connecting'}>
            <Button loading disabled>
              Connecting...
            </Button>
          </Match>

          <Match when={dash.status() === 'error'}>
            <div class="callout callout--danger" role="alert">{dash.error()}</div>
            <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
              Try again
            </Button>
          </Match>

          <Match when={dash.status() === 'disconnected'}>
            <p>
              Plug the control cable (the USB2 port) into this computer, then connect. The browser
              will ask you to pick the serial port.
            </p>
            <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
              Connect
            </Button>
          </Match>
        </Switch>
        </div>
      </Card>
    </>
  );
};

export default Device;
