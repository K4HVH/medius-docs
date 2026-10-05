import { Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { PROTO_VER } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { row } from './ui';

// A box this page can update but not control: on an older protocol, or a newer one.
const UpdateOnlyCard = (props: { use: string }) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const proto = () => dash.version()?.protoVer ?? 0;
  return (
    <Show
      when={proto() > PROTO_VER}
      fallback={
        <div id="update-needed" data-search-target>
          <Card>
            <CardHeader title="Update needed" subtitle="This box speaks an older protocol" />
            <p>Update it to use {props.use}.</p>
            <Button variant="primary" onClick={() => navigate('/dashboard/update')}>
              Update
            </Button>
          </Card>
        </div>
      }
    >
      <div id="newer-firmware" data-search-target>
        <Card>
          <CardHeader title="Newer firmware" subtitle="This box speaks a newer protocol" />
          <p>
            This box speaks protocol {proto()} and this page protocol {PROTO_VER}. Reload to check for a newer
            page. It can still be flashed from Advanced.
          </p>
          <div style={row}>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard/advanced')}>
              Advanced
            </Button>
          </div>
        </Card>
      </div>
    </Show>
  );
};

export default UpdateOnlyCard;
