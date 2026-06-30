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
          <A href="/native/hardware">The box</A> has two live channels: physical input it forwards to the PC
          (<A href="/library/catch">Catch</A>) and its own log lines (<A href="/library/diagnostics">Logs &amp; counters</A>).
          Subscribe to each with a method on an open <A href="/bindings/python/api">Device</A>, then pull items
          off the returned stream. What an event <em>means</em> lives on those pages; this page covers reading
          them in <a href="https://www.python.org" target="_blank" rel="noreferrer">Python</a>.
        </p>
        <pre class="diagram">{`  physical mouse / keyboard
            │   (also forwarded to the game PC)
            ▼
   ┌─────────────────┐                         ┌─────────────┐
   │   medius box    │  catch_events(mask)   ─▶│ EventStream │ ─▶ recv() → CatchEvent
   │                 │                         ├─────────────┤
   │                 │  logs()               ─▶│  LogStream  │ ─▶ recv() → LogLine
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
              <tr><td><A href="/bindings/python/api#streams"><code>dev.catch_events(mask=CatchMask.ALL)</code></A></td><td><code>EventStream</code></td><td>physical mouse / key / media events (see <A href="/library/catch">Catch</A>)</td></tr>
              <tr><td><A href="/bindings/python/api#streams"><code>dev.logs()</code></A></td><td><code>LogStream</code></td><td>device log lines (see <A href="/library/diagnostics">Logs &amp; counters</A>)</td></tr>
            </tbody>
          </table>
          <p>
            <code>mask</code> is a <A href="/bindings/python/types#catchmask"><code>CatchMask</code></A>, an{' '}
            <a href="https://docs.python.org/3/library/enum.html" target="_blank" rel="noreferrer"><code>IntFlag</code></a>,
            so OR the categories you want (<code>CatchMask.MOTION | CatchMask.BUTTONS</code>). It
            defaults to <code>ALL</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>CatchMask member</th><th>Value</th><th>Selects</th></tr></thead>
            <tbody>
              <tr><td><code>CatchMask.MOTION</code></td><td><code>1</code></td><td>cursor movement (dx / dy)</td></tr>
              <tr><td><code>CatchMask.WHEEL</code></td><td><code>2</code></td><td>wheel ticks</td></tr>
              <tr><td><code>CatchMask.BUTTONS</code></td><td><code>4</code></td><td>mouse buttons</td></tr>
              <tr><td><code>CatchMask.KEYS</code></td><td><code>8</code></td><td>keyboard and media keys</td></tr>
              <tr><td><code>CatchMask.ALL</code></td><td><code>15</code></td><td>every category (the default)</td></tr>
            </tbody>
          </table>
          <p>Exactly what each bit selects is on <A href="/library/catch">Catch</A>.</p>
        </Card>
      </div>

      <div id="receive" data-search-target>
        <Card>
          <CardHeader title="Receive" subtitle="Block, poll, time out, or iterate" />
          <p>
            The same four read methods are on both streams. The table shows <code>EventStream</code>{' '}
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
            A <code>CatchEvent</code> carries a <code>kind</code> and one payload. Read the payload by
            kind, or use the typed accessors that return <code>None</code> for the wrong kind. Every
            object here is a{' '}
            <a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">dataclass</a>.
          </p>
          <pre class="diagram">{`CatchEvent
 ├─ kind : CatchEventKind             (MOUSE = 0 · KEYBOARD = 1 · MEDIA = 2)
 ├─ payload : MouseEvent | KeyboardEvent | MediaEvent
 ├─ .mouse     → MouseEvent | None    (None unless kind == MOUSE)
 ├─ .keyboard  → KeyboardEvent | None
 ├─ .media     → MediaEvent | None
 └─ .is_pressed(target) → bool        (delegates to the payload)`}</pre>
          <table class="api-params">
            <thead><tr><th>Payload</th><th>Fields</th><th>is_pressed(target)</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/types#mouseevent"><code>MouseEvent</code></A></td><td><code>buttons: int</code>, <code>dx: int</code>, <code>dy: int</code>, <code>wheel: int</code></td><td><code>is_pressed(button)</code> tests the <A href="/bindings/python/types#button"><code>Button</code></A> bit (<A href="/native/commands/usage#buttons">button ids</A>) in <code>buttons</code></td></tr>
              <tr><td><A href="/bindings/python/types#keyboardevent"><code>KeyboardEvent</code></A></td><td><code>modifiers: int</code>, <code>keys: List[int]</code> (<A href="/native/commands/usage#keycodes">HID keycodes</A>)</td><td><code>is_pressed(key)</code>: modifier bit for <code>0xE0–0xE7</code>, else membership in <code>keys</code></td></tr>
              <tr><td><A href="/bindings/python/types#mediaevent"><code>MediaEvent</code></A></td><td><code>keys: List[int]</code> (<A href="/native/commands/usage#consumer">Consumer usages</A>)</td><td><code>is_pressed(media)</code>: membership in <code>keys</code></td></tr>
              <tr><td><code>LogLine</code></td><td><A href="/bindings/python/types#loglevel"><code>level: LogLevel</code></A>, <code>text: str</code></td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            Field meanings and the full enum tables are on <A href="/bindings/python/types">Types &amp; errors</A>.
            The raw key and media ids come from the{' '}
            <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage tables</a>.
          </p>
          <div class="callout callout--info">
            <p>
              <code>EventStream</code> has a <code>dropped</code> property (an <code>int</code>): events
              the box queued that you didn't <code>recv()</code> fast enough, so the queue shed them.
              Read it to tell when you fell behind. <code>LogStream</code> has no such counter.
            </p>
          </div>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Consume loop" subtitle="Subscribe, iterate, react" />
          <pre><code class="language-python">{`from medius import Device, CatchMask, CatchEventKind, Button

with Device.find() as dev:
    with dev.catch_events(CatchMask.MOTION | CatchMask.BUTTONS) as events:
        for ev in events:                      # ends when the link drops
            if ev.kind == CatchEventKind.MOUSE:
                m = ev.mouse
                if m.is_pressed(Button.LEFT):
                    print(f"left held, moved {m.dx},{m.dy}")
            if events.dropped:
                print("fell behind:", events.dropped, "dropped")`}</code></pre>
          <div class="api-response-label">NON-BLOCKING POLL</div>
          <pre><code class="language-python">{`events = dev.catch_events()
while running:
    ev = events.recv_timeout(50)   # wake every 50 ms to do other work
    if ev is None:
        continue
    handle(ev)`}</code></pre>
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
