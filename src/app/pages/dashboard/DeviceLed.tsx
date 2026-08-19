import { Show, createSignal } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { RadioGroup } from '../../../components/inputs/RadioGroup';
import { Slider } from '../../../components/inputs/Slider';
import { LedMode, LedTarget } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { label, row } from './ui';

const TARGETS: Record<string, LedTarget> = {
  both: LedTarget.Both,
  device: LedTarget.Device,
  host: LedTarget.Host,
};

const DeviceLed = () => {
  const dash = useDashboard();
  const [target, setTarget] = createSignal('both');
  const [level, setLevel] = createSignal(255);

  const send = (mode: LedMode) => {
    void dash.link()?.led(TARGETS[target()], mode, level());
  };

  return (
    <Show when={dash.status() === 'connected'}>
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
          <Button variant="secondary" onClick={() => send(LedMode.Auto)}>Status</Button>
          <Button variant="secondary" onClick={() => send(LedMode.Off)}>Off</Button>
          <Button variant="primary" onClick={() => send(LedMode.Solid)}>On</Button>
          <Button variant="primary" onClick={() => send(LedMode.Blink)}>Blink</Button>
        </div>
      </Card>
    </Show>
  );
};

export default DeviceLed;
