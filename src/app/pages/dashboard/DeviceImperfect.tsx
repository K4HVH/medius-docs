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
        <CardHeader title="Imperfect clone" subtitle="Clone an over-capacity device anyway" />
        <p style={{ color: 'var(--g-text-muted, #8a8a8a)' }}>
          Refused by default. Allow it and the box clones it with one input dropped, then reboots to apply.
        </p>
        <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
          <Button variant="primary" onClick={() => void set(true)}>Allow imperfect</Button>
          <Button variant="secondary" onClick={() => void set(false)}>Faithful only</Button>
        </div>
        <Show when={status()} fallback={<p style={{ 'margin-top': 'var(--g-spacing)' }}>Reading status...</p>}>
          {(s) => (
            <div style={{ 'margin-top': 'var(--g-spacing)' }}>
              <Chip variant={s().allowed ? 'success' : 'neutral'}>
                {s().allowed ? 'Imperfect clones allowed' : 'Faithful only'}
              </Chip>
            </div>
          )}
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceImperfect;
