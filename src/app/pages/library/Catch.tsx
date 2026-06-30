import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Stream the physical mouse and keyboard input" />
        <p>
          <A href="/library/catch#catch-events"><code>catch_events</code></A> subscribes to the user's
          real input and hands back an{' '}
          <A href="/library/catch#event-stream"><code>EventStream</code></A> of{' '}
          <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> snapshots, mouse,
          keyboard, and media as the user makes them, captured before any{' '}
          <A href="/library/lock"><code>lock</code></A> suppression or{' '}
          <A href="/library/move">injection</A>. Drop the stream to unsubscribe.
        </p>
      </Card>

      <div id="catch-events" data-search-target>
        <Card>
          <CardHeader title="catch_events" subtitle="Subscribe to the physical-input stream" />
          <pre class="api-signature">fn catch_events(&self, mask: CatchMask) -&gt; Result&lt;EventStream&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/structs#catch-mask"><code>CatchMask</code></A> picks which classes
            of change emit an event: <code>MOTION</code>, <code>WHEEL</code>, <code>BUTTONS</code>,
            <code>KEYS</code>, combined with <code>|</code>, or <code>CatchMask::all()</code> for the
            full mirror. The returned{' '}
            <A href="/library/catch#event-stream"><code>EventStream</code></A> receives every event;
            the subscribe itself sends one frame and doesn't wait for a reply.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>mask</code></td><td><A href="/library/types/structs#catch-mask"><code>CatchMask</code></A></td><td>Which classes to stream. <code>MOTION</code> / <code>WHEEL</code> / <code>BUTTONS</code> / <code>KEYS</code> or <code>all()</code>.</td></tr>
            </tbody>
          </table>
          <p>
            The subscription is held alive by the library's keepalive (which re-asserts it after a
            device-side blip) and across a reconnect; it clears like injection: on control-PC silence,
            a <A href="/library/admin#reset"><code>reset</code></A> (which ends the stream, so its{' '}
            <code>recv</code> returns <code>Err</code>), or link loss. The reported input is the user's{' '}
            <em>physical</em>{' '}
            input; a locked or injected target still reports its real hand value here. See the native{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> command for the wire layout.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, CatchMask, CatchEvent, Button};

let device = Device::find()?;
let events = device.catch_events(CatchMask::all())?;   // or MOTION | BUTTONS | KEYS
while let Ok(event) = events.recv() {
    match event {
        CatchEvent::Mouse(m) if m.is_pressed(Button::Side1) => {
            // the side button was pressed; rebind it...
        }
        CatchEvent::Keyboard(k) => println!("{} keys down", k.keys.len()),
        CatchEvent::Media(c)    => println!("{} media keys", c.keys.len()),
        _ => {}
    }
}
// dropping \`events\` unsubscribes`}</code></pre>
        </Card>
      </div>

      <div id="event-stream" data-search-target>
        <Card>
          <CardHeader title="EventStream" subtitle="Receive physical-input reports" />
          <p>
            The handle <A href="/library/catch#catch-events"><code>catch_events</code></A> returns.
            Pull <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> snapshots with
            whichever method fits your loop; cloning shares the queue (like{' '}
            <A href="/library/diagnostics#logs"><code>LogStream</code></A>). When the stream and all its
            clones drop, the subscription ends and the box returns to passthrough.
          </p>
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Returns</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>Result&lt;CatchEvent&gt;</code></td><td>Block until the next event.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Option&lt;CatchEvent&gt;</code></td><td>The next buffered event, or <code>None</code> (never blocks).</td></tr>
              <tr><td><code>recv_timeout(dur)</code></td><td><code>Option&lt;CatchEvent&gt;</code></td><td>Block up to <code>dur</code>; <code>None</code> on timeout.</td></tr>
              <tr><td><code>try_iter()</code></td><td><code>impl Iterator</code></td><td>Drain every buffered event without blocking.</td></tr>
              <tr><td><code>recv_async().await</code></td><td><code>Result&lt;CatchEvent&gt;</code></td><td>Await the next event (<code>async</code> feature), runtime-agnostic.</td></tr>
              <tr><td><code>dropped()</code></td><td><code>u64</code></td><td>Events lost host-side because this consumer fell behind.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The buffer is bounded and lossy: a slow consumer drops the OLDEST events, keeping the
              freshest input (count them with <code>dropped()</code>). The box's own drop count, under
              back-pressure on the wire, is on{' '}
              <A href="/library/requests#query-catch"><code>query_catch</code></A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="catch_events fires, the stream awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>catch_events</code> synchronous (it just sends the subscribe and returns the stream)
            while the stream itself offers <code>recv_async().await</code>. <code>query_catch</code> is a
            future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, CatchMask};

let device = AsyncDevice::open("/dev/ttyACM0")?;
let events = device.catch_events(CatchMask::BUTTONS)?;   // sync, no await
let report = events.recv_async().await?;                 // stream awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Catch;
