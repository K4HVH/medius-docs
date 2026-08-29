import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Streams: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Streams" subtitle="Live input and device logs" />
        <p>
          <A href="/native/hardware">The box</A> has two live channels: the traffic it carries
          (<A href="/library/catch">Catch</A>: physical input, and the USB bytes behind it) and its own
          log lines (<A href="/library/diagnostics">Logs &amp; counters</A>). What an event{' '}
          <em>means</em> lives on those pages.
        </p>
        <pre class="diagram">{`  physical mouse / keyboard          the traffic the box carries
            │   (also forwarded       (vendor endpoints, control
            │    to the game PC)       transactions, bus events)
            ▼                                  ▼
   ┌─────────────────┐                         ┌─────────────┐
   │   medius box    │ catch_events(filters) ─▶│ EventStream │ ─▶ recv() ─▶ CatchEvent
   │                 │                         ├─────────────┤
   │                 │ input_events(filters) ─▶│ InputStream │ ─▶ recv() ─▶ InputEvent
   │                 │                         ├─────────────┤
   │                 │ logs()                ─▶│  LogStream  │ ─▶ recv() ─▶ LogLine
   └─────────────────┘                         └─────────────┘`}</pre>
        <p>
          The first two read the same subscription. <code>catch_events</code> hands you the box's own
          held-usage snapshots; <A href="/bindings/python/streams#input"><code>input_events</code></A>{' '}
          diffs them into press and release edges first.
        </p>
        <div class="callout callout--info">
          <p>
            Every stream is a{' '}
            <a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">context manager</a>{' '}
            and iterable. Use <code>with</code> so the subscription is released on exit, and{' '}
            <code>for item in stream:</code> to drain it until <A href="/library/lifecycle">the link drops</A>.
          </p>
        </div>
      </Card>

      <div id="subscribe" data-search-target>
        <Card>
          <CardHeader title="Subscribe" subtitle="Open an event, input, or log stream" />
          <p>
            All three calls live on the <A href="/bindings/python/api">Device</A> and send a
            subscribe request to the box.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Returns</th><th>Channel</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.catch_events(filters)</code></A></td><td><code>EventStream</code></td><td>the subscribed traffic: input, raw HID, vendor endpoints, control transactions, bus events (see <A href="/library/catch">Catch</A>)</td></tr>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.input_events(filters)</code></A></td><td><code>InputStream</code></td><td>the same input, decoded into press and release edges (see <A href="/bindings/python/streams#input">below</A>)</td></tr>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.logs()</code></A></td><td><code>LogStream</code></td><td>device log lines (see <A href="/library/diagnostics">Logs &amp; counters</A>)</td></tr>
            </tbody>
          </table>
          <p>
            <code>filters</code> is one <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
            or an iterable of them. Each names an address, a{' '}
            <A href="/bindings/python/types#catchclass"><code>CatchClass</code></A> plus an id inside
            that class, with an optional direction and capture. The box holds them as a 32-entry
            table.
          </p>
          <pre class="api-signature">{`CatchFilter.watch(usage)                # one button, key, or media usage
CatchFilter.watch_axis(axis)            # one Axis
CatchFilter.watch_class(input_class)    # every usage in one Class
CatchFilter.watch_axes()                # X, Y and the wheel
CatchFilter.all_input()                 # a list: all four input classes
CatchFilter.traffic(traffic_class, id)  # one endpoint, interface, or EP number
CatchFilter.traffic_class(tc)           # every id in one TrafficClass
CatchFilter.everything()                # every class, every id, one table entry
  .with_direction(direction)            # a Direction, default BOTH
  .with_capture(n)                      # bytes kept per event, default 0 = whole packet
  .on_press() / .on_release()           # one edge of an input filter
  .inbound() / .outbound()              # one flow of a traffic filter`}</pre>
          <p>
            Every class and the ids it takes are on <code>CatchClass</code> above; matching order is
            on <A href="/native/commands/catch#matching">The table</A>.
          </p>
          <div class="callout callout--warning">
            <p>
              Subscribing checks the filters here and raises: <code>CatchTableFullError</code> when
              every subscription in this process together needs more than the box's 32 entries,{' '}
              <code>CaptureNotApplicableError</code> for a capture on an input class,{' '}
              <code>EmptySubscriptionError</code> for none.
            </p>
            <p>
              What the <em>box</em> then refuses is{' '}
              <A href="/native/injection#fire-and-forget">fire-and-forget</A> and gets no reply: read
              it back with{' '}
              <A href="/bindings/python/api#queries"><code>dev.query_catch()</code></A>, whose{' '}
              <A href="/bindings/python/types#catchstate"><code>CatchState.entries</code></A> is what
              it holds.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              Subscribing to everything at full length is more than the control link carries, and a
              busy mouse leaves a bulk trace undrained. The queue ranking and the link budget are on{' '}
              <A href="/native/commands/catch#delivery">Delivery</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="receive" data-search-target>
        <Card>
          <CardHeader title="Receive" subtitle="Blocking, polling, timed, and iterated reads" />
          <p>
            Every stream has the same four read methods plus <code>close()</code>. The table shows <code>EventStream</code>{' '}
            (yielding <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A>);{' '}
            <code>InputStream</code> and <code>LogStream</code> are identical with{' '}
            <A href="/bindings/python/types#inputevent"><code>InputEvent</code></A> or{' '}
            <A href="/bindings/python/types#logline"><code>LogLine</code></A> in place of it.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Behaviour</th></tr></thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>CatchEvent</code></td><td>Blocks for the next item. Raises <A href="/bindings/python/types#subclasses"><code>DisconnectedError</code></A> when the link drops.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Optional[CatchEvent]</code></td><td>Returns immediately; <code>None</code> if nothing is queued.</td></tr>
              <tr><td><code>recv_timeout(ms)</code></td><td><code>Optional[CatchEvent]</code></td><td>Waits up to <code>ms</code> milliseconds; <code>None</code> on timeout.</td></tr>
              <tr><td><code>for ev in stream:</code></td><td>yields each item</td><td>Loops on <code>recv()</code>; ends cleanly when the link drops (no exception).</td></tr>
              <tr><td><code>clone()</code></td><td><code>EventStream</code></td><td>A second handle to the same subscription; the queue is shared. <code>EventStream</code> and <code>LogStream</code> only.</td></tr>
              <tr><td><code>close()</code> / <code>with stream:</code></td><td>none</td><td>Release the subscription. Automatic on <code>with</code> exit and GC.</td></tr>
            </tbody>
          </table>
          <p><code>InputStream</code> has no <code>clone()</code>; open a second one instead.</p>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Event objects" subtitle="The dataclasses recv() returns" />
          <p>
            Every object here is a{' '}
            <a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">dataclass</a>.
          </p>
          <pre class="diagram">{`CatchEvent
 ├─ kind    : CatchEventKind       MOTION = 0 · USAGES = 1 · TRAFFIC = 2
 ├─ ts_us   : int                  box microseconds; wraps every ~71.6 min
 ├─ clock   : ClockDomain          HOST_CHIP = 0 (real device side) · DEVICE_CHIP = 1 (clone side)
 ├─ payload : MotionEvent | UsageSnapshot | TrafficEvent
 │
 ├─ .motion  → MotionEvent | None      None unless kind == MOTION
 │               dx, dy, dz
 ├─ .usages  → UsageSnapshot | None    None unless kind == USAGES
 │               usages[], cls, direction, is_held(usage)
 └─ .traffic → TrafficEvent | None     None unless kind == TRAFFIC
                 catch_class, id, direction, flags,
                 true_len, bytes, truncated()`}</pre>
          <table class="api-params">
            <thead><tr><th>Payload</th><th>Fields</th><th>Methods</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/types#motionevent"><code>MotionEvent</code></A></td><td><code>dx: int</code>, <code>dy: int</code>, <code>dz: int</code> (the relative deltas at the merge point)</td><td>none</td></tr>
              <tr><td><A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A></td><td><code>usages: List[Usage]</code> (buttons, keys, and media, one shape), <code>cls: Class</code>, <code>direction: Direction</code></td><td><code>is_held(usage)</code>: the built <A href="/bindings/python/types#input"><code>Usage</code></A> is in the snapshot</td></tr>
              <tr><td><A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A></td><td><code>catch_class: CatchClass</code>, <code>id: int</code>, <code>direction: Direction</code>, <code>flags: int</code>, <code>true_len: int</code>, <code>bytes: bytes</code></td><td><code>truncated()</code>, <code>setup()</code>, <code>data()</code>, <code>control_status()</code>, <code>bus_event()</code>, <code>bulk_end_of_transfer()</code>, <code>bulk_zlp()</code></td></tr>
              <tr><td><A href="/bindings/python/types#inputevent"><code>InputEvent</code></A></td><td><code>kind: InputKind</code>, <code>usage: Optional[Usage]</code>, <code>dx</code>/<code>dy</code>/<code>dz</code>, <code>ts_us</code>, <code>clock</code></td><td><code>is_press</code>, <code>is_release</code></td></tr>
              <tr><td><A href="/bindings/python/types#logline"><code>LogLine</code></A></td><td><A href="/bindings/python/types#loglevel"><code>level: LogLevel</code></A>, <code>text: str</code></td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            Field meanings are on <A href="/bindings/python/types">Types &amp; errors</A>.
            Held <A href="/native/commands/usage">usage ids</A> come from the{' '}
            <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage tables</a>.{' '}
            <code>flags</code> is class-specific, and each class has an accessor that reads it:{' '}
            <code>bulk_end_of_transfer()</code> / <code>bulk_zlp()</code> on{' '}
            <code>VENDOR_BULK</code>, <A href="/bindings/python/types#controlstatus"><code>control_status()</code></A>{' '}
            on <code>CONTROL</code>, <code>bus_event()</code> on <code>BUS</code>.
          </p>
          <div class="callout callout--info">
            <p>
              Subtract two stamps only when their <code>clock</code> domains match. To put them on
              this machine's clock, use a{' '}
              <A href="/bindings/python/streams#timeline"><code>Timeline</code></A>.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              <code>EventStream</code> and <code>InputStream</code> both have a <code>dropped</code>{' '}
              property (an <code>int</code>): events the queue shed before you read them. That is the
              host-side count; the box-side one is on{' '}
              <A href="/bindings/python/types#catchstate"><code>CatchState</code></A>, both box-wide and{' '}
              <A href="/bindings/python/types#catchentry">per entry</A>. <code>LogStream</code> has no
              such counter.
            </p>
          </div>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Consume loop" subtitle="Subscribe, iterate, react" />
          <pre><code class="language-python">{`from medius import (Device, CatchFilter, CatchEventKind, Usage, Button)

with Device.find() as dev:
    filters = [
        CatchFilter.watch_axes(),                     # cursor and wheel
        CatchFilter.watch(Button.LEFT),               # one button only
    ]
    with dev.catch_events(filters) as events:
        for ev in events:                      # ends when the link drops
            if ev.kind == CatchEventKind.MOTION:
                m = ev.motion
                print(f"moved {m.dx},{m.dy}  wheel {m.dz}")
            elif ev.kind == CatchEventKind.USAGES:
                if ev.usages.is_held(Usage.button(Button.LEFT)):
                    print("left held")
            if events.dropped:
                print("fell behind:", events.dropped, "dropped")`}</code></pre>
          <div class="api-response-label">TRACE A VENDOR ENDPOINT AND THE BUS</div>
          <pre><code class="language-python">{`from medius import Device, CatchFilter, CatchEventKind, TrafficClass

VI = TrafficClass.VENDOR_INTERRUPT
filters = [
    CatchFilter.traffic_class(VI).with_capture(16),  # the rest, 16 bytes
    CatchFilter.traffic(VI, 0x83),                   # this one, whole packets
    CatchFilter.traffic_class(TrafficClass.BUS),     # resets, configures, detach
]

with Device.find() as dev:
    with dev.catch_events(filters) as events:
        for ev in events:
            if ev.kind != CatchEventKind.TRAFFIC:
                continue
            t = ev.traffic
            cut = " (cut)" if t.truncated() else ""
            print(f"{ev.ts_us:>10} {ev.clock.name:<11} {t.catch_class.name:<16} "
                  f"ep={t.id:#04x} {t.direction.name:<8} "
                  f"{len(t.bytes)}/{t.true_len} bytes{cut}  {t.bytes.hex(' ')}")`}</code></pre>
          <p>
            <code>truncated()</code> separates a clipped capture from a genuinely short packet: a
            16-byte capture of a 64-byte report and a real 16-byte report differ only in{' '}
            <code>true_len</code>.
          </p>
          <div class="api-response-label">NON-BLOCKING POLL</div>
          <pre><code class="language-python">{`events = dev.catch_events(CatchFilter.everything().with_capture(16))
while running:
    ev = events.recv_timeout(50)   # wake every 50 ms to do other work
    if ev is None:
        continue
    handle(ev)`}</code></pre>
          <div class="api-response-label">CONFIRM THE BOX TOOK THEM</div>
          <pre><code class="language-python">{`st = dev.query_catch()
if st.table_full:
    print("a filter was refused: the box's 32-entry table is full")
for e in st.entries:
    print(f"{e.filter!r}  dropped={e.dropped}")
print("box-wide dropped:", st.dropped, " clock age:", st.clock.age_ms)`}</code></pre>
        </Card>
      </div>

      <div id="input" data-search-target>
        <Card>
          <CardHeader title="Decoded input" subtitle="Press and release edges, not snapshots" />
          <p>
            The box reports held usages as a snapshot per report.{' '}
            <A href="/bindings/python/api#streams"><code>dev.input_events(filters)</code></A> diffs
            those against what it holds and yields the edges they represent.
          </p>
          <table class="api-params">
            <thead><tr><th>Member</th><th>Returns</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>recv()</code> / <code>try_recv()</code> / <code>recv_timeout(ms)</code></td><td><A href="/bindings/python/types#inputevent"><code>InputEvent</code></A></td><td>as on <code>EventStream</code>.</td></tr>
              <tr><td><code>held(input_class)</code></td><td><code>List[Usage]</code></td><td>Which usages of one <A href="/bindings/python/types#class"><code>Class</code></A> this stream currently holds.</td></tr>
              <tr><td><code>dropped</code></td><td><code>int</code></td><td>Events the queue shed before you read them.</td></tr>
            </tbody>
          </table>
          <p>
            Every filter must name an input class and cover both edges. A traffic class raises{' '}
            <code>NotAnInputFilterError</code>, <code>everything()</code> raises{' '}
            <code>WildcardNotInputError</code>, and one narrowed with <code>on_press()</code> raises{' '}
            <code>HalfEdgeInputFilterError</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-python">{`from medius import Class, CatchFilter, Device, InputKind

with Device.find() as dev:
    with dev.input_events(CatchFilter.all_input()) as inputs:
        for ev in inputs:
            if ev.kind == InputKind.MOTION:
                print(f"{ev.ts_us:>10}  move {ev.dx},{ev.dy} wheel {ev.dz}")
            else:
                edge = "down" if ev.is_press else "up"
                print(f"{ev.ts_us:>10}  {ev.usage!r} {edge}")
                print("   still held:", inputs.held(Class.KEY))`}</code></pre>
        </Card>
      </div>

      <div id="timeline" data-search-target>
        <Card>
          <CardHeader title="Timeline" subtitle="Put box stamps on this machine's clock" />
          <p>
            A catch stamp is microseconds on a chip that booted before this process did. It wraps
            every ~71.6 minutes and relates to no clock here. <code>Timeline</code> maps it onto one.
          </p>
          <table class="api-params">
            <thead><tr><th>Member</th><th>Returns</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>observe(event, now_ns=None)</code></td><td><A href="/bindings/python/types#stamped"><code>Stamped</code></A></td><td>Place one <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A> on this machine's clock. <code>now_ns</code> defaults to <a href="https://docs.python.org/3/library/time.html#time.monotonic_ns" target="_blank" rel="noreferrer"><code>time.monotonic_ns()</code></a>.</td></tr>
              <tr><td><code>reset(domain)</code></td><td>none</td><td>Forget one <A href="/bindings/python/types#clockdomain"><code>ClockDomain</code></A>'s rollover count and measured floor, for a chip that rebooted.</td></tr>
              <tr><td><code>samples(domain)</code></td><td><code>int</code></td><td>Events observed for a domain; the floor is a minimum over these.</td></tr>
            </tbody>
          </table>
          <p>
            Feed every event in as it arrives, in order. Each domain is tracked separately, and the
            mapping improves as it runs.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-python">{`from medius import CatchFilter, Device, Timeline

with Device.find() as dev:
    with dev.catch_events(CatchFilter.watch_axes()) as events, Timeline() as time:
        for ev in events:
            at = time.observe(ev)
            print(f"{at.host_ns:>16} ns  box {at.box_us} us  +{at.excess_ns} jitter")`}</code></pre>
          <p>
            <code>excess_ns</code> is how much later than the measured floor the event arrived:
            jitter, not latency.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="No async" subtitle="Build it on the non-blocking reads" />
          <div class="callout callout--warning">
            <p>
              The streams are synchronous: there are no <code>async def</code> or <code>await</code>{' '}
              methods. To feed an event loop, run <code>recv_timeout(ms)</code> or{' '}
              <code>try_recv()</code> on a worker thread (or in{' '}
              <a href="https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.run_in_executor" target="_blank" rel="noreferrer"><code>run_in_executor</code></a>). See{' '}
              <A href="/library/features/async">Async</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Streams;
