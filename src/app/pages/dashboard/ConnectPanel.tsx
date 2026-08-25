import { Match, Show, Switch } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { PortDiagram, type PortId } from './PortDiagram';

// Connect, and after a failure the one thing to do about it. Every page that offers Connect renders
// this, so the answer to "why won't it connect" is written once. `where` renames the ports for a
// caller that knows which machine is which, which the end of the setup wizard does.
export const ConnectPanel = (props: {
  onSetup?: () => void;
  where?: Partial<Record<PortId, string>>;
}) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const setup = () => (props.onSetup ? props.onSetup() : navigate('/dashboard/setup'));
  const verdict = () => dash.verdict();
  const busy = () => dash.status() === 'connecting';

  const Connect = (p: { label?: string }) => (
    <Button
      variant="primary"
      loading={busy()}
      disabled={!dash.supported || busy()}
      onClick={() => void dash.connect()}
    >
      {busy() ? 'Connecting...' : (p.label ?? 'Connect')}
    </Button>
  );

  const NeverInstalled = () => (
    <Button variant="subtle" size="compact" onClick={setup}>
      Never installed it?
    </Button>
  );

  return (
    <div aria-live="polite">
      <Switch>
        <Match when={!verdict()}>
          <p>Plug in like this.</p>
          <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} where={props.where} />
          <Connect />
        </Match>

        <Match when={verdict()?.kind === 'unsupported'}>
          <div class="callout callout--warning" role="alert">
            This browser can't reach USB devices. Open this page in Chrome, Edge or Opera.
          </div>
        </Match>

        <Match when={verdict()?.kind === 'insecure'}>
          <div class="callout callout--warning" role="alert">
            Open this page over https, or on localhost.
          </div>
        </Match>

        <Match when={verdict()?.kind === 'no-port'}>
          <div class="callout callout--danger" role="alert">
            USB2 is not plugged into this computer.
          </div>
          <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} where={props.where} />
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Connect label="Try again" />
            <NeverInstalled />
          </div>
        </Match>

        <Match when={verdict()?.kind === 'busy'}>
          <div class="callout callout--danger" role="alert">
            Something else on this computer is using the box. Close it, then try again.
          </div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'silent'}>
          <div class="callout callout--danger" role="alert">
            The box is not answering. Plug USB1 in as well.
          </div>
          <PortDiagram plug={['usb1', 'usb2']} mouse={['usb3']} where={props.where} />
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Connect label="Try again" />
            <NeverInstalled />
          </div>
        </Match>

        <Match when={verdict()?.kind === 'old-firmware'}>
          {(() => {
            const v = verdict();
            const ver = v?.kind === 'old-firmware' ? v.version : null;
            return (
              <>
                <div class="callout callout--danger" role="alert">
                  <Show when={ver} fallback="This box is too old for one-click updates.">
                    {(x) => <>This box runs v{versionString(x())}, which is too old for one-click updates.</>}
                  </Show>{' '}
                  Set it up once over USB and it will update in one click from then on.
                </div>
                <Button variant="primary" onClick={setup}>
                  Set up
                </Button>
              </>
            );
          })()}
        </Match>

        <Match when={verdict()?.kind === 'other'}>
          {(() => {
            const v = verdict();
            return (
              <div class="callout callout--danger" role="alert">
                {v?.kind === 'other' ? v.message : ''}
              </div>
            );
          })()}
          <Connect label="Try again" />
        </Match>
      </Switch>
    </div>
  );
};
