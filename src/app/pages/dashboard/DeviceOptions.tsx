import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import type { ImperfectStatus } from '../../../dashboard/protocol';
import { useDashboard } from './context';

// One card for every persistent box option (saved on the device, survive a reboot). Each option is a
// labelled section here; the read-only summary on the Device tab mirrors the same values.
const sectionLabel = {
  color: 'var(--g-text-muted, #8a8a8a)',
  'font-size': 'var(--font-size-xs, 0.75rem)',
  'font-weight': '600',
  'letter-spacing': '0.05em',
  'text-transform': 'uppercase',
  margin: 'var(--g-spacing) 0 var(--g-spacing-sm)',
} as const;

const controls = {
  display: 'flex',
  gap: 'var(--g-spacing-sm)',
  'flex-wrap': 'wrap',
  'align-items': 'flex-end',
} as const;

const status = { 'margin-top': 'var(--g-spacing-sm)' } as const;

const DeviceOptions = () => {
  const dash = useDashboard();
  const [imperfect, setImperfect] = createSignal<ImperfectStatus | null>(null);
  const [ride, setRide] = createSignal<number | null>(null); // movement-riding window in ms, 0 = off
  const [draft, setDraft] = createSignal(20);

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

  const allowImperfect = async (allow: boolean) => {
    await dash.link()?.allowImperfectClones(allow);
    await refresh();
  };

  const setRiding = async (ms: number) => {
    await dash.link()?.setMovementRiding(ms);
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
        <CardHeader title="Options" subtitle="Persistent settings saved on the box" />

        <div style={sectionLabel}>Imperfect clone</div>
        <p>
          Some devices need more inputs than the box can copy (like the Wooting's analog stream), so the
          box refuses them by default. Allow it and the box clones the device anyway with one input
          dropped, then reboots to apply.
        </p>
        <div style={controls}>
          <Button variant="primary" onClick={() => void allowImperfect(true)}>
            Allow imperfect
          </Button>
          <Button variant="secondary" onClick={() => void allowImperfect(false)}>
            Faithful only
          </Button>
        </div>
        <Show when={imperfect()} fallback={<p style={status}>Reading status...</p>}>
          {(s) => (
            <div style={{ ...status, display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
              <Chip variant={s().allowed ? 'success' : 'neutral'}>
                {s().allowed ? 'Allowed' : 'Faithful only'}
              </Chip>
              <Show when={s().overCapacity}>
                <Chip variant="warning">Attached device needs an input the box can't copy</Chip>
              </Show>
            </div>
          )}
        </Show>

        <div style={sectionLabel}>Movement riding</div>
        <p>
          Injected motion only rides a real mouse move within the window and is dropped if no move
          arrives, so it keeps the hand's report timing. It can't move the cursor on its own while it's
          on. Off by default.
        </p>
        <div style={controls}>
          <div style={{ 'max-width': '8rem' }}>
            <NumberInput
              label="Window (ms)"
              value={draft()}
              min={1}
              max={65535}
              onChange={(v) => setDraft(v ?? 1)}
            />
          </div>
          <Button variant="primary" onClick={() => void setRiding(draft())}>
            Turn on
          </Button>
          <Button variant="secondary" onClick={() => void setRiding(0)}>
            Turn off
          </Button>
        </div>
        <Show when={ride() !== null} fallback={<p style={status}>Reading status...</p>}>
          <div style={status}>
            <Chip variant={ride()! > 0 ? 'success' : 'neutral'}>
              {ride()! > 0 ? `On · ${ride()} ms` : 'Off'}
            </Chip>
          </div>
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceOptions;
