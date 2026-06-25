import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { A } from '@solidjs/router';
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
          Some devices have more inputs than the box can copy. By default the box refuses them rather than
          show a half-working clone. Allow imperfect cloning and it clones the device anyway, with the one
          extra input left off. The box reboots itself to apply the change — no re-plug needed. Whether
          the attached device actually needs this shows on the <A href="/dashboard">Device</A> page.
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
