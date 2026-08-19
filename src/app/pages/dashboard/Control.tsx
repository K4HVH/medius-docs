import { Match, Show, Switch, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { createCommand } from './action';
import DeviceInject from './DeviceInject';
import DeviceLock from './DeviceLock';
import DeviceEventCatch from './DeviceEventCatch';
import DeviceClip from './DeviceClip';
import DeviceLed from './DeviceLed';
import { col, columns, row } from './ui';
import '../../../styles/docs.css';

// Everything on this page is momentary: the box drops all of it after a second of control-link
// silence. The persistent options live on the Device tab instead, so a setting that survives a
// reboot is not sitting in the same column as a test control that does not.
const Control = () => {
  const dash = useDashboard();
  const [cleared, setCleared] = createSignal(false);
  const cmd = createCommand(() => {
    dash.refreshPoll('locks');
    dash.refreshPoll('catch');
    dash.refreshPoll('clip');
  });

  const safetyClear = () => {
    setCleared(false);
    cmd.run(async () => {
      await dash.link()!.reset();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    });
  };

  return (
    <Show
      when={dash.status() === 'connected'}
      fallback={
        <Card>
          <CardHeader title="Controls" subtitle="Drive the box to test it" />
          <div aria-live="polite">
            <Switch>
              <Match when={dash.status() === 'connecting'}>
                <Button loading disabled>Connecting...</Button>
              </Match>

              <Match when={dash.status() === 'flashing'}>
                <p>Updating. See the <A href="/dashboard/update">Update tab</A>.</p>
              </Match>

              <Match when={dash.status() === 'error'}>
                <div class="callout callout--danger" role="alert">{dash.error()}</div>
                <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
                  Try again
                </Button>
              </Match>

              <Match when={dash.status() === 'disconnected'}>
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
                <p>
                  Connect to your box on the <A href="/dashboard">Device</A> page, then come back
                  here to drive it.
                </p>
                <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
                  Connect
                </Button>
              </Match>
            </Switch>
          </div>
        </Card>
      }
    >
      <>
      <Card>
        <CardHeader title="Controls" subtitle="Drive the box to test it" />
        <p>
          Everything on this page is momentary: the box releases it after a second without a control
          frame, so closing the dashboard hands the device back.
        </p>
      </Card>
      <div style={columns}>
        <div style={col}>
          <DeviceInject />
          <DeviceLock />
          <DeviceLed />
          <Card>
            <CardHeader title="Safety clear" subtitle="Clear all injection, locks, subscriptions and the clip" />
            <p>
              One frame that releases every injected input, every lock, the whole event
              subscription and the loaded clip.
            </p>
            <div style={row}>
              <Button variant="danger" disabled={cmd.busy()} onClick={safetyClear}>
                Clear everything
              </Button>
            </div>
            <div aria-live="polite">
              <Show when={cleared()}>
                <p>Sent.</p>
              </Show>
              <Show when={cmd.error()}>
                <div class="callout callout--danger" role="alert">{cmd.error()}</div>
              </Show>
            </div>
          </Card>
        </div>
        <div style={col}>
          <DeviceEventCatch />
          <DeviceClip />
        </div>
      </div>
      </>
    </Show>
  );
};

export default Control;
