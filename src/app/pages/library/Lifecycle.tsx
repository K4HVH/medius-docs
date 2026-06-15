import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lifecycle: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lifecycle" subtitle="Holding injected input alive and recovering a dropped link" />
        <p>
          The box clears every injected button and pending move when no frame arrives for its silence
          window (see <A href="/native/injection#safety">injection safety</A>). The library holds a
          deliberate override past that clear, and restores state if the link drops and reopens.
        </p>
        <ul>
          <li>
            <A href="/library/lifecycle#keepalive"><code>keepalive</code></A> (automatic) holds an
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

        <pre><code>cargo add medius</code></pre>

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

      <div id="reapply" data-search-target>
        <Card>
          <CardHeader title="reapply" subtitle="Re-send the held overrides so the box matches the library" />

          <pre class="api-signature">fn reapply(&self) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>
            Re-sends each held override to match the box to the library;{' '}
            <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> does this for you after a
            drop.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device};

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    device.press(Button::Left)?;

    // Re-assert the held override; useful if the box reset under you.
    device.reapply()?;

    device.reset()?;
    Ok(())
}`}</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// The no-op case: reset clears every override, so reapply sends nothing.
device.reset()?;
device.reapply()?; // does nothing, no buttons are held`}</code></pre>

          <div class="callout callout--info">
            <p>
              Overrides are keyed by their{' '}
              <A href="/library/types/enums#button"><code>Button</code></A> values.{' '}
              <A href="/library/buttons"><code>press</code></A> and{' '}
              <A href="/library/buttons"><code>force_release</code></A> add a held override;{' '}
              <A href="/library/buttons"><code>soft_release</code></A> and{' '}
              <A href="/library/admin#reset"><code>reset</code></A> clear them.
            </p>
          </div>
        </Card>
      </div>

      <div id="reconnect" data-search-target>
        <Card>
          <CardHeader title="reconnect" subtitle="Rescan, reopen the port, and restore held state" />

          <pre class="api-signature">fn reconnect(&self) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>
            The reader thread auto-reconnects on any read error; call this by hand only to force a
            rescan.
          </p>
          <p>On each call:</p>
          <ol>
            <li>
              Rescans for the box by its USB identity, vendor ID <code>0x1A86</code> and product ID{' '}
              <code>0x55D3</code> (see <A href="/native/transport">Transport</A>).
            </li>
            <li>Reopens the port.</li>
            <li>
              Re-applies the held overrides, the same work as{' '}
              <A href="/library/lifecycle#reapply"><code>reapply</code></A>.
            </li>
            <li>Bumps the reconnect counter.</li>
          </ol>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// After a known unplug and replug, force a rescan and confirm it took.
let before = device.counters().reconnects;
device.reconnect()?;
let after = device.counters().reconnects;
assert!(after > before);`}</code></pre>

          <div class="callout callout--info">
            <p>
              The reconnect count is the <code>reconnects</code> field in{' '}
              <A href="/library/diagnostics#counters">diagnostics</A>. Held state is keyed by{' '}
              <A href="/library/types/enums#button"><code>Button</code></A> value, so the right buttons come
              back after a reopen.
            </p>
          </div>
        </Card>
      </div>

      <div id="from-async" data-search-target>
        <Card>
          <CardHeader title="From async code" subtitle="These methods live on Device, not AsyncDevice" />

          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <p>
            <code>reapply</code> and <code>reconnect</code> live on <code>Device</code> only, not{' '}
            <A href="/library/features/async"><code>AsyncDevice</code></A>; convert with{' '}
            <code>into_inner</code> first.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::AsyncDevice;

let async_dev = AsyncDevice::open("/dev/ttyACM0")?;

// reapply and reconnect aren't on AsyncDevice; drop back to Device.
let device = async_dev.into_inner();
device.reconnect()?;`}</code></pre>

          <div class="callout callout--info">
            <p>
              See <A href="/library/features/async">async</A> for the full async surface and how{' '}
              <code>into_inner</code> and <code>into_async</code> move between the two views.
            </p>
          </div>
        </Card>
      </div>

      <div id="full-example" data-search-target>
        <Card>
          <CardHeader title="Complete example" subtitle="Hold a button, force a reconnect, restore state" />

          <p>
            Hold a button, force a reconnect and confirm the counter rose, reapply, then return to
            passthrough.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Device};

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    // Hold a button. The keepalive thread now keeps it alive on its
    // own; no further calls are needed to survive the silence window.
    device.press(Button::Left)?;

    // Force a rescan as if the cable was just replugged.
    let before = device.counters().reconnects;
    device.reconnect()?;
    println!("reconnects: {} -> {}", before, device.counters().reconnects);

    // reconnect already reapplied; this is the no-op-when-held path.
    device.reapply()?;

    // Back to passthrough. This clears the held override too.
    device.reset()?;
    Ok(())
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Lifecycle;
