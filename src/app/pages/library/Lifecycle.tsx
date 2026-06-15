import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lifecycle: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lifecycle" subtitle="Keeping held input alive and recovering a dropped link" />
        <p>
          If your program goes quiet, the box clears every injected button and pending move on
          its own so injected input can't get stuck (see{' '}
          <A href="/native/injection#safety">injection safety</A>). The library keeps a deliberate hold
          from tripping that clear, and restores your state if the link drops and reopens, via three
          mechanisms:
        </p>
        <ul>
          <li>
            <A href="/library/lifecycle#keepalive"><code>keepalive</code></A> — keeps a held override
            alive past the silence timeout.
          </li>
          <li>
            <A href="/library/lifecycle#reapply"><code>reapply</code></A> — re-sends the held
            overrides so the box matches the library.
          </li>
          <li>
            <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> — reopens the box and
            restores held state after a dropped link.
          </li>
        </ul>
        <table class="api-params">
          <thead>
            <tr>
              <th>Term</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <em>Override</em>
              </td>
              <td>
                The box holding a button down or up itself, set with{' '}
                <A href="/library/buttons"><code>press</code></A> or{' '}
                <A href="/library/buttons"><code>force_release</code></A>. The library keeps a copy
                so it can re-send them.
              </td>
            </tr>
            <tr>
              <td>
                <em>Injection</em>
              </td>
              <td>
                The movement, buttons, and scroll your program sends on top of the real mouse's
                input.
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div id="keepalive" data-search-target>
        <Card>
          <CardHeader title="keepalive" subtitle="Holding an override past the silence timeout" />

          <p>
            The box clears all injection if no valid frame arrives for its silence timeout. Any valid
            frame resets that timer, so holding a button past it means keeping the link busy.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Aspect</th>
                <th>Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Silence timeout</td>
                <td>
                  Firmware default <code>1000 ms</code> with no valid frame, then all injection
                  clears.
                </td>
              </tr>
              <tr>
                <td>Reset trigger</td>
                <td>Any valid frame resets the silence timer.</td>
              </tr>
              <tr>
                <td>Held override</td>
                <td>
                  A background thread sends a{' '}
                  <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> every{' '}
                  <code>500 ms</code>; the reply is ignored, the frame itself resets the timer.
                </td>
              </tr>
              <tr>
                <td>Idle</td>
                <td>The thread sends nothing.</td>
              </tr>
            </tbody>
          </table>

          <p>
            See <A href="/native/injection">injection</A> for the firmware-side ownership and
            auto-clear model.
          </p>
        </Card>
      </div>

      <div id="reapply" data-search-target>
        <Card>
          <CardHeader title="reapply" subtitle="Re-send the held overrides" />

          <pre class="api-signature">fn reapply(&self) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>
            Re-sends the currently held overrides so the box matches the library's state. A no-op when
            idle.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.reapply()?;`}</code></pre>
        </Card>
      </div>

      <div id="reconnect" data-search-target>
        <Card>
          <CardHeader title="reconnect" subtitle="Reopen the box and restore held state" />

          <pre class="api-signature">fn reconnect(&self) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>On each call:</p>
          <ol>
            <li>
              Rescans for the box by its USB identity, vendor ID <code>0x1A86</code> and product ID{' '}
              <code>0x55D3</code> (see <A href="/native/transport">Transport</A>).
            </li>
            <li>Reopens the port.</li>
            <li>
              Re-applies the held overrides, like{' '}
              <A href="/library/lifecycle#reapply"><code>reapply</code></A>.
            </li>
            <li>Bumps the reconnect counter.</li>
          </ol>
          <p>
            The reader thread also auto-reconnects on a dropped link with back-off, taking this same
            path.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.reconnect()?;`}</code></pre>

          <p>
            The reconnect count is visible in{' '}
            <A href="/library/diagnostics#counters">diagnostics</A>. Held state is keyed by the{' '}
            <A href="/library/types"><code>Button</code></A> values the overrides were set with, so the
            right buttons come back after a reopen.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Lifecycle;
