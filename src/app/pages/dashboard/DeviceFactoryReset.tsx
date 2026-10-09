import { Show, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Panel } from '../../shell/Panel';

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
      <Panel id="factory-reset" title="Factory reset">
        <p>Clears the box name, every option on this tab and everything learned about devices, then restarts.</p>
        <div class="acts">
          <Button variant="danger" disabled={cmd.busy()} onClick={factoryReset}>
            Erase and restart
          </Button>
        </div>
        <div aria-live="polite">
          <Show when={done()}>
            <p class="mut">Sent.</p>
          </Show>
          <Show when={cmd.error()}>
            <div class="callout callout--danger" role="alert">{cmd.error()}</div>
          </Show>
        </div>
      </Panel>
    </Show>
  );
};

export default DeviceFactoryReset;
