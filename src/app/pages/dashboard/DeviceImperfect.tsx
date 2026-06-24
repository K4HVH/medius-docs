import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import type { ImperfectStatus } from '../../../dashboard/protocol';
import { useDashboard } from './context';

const DeviceImperfect = () => {
  const dash = useDashboard();
  const [status, setStatus] = createSignal<ImperfectStatus | null>(null);

  const refresh = async () => {
    try {
      const s = await dash.link()?.queryImperfect();
      if (s) setStatus(s);
    } catch {
      // A transient miss is fine; the next refresh tries again.
    }
  };

  const set = async (allow: boolean) => {
    await dash.link()?.allowImperfectClones(allow);
    await refresh();
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    void refresh();
    timer = setInterval(() => void refresh(), 1000);
  });
  onCleanup(() => {
    if (timer !== null) clearInterval(timer);
  });

  return (
    <Show when={dash.status() === 'connected'}>
      <Card>
        <CardHeader title="Imperfect clone" subtitle="Clone a device the box can't fully fit" />
        <p>
          Some devices need more interrupt-IN endpoints than the box has. By default the box refuses
          them rather than show a broken clone. Allow imperfect cloning and it clones the device anyway,
          with the one over-capacity interface dead. Re-plug the device for a change to take effect.
        </p>
        <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
          <Button variant="primary" onClick={() => void set(true)}>Allow imperfect</Button>
          <Button variant="secondary" onClick={() => void set(false)}>Faithful only</Button>
        </div>
        <Show when={status()} fallback={<p style={{ 'margin-top': 'var(--g-spacing)' }}>Reading status...</p>}>
          {(s) => (
            <div
              style={{
                display: 'flex',
                'flex-wrap': 'wrap',
                gap: 'var(--g-spacing-sm)',
                'margin-top': 'var(--g-spacing)',
              }}
            >
              <Chip variant={s().allowed ? 'success' : 'neutral'}>
                {s().allowed ? 'Imperfect allowed' : 'Faithful only'}
              </Chip>
              <Chip variant={s().overCapacity ? 'warning' : 'neutral'}>
                {s().overCapacity ? 'Device over-capacity' : 'Device fits'}
              </Chip>
              <Chip variant={s().cloneImperfect ? 'warning' : 'neutral'}>
                {s().cloneImperfect ? 'Clone imperfect' : 'Clone faithful'}
              </Chip>
            </div>
          )}
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceImperfect;
