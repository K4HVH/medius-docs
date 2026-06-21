import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import DeviceLed from './DeviceLed';
import '../../../styles/docs.css';

const col = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--g-spacing)',
  'max-width': '720px',
} as const;

// Controls that drive the box to test it. Starts with the status lights; more
// test controls land here as they ship.
const Control = () => {
  const dash = useDashboard();

  return (
    <div style={col}>
      <Show
        when={dash.status() === 'connected'}
        fallback={
          <Card>
            <CardHeader title="Controls" subtitle="Drive the box to test it" />
            <p>
              Connect to your box on the <A href="/dashboard">Device</A> page, then come back here to
              drive its lights and other test controls.
            </p>
            <Button variant="primary" disabled={!dash.supported} onClick={() => void dash.connect()}>
              Connect
            </Button>
          </Card>
        }
      >
        <DeviceLed />
      </Show>
    </div>
  );
};

export default Control;
