import { Match, Show, Switch, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import UpdateOnlyCard from './UpdateOnlyCard';
import { ConnectPanel } from './ConnectPanel';
import { createCommand } from './action';
import DeviceInject from './DeviceInject';
import DeviceLock from './DeviceLock';
import DeviceTransform from './DeviceTransform';
import DeviceEventCatch from './DeviceEventCatch';
import DeviceClip from './DeviceClip';
import DeviceLed from './DeviceLed';
import DeviceRewrite from './DeviceRewrite';
import DevicePatch from './DevicePatch';
import DeviceRaw from './DeviceRaw';
import DeviceTransfer from './DeviceTransfer';
import { PageHeader } from '../../shell/PageHeader';
import { PageTabs, Pane } from '../../shell/PageTabs';
import { Panel, Panels, Stack } from '../../shell/Panel';

const TABS = [
  { key: 'injection', label: 'Injection' },
  { key: 'locks', label: 'Input locks' },
  { key: 'transforms', label: 'Transforms' },
  { key: 'catch', label: 'Input catch' },
  { key: 'clips', label: 'Clip playback' },
  { key: 'light', label: 'Status light' },
  { key: 'advanced', label: 'Advanced' },
];

// Everything here but the Advanced tab's patches is momentary: the box drops it after 1 s of
// control-link silence. Persistent options live on the Device page.
const Control = () => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const [cleared, setCleared] = createSignal(false);
  const cmd = createCommand(() => {
    dash.refreshPoll('locks');
    dash.refreshPoll('catch');
    dash.refreshPoll('clip');
  });
  const full = () => dash.status() === 'connected' && !dash.updateOnly();

  const safetyClear = () => {
    setCleared(false);
    cmd.run(async () => {
      await dash.link()!.reset();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    });
  };

  return (
    <>
      <PageHeader
        aside={
          <Show when={full()}>
            <div class="safety" id="safety-clear" data-search-target>
              <Button variant="danger" disabled={cmd.busy()} onClick={safetyClear}>
                Clear everything
              </Button>
              {/* One line: what it clears, what it did, or why it didn't, so the header never changes height. */}
              <Switch
                fallback={
                  <p class="sub2">Clears injection, locks, transforms, rewrite rules, subscriptions, the clip and the status light</p>
                }
              >
                <Match when={cmd.error()}>
                  {(msg) => (
                    <p class="sub2 bad" role="alert">
                      {msg()}
                    </p>
                  )}
                </Match>
                <Match when={cleared()}>
                  <p class="sub2" role="status">
                    Sent.
                  </p>
                </Match>
              </Switch>
            </div>
          </Show>
        }
      />
      <Show
        when={full()}
        fallback={
          <Panels>
            <Show when={!dash.updateOnly()} fallback={<UpdateOnlyCard use="these controls" />}>
              <Panel id="controls" title="Your box" wide>
                <div aria-live="polite" class="boxstate">
                  <Switch>
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
                        <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                          Go to Update
                        </Button>
                      </div>
                    </Match>

                    <Match when={dash.status() === 'error' || dash.status() === 'disconnected' || dash.status() === 'lost'}>
                      <ConnectPanel />
                    </Match>
                  </Switch>
                </div>
              </Panel>
            </Show>
          </Panels>
        }
      >
        <PageTabs id="control" tabs={TABS}>
          <Pane key="injection">
            <DeviceInject />
          </Pane>
          <Pane key="locks">
            <DeviceLock />
          </Pane>
          <Pane key="transforms">
            <DeviceTransform />
          </Pane>
          <Pane key="catch">
            <DeviceEventCatch />
          </Pane>
          <Pane key="clips">
            <DeviceClip />
          </Pane>
          <Pane key="light">
            <DeviceLed />
          </Pane>
          <Pane key="advanced">
            <Panels>
              <Stack>
                <DeviceRewrite />
                <DevicePatch />
              </Stack>
              <Stack>
                <DeviceRaw />
                <DeviceTransfer />
              </Stack>
            </Panels>
          </Pane>
        </PageTabs>
      </Show>
    </>
  );
};

export default Control;
