// The advanced control layer: the two tables the box stores beside the two one-shot wire operations.
//
// Rewrite rules and raw reports are dropped while imperfect clones are off and a control transfer is
// refused, but a descriptor patch is stored either way and only applied under the opt-in. Each card
// says which of those it is, so the tab carries no banner of its own.

import { Match, Show, Switch } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { ConnectPanel } from './ConnectPanel';
import DeviceRewrite from './DeviceRewrite';
import DevicePatch from './DevicePatch';
import DeviceRaw from './DeviceRaw';
import DeviceTransfer from './DeviceTransfer';
import { col, columns } from './ui';
import '../../../styles/docs.css';

const DeviceDeveloper = () => {
  const dash = useDashboard();
  const navigate = useNavigate();

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
                <p>Update it to use the advanced control layer.</p>
                <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
                  Update
                </Button>
              </Card>
            </div>
          }
        >
          <div id="advanced-control-layer" data-search-target>
            <Card>
              <CardHeader
                title="Advanced control layer"
                subtitle="Rewrite rules, descriptor patches, and raw injection"
              />
              <div aria-live="polite">
                <Switch>
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
        </Show>
      }
    >
      <div style={columns}>
        <div style={col}>
          <DeviceRewrite />
          <DevicePatch />
        </div>
        <div style={col}>
          <DeviceRaw />
          <DeviceTransfer />
        </div>
      </div>
    </Show>
  );
};

export default DeviceDeveloper;
