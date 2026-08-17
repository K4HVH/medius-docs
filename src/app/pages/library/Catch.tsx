import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Observe what passes through the box, addressed like a lock" />
        <p>
          <A href="/library/catch#input-events"><code>input_events</code></A> gives you press and
          release edges;{' '}
          <A href="/library/catch#catch-events"><code>catch_events</code></A> gives you the raw frames
          underneath. Input is observed before any{' '}
          <A href="/library/lock"><code>lock</code></A> suppression or{' '}
          <A href="/library/inject">injection</A>. Drop the stream to unsubscribe.
        </p>
        <p>
          A subscription is a table of{' '}
          <A href="/library/catch#filters"><code>CatchFilter</code></A> entries. Addressing doubles as
          the filter: the control link runs at 4&nbsp;Mbaud and vendor bulk alone measures
          ~250&nbsp;KiB/s, so a subscription has to be able to name one endpoint.
        </p>
      </Card>

      <div id="input-events" data-search-target>
        <Card>
          <CardHeader title="input_events" subtitle="Subscribe to decoded input edges" />
          <pre class="api-signature">fn input_events(&self, filters: impl IntoIterator&lt;Item = CatchFilter&gt;) -&gt; Result&lt;InputStream&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The box sends held-usage <em>snapshots</em>; this diffs them into edges, so watching a key
            is a match rather than a set difference.
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
            <A href="/library/types/errors">refused</A>. Without the release edge a fresh press cannot
            be told from a chord, so match on <code>Input::Press</code> instead.
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
          <div class="api-response-label">LIFECYCLE</div>
          <p>
            The keepalive re-asserts the table, and it survives a{' '}
            <A href="/library/lifecycle#reconnect">reconnect</A>. It clears on control-PC silence, on{' '}
            <A href="/library/admin#reset"><code>reset</code></A> (which ends the stream), or on link
            loss. See the native{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> command for the wire layout.
          </p>
        </Card>
      </div>

      <div id="filters" data-search-target>
        <Card>
          <CardHeader title="CatchFilter" subtitle="One table entry: an address, a direction, a capture" />
          <p>
            The input constructors take what <A href="/library/lock#lock"><code>lock</code></A> takes,
            so hiding an input from the game and watching it are written alike.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Constructor</th><th>Addresses</th></tr>
            </thead>
            <tbody>
              <tr><td><code>CatchFilter::watch(u)</code></td><td>one <A href="/library/types/enums#usage"><code>Usage</code></A>: a button, a key, or a media usage.</td></tr>
              <tr><td><code>CatchFilter::watch_axis(a)</code></td><td>one <A href="/library/types/enums#axis"><code>Axis</code></A>: X, Y, or the wheel.</td></tr>
              <tr><td><code>CatchFilter::watch_class(c)</code></td><td>every usage in one <A href="/library/types/enums#class"><code>Class</code></A>.</td></tr>
              <tr><td><code>CatchFilter::watch_axes()</code></td><td>every axis.</td></tr>
              <tr><td><code>CatchFilter::all_input()</code></td><td>all four input classes, as a <code>[CatchFilter; 4]</code>.</td></tr>
              <tr><td><code>CatchFilter::traffic(c, id)</code></td><td>one id in a <A href="/library/types/enums#traffic-class"><code>TrafficClass</code></A>: an endpoint, an interface, an endpoint number.</td></tr>
              <tr><td><code>CatchFilter::traffic_class(c)</code></td><td>every id in one traffic class.</td></tr>
              <tr><td><code>CatchFilter::everything()</code></td><td>every class, every id. One table entry, not an expansion.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Modifier</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>.on_press() / .on_release()</code></td><td>One edge, on the momentary classes.</td></tr>
              <tr><td><code>.inbound() / .outbound()</code></td><td>One flow, on the traffic classes: IN is device to PC.</td></tr>
              <tr><td><code>.with_direction(d)</code></td><td>The <A href="/library/types/enums#direction"><code>Direction</code></A> directly; on an axis it is the sign of the delta.</td></tr>
              <tr><td><code>.with_capture(c)</code></td><td>Bytes kept per event, as a <A href="/library/types/enums#capture"><code>Capture</code></A>. Traffic classes only. An input class carries no packet, and naming one with a capture is refused.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MOST-SPECIFIC-FIRST</div>
          <p>
            An exact <code>(class, id)</code> beats a class blanket, which beats{' '}
            <code>everything()</code>, and a named direction beats <code>Both</code>. The winning entry
            supplies the capture.
          </p>
          <pre class="diagram">{`  CatchFilter::everything().with_capture(Capture::First(16))
  CatchFilter::traffic_class(TrafficClass::VendorInterrupt).with_capture(Capture::First(32))
  CatchFilter::traffic(TrafficClass::VendorInterrupt, 0x83)

  a 64-byte report on vendor interrupt endpoint 0x83
    +- exact (class, id)?  HIT   -->  whole packet  -->  all 64 bytes

  the same report on endpoint 0x81
    +- exact (class, id)?  miss
    +- class blanket?      HIT   -->  First(32)     -->  32 bytes, true_len 64`}</pre>
          <div class="api-response-label">CAPACITY</div>
          <p>
            The table holds 32 entries. A subscription that would exceed it is refused before anything
            is sent, so a stream is never quietly missing an address.
          </p>
        </Card>
      </div>

      <div id="input-stream" data-search-target>
        <Card>
          <CardHeader title="InputStream" subtitle="Receive decoded edges" />
          <p>
            The handle <A href="/library/catch#input-events"><code>input_events</code></A> returns. It
            holds the per-class held sets it diffs, so it takes <code>&mut self</code> and one report
            can yield several <A href="/library/types/enums#input"><code>Input</code></A> values. It is
            an <code>Iterator</code>, so a <code>for</code> loop over it works.
          </p>
          <p>
            It reports only the usages <em>this</em> subscription addressed. The box holds one table,
            the union of every subscription in the process, so its snapshots widen as soon as
            unrelated code subscribes. The decoder filters them back down.
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
              <tr><td><code>held(class)</code></td><td><code>&amp;[Usage]</code></td><td>What this stream currently has held for one class.</td></tr>
              <tr><td><code>dropped()</code></td><td><code>u64</code></td><td>Events lost host-side because this consumer fell behind.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="event-stream" data-search-target>
        <Card>
          <CardHeader title="EventStream" subtitle="Receive raw events" />
          <p>
            The handle <A href="/library/catch#catch-events"><code>catch_events</code></A> returns.
            Cloning shares the queue. When the stream and all its clones drop, the subscription ends.
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
              <tr><td><code>is_connected()</code></td><td><code>bool</code></td><td>Whether the box is still delivering, which a <code>None</code> from the two above cannot tell you.</td></tr>
              <tr><td><code>dropped()</code></td><td><code>u64</code></td><td>Events lost host-side because this consumer fell behind.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">THE THREE VARIANTS</div>
          <table class="api-params">
            <thead>
              <tr><th>Variant</th><th>Carries</th><th>Raised by</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Motion(MotionEvent)</code></td><td>the relative axes of one physical report, as a <A href="/library/types/structs#motion-event"><code>MotionEvent</code></A></td><td>an <code>Axis</code> filter</td></tr>
              <tr><td><code>Usages(UsageSnapshot)</code></td><td>the held usages of one class as a <A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A>, a full snapshot rather than edges</td><td>a <code>Button</code>, <code>Key</code>, or <code>Media</code> filter</td></tr>
              <tr><td><code>Traffic(TrafficEvent)</code></td><td>bytes plus the address they came from, as a <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A></td><td>every other class</td></tr>
            </tbody>
          </table>
          <p>
            <code>class()</code>, <code>id()</code>, <code>direction()</code>, <code>ts_us()</code>,{' '}
            <code>clock()</code> and <code>bytes()</code> answer the same question of any variant.
          </p>
          <div class="callout callout--info">
            <p>
              The buffer is bounded and lossy: a slow consumer drops the <em>oldest</em> events. The
              box's own drop counts are on{' '}
              <A href="/library/requests#query-catch"><code>query_catch</code></A>, box-wide and per
              entry.
            </p>
          </div>
          <div class="api-response-label">DELIVERY IS RANKED</div>
          <p>
            The box drains through strict-priority queues. Vendor bulk can starve completely under a
            busy mouse: bulk-plus-input is what the control link cannot carry.
          </p>
          <pre class="diagram">{`  Button Key Media Axis Bus    -->  [ queue 0 ]  --+
  HidIn HidOut                                     |
  VendorInterrupt Emit         -->  [ queue 1 ]  --+--->  control link, 4 Mbaud
  Control                      -->  [ queue 2 ]  --+
  VendorBulk                   -->  [ queue 3 ]  --+

  each queue drains fully before the next`}</pre>
        </Card>
      </div>

      <div id="traffic" data-search-target>
        <Card>
          <CardHeader title="Reading traffic" subtitle="Truncation, control transactions, bus events" />
          <p>
            A <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A> carries the
            address, the bytes, and <code>true_len</code>: the length before the capture cut it. A
            trimmed packet and a genuinely short one are otherwise identical, so check{' '}
            <code>truncated()</code>.
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
          <div class="api-response-label">FLAGS BY CLASS</div>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th><code>flags</code></th></tr>
            </thead>
            <tbody>
              <tr><td><code>VendorBulk</code></td><td>b0 end-of-transfer, b1 zero-length packet</td></tr>
              <tr><td><code>Control</code></td><td>the real device's answer, via <A href="/library/types/enums#control-status"><code>control_status</code></A></td></tr>
              <tr><td><code>Bus</code></td><td>a <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> discriminant</td></tr>
              <tr><td>every other class</td><td><code>0</code></td></tr>
            </tbody>
          </table>
          <p>
            A <code>Control</code> event is one completed transaction, not one stage:{' '}
            <code>bytes</code> is <code>[setup 8][data…]</code>, split by <code>setup()</code> and{' '}
            <code>data()</code>. A <code>Bus</code> event carries a{' '}
            <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> kind and its operands.
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
              <tr><td><code>ClockDomain::HostChip</code></td><td>in USB interrupt context, the instant the real device's transfer completed</td><td>motion, usages, <code>HidIn</code>, vendor IN</td></tr>
              <tr><td><code>ClockDomain::DeviceChip</code></td><td>at the tap on the device chip</td><td><code>HidOut</code>, every OUT direction, <code>Control</code>, <code>Emit</code>, <code>Bus</code></td></tr>
            </tbody>
          </table>
          <p>
            Stamps are <code>u32</code> microseconds from that chip's boot: they wrap every ~71.6
            minutes and restart at zero on reboot.{' '}
            <A href="/library/types/structs#timeline"><code>Timeline</code></A> handles all of it and
            hands back an <code>Instant</code>. It takes an{' '}
            <A href="/library/types/structs#input-event"><code>InputEvent</code></A> or a raw{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> alike.
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
            It keeps a per-domain minimum of (elapsed here minus elapsed on the box) rather than an
            average, because the error is one-sided: an event can arrive late but never early.
          </p>
          <div class="api-response-label">CROSSING DOMAINS ON THE BOX</div>
          <p>
            <A href="/library/requests#query-catch"><code>query_catch</code></A> returns a{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A>: the box's
            own offset between its two chips, its drift rate, and the round trip bounding the error.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Subscribing fires, the stream awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>catch_events</code> and <code>input_events</code> synchronous; the streams offer{' '}
            <code>recv_async().await</code>. <code>query_catch</code> is a future, like the other
            queries.
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
