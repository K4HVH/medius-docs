import { Match, Show, Switch, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
import { createCommand } from './action';
import DeviceInject from './DeviceInject';
import DeviceLock from './DeviceLock';
import DeviceTransform from './DeviceTransform';
import DeviceEventCatch from './DeviceEventCatch';
import DeviceClip from './DeviceClip';
import DeviceLed from './DeviceLed';
import { col, columns, row } from './ui';
import '../../../styles/docs.css';

// Everything here is momentary: the box drops it after 1 s of control-link silence. Persistent
// options live on the Device tab.
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
        <Show
          when={!dash.updateOnly()}
          fallback={
            <div id="update-needed" data-search-target>
              <Card>
                <CardHeader title="Update needed" subtitle="This box speaks an older protocol" />
                <p>Update it to use these controls.</p>
                <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                  Update
                </Button>
              </Card>
            </div>
          }
        >
          <div id="controls" data-search-target>
            <Card>
              <CardHeader title="Controls" subtitle="Test the box" />
              <div aria-live="polite">
                <Switch>
                  <Match when={dash.status() === 'connecting'}>
                    <Button loading disabled>Connecting...</Button>
                  </Match>

                  <Match when={dash.status() === 'flashing'}>
                    <p>Updating.</p>
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
        </Show>
      }
    >
      <>
      <div style={columns}>
        <div style={col}>
          <DeviceInject />
          <DeviceLock />
          <DeviceTransform />
          <DeviceLed />
          <div id="safety-clear" data-search-target>
            <Card>
              <CardHeader title="Safety clear" subtitle="Clears injection, locks, subscriptions and the clip" />
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
