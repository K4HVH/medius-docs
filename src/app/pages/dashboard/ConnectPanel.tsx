import { Match, Show, Switch } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { versionString } from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { WiringPorts } from './PortDiagram';

// Shared by every page that gates on these two conditions.
export const BAD_BROWSER = "This browser can't talk to your box. Open this page in Chrome.";
export const BAD_CONTEXT = "This page isn't secure. Open it again from the link you were given.";

export const ConnectPanel = (props: { onSetup?: () => void }) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const setup = () => (props.onSetup ? props.onSetup() : navigate('/dashboard/setup'));
  const verdict = () => dash.verdict();
  const busy = () => dash.status() === 'connecting';

  // `force` asks for a device instead of reusing the remembered one; only the silent verdict can be
  // about the wrong device, so only its retry forces.
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

  // Callers mount this inside their own Card; the page-level copies in Device, Advanced and Setup
  // carry the card chrome.
  if (!dash.supported)
    return <div class="callout callout--warning" role="alert">{BAD_BROWSER}</div>;
  if (!dash.secure)
    return <div class="callout callout--warning" role="alert">{BAD_CONTEXT}</div>;

  return (
    <div aria-live="polite">
      {/* Above the switch: a flash or update failure has no verdict, and a stale verdict would hide
          it. Ungated on status: an update whose box never came back leaves 'disconnected'. */}
      <Show when={dash.error()}>
        {(msg) => (
          <div class="callout callout--danger" role="alert">
            {msg()}
          </div>
        )}
      </Show>
      <Switch>
        <Match when={!verdict()}>
          <WiringPorts />
          <Connect />
        </Match>

        <Match when={verdict()?.kind === 'unsupported'}>
          <div class="callout callout--warning" role="alert">{BAD_BROWSER}</div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'insecure'}>
          <div class="callout callout--warning" role="alert">{BAD_CONTEXT}</div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'no-port'}>
          <div class="callout callout--danger" role="alert">
            This computer can't see your box. Plug USB2 into it.
          </div>
          <WiringPorts />
          <div style={{ display: 'flex', gap: 'var(--g-spacing-sm)', 'flex-wrap': 'wrap' }}>
            <Connect label="Try again" />
            <NeverInstalled />
          </div>
        </Match>

        <Match when={verdict()?.kind === 'needs-click'}>
          <div class="callout callout--danger" role="alert">
            The browser needs one more click before it asks.
          </div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'busy'}>
          <div class="callout callout--danger" role="alert">
            Another tab has your box open. Close your other tabs.
          </div>
          <Connect label="Try again" />
        </Match>

        <Match when={verdict()?.kind === 'silent'}>
          <div class="callout callout--danger" role="alert">
            The box isn't answering. Check USB1 is plugged in too.
          </div>
          <WiringPorts />
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
                  <Show when={ver} fallback="This box is too old to update from here.">
                    {(x) => <>This box runs v{versionString(x())}, too old to update from here.</>}
                  </Show>{' '}
                  Set it up once over USB; after that it updates in one click.
                </div>
                <Button variant="primary" onClick={setup}>
                  Set up
                </Button>
              </>
            );
          })()}
        </Match>

        <Match when={verdict()?.kind === 'new-firmware'}>
          {(() => {
            const v = verdict();
            const ver = v?.kind === 'new-firmware' ? v.version : null;
            return (
              <>
                <div class="callout callout--danger" role="alert">
                  <Show when={ver} fallback="This box runs firmware newer than this dashboard.">
                    {(x) => <>This box runs v{versionString(x())}, newer than this dashboard.</>}
                  </Show>{' '}
                  Reload for the current dashboard, then connect.
                </div>
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Reload
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
                That didn't work. Unplug everything and plug it back in.
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
