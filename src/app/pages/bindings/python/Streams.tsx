import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Streams: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Streams" subtitle="Consume live input and device logs" />
        <p>
          <A href="/native/hardware">The box</A> has two live channels: the traffic it carries
          (<A href="/library/catch">Catch</A>: physical input, and the USB bytes behind it) and its own
          log lines (<A href="/library/diagnostics">Logs &amp; counters</A>).
          Subscribe to each with a method on an open <A href="/bindings/python/api">Device</A>, then pull items
          off the returned stream. What an event <em>means</em> lives on those pages; this page covers reading
          them in <a href="https://www.python.org" target="_blank" rel="noreferrer">Python</a>.
        </p>
        <pre class="diagram">{`  physical mouse / keyboard          the traffic the box carries
            │   (also forwarded       (vendor endpoints, control
            │    to the game PC)       transactions, bus events)
            ▼                                  ▼
   ┌─────────────────┐                         ┌─────────────┐
   │   medius box    │ catch_events(filters) ─▶│ EventStream │ ─▶ recv() ─▶ CatchEvent
   │                 │                         ├─────────────┤
   │                 │ logs()                ─▶│  LogStream  │ ─▶ recv() ─▶ LogLine
   └─────────────────┘                         └─────────────┘`}</pre>
        <div class="callout callout--info">
          <p>
            Both streams are{' '}
            <a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">context managers</a>{' '}
            and iterable. Use <code>with</code> so the subscription is released on exit, and{' '}
            <code>for item in stream:</code> to drain it until <A href="/library/lifecycle">the link drops</A>.
          </p>
        </div>
      </Card>

      <div id="subscribe" data-search-target>
        <Card>
          <CardHeader title="Subscribe" subtitle="Open a stream from a Device" />
          <p>
            Both calls live on the <code>Device</code>. They send a subscribe request to the box and
            hand back a stream object.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Returns</th><th>Channel</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.catch_events(filters=CatchFilter.all())</code></A></td><td><code>EventStream</code></td><td>the subscribed traffic: input, raw HID, vendor endpoints, control transactions, bus events (see <A href="/library/catch">Catch</A>)</td></tr>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.logs()</code></A></td><td><code>LogStream</code></td><td>device log lines (see <A href="/library/diagnostics">Logs &amp; counters</A>)</td></tr>
            </tbody>
          </table>
          <p>
            <code>filters</code> is one <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A>{' '}
            or an iterable of them. Each names an address, a{' '}
            <A href="/bindings/python/types#catchclass"><code>CatchClass</code></A> plus an id inside
            that class, with an optional direction and <code>snaplen</code>. The box holds them as a
            32-entry table; <code>CatchFilter.all()</code> is the one-line "everything".
          </p>
          <pre class="api-signature">{`CatchFilter.all()                    # class ANY, every id, both directions
CatchFilter.of_class(cls)            # one whole class
CatchFilter.addr(cls, id)            # one id inside a class
  .with_direction(direction)         # LockDirection, default BOTH
  .with_snaplen(n)                   # bytes kept per event, default 0 = whole packet`}</pre>
          <table class="api-params">
            <thead><tr><th>CatchClass</th><th>Value</th><th>id addresses</th><th>Yields</th></tr></thead>
            <tbody>
              <tr><td><code>BUTTON / KEY / MEDIA</code></td><td><code>0 / 1 / 2</code></td><td>a button slot, key usage, or Consumer usage</td><td><code>UsageSnapshot</code></td></tr>
              <tr><td><code>AXIS</code></td><td><code>3</code></td><td>X, Y, or the wheel</td><td><code>MotionEvent</code></td></tr>
              <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>a HID interface number</td><td rowspan="7"><code>TrafficEvent</code></td></tr>
              <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>an interrupt-OUT endpoint address</td></tr>
              <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>a vendor interrupt endpoint address</td></tr>
              <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>a vendor bulk endpoint address</td></tr>
              <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>a control endpoint number (<code>0</code> = EP0)</td></tr>
              <tr><td><code>EMIT</code></td><td><code>9</code></td><td>an emitting interface number</td></tr>
              <tr><td><code>BUS</code></td><td><code>10</code></td><td>nothing; the bus lifecycle</td></tr>
              <tr><td><code>ANY</code></td><td><code>0xFF</code></td><td>every class at once</td><td>all three</td></tr>
            </tbody>
          </table>
          <p>
            Pass <code>CATCH_ID_ALL</code> (<code>0xFFFF</code>, the default) for every id in a class.
            Matching is most-specific-first, so an exact <code>(cls, id)</code> beats a class blanket
            and a blanket beats <code>ANY</code>; the winning filter is the one whose{' '}
            <code>snaplen</code> applies. Full semantics on{' '}
            <A href="/bindings/python/types#catchfilter">Types</A> and <A href="/library/catch">Catch</A>.
          </p>
          <div class="callout callout--warning">
            <p>
              Subscribing is <A href="/native/injection#fire-and-forget">fire-and-forget</A>: a filter
              the box refuses (unknown class, bad direction, a table already holding 32 entries) raises
              nothing here. Read it back with{' '}
              <A href="/bindings/python/api#queries"><code>dev.query_catch()</code></A>, whose{' '}
              <A href="/bindings/python/types#catchstate"><code>CatchState.entries</code></A> is what
              the box actually holds and whose <code>table_full</code> says the table was the reason.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              The address is the filter because the control link cannot carry everything: it runs at
              4 Mbaud and vendor bulk alone measures 250 KiB/s through the box. Events drain in three
              strict-priority queues (input and bus, then the byte-oriented classes, then vendor
              bulk), so a busy mouse can starve a bulk trace completely. Narrow the class, or cut{' '}
              <code>snaplen</code>, rather than subscribing wide and hoping.
            </p>
          </div>
        </Card>
      </div>

      <div id="receive" data-search-target>
        <Card>
          <CardHeader title="Receive" subtitle="Block, poll, time out, or iterate" />
          <p>
            Four read methods (<code>recv</code>, <code>try_recv</code>, <code>recv_timeout</code>, <code>iterate</code>) are on both
            streams, plus <code>clone()</code> and <code>close()</code> for lifecycle. The table shows <code>EventStream</code>{' '}
            (yielding <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A>); <code>LogStream</code> is identical with{' '}
            <A href="/bindings/python/types#logline"><code>LogLine</code></A> in place of <code>CatchEvent</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Behaviour</th></tr></thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>CatchEvent</code></td><td>Blocks for the next item. Raises <A href="/bindings/python/types#subclasses"><code>DisconnectedError</code></A> when the link drops.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Optional[CatchEvent]</code></td><td>Returns immediately; <code>None</code> if nothing is queued.</td></tr>
              <tr><td><code>recv_timeout(ms)</code></td><td><code>Optional[CatchEvent]</code></td><td>Waits up to <code>ms</code> milliseconds; <code>None</code> on timeout.</td></tr>
              <tr><td><code>for ev in stream:</code></td><td>yields each item</td><td>Loops on <code>recv()</code>; ends cleanly when the link drops (no exception).</td></tr>
              <tr><td><code>clone()</code></td><td><code>EventStream</code></td><td>A second handle to the same subscription; the queue is shared.</td></tr>
              <tr><td><code>close()</code> / <code>with stream:</code></td><td>none</td><td>Release the subscription. Automatic on <code>with</code> exit and GC.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Event objects" subtitle="What recv() hands back" />
          <p>
            A <code>CatchEvent</code> carries a <code>kind</code>, a timestamp with the clock that
            stamped it, and one of three payloads. Read the payload by kind, or use the typed
            accessors that return <code>None</code> for the wrong kind. Every object here is a{' '}
            <a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">dataclass</a>.
          </p>
          <pre class="diagram">{`CatchEvent
 ├─ kind    : CatchEventKind       MOTION = 0 · USAGES = 1 · TRAFFIC = 2
 ├─ ts_us   : int                  box microseconds; wraps every ~71.6 min
 ├─ clk     : ClockDomain          HOST = 0 (real device side) · DEVICE = 1 (clone side)
 ├─ payload : MotionEvent | UsageSnapshot | TrafficEvent
 │
 ├─ .motion  → MotionEvent | None      None unless kind == MOTION
 │               dx, dy, dz, clk
 ├─ .usages  → UsageSnapshot | None    None unless kind == USAGES
 │               usages[], clk, is_held(usage)
 └─ .traffic → TrafficEvent | None     None unless kind == TRAFFIC
                 cls, id, direction, flags,
                 true_len, data, truncated()`}</pre>
          <table class="api-params">
            <thead><tr><th>Payload</th><th>Fields</th><th>Method</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/types#motionevent"><code>MotionEvent</code></A></td><td><code>dx: int</code>, <code>dy: int</code>, <code>dz: int</code> (the relative deltas at the merge point), <code>clk</code></td><td>none</td></tr>
              <tr><td><A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A></td><td><code>usages: List[Usage]</code> (buttons, keys, and media, one shape), <code>clk</code></td><td><code>is_held(usage)</code>: the built <A href="/bindings/python/types#input"><code>Usage</code></A> is in the snapshot</td></tr>
              <tr><td><A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A></td><td><code>cls: CatchClass</code>, <code>id: int</code>, <code>direction: LockDirection</code>, <code>flags: int</code>, <code>true_len: int</code>, <code>data: bytes</code></td><td><code>truncated()</code>: <code>len(data) &lt; true_len</code>, so <code>snaplen</code> cut bytes</td></tr>
              <tr><td><A href="/bindings/python/types#logline"><code>LogLine</code></A></td><td><A href="/bindings/python/types#loglevel"><code>level: LogLevel</code></A>, <code>text: str</code></td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            Field meanings and the full type tables are on <A href="/bindings/python/types">Types &amp; errors</A>.
            Held <A href="/native/commands/usage">usage ids</A> come from the{' '}
            <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage tables</a>.{' '}
            <code>flags</code> is class-specific: end-of-transfer and zero-length-packet bits on{' '}
            <code>VEND_BULK</code>, the real device's answer (<code>0</code> OK, <code>0xFD</code>{' '}
            STALL, <code>0xFE</code> NAK-to-timeout) on <code>CONTROL</code>, and the{' '}
            <A href="/bindings/python/types#busevent"><code>BusEvent</code></A> kind on <code>BUS</code>.
          </p>
          <div class="callout callout--info">
            <p>
              <code>clk</code> exists because the box is two chips whose timers start independently:{' '}
              <code>HOST</code> stamps what the real device did, <code>DEVICE</code> stamps what
              happened on the clone side (<code>HID_OUT</code>, every OUT transfer, and{' '}
              <code>CONTROL / EMIT / BUS</code>). Subtract two stamps only
              when their domains match; to cross domains, apply the measured offset in{' '}
              <A href="/bindings/python/types#clockestimate"><code>CatchState.clock</code></A> and
              respect its error bound.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              <code>EventStream</code> has a <code>dropped</code> property (an <code>int</code>): events
              the box queued that you didn't <code>recv()</code> fast enough, so the queue shed them.
              That is the host-side count. The box-side one is on{' '}
              <A href="/bindings/python/types#catchstate"><code>CatchState</code></A>, both box-wide and{' '}
              <A href="/bindings/python/types#catchentry">per entry</A>. The per-entry count is the
              one that says <em>which</em> subscription is overflowing. <code>LogStream</code> has no such
              counter.
            </p>
          </div>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Consume loop" subtitle="Subscribe, iterate, react" />
          <pre><code class="language-python">{`from medius import (Device, CatchClass, CatchFilter, CatchEventKind,
                    Usage, Button)

with Device.find() as dev:
    filters = [
        CatchFilter.of_class(CatchClass.AXIS),               # cursor and wheel
        CatchFilter.addr(CatchClass.BUTTON, Button.LEFT),    # one button only
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
          <pre><code class="language-python">{`from medius import Device, CatchClass, CatchFilter, CatchEventKind

filters = [
    CatchFilter.of_class(CatchClass.VEND_INTR).with_snaplen(16),  # the rest, 16 bytes
    CatchFilter.addr(CatchClass.VEND_INTR, 0x83),                 # this one, whole packets
    CatchFilter.of_class(CatchClass.BUS),                         # resets, configures, detach
]

with Device.find() as dev:
    with dev.catch_events(filters) as events:
        for ev in events:
            if ev.kind != CatchEventKind.TRAFFIC:
                continue
            t = ev.traffic
            cut = " (cut)" if t.truncated() else ""
            print(f"{ev.ts_us:>10} {ev.clk.name:<6} {t.cls.name:<9} ep={t.id:#04x} "
                  f"{t.direction.name:<8} {len(t.data)}/{t.true_len} bytes{cut}"
                  f"  {t.data.hex(' ')}")`}</code></pre>
          <p>
            The exact filter beats the class blanket, so <code>0x83</code> arrives whole while every
            other vendor interrupt endpoint is clipped to 16 bytes. <code>truncated()</code> tells the
            two apart on arrival: a 16-byte capture of a 64-byte report and a real 16-byte report look
            identical without <code>true_len</code>.
          </p>
          <div class="api-response-label">NON-BLOCKING POLL</div>
          <pre><code class="language-python">{`events = dev.catch_events(CatchFilter.all())
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
    print(f"{e.cls.name:<9} id={e.id:#06x} {e.direction.name:<8} "
          f"snaplen={e.snaplen:<3} dropped={e.dropped}")
print("box-wide dropped:", st.dropped, " clock age:", st.clock.age_ms)`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="No async" subtitle="Build it on the timeout / non-blocking reads" />
          <div class="callout callout--warning">
            <p>
              The streams are synchronous. There are no <code>async def</code> or <code>await</code>{' '}
              methods. To feed an event loop, drive it yourself: run <code>recv_timeout(ms)</code> or{' '}
              <code>try_recv()</code> on a worker thread (or in{' '}
              <a href="https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.run_in_executor" target="_blank" rel="noreferrer"><code>run_in_executor</code></a>) and hand
              items to your loop. The pattern is the same in every binding; see{' '}
              <A href="/library/features/async">Async</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Streams;
