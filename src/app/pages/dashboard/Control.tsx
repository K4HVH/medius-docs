import { Match, Show, Switch, createSignal } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { PROTO_VER } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
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
  const navigate = useNavigate();
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
      when={dash.status() === 'connected' && !dash.updateOnly()}
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

              <Match when={dash.updateOnly()}>
                <p>
                  These controls need protocol v{PROTO_VER}. This box speaks
                  <Show when={dash.version()}>{(v) => <> protocol v{v().protoVer}</>}</Show>.
                </p>
                <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                  Update
                </Button>
              </Match>

              <Match when={dash.status() === 'error' || dash.status() === 'disconnected'}>
                <ConnectPanel />
              </Match>

            </Switch>
          </div>
        </Card>
      }
    >
      <>
      <div style={columns}>
        <div style={col}>
          <DeviceInject />
          <DeviceLock />
          <DeviceLed />
          <Card>
            <CardHeader title="Safety clear" subtitle="Clear all injection, locks, subscriptions and the clip" />
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
