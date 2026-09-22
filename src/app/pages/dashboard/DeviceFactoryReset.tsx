import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { createCommand } from './action';

// The other half of the Options card: one control that puts every persistent setting, and everything
// the box has learned about the devices it has seen, back to how a new box leaves the factory.
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
          <CardHeader title="Factory reset" subtitle="Erase everything saved on the box" />
          <p>
            Clears the box name, every option above, and everything the box has learned about the
            devices it has seen, then restarts it. It stops responding for a moment while it
            restarts.
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
