import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Observe box traffic, addressed like a lock" />
        <p>
          <A href="/library/catch#input-events"><code>input_events</code></A> yields press and release
          edges; <A href="/library/catch#catch-events"><code>catch_events</code></A> yields the raw
          frames underneath. Input is observed before any{' '}
          <A href="/library/lock"><code>lock</code></A> suppression or{' '}
          <A href="/library/inject">injection</A>. Dropping the stream unsubscribes.
        </p>
        <p>
          A subscription is a table of{' '}
          <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> entries; the
          address is the filter, down to one endpoint, since vendor bulk alone measures ~250&nbsp;KiB/s
          on a 6&nbsp;Mbaud control link.
        </p>
      </Card>

      <div id="input-events" data-search-target>
        <Card>
          <CardHeader title="input_events" subtitle="Subscribe to decoded input edges" />
          <pre class="api-signature">fn input_events(&self, filters: impl IntoIterator&lt;Item = CatchFilter&gt;) -&gt; Result&lt;InputStream&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The box sends held-usage <em>snapshots</em>; this diffs them into edges, so watching a key
            is a match.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, CatchFilter, Input, Key};

let device = Device::find()?;
for ev in device.input_events([CatchFilter::watch(Key::F)])? {
    match ev.input {
        Input::Press(u) => println!("down {u:?}"),
        Input::Release(u) => println!("up {u:?}"),
        Input::Motion { dx, dy, dz } => println!("moved {dx},{dy},{dz}"),
    }
}`}</code></pre>
          <p>
            Every filter must name an input class and cover both edges; anything else is{' '}
            <A href="/library/types/errors">refused</A>. Without the release edge a fresh press can't be
            told from a chord; to watch presses, match on <code>Input::Press</code>.
          </p>
        </Card>
      </div>

      <div id="catch-events" data-search-target>
        <Card>
          <CardHeader title="catch_events" subtitle="Subscribe to the raw event stream" />
          <pre class="api-signature">fn catch_events(&self, filters: impl IntoIterator&lt;Item = CatchFilter&gt;) -&gt; Result&lt;EventStream&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Each <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> becomes one
            entry in the box's 32-entry table, sent as its own frame. The returned{' '}
            <A href="/library/catch#event-stream"><code>EventStream</code></A> receives every event any
            of them matches.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>filters</code></td><td>anything iterable of <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A></td><td>The subscription table: one filter, an array, or a <code>Vec</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Capture, CatchEvent, CatchFilter, Device, TrafficClass};

let device = Device::find()?;
let events = device.catch_events([
    CatchFilter::everything().with_capture(Capture::First(16)),
    CatchFilter::traffic(TrafficClass::VendorInterrupt, 0x83),
])?;
while let Ok(CatchEvent::Traffic(t)) = events.recv() {
    println!("{:?} {:#06x}: {} of {} bytes", t.class, t.id, t.bytes.len(), t.true_len);
}
// dropping \`events\` unsubscribes`}</code></pre>
          <p>
            The keepalive re-asserts the table; it survives a{' '}
            <A href="/library/lifecycle#reconnect">reconnect</A> and a{' '}
            <A href="/library/lifecycle#restart">session recovery</A>. The box clears it on control-PC
            silence, <A href="/library/admin#reset"><code>reset</code></A> (which ends the stream), link
            loss, device detach, and a re-clone. The wire layout is on the native{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> command.
          </p>
        </Card>
      </div>


      <div id="input-stream" data-search-target>
        <Card>
          <CardHeader title="InputStream" subtitle="Receive decoded edges" />
          <p>
            Returned by <A href="/library/catch#input-events"><code>input_events</code></A>. It holds the
            per-class held sets it diffs, so it takes <code>&mut self</code>, and one report can yield
            several <A href="/library/types/enums#input"><code>Input</code></A> values. It is an{' '}
            <code>Iterator</code>.
          </p>
          <p>
            It reports only the usages <em>this</em> subscription addressed: the box's one table is the
            union of every subscription in the process, and the decoder filters the wider snapshots back
            down.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Returns</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>Result&lt;InputEvent&gt;</code></td><td>Block until the next edge.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Option&lt;InputEvent&gt;</code></td><td>The next decoded edge, or <code>None</code> (never blocks).</td></tr>
              <tr><td><code>recv_timeout(dur)</code></td><td><code>Option&lt;InputEvent&gt;</code></td><td>Block up to <code>dur</code>; <code>None</code> on timeout.</td></tr>
              <tr><td><code>recv_async().await</code></td><td><code>Result&lt;InputEvent&gt;</code></td><td>Await the next edge (<code>async</code> feature).</td></tr>
              <tr><td><code>is_connected()</code></td><td><code>bool</code></td><td>Whether the box is still delivering; <code>try_recv</code> and <code>recv_timeout</code> return <code>None</code> for both "nothing yet" and "nothing ever again".</td></tr>
              <tr><td><code>held(class)</code></td><td><code>&amp;[Usage]</code></td><td>What this stream holds for one class.</td></tr>
              <tr><td><code>dropped()</code></td><td><code>u64</code></td><td>Events lost host-side because this consumer fell behind.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="event-stream" data-search-target>
        <Card>
          <CardHeader title="EventStream" subtitle="Receive raw events" />
          <p>
            Returned by <A href="/library/catch#catch-events"><code>catch_events</code></A>. Clones share
            the queue; the subscription ends when the stream and every clone drop.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Returns</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>Result&lt;CatchEvent&gt;</code></td><td>Block until the next event.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Option&lt;CatchEvent&gt;</code></td><td>The next buffered event, or <code>None</code> (never blocks).</td></tr>
              <tr><td><code>recv_timeout(dur)</code></td><td><code>Option&lt;CatchEvent&gt;</code></td><td>Block up to <code>dur</code>; <code>None</code> on timeout.</td></tr>
              <tr><td><code>iter() / try_iter()</code></td><td><code>impl Iterator</code></td><td>Blocking, or drain what is buffered. The stream is itself an <code>Iterator</code>.</td></tr>
              <tr><td><code>recv_async().await</code></td><td><code>Result&lt;CatchEvent&gt;</code></td><td>Await the next event (<code>async</code> feature), runtime-agnostic.</td></tr>
              <tr><td><code>stream()</code></td><td><code>impl Stream</code></td><td>The same queue as a <code>futures</code> stream (<code>async</code> feature).</td></tr>
              <tr><td><code>is_connected()</code></td><td><code>bool</code></td><td>Whether the box is still delivering; a <code>None</code> from the two above can't tell.</td></tr>
              <tr><td><code>dropped()</code></td><td><code>u64</code></td><td>Events lost host-side because this consumer fell behind.</td></tr>
            </tbody>
          </table>
          <p>
            Each event is a <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A>{' '}
            variant; <code>class()</code>, <code>id()</code>, <code>direction()</code>,{' '}
            <code>ts_us()</code>, <code>clock()</code> and <code>bytes()</code> read the same fields
            on any of them.
          </p>
          <div class="callout callout--info">
            <p>
              The buffer is bounded and lossy: a slow consumer drops the <em>oldest</em> events. The
              box's drop counts, box-wide and per entry, are on{' '}
              <A href="/library/requests#query-catch"><code>query_catch</code></A>.
            </p>
          </div>
          <p>
            The box drains through strict-priority queues, so under a busy mouse vendor bulk can go
            entirely undrained: the control link can't carry bulk plus input.
          </p>
          <pre class="diagram">{`  Button Key Media Axis Bus    -->  [ queue 0 ]  --+
  HidIn HidOut                                     |
  VendorInterrupt Emit         -->  [ queue 1 ]  --+--->  control link, 6 Mbaud
  Control ClipTransfer         -->  [ queue 2 ]  --+
  VendorBulk                   -->  [ queue 3 ]  --+

  each queue drains fully before the next`}</pre>
        </Card>
      </div>

      <div id="traffic" data-search-target>
        <Card>
          <CardHeader title="Traffic" subtitle="Truncation, control transactions, bus events" />
          <p>
            A <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A> carries the
            address, the bytes, and <code>true_len</code>, the length before capture cut it. Only{' '}
            <code>truncated()</code> tells a trimmed packet from a short one.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Capture, CatchEvent, CatchFilter, TrafficClass};

let filter = CatchFilter::traffic_class(TrafficClass::VendorInterrupt)
    .with_capture(Capture::First(16));
for event in &device.catch_events([filter])? {
    if let CatchEvent::Traffic(t) = event {
        if t.truncated() {
            println!("ep {:#06x}: {} of {} bytes", t.id, t.bytes.len(), t.true_len);
        }
    }
}`}</code></pre>
          <p>
            What <code>flags</code> carries per class is on{' '}
            <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A>;{' '}
            <code>control_status()</code>, <code>rule_acted()</code>, <code>transfer_status()</code>,
            and <A href="/library/types/enums#bus-event"><code>bus_event()</code></A> read it.
          </p>
          <p>
            A <code>Control</code> or <code>ClipTransfer</code> event is one completed transaction:{' '}
            <code>bytes</code> is <code>[setup 8][data...]</code>, split by{' '}
            <code>setup()</code> and <code>data()</code>. A <code>Control</code> event is the
            transaction the game PC received, on every control endpoint.
          </p>
        </Card>
      </div>

      <div id="timestamps" data-search-target>
        <Card>
          <CardHeader title="Timestamps" subtitle="Two chips, two clocks, one host timeline" />
          <p>
            Every event carries <code>ts_us</code> and the{' '}
            <A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A> that produced it.
            The two chips boot independently, so a stamp is only meaningful within its own domain.
          </p>
          <table class="api-params">
            <thead><tr><th>Domain</th><th>Stamped</th><th>Covers</th></tr></thead>
            <tbody>
              <tr><td><code>ClockDomain::HostChip</code></td><td>in USB interrupt context, the instant the real device's transfer completed</td><td>motion, usages, <code>HidIn</code>, the device's vendor IN</td></tr>
              <tr><td><code>ClockDomain::DeviceChip</code></td><td>at the tap on the device chip</td><td><code>HidOut</code>, every OUT direction, a <A href="/library/advanced/raw">raw</A> vendor IN packet, <code>Control</code>, <code>Emit</code>, <code>Bus</code>, <code>ClipTransfer</code></td></tr>
            </tbody>
          </table>
          <p>
            Stamps are <code>u32</code> microseconds from that chip's boot, so they{' '}
            <A href="/library/types/enums#clock-domain">wrap and restart at zero on reboot</A>.{' '}
            <A href="/library/types/structs#timeline"><code>Timeline</code></A> handles domains, wrap and
            reboot, and turns an{' '}
            <A href="/library/types/structs#input-event"><code>InputEvent</code></A> or a raw{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> into an{' '}
            <code>Instant</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchFilter, Input, Key, Timeline};

let mut input = device.input_events([CatchFilter::watch(Key::F)])?;
let mut time = Timeline::new();
for ev in input.by_ref().take(20) {
    let at = time.observe(&ev);
    if let Input::Press(u) = ev.input {
        println!("{u:?} down at {:?}, {:?} above the floor", at.host, at.excess);
    }
}`}</code></pre>
          <p>
            <A href="/library/requests#query-catch"><code>query_catch</code></A> returns a{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A>: the box's
            offset between its two chips, the drift rate, and the round trip bounding the error.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Subscribing fires, the stream awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>catch_events</code> and <code>input_events</code> synchronous; the streams offer{' '}
            <code>recv_async().await</code>; <code>query_catch</code> is a future.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, CatchFilter, Key};

let device = AsyncDevice::open("/dev/ttyACM0")?;
let mut input = device.input_events([CatchFilter::watch(Key::F)])?;  // sync, no await
let edge = input.recv_async().await?;                                // stream awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Catch;
