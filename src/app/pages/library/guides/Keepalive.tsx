import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Keepalive: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Keepalive & holds" subtitle="Holding injected input alive and recovering a dropped link" />
        <p>
          The box clears every injected button and pending move when no frame arrives for its silence
          window (see <A href="/native/injection#safety">injection safety</A>). The library holds a
          deliberate override past that clear, and restores state if the link drops and reopens.
        </p>
        <ul>
          <li>
            <A href="/library/guides/keepalive#keepalive"><code>keepalive</code></A> (automatic) holds an
            override past the silence timeout.
          </li>
          <li>
            <A href="/library/lifecycle#reapply"><code>reapply</code></A> re-sends the held overrides
            so the box matches the library.
          </li>
          <li>
            <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> rescans, reopens the
            port, and restores held state after a dropped link.
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
                <A href="/library/buttons"><code>force_release</code></A>. The library keeps a copy to
                re-send. A button with an override set is "held".
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
          <CardHeader title="keepalive" subtitle="An automatic thread that holds an override past the silence timeout" />

          <p>
            A background thread (<code>medius-keepalive</code>) runs for the life of the device; there's
            no <code>keepalive()</code> to call.
          </p>

          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <table class="api-params">
            <thead>
              <tr>
                <th>State</th>
                <th>Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Override held</td>
                <td>
                  Sends a <code>QUERY(HEALTH)</code> frame every{' '}
                  <code>DEFAULT_KEEPALIVE_CADENCE</code> (500 ms) and drops the reply.
                </td>
              </tr>
              <tr>
                <td>Idle</td>
                <td>No override held, so the thread sends nothing.</td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// Press a button, then do nothing. The keepalive thread holds it.
device.press(Button::Left)?;

// No further calls. The background thread sends QUERY(HEALTH) on its
// own, so the hold survives well past the 1000 ms silence window.
std::thread::sleep(std::time::Duration::from_secs(5));

device.reset()?;`}</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::DEFAULT_KEEPALIVE_CADENCE;

// The cadence is observable and read-only; there's no public setter.
println!("keepalive fires every {:?}", DEFAULT_KEEPALIVE_CADENCE);`}</code></pre>

          <div class="callout callout--info">
            <p>
              <code>DEFAULT_KEEPALIVE_CADENCE</code> is a read-only public constant, listed on{' '}
              <A href="/library/connection#zero-config">connection</A>. See{' '}
              <A href="/native/injection">injection</A> for the firmware-side ownership and
              auto-clear model.
            </p>
          </div>
        </Card>
      </div>

      <div id="release" data-search-target>
        <Card>
          <CardHeader title="Releasing the device" subtitle="Drop it; no close() call" />
          <p>
            No <code>close</code> method: the last{' '}
            <A href="/library/guides/threading#threading"><code>Arc</code>-backed handle</A>'s{' '}
            <a href="https://doc.rust-lang.org/std/ops/trait.Drop.html" target="_blank" rel="noreferrer"><code>Drop</code></a>{' '}
            tears the connection down.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Step</th><th>What drop does</th></tr>
            </thead>
            <tbody>
              <tr><td>Signal</td><td>Sets the stop flag the reader and keepalive threads watch.</td></tr>
              <tr><td>Join</td><td>Waits for both threads to exit, so none are left running.</td></tr>
              <tr><td>Close</td><td>Releases the serial port as the transport drops.</td></tr>
            </tbody>
          </table>
          <p>
            For immediate hand-off call{' '}
            <A href="/library/admin#reset"><code>reset</code></A> before drop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// hand the mouse back right now, not a second from now:
device.reset()?;   // box returns to passthrough immediately
drop(device);      // tears down threads and closes the port`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Keepalive;
