import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Chip } from '../../../components/display/Chip';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { useDashboard } from './context';

const DeviceMovementRiding = () => {
  const dash = useDashboard();
  const [windowMs, setWindowMs] = createSignal<number | null>(null);
  const [draft, setDraft] = createSignal(20);

  const refresh = async () => {
    try {
      const ms = await dash.link()?.queryMovementRiding();
      if (ms !== undefined) setWindowMs(ms);
    } catch {
      // A transient miss is fine; the next refresh tries again.
    }
  };

  const set = async (ms: number) => {
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
        <CardHeader title="Movement riding" subtitle="Inject motion only when the real mouse moves" />
        <p style={{ color: 'var(--g-text-muted, #8a8a8a)' }}>
          With it on, injected cursor and wheel motion rides a real move inside the window, so it
          looks like the mouse. Motion that doesn't catch a move in time is dropped. Idle injection
          (moving while you hold still) stops working while it's on. Off by default.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 'var(--g-spacing-sm)',
            'flex-wrap': 'wrap',
            'align-items': 'flex-end',
          }}
        >
          <div style={{ 'max-width': '8rem' }}>
            <NumberInput
              label="Window (ms)"
              value={draft()}
              min={1}
              max={65535}
              onChange={(v) => setDraft(v ?? 1)}
            />
          </div>
          <Button variant="primary" onClick={() => void set(draft())}>Turn on</Button>
          <Button variant="secondary" onClick={() => void set(0)}>Turn off</Button>
        </div>
        <Show
          when={windowMs() !== null}
          fallback={<p style={{ 'margin-top': 'var(--g-spacing)' }}>Reading status...</p>}
        >
          <div style={{ 'margin-top': 'var(--g-spacing)' }}>
            <Chip variant={windowMs()! > 0 ? 'success' : 'neutral'}>
              {windowMs()! > 0 ? `Riding, ${windowMs()} ms window` : 'Off'}
            </Chip>
          </div>
        </Show>
      </Card>
    </Show>
  );
};

export default DeviceMovementRiding;
