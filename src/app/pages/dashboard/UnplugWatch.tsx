import { createEffect, onCleanup } from 'solid-js';
import { Progress } from '../../../components/feedback/Progress';
import { Button } from '../../../components/inputs/Button';

// Make the user physically unplug everything before a mouse-side (USB3) flash,
// and confirm it: the browser fires a serial `disconnect` when the box's USB
// device is removed. Only then does the caller let them proceed.
export const UnplugWatch = (props: { onUnplugged: () => void }) => {
  createEffect(() => {
    const handler = () => props.onUnplugged();
    navigator.serial?.addEventListener('disconnect', handler);
    onCleanup(() => navigator.serial?.removeEventListener('disconnect', handler));
  });

  return (
    <div>
      <p><strong>Unplug every cable from the box.</strong></p>
      <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--g-spacing-sm)' }}>
        <Progress type="circular" size="sm" />
        <span style={{ color: 'var(--g-text-secondary)' }}>Waiting for the box to disconnect...</span>
      </div>
      <div style={{ 'margin-top': 'var(--g-spacing-sm)' }}>
        <Button variant="subtle" size="compact" onClick={() => props.onUnplugged()}>
          Nothing is plugged in
        </Button>
      </div>
    </div>
  );
};
