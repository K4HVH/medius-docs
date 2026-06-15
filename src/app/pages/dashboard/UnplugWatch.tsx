import { Match, Switch, createEffect, createSignal, onCleanup } from 'solid-js';
import { Progress } from '../../../components/feedback/Progress';
import { Button } from '../../../components/inputs/Button';

// Gate before a mouse-side (USB3) flash. The browser fires a serial `disconnect`
// when the box's USB2 device is removed, but it CANNOT see USB1 (the HID clone).
// So: watch for the disconnect, hold the waiting screen a beat, then make the user
// confirm USB1 is out too (USB1 + USB3 together can shut the machine down).
const DELAY_MS = 1500;

export const UnplugWatch = (props: { onUnplugged: () => void }) => {
  const [phase, setPhase] = createSignal<'waiting' | 'confirm'>('waiting');
  const [ack, setAck] = createSignal(false);
  let scheduled = false;

  createEffect(() => {
    if (phase() !== 'waiting') return;
    const handler = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => setPhase('confirm'), DELAY_MS);
    };
    navigator.serial?.addEventListener('disconnect', handler);
    onCleanup(() => navigator.serial?.removeEventListener('disconnect', handler));
  });

  return (
    <Switch>
      <Match when={phase() === 'waiting'}>
        <p><strong>Unplug every cable from the box.</strong></p>
        <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--g-spacing-sm)' }}>
          <Progress type="circular" size="sm" />
          <span style={{ color: 'var(--g-text-secondary)' }}>Waiting for the box to disconnect...</span>
        </div>
        <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
          <Button variant="subtle" size="compact" onClick={() => setPhase('confirm')}>
            Nothing is plugged in
          </Button>
        </div>
      </Match>

      <Match when={phase() === 'confirm'}>
        <div class="callout callout--danger">
          <p><strong>Make sure every cable is out, including USB1.</strong></p>
          <p>The browser can't see the USB1 (game PC) port, so check it yourself. USB1 and USB3 plugged into the same PC can shut it down.</p>
        </div>
        <label style={{ display: 'flex', 'align-items': 'center', gap: 'var(--g-spacing-sm)' }}>
          <input type="checkbox" checked={ack()} onChange={(e) => setAck(e.currentTarget.checked)} />
          Every cable is unplugged, including USB1.
        </label>
        <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
          <Button variant="primary" disabled={!ack()} onClick={() => props.onUnplugged()}>
            Continue
          </Button>
        </div>
      </Match>
    </Switch>
  );
};
