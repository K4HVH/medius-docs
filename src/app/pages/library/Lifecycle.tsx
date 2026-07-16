import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lifecycle: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lifecycle" subtitle="Holding injected input alive and recovering a dropped link" />
        <p>The library holds deliberate overrides past the box's <A href="/native/injection#safety">silence-window clear</A>, and restores them if the link drops and reopens.</p>
        <ul>
          <li>
            <A href="/library/guides/connection#keepalive"><code>keepalive</code></A> (automatic) holds an
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
        <p>See also: <A href="/library/guides/connection#keepalive">keepalive &amp; holds</A>.</p>
      </Card>

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
          <pre><code class="language-rust">{`device.press(Button::Left)?;
device.reapply()?; // re-assert the held override, e.g. if the box reset under you`}</code></pre>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// The no-op case: reset clears every override, so reapply sends nothing.
device.reset()?;
device.reapply()?; // does nothing, no buttons are held`}</code></pre>

          <div class="callout callout--info">
            <p>
              Overrides are keyed by their{' '}
              <A href="/library/types/enums#usage"><code>Usage</code></A> (a button, key, or media
              usage).{' '}
              <A href="/library/inject#inject"><code>press</code></A> and{' '}
              <A href="/library/inject#inject"><code>force_release</code></A> add a held override;{' '}
              <A href="/library/inject#inject"><code>release</code></A> and{' '}
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
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>

          <p>
            The reader thread auto-reconnects on any read error; call this by hand only to force a
            rescan. It blocks while it rescans and reopens the port, and returns an error if the box
            can't be found or opened, but it never waits on a box reply.
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
          <pre><code class="language-rust">{`// After a known unplug and replug, force a rescan and confirm it took.
let before = device.counters().reconnects;
device.reconnect()?;
let after = device.counters().reconnects;
assert!(after > before);`}</code></pre>

          <div class="callout callout--info">
            <p>
              The reconnect count is the <code>reconnects</code> field in{' '}
              <A href="/library/diagnostics#counters">diagnostics</A>. Held state is keyed by{' '}
              <A href="/library/types/enums#usage"><code>Usage</code></A>, so the right inputs come
              back after a reopen.
            </p>
          </div>
        </Card>
      </div>

      <div id="from-async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="reapply and reconnect, still direct" />

          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>

          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> exposes{' '}
            <code>reapply</code> and <code>reconnect</code> directly, same signatures.{' '}
            <code>reapply</code> is a fire-and-forget frame; <code>reconnect</code> blocks while it
            rescans and reopens the port, so keep it off a latency-sensitive task.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::AsyncDevice;

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.reapply()?;     // re-assert held overrides
device.reconnect()?;   // blocks: rescan + reopen`}</code></pre>

          <div class="callout callout--info">
            <p>
              See <A href="/library/features/async">async</A> for the full async surface and how{' '}
              <code>into_inner</code> and <code>into_async</code> move between the two views.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Lifecycle;
