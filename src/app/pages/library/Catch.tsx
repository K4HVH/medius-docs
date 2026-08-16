import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Stream the traffic the box carries, addressed like a lock" />
        <p>
          <A href="/library/catch#catch-events"><code>catch_events</code></A> subscribes to what
          passes through the box and hands back an{' '}
          <A href="/library/catch#event-stream"><code>EventStream</code></A> of{' '}
          <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> values: relative
          motion, held-usage snapshots, and the raw bytes of the HID, vendor, control, emit and bus
          taps. Physical input is captured before any{' '}
          <A href="/library/lock"><code>lock</code></A> suppression or{' '}
          <A href="/library/inject">injection</A>. Drop the stream to unsubscribe.
        </p>
        <p>
          A subscription is a table of{' '}
          <A href="/library/catch#filters"><code>CatchFilter</code></A> entries, each naming an
          address. Addressing doubles as the filter because the control link runs at 4&nbsp;Mbaud
          while vendor bulk alone measures ~250&nbsp;KiB/s through the box: everything at once cannot
          be delivered, so a subscription has to be able to name one endpoint.
        </p>
      </Card>

      <div id="catch-events" data-search-target>
        <Card>
          <CardHeader title="catch_events" subtitle="Subscribe to the event stream" />
          <pre class="api-signature">fn catch_events(&amp;self, filters: impl IntoIterator&lt;Item = CatchFilter&gt;) -&gt; Result&lt;EventStream&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Each <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> becomes one
            entry in the box's 32-entry table, sent as its own frame. The returned{' '}
            <A href="/library/catch#event-stream"><code>EventStream</code></A> receives every event
            any of them matches; the subscribe itself sends the frames and doesn't wait for a reply.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>filters</code></td><td>anything iterable of <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A></td><td>The subscription table: one filter, an array, or a <code>Vec</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, CatchClass, CatchEvent, CatchFilter, Button};

let device = Device::find()?;
let events = device.catch_events([
    CatchFilter::class(CatchClass::Button),
    CatchFilter::class(CatchClass::Axis),
])?;
while let Ok(event) = events.recv() {
    match event {
        CatchEvent::Motion(m) => println!("dx={} dy={} dz={}", m.dx, m.dy, m.dz),
        CatchEvent::Usages(u) if u.is_held(Button::Side1) => {
            // the side button is held; rebind it...
        }
        CatchEvent::Usages(u) => println!("{} usages held", u.usages.len()),
        CatchEvent::Traffic(t) => println!("{:?} {} bytes", t.class, t.bytes.len()),
    }
}
// dropping \`events\` unsubscribes`}</code></pre>
          <div class="api-response-label">LIFECYCLE</div>
          <p>
            The subscription is held alive by the library's keepalive (which re-asserts the whole
            table after a device-side blip) and across a{' '}
            <A href="/library/lifecycle#reconnect">reconnect</A>; it clears like injection: on
            control-PC silence, a <A href="/library/admin#reset"><code>reset</code></A> (which ends the
            stream, so its <code>recv</code> returns <code>Err</code>), or link loss. The input classes
            report the user's <em>physical</em> input, so a locked or injected target still shows its
            real hand value here. See the native{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> command for the wire layout.
          </p>
        </Card>
      </div>

      <div id="filters" data-search-target>
        <Card>
          <CardHeader title="CatchFilter" subtitle="One table entry: an address, a direction, a snaplen" />
          <p>
            A filter is built and then narrowed. The constructors pick the address; the two modifiers
            are optional and default to both directions and the whole packet.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Constructor</th><th>Addresses</th></tr>
            </thead>
            <tbody>
              <tr><td><code>CatchFilter::all()</code></td><td>every class, every id. One table entry, not an expansion.</td></tr>
              <tr><td><code>CatchFilter::class(c)</code></td><td>every id in one <A href="/library/types/enums#catch-class"><code>CatchClass</code></A>.</td></tr>
              <tr><td><code>CatchFilter::addr(c, id)</code></td><td>one id inside a class: a button, a key, an endpoint address, an interface number.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Modifier</th><th>Default</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>.direction(d)</code></td><td><code>LockDirection::Both</code></td><td>For the input classes, the press or release edge, exactly as for a lock. For the traffic classes, <code>Positive</code> is IN (device to PC) and <code>Negative</code> is OUT. No class is both, so one value carries either reading.</td></tr>
              <tr><td><code>.snaplen(n)</code></td><td><code>0</code> (whole packet)</td><td>Bytes captured per event. Per entry, because the useful value differs by orders of magnitude between classes: a 64-byte vendor interrupt report is worth having whole, a bulk pipe traced for framing needs 16 and would otherwise saturate the link on its own.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">THE CLASSES</div>
          <p>
            <A href="/library/types/enums#catch-class"><code>CatchClass</code></A>'s first four
            variants are <A href="/library/lock"><code>lock</code></A>'s classes unchanged, so one
            vocabulary covers locking a field and catching it.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th><code>id</code> means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Button</code> / <code>Key</code> / <code>Media</code></td><td>the usage id, as for a lock or an inject</td></tr>
              <tr><td><code>Axis</code></td><td>X, Y, or Wheel</td></tr>
              <tr><td><code>HidIn</code></td><td>interface number</td></tr>
              <tr><td><code>HidOut</code></td><td>endpoint address</td></tr>
              <tr><td><code>VendIntr</code> / <code>VendBulk</code></td><td>endpoint address</td></tr>
              <tr><td><code>Control</code></td><td>endpoint number (<code>0</code> = EP0)</td></tr>
              <tr><td><code>Emit</code></td><td>interface number; what the clone actually put on the wire, after injection, locks and the suppression gate</td></tr>
              <tr><td><code>Bus</code></td><td>unused; the class is the whole address</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MOST-SPECIFIC-FIRST</div>
          <p>
            An exact <code>(class, id)</code> beats a class blanket, which beats{' '}
            <code>CatchFilter::all()</code>; ties go to the earlier filter. The winning entry supplies
            the <code>snaplen</code>, so "everything at 16 bytes, except endpoint <code>0x83</code> in
            full" is two filters rather than a special case.
          </p>
          <pre class="diagram">{`  filters, in the order you passed them
    [0]  CatchFilter::all().snaplen(16)
    [1]  CatchFilter::class(CatchClass::VendIntr).snaplen(32)
    [2]  CatchFilter::addr(CatchClass::VendIntr, 0x83)

  a 64-byte report on vendor interrupt endpoint 0x83
    +- exact (class, id)?   [2]  HIT  --> snaplen 0   -> all 64 bytes
    +- class blanket?       [1]  (not reached)
    +- CatchFilter::all()?  [0]  (not reached)

  the same report on endpoint 0x81
    +- exact (class, id)?        miss
    +- class blanket?       [1]  HIT  --> snaplen 32  -> 32 bytes, true_len 64
    +- CatchFilter::all()?  [0]  (not reached)`}</pre>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchFilter, LockDirection};

let events = device.catch_events([
    CatchFilter::all().snaplen(16),                        // a cheap floor under everything
    CatchFilter::addr(CatchClass::VendIntr, 0x83),         // this endpoint, whole packets
    CatchFilter::class(CatchClass::VendBulk)               // outbound bulk only, first 16 bytes
        .direction(LockDirection::Negative)
        .snaplen(16),
])?;`}</code></pre>
          <div class="api-response-label">CAPACITY</div>
          <p>
            The table holds 32 entries and subscribing is fire-and-forget, so a refused filter is
            visible only by its absence from{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A>, alongside that
            reply's <code>table_full</code> flag. A filter is also refused for an unknown class, a
            direction outside the three values, or a wildcard class carrying a specific id.{' '}
            <code>id</code> is class-specific, so a wildcard class with a real id addresses nothing
            coherent.
          </p>
        </Card>
      </div>

      <div id="event-stream" data-search-target>
        <Card>
          <CardHeader title="EventStream" subtitle="Receive events" />
          <p>
            The handle <A href="/library/catch#catch-events"><code>catch_events</code></A> returns.
            Pull <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A> values with
            whichever method fits your loop; cloning shares the queue (like{' '}
            <A href="/library/diagnostics#logs"><code>LogStream</code></A>). When the stream and all
            its clones drop, the subscription ends and the box returns to passthrough.
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
          <div class="api-response-label">THE THREE VARIANTS</div>
          <table class="api-params">
            <thead>
              <tr><th>Variant</th><th>Carries</th><th>Raised by</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Motion(</code><A href="/library/types/structs#motion-event"><code>MotionEvent</code></A><code>)</code></td><td>the relative axes of one physical report</td><td>an <code>Axis</code> filter</td></tr>
              <tr><td><code>Usages(</code><A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A><code>)</code></td><td>the held usages of one class, a full snapshot rather than edges</td><td>a <code>Button</code>, <code>Key</code>, or <code>Media</code> filter</td></tr>
              <tr><td><code>Traffic(</code><A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A><code>)</code></td><td>bytes, plus the address they came from</td><td>every other class</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The buffer is bounded and lossy: a slow consumer drops the OLDEST events, keeping the
              freshest input (count them with <code>dropped()</code>). The box's own drop counts, under
              back-pressure on the wire, are on{' '}
              <A href="/library/requests#query-catch"><code>query_catch</code></A>: once box-wide and
              once per table entry, because "my link is full" and "this endpoint's trace has holes"
              are different problems.
            </p>
          </div>
          <div class="api-response-label">DELIVERY IS RANKED</div>
          <p>
            The box drains events through four strict-priority queues: input and bus first, then the
            byte-oriented traffic classes, then control, then vendor bulk. Bulk can starve completely under a busy
            mouse. That is the honest outcome: bulk-plus-input is the combination the control link
            cannot carry, and a half-delivered bulk trace is worse than a visibly absent one because
            it looks like data.
          </p>
          <pre class="diagram">{`  Button Key Media Axis Bus  -->  [ queue 0 ]  --+
                                                 |
  HidIn HidOut VendIntr                          |
  Control Emit               -->  [ queue 1 ]  --+--->  control link, 4 Mbaud
                                                 |
  VendBulk                   -->  [ queue 2 ]  --+

  queue 0 drains fully before queue 1, and 1 fully before 2`}</pre>
        </Card>
      </div>

      <div id="traffic" data-search-target>
        <Card>
          <CardHeader title="Reading traffic" subtitle="Truncation, control transactions, bus events" />
          <p>
            A <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A> carries the
            address it came from, the bytes that arrived, and <code>true_len</code>: the packet's
            length <em>before</em> <code>snaplen</code> cut it. Without that field a packet trimmed by
            <code>snaplen</code> and a genuinely short packet look identical, so{' '}
            <code>truncated()</code> is the only honest way to tell them apart.
          </p>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchEvent, CatchFilter};

let events = device.catch_events([CatchFilter::class(CatchClass::VendIntr).snaplen(16)])?;
loop {
    // A while-let would end the loop on the first event of another kind instead of skipping it.
    if let CatchEvent::Traffic(t) = events.recv()? {
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
              <tr><td><code>VendBulk</code></td><td>b0 end-of-transfer, b1 zero-length packet</td></tr>
              <tr><td><code>Control</code></td><td>the real device's answer: <code>0</code> OK, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed to timeout</td></tr>
              <tr><td><code>Bus</code></td><td>a <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> discriminant</td></tr>
              <tr><td>every other class</td><td><code>0</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL</div>
          <p>
            A <code>Control</code> event is one <em>completed transaction</em>, not one stage:{' '}
            <code>bytes</code> is <code>[setup 8][data…]</code> and <code>direction</code> says which
            way the data stage went. That is the unit the proxy already holds both halves of, so
            splitting it would put reassembly on every consumer. A request answered from the box's own
            value cache still produces an event, because a trace that omitted those would show a
            device that had stopped being asked.
          </p>
          <div class="api-response-label">BUS</div>
          <p>
            A <code>Bus</code> event carries two operand bytes and a{' '}
            <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> kind: resets, suspends,
            resumes, (de)configuration, <code>SET_INTERFACE</code>, device attach and detach, and the
            clone coming up or down. These already drive the{' '}
            <A href="/library/requests#health"><code>health</code></A> flags and the{' '}
            <A href="/library/requests#query-stats"><code>stats</code></A> counters; what the stream
            adds is a timestamped ordering. A counter says a reconfiguration happened, not when it
            happened relative to the report stream that stopped.
          </p>
        </Card>
      </div>

      <div id="timestamps" data-search-target>
        <Card>
          <CardHeader title="Timestamps" subtitle="Two chips, two clocks, and one measured offset" />
          <p>
            Every event carries <code>ts_us</code> and the{' '}
            <A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A> that produced it.
            The two ESP32-S3s boot independently, so nothing relates their timers: a stamp is only
            meaningful against another from the same domain.
          </p>
          <div class="api-response-label">THE CLOCKS</div>
          <table class="api-params">
            <thead><tr><th>Domain</th><th>Stamped</th><th>Covers</th></tr></thead>
            <tbody>
              <tr><td><code>ClockDomain::Host</code></td><td>in USB interrupt context on the host chip, the instant the real device's transfer completed, the earliest point at which the box knows the report exists</td><td>motion, usages, <code>HidIn</code>, vendor IN</td></tr>
              <tr><td><code>ClockDomain::Device</code></td><td>at the tap on the device chip</td><td><code>HidOut</code>, every OUT direction, <code>Control</code>, <code>Emit</code>, <code>Bus</code></td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Property</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>type</td><td><code>u32</code> microseconds, handed over as the box sent it, like the rolling <code>SEQ</code> beside it.</td></tr>
              <tr><td>epoch</td><td>that chip's boot, with no relationship to any clock on this machine. Compare stamps only within a domain, or apply the measured offset below.</td></tr>
              <tr><td>wrap</td><td>every ~71.6 minutes, and back to zero when that chip reboots. A value below the previous one is a wrap, a reboot, or a domain change, and the delta across it is meaningless.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CROSSING DOMAINS</div>
          <p>
            <A href="/library/requests#query-catch"><code>query_catch</code></A> returns a{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A>: the
            measured offset between the two chips, the drift rate, the round trip that bounds the
            offset's error, and the estimate's age (<code>None</code> until one has been taken, which
            an offset of zero alone could not distinguish). The age is that of the exchange the offset
            <em>rests on</em>, not of the newest one — the offset comes from the least-delayed exchange
            in the window, which is often older. Applying it is optional and the domain tag stays
            authoritative, so a caller that does not want an approximated timeline can simply refuse to
            subtract across domains.
          </p>
          <pre><code class="language-rust">{`let c = device.query_catch()?;
if let Some(age) = c.clock.age {
    // Good to about half the round trip; extrapolate with rate_ppb rather than
    // trusting the offset, which two free-running crystals stale at ~20 us/s.
    let err_us = c.clock.delay_us / 2;
    let drift_us = c.clock.drift_us_over(age);
    println!("offset {} us ±{} us, +{} us of drift", c.clock.offset_us, err_us, drift_us);
}`}</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchEvent, CatchFilter};

let poll_us = device.query_rate()?.poll_period_us as u32;
let stream = device.catch_events([CatchFilter::class(CatchClass::Axis)])?;
let mut prev: Option<u32> = None;
loop {
    if let CatchEvent::Motion(m) = stream.recv()? {
        if let Some(p) = prev.filter(|p| m.ts_us > *p) {
            // Two reports inside one poll period give 0, so saturate rather than underflow.
            let idle_polls = ((m.ts_us - p) / poll_us).saturating_sub(1);
            println!("{idle_polls} polls with nothing to report");
        }
        prev = Some(m.ts_us);
    }
}`}</code></pre>
          <p>
            Check <A href="/library/requests#query-rate"><code>query_rate</code></A>'s{' '}
            <code>change_driven</code> flag first: on a change-driven device the idle polls were never
            on the wire, so a gap cannot be read as a poll count.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="catch_events fires, the stream awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>catch_events</code> synchronous (it just sends the subscribe frames and returns the
            stream) while the stream itself offers <code>recv_async().await</code>.{' '}
            <code>query_catch</code> is a future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, CatchClass, CatchFilter};

let device = AsyncDevice::open("/dev/ttyACM0")?;
let events = device.catch_events([CatchFilter::class(CatchClass::Button)])?;  // sync, no await
let report = events.recv_async().await?;                                    // stream awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Catch;
