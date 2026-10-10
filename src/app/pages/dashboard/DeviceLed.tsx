import { Show, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { Range } from '../../shell/Range';
import { Chip } from '../../../components/display/Chip';
import { LedMode, LedTarget } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { Panel, Panels } from '../../shell/Panel';
import { Segmented } from '../../shell/Segmented';

const TARGETS: Record<string, LedTarget> = {
  both: LedTarget.Both,
  device: LedTarget.Device,
  host: LedTarget.Host,
};

const MODE_LABEL: Record<number, string> = {
  [LedMode.Auto]: 'Status',
  [LedMode.Off]: 'Off',
  [LedMode.Solid]: 'On',
  [LedMode.Blink]: 'Blink',
};

const DeviceLed = () => {
  const dash = useDashboard();
  const [target, setTarget] = createSignal('both');
  const [level, setLevel] = createSignal(255);
  // No LED readback: this is the last mode the box accepted.
  const [sent, setSent] = createSignal<LedMode | null>(null);
  const cmd = createCommand();

  const send = (mode: LedMode) => {
    cmd.run(async () => {
      await dash.link()!.led(TARGETS[target()], mode, level());
      setSent(mode);
    });
  };

  return (
    <Show when={dash.status() === 'connected'}>
      <Panels>
        <Panel id="status-light" wide>
          <div class="labelled">
            <span class="field-l">Light</span>
            <Segmented
              name="led-target"
              label="Light"
              value={target()}
              onChange={setTarget}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'device', label: 'Main chip' },
                { value: 'host', label: 'Mouse-side chip' },
              ]}
            />
          </div>
          <div class="labelled">
            <span class="field-l">Brightness</span>
            <Range label="Brightness" value={level()} onChange={setLevel} min={0} max={255} />
          </div>
          <div class="acts mid">
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Auto)}>Status</Button>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Off)}>Off</Button>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Solid)}>On</Button>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Blink)}>Blink</Button>
          </div>
          <div aria-live="polite" class="step">
            <Show when={sent() !== null}>
              <div class="chips">
                <Chip variant="neutral">Sent {MODE_LABEL[sent()!]}</Chip>
              </div>
            </Show>
            <Show when={cmd.error()}>
              <div class="callout callout--danger" role="alert">{cmd.error()}</div>
            </Show>
          </div>
        </Panel>
      </Panels>
    </Show>
  );
};

export default DeviceLed;
