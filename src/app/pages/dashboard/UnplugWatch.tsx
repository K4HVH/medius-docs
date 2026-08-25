import { Match, Switch, createEffect, createSignal, onCleanup } from 'solid-js';
import { Progress } from '../../../components/feedback/Progress';
import { Button } from '../../../components/inputs/Button';
import { PortDiagram } from './PortDiagram';

// The gate before any native flash. The browser fires a serial `disconnect` when the box's USB2
// device is removed, but it CANNOT see USB1 (the HID clone) at all. So: watch for the disconnect,
// hold the waiting screen a beat, then have the user confirm USB1 is out too.
const DELAY_MS = 1500;

export const UnplugWatch = (props: { onUnplugged: () => void }) => {
  const [phase, setPhase] = createSignal<'waiting' | 'confirm'>('waiting');
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
        <PortDiagram out={['usb1', 'usb2', 'usb3']} />
        <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--g-spacing-sm)' }}>
          <Progress type="circular" size="sm" />
          <span style={{ color: 'var(--g-text-secondary)' }}>Waiting for the box to disconnect...</span>
        </div>
        <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
          <Button variant="primary" onClick={() => setPhase('confirm')}>
            They're all unplugged
          </Button>
        </div>
      </Match>

      <Match when={phase() === 'confirm'}>
        <p><strong>Check USB1 as well. The browser cannot see that one.</strong></p>
        <PortDiagram out={['usb1', 'usb2', 'usb3']} />
        <div class="callout callout--danger">
          USB1 and USB3 plugged into the same computer at once can kill it.
        </div>
        <Button variant="primary" onClick={() => props.onUnplugged()}>
          Every cable is unplugged
        </Button>
      </Match>
    </Switch>
  );
};
