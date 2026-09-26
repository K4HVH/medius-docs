import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { createCommand } from './action';

const DeviceFactoryReset = () => {
  const dash = useDashboard();
  const [done, setDone] = createSignal(false);
  const cmd = createCommand();

  const factoryReset = () => {
    setDone(false);
    cmd.run(async () => {
      await dash.link()!.factoryReset();
      setDone(true);
      setTimeout(() => setDone(false), 6000);
    });
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="factory-reset" data-search-target>
        <Card>
          <CardHeader title="Factory reset" subtitle="Erase everything saved" />
          <p>
            Clears the box name, every option above and everything learned about devices, then
            restarts. The box stops responding for a moment.
          </p>
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Button variant="danger" disabled={cmd.busy()} onClick={factoryReset}>
              Erase and restart
            </Button>
          </div>
          <div aria-live="polite">
            <Show when={done()}>
              <p>Sent.</p>
            </Show>
            <Show when={cmd.error()}>
              <div class="callout callout--danger" role="alert">{cmd.error()}</div>
            </Show>
          </div>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceFactoryReset;
