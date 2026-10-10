import { Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { PROTO_VER } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { Panel } from '../../shell/Panel';

// A box this page can update but not control: on an older protocol, or a newer one.
const UpdateOnlyCard = (props: { use: string }) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const proto = () => dash.version()?.protoVer ?? 0;
  return (
    <Show
      when={proto() > PROTO_VER}
      fallback={
        <Panel id="update-needed" title="Update needed" wide transient>
          <p>This box speaks an older protocol. Update it to use {props.use}.</p>
          <div class="acts">
            <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
              Update
            </Button>
          </div>
        </Panel>
      }
    >
      <Panel id="newer-firmware" title="Newer firmware" wide transient>
        <p>
          This box speaks protocol {proto()} and this page protocol {PROTO_VER}. Reload to check for a newer page. It
          can still be flashed by hand, on Update's Manual tab.
        </p>
        <div class="acts">
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button variant="secondary" onClick={() => navigate('/dashboard/update#manual')}>
            Manual flash
          </Button>
        </div>
      </Panel>
    </Show>
  );
};

export default UpdateOnlyCard;
