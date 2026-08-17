import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Quickstart: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="First program" subtitle="Connect, move, click, read one event" />
        <p>
          One file that finds <A href="/native/hardware">the box</A>, moves the cursor, clicks, and
          reads one physical event. Install with{' '}
          <a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a>{' '}
          (<code>pip install medius</code>, see <A href="/bindings/python">Install</A>). What each
          call does lives in the <A href="/library">Rust Library</A> and{' '}
          <A href="/native">Native API</A>.
        </p>
        <div class="callout callout--info">
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span> calls return the moment
            they're queued (<A href="/native/injection#fire-and-forget">the injection model</A>);{' '}
            <span class="api-badge api-badge--responded">Blocks</span> calls wait for the box's{' '}
            <A href="/native/commands/requests">reply</A>. Either kind raises a{' '}
            <A href="/bindings/python/types#errors"><code>MediusError</code></A> on failure.
          </p>
        </div>
      </Card>

      <div id="program" data-search-target>
        <Card>
          <CardHeader title="The program" subtitle="The full listing" />
          <pre><code class="language-python">{`import time
from medius import Device, Usage, Button, CatchFilter, NotFoundError

try:
    with Device.find() as dev:                       # open first box + handshake
        v = dev.query_version()                      # blocks for one reply
        print(f"firmware {v.fw_major}.{v.fw_minor}.{v.fw_patch}, proto {v.proto_ver}")

        dev.move_rel(100, 0)                         # nudge cursor 100 right
        dev.press(Usage.button(Button.LEFT))         # hold left down
        time.sleep(0.02)
        dev.soft_release(Usage.button(Button.LEFT))  # let it back up

        with dev.catch_events(CatchFilter.everything()) as stream:  # subscribe to everything
            event = stream.recv_timeout(5000)                      # one event, or None after 5 s
            if event is None:
                print("no physical input within 5 s")
            elif event.motion:
                m = event.motion
                print(f"motion  dx={m.dx} dy={m.dy} wheel={m.dz}")
            elif event.usages and event.usages.is_held(Usage.button(Button.LEFT)):
                print("left button held")
            elif event.traffic:
                t = event.traffic
                print(f"traffic {t.catch_class.name} id={t.id:#04x} "
                      f"{len(t.bytes)} of {t.true_len} bytes")
            else:
                print(f"event  {event.kind.name}")
        # stream + link are closed here, on block exit
except NotFoundError:
    raise SystemExit("no medius box found: check the control-port cable")`}</code></pre>
          <div class="callout callout--info">
            <p>
              The cursor won't move and the click won't land on this machine: injection only reaches
              the <em>game</em> PC through the clone port, not the control PC running this script.
              See <A href="/native/hardware">Hardware</A> for the port map.
            </p>
          </div>
        </Card>
      </div>

      <div id="walkthrough" data-search-target>
        <Card>
          <CardHeader title="Walkthrough" subtitle="What each call is and where its meaning lives" />
          <table class="api-params">
            <thead>
              <tr><th>Call</th><th>Kind</th><th>Does (follow the link)</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/bindings/python/api#connect"><code>Device.find()</code></A></td>
                <td><span class="api-badge api-badge--responded">Blocks</span></td>
                <td>Open the first box and run the <A href="/native/connection#handshake">handshake</A>. See <A href="/library/connection">Connection</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/api#queries"><code>dev.query_version()</code></A></td>
                <td><span class="api-badge api-badge--responded">Blocks</span></td>
                <td>Read a <A href="/bindings/python/types#version"><code>Version</code></A>. See <A href="/library/requests">Requests</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/api#move"><code>dev.move_rel(100, 0)</code></A></td>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Relative cursor move. See <A href="/native/commands/move#move">MOVE</A> / <A href="/library/move">Move</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/api#inject"><code>dev.press(Usage.button(Button.LEFT))</code></A></td>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Hold a button. See the <A href="/native/injection#fire-and-forget">injection model</A> / <A href="/library/inject">Inject</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/api#inject"><code>dev.soft_release(Usage.button(Button.LEFT))</code></A></td>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Release, unless the user is physically holding it. See <A href="/native/injection">Injection</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/api#streams"><code>dev.catch_events(CatchFilter.everything())</code></A></td>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Subscribe with one <A href="/bindings/python/types#catchfilter"><code>CatchFilter</code></A> (or an iterable); returns an <A href="/bindings/python/streams"><code>EventStream</code></A>. See <A href="/library/catch">Catch</A>.</td>
              </tr>
              <tr>
                <td><A href="/bindings/python/streams"><code>stream.recv_timeout(5000)</code></A></td>
                <td><span class="api-badge api-badge--responded">Blocks</span></td>
                <td>Wait up to 5 s for one <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A>, or <code>None</code>. More on <A href="/bindings/python/streams">Streams</A>.</td>
              </tr>
            </tbody>
          </table>
          <p>
            <A href="/bindings/python/types#button">Button</A> ids are on{' '}
            <A href="/native/commands/usage#buttons">Usage IDs</A>; the full call surface is the{' '}
            <A href="/bindings/python/api">API index</A>.
          </p>
        </Card>
      </div>

      <div id="run" data-search-target>
        <Card>
          <CardHeader title="Run it" subtitle="One command, expected output" />
          <pre><code class="language-bash">{`python first.py
# firmware 3.1.0, proto 4
# motion  dx=8 dy=-3 wheel=0`}</code></pre>
          <p>
            The <code>motion</code> line needs a real mouse move or click inside the 5-second window.{' '}
            <code>CatchFilter.everything()</code> subscribes to every class, so a <code>traffic</code>{' '}
            line can arrive first on a device with busy vendor endpoints; narrow it with{' '}
            <code>CatchFilter.watch_axes()</code>.
          </p>
        </Card>
      </div>

      <div id="reading" data-search-target>
        <Card>
          <CardHeader title="Reading events" subtitle="Four ways to pull from a stream" />
          <p>
            The program uses <code>recv_timeout</code> so it can't hang.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Reader</th><th>Empty queue</th><th>Link dropped</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/bindings/python/streams"><code>stream.recv()</code></A></td><td>blocks forever</td><td>raises <A href="/bindings/python/types#subclasses"><code>DisconnectedError</code></A></td></tr>
              <tr><td><A href="/bindings/python/streams"><code>stream.recv_timeout(ms)</code></A></td><td>returns <code>None</code> after <code>ms</code></td><td>returns <code>None</code> (same as a timeout)</td></tr>
              <tr><td><A href="/bindings/python/streams"><code>stream.try_recv()</code></A></td><td>returns <code>None</code> at once</td><td>returns <code>None</code> (same as empty)</td></tr>
              <tr><td><code>for ev in stream:</code></td><td>blocks for each</td><td>loop ends cleanly</td></tr>
            </tbody>
          </table>
          <p>
            A <A href="/bindings/python/types#catchevent"><code>CatchEvent</code></A> carries one of{' '}
            <code>.motion</code> / <code>.usages</code> / <code>.traffic</code> (the other two are{' '}
            <code>None</code>), plus <code>.ts_us</code> and the{' '}
            <A href="/bindings/python/types#clockdomain"><code>.clock</code></A> domain that stamped it. A{' '}
            <A href="/bindings/python/types#usagesnapshot"><code>UsageSnapshot</code></A> has{' '}
            <code>is_held(usage)</code> for any built <A href="/bindings/python/types#input"><code>Usage</code></A>;
            a <A href="/bindings/python/types#trafficevent"><code>TrafficEvent</code></A> has{' '}
            <code>truncated()</code>. Full payload shapes on{' '}
            <A href="/bindings/python/streams">Streams</A>.
          </p>
          <p>
            To skip diffing snapshots yourself, subscribe with{' '}
            <A href="/bindings/python/streams#input"><code>dev.input_events()</code></A> instead: it
            yields press and release edges directly.
          </p>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="Failures raise; they're never a return code" />
          <p>
            Every <code>Device</code> and stream call raises on failure. Each exception is a{' '}
            <A href="/bindings/python/types#errors"><code>MediusError</code></A> subclass carrying{' '}
            <code>.status</code>, <code>.message</code>, and <code>.proto_ver</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>Raises</th></tr>
            </thead>
            <tbody>
              <tr><td><code>find()</code> with no box present</td><td><A href="/bindings/python/types#subclasses"><code>NotFoundError</code></A></td></tr>
              <tr><td>a <code>query_*</code> gets no reply in time</td><td><A href="/bindings/python/types#subclasses"><code>QueryTimeoutError</code></A></td></tr>
              <tr><td>the box speaks a different protocol</td><td><A href="/bindings/python/types#subclasses"><code>BadProtoVerError</code></A> (check <code>.proto_ver</code>)</td></tr>
              <tr><td>a stream read after the link drops</td><td><A href="/bindings/python/types#subclasses"><code>DisconnectedError</code></A></td></tr>
              <tr><td>any other failure</td><td>a <A href="/bindings/python/types#errors"><code>MediusError</code></A> subclass</td></tr>
            </tbody>
          </table>
          <p>
            Catch the base <code>MediusError</code> to handle them all at once. Full list and the{' '}
            <A href="/bindings/python/types#status"><code>Status</code></A> codes on{' '}
            <A href="/bindings/python/types">Types &amp; errors</A>;
            patterns on <A href="/bindings/python/usage">Calls &amp; errors</A>.
          </p>
        </Card>
      </div>

      <div id="cleanup" data-search-target>
        <Card>
          <CardHeader title="Closing" subtitle="A with-block, close(), or garbage collection" />
          <p>
            A <code>Device</code> and each stream hold a live connection. Close it three ways, all
            safe to combine:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Mechanism</th><th>Frees when</th></tr>
            </thead>
            <tbody>
              <tr><td><code>with Device.find() as dev:</code></td><td>the <a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">context manager</a> exits (used twice above, for the link and the stream)</td></tr>
              <tr><td><code>dev.close()</code></td><td>you call it; idempotent, a second call is a no-op</td></tr>
              <tr><td><a href="https://docs.python.org/3/glossary.html#term-garbage-collection" target="_blank" rel="noreferrer">garbage collection</a></td><td>the object is collected, via <a href="https://docs.python.org/3/reference/datamodel.html#object.__del__" target="_blank" rel="noreferrer"><code>__del__</code></a>, if you forgot</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/bindings/python/api#connect"><code>dev.clone()</code></A> returns another handle to the same link; the connection lives
            until the last handle is freed. See <A href="/library/lifecycle">Lifecycle</A> and the{' '}
            <A href="/library/guides/connection#keepalive">keepalive</A> thread.
          </p>
        </Card>
      </div>

      <div id="next" data-search-target>
        <Card>
          <CardHeader title="Next steps" subtitle="Further reading" />
          <table class="api-params">
            <thead>
              <tr><th>Page</th><th>For</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/bindings/python/usage">Calls &amp; errors</A></td><td>how calls, enums, and error handling work in Python</td></tr>
              <tr><td><A href="/bindings/python/streams">Streams</A></td><td>consuming catch events and device logs</td></tr>
              <tr><td><A href="/bindings/python/api">API index</A></td><td>every call, one line each, linked to what it does</td></tr>
              <tr><td><A href="/bindings/python/types">Types &amp; errors</A></td><td>the <a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">dataclasses</a>, <a href="https://docs.python.org/3/library/enum.html" target="_blank" rel="noreferrer">enums</a>, and exception tree</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Quickstart;
