import { Match, Show, Switch } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button } from '../../../components/inputs/Button';
import { versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { PortDiagram, type PortId } from './PortDiagram';

// Connect, and after a failure the one thing to do about it. Every page that offers Connect renders
// this, so the answer to "why won't it connect" is written once. `where` renames the ports for a
// caller that knows which machine is which, which the end of the setup wizard does.
// One wording for the two conditions that end the page before it starts, shared with every page
// that gates on them, so the same problem is never described three ways.
export const BAD_BROWSER = "This browser can't talk to your box. Open this page in Chrome.";
export const BAD_CONTEXT = "This page isn't secure. Open it again from the link you were given.";

export const ConnectPanel = (props: {
  onSetup?: () => void;
  plug?: PortId[];
  other?: PortId[];
  where?: Partial<Record<PortId, string>>;
}) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const setup = () => (props.onSetup ? props.onSetup() : navigate('/dashboard/setup'));
  const verdict = () => dash.verdict();
  const busy = () => dash.status() === 'connecting';

  // `force` asks which device to use instead of reusing one the browser remembers. The silent
  // verdict is the one that can be about the wrong device, so its retry is the escape from it.
  const Connect = (p: { label?: string; force?: boolean }) => (
    <Button
      variant="primary"
      loading={busy()}
      disabled={!dash.supported || busy()}
      onClick={() => void dash.connect(p.force)}
    >
      {busy() ? 'Connecting...' : (p.label ?? 'Connect')}
    </Button>
  );

  const NeverInstalled = () => (
    <Button variant="subtle" size="compact" onClick={setup}>
      Set up a new box
    </Button>
  );

  if (!dash.supported) return <div class="callout callout--warning">{BAD_BROWSER}</div>;
  if (!dash.secure) return <div class="callout callout--warning">{BAD_CONTEXT}</div>;

  return (
    <div aria-live="polite">
      {/* Above the switch, not inside one arm: a flash failure has no verdict of its own, and a
          verdict left over from an earlier connect used to hide it entirely. */}
      <Show when={dash.status() === 'error' && dash.error()}>
        {(msg) => (
          <div class="callout callout--danger" role="alert">
            {msg()}
          </div>
        )}
      </Show>
      <Switch>
        <Match when={!verdict()}>
          <p>Plug in like this.</p>
          <PortDiagram
            plug={props.plug ?? ['usb1', 'usb2']}
            other={props.other}
            mouse={['usb3']}
            where={props.where}
          />
          <Connect />
        </Match>

        <Match when={verdict()?.kind === 'unsupported'}>
          <div class="callout callout--warning" role="alert">{BAD_BROWSER}</div>
        </Match>

        <Match when={verdict()?.kind === 'insecure'}>
          <div class="callout callout--warning" role="alert">{BAD_CONTEXT}</div>
        </Match>

        <Match when={verdict()?.kind === 'no-port'}>
          <div class="callout callout--danger" role="alert">
            This computer can't see your box. Plug USB2 into it, then press Try again.
          </div>
          <PortDiagram
            plug={props.plug ?? ['usb1', 'usb2']}
            other={props.other}
            mouse={['usb3']}
            where={props.where}
          />
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Connect label="Try again" />
            <NeverInstalled />
          </div>
        </Match>

        <Match when={verdict()?.kind === 'needs-click'}>
          <div class="callout callout--danger" role="alert">
            The browser wants one more click before it will ask. Press Try again.
          </div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'busy'}>
          <div class="callout callout--danger" role="alert">
            Another tab has your box open. Close your other tabs, then press Try again.
          </div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'silent'}>
          <div class="callout callout--danger" role="alert">
            The box is not answering. Check USB1 is plugged in too, then press Try again.
          </div>
          <PortDiagram
            plug={props.plug ?? ['usb1', 'usb2']}
            other={props.other}
            mouse={['usb3']}
            where={props.where}
          />
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Connect label="Try again" force />
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
                That didn't work. Unplug everything, plug it back in, then press Try again.
                <div style={{ 'margin-top': '6px', 'font-size': '0.85em', opacity: '0.75' }}>
                  {v?.kind === 'other' ? v.message : ''}
                </div>
              </div>
            );
          })()}
          <Connect label="Try again" />
        </Match>
      </Switch>
    </div>
  );
};
