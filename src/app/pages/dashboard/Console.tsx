import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import '../../../styles/docs.css';

const Console = () => {
  const dash = useDashboard();

  return (
    <Card>
      <CardHeader title="Device log" subtitle="Live diagnostics from the box" />
      <Show
        when={dash.status() === 'connected' || dash.deviceLog().length > 0}
        fallback={
          <p>
            Connect to your box on the <A href="/dashboard">Device</A> tab. Diagnostic LOG messages
            from the firmware appear here while you're connected.
          </p>
        }
      >
        <div style={{ 'margin-bottom': 'var(--g-spacing-sm)' }}>
          <Button variant="subtle" size="compact" onClick={() => dash.clearDeviceLog()}>
            Clear
          </Button>
        </div>
        <pre
          class="diagram"
          style={{ 'max-height': '420px', overflow: 'auto', 'white-space': 'pre-wrap' }}
        >
          <Show when={dash.deviceLog().length > 0} fallback="(no messages yet)">
            {dash.deviceLog().join('\n')}
          </Show>
        </pre>
      </Show>
    </Card>
  );
};

export default Console;
