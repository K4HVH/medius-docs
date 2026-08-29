import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { Slider } from '../../../components/inputs/Slider';
import { Chip } from '../../../components/display/Chip';
import { LedMode, LedTarget } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { createCommand } from './action';
import { chips, label, row } from './ui';

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
  // The box has no LED readback, so this is what was last accepted, not what the box holds.
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
      <div id="status-light" data-search-target>
        <Card>
          <CardHeader title="Status light" subtitle="The box's green LEDs" />
          <div style={label}>Which light</div>
          <RadioGroup
            name="led-target"
            value={target()}
            onChange={setTarget}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'device', label: 'PC side' },
              { value: 'host', label: 'Mouse side' },
            ]}
          />
          <div style={{ margin: 'var(--g-spacing) 0' }}>
            <div style={label}>Brightness</div>
            <Slider
              value={level()}
              onChange={(v) => {
                setLevel(Array.isArray(v) ? v[0] : v);
              }}
              min={0}
              max={255}
            />
          </div>
          <div style={row}>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Auto)}>Status</Button>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Off)}>Off</Button>
            <Button variant="primary" disabled={cmd.busy()} onClick={() => send(LedMode.Solid)}>On</Button>
            <Button variant="secondary" disabled={cmd.busy()} onClick={() => send(LedMode.Blink)}>Blink</Button>
          </div>
          <div aria-live="polite">
            <Show when={sent() !== null}>
              <div style={chips}>
                <Chip variant="neutral">Sent {MODE_LABEL[sent()!]}</Chip>
              </div>
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

export default DeviceLed;
