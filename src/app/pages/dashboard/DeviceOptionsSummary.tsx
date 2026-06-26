import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Chip } from '../../../components/display/Chip';
import type { ImperfectStatus } from '../../../dashboard/protocol';
import { useDashboard } from './context';

// Read-only view of the persistent box options for the Device tab; set them on the Control tab.
const muted = { color: 'var(--g-text-muted, #8a8a8a)' } as const;
const field = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: 'var(--g-spacing)',
  padding: '6px 0',
} as const;

const DeviceOptionsSummary = () => {
  const dash = useDashboard();
  const [imperfect, setImperfect] = createSignal<ImperfectStatus | null>(null);
  const [ride, setRide] = createSignal<number | null>(null); // movement-riding window in ms, 0 = off

  const refresh = async () => {
    try {
      const link = dash.link();
      if (!link) return;
      setImperfect(await link.queryImperfect());
      setRide(await link.queryMovementRiding());
    } catch {
      // A transient miss is fine; the next refresh tries again.
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    void refresh();
    timer = setInterval(() => void refresh(), 2000);
  });
  onCleanup(() => {
    if (timer !== null) clearInterval(timer);
  });

  return (
    <Card>
      <CardHeader title="Options" subtitle="Persistent settings, set on the Control tab" />
      <div style={field}>
        <span style={muted}>Imperfect clone</span>
        <Show when={imperfect()} fallback={<span style={muted}>—</span>}>
          {(s) => (
            <Chip variant={s().allowed ? 'success' : 'neutral'}>
              {s().allowed ? 'Allowed' : 'Faithful only'}
            </Chip>
          )}
        </Show>
      </div>
      <div style={field}>
        <span style={muted}>Movement riding</span>
        <Show when={ride() !== null} fallback={<span style={muted}>—</span>}>
          <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
            {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
          </Chip>
        </Show>
      </div>
    </Card>
  );
};

export default DeviceOptionsSummary;
