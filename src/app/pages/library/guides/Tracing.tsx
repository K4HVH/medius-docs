import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Tracing: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Tracing" subtitle="Structured diagnostics over the link" />
        <p>
          The <code>tracing</code> feature wires the crate into{' '}
          <a href="https://docs.rs/tracing" target="_blank" rel="noreferrer"><code>tracing</code></a>,
          emitting a span and events as it works the link. It adds no medius API and changes no
          behavior. Nothing prints until you install a subscriber.
        </p>
        <pre><code>cargo add medius --features tracing</code></pre>
      </Card>

      <div id="feature" data-search-target>
        <Card>
          <CardHeader title="The tracing feature" subtitle="Build-time opt-in, zero cost when off" />
          <p>
            The <code>tracing</code> Cargo feature is off by default; with it off the span and event
            macros expand to nothing, so there's no runtime cost. The crate ships no subscriber, so
            add one alongside the feature, usually{' '}
            <a href="https://docs.rs/tracing-subscriber" target="_blank" rel="noreferrer"><code>tracing-subscriber</code></a>:
          </p>
          <pre><code>cargo add tracing-subscriber</code></pre>

          <div class="callout callout--info">
            <p>
              With no subscriber installed, every span and event is dropped silently.
            </p>
          </div>
        </Card>
      </div>

      <div id="subscriber" data-search-target>
        <Card>
          <CardHeader title="Install a subscriber" subtitle="Print something to stderr" />
          <pre class="api-signature">fn tracing_subscriber::fmt::init()</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            The{' '}
            <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/index.html" target="_blank" rel="noreferrer"><code>fmt</code></a>{' '}
            subscriber writes lines to stderr; call <code>init()</code> once before opening.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

tracing_subscriber::fmt::init();

let device = Device::find()?;
device.move_rel(10, 0)?;
// stderr now carries the connect span and an INFO event, e.g.:
//   INFO connect: medius::device: connected proto_ver=1 fw_major=1 fw_minor=2 fw_patch=0`}</code></pre>

          <p>
            Transport events appear only above <code>INFO</code>, covered in{' '}
            <A href="/library/guides/tracing#filtering">filtering</A>.
          </p>
        </Card>
      </div>

      <div id="targets" data-search-target>
        <Card>
          <CardHeader title="Targets and levels" subtitle="What gets emitted and where" />

          <div class="api-response-label">TARGETS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Target</th>
                <th>Levels</th>
                <th>Emitted</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>medius::device</code></td>
                <td><code>INFO</code>, <code>DEBUG</code>, <code>WARN</code></td>
                <td>
                  The <code>connect</code> span and <code>connected</code> event (<code>INFO</code>),
                  handshake retries (<code>DEBUG</code>) and handshake failures (<code>WARN</code>),
                  query resolved (<code>DEBUG</code>) and query timed out (<code>WARN</code>), the{' '}
                  <code>reconnected</code> event (<code>INFO</code>), plus the box's own logs
                  re-emitted with <code>device_log=true</code> at their matching level.
                </td>
              </tr>
              <tr>
                <td><code>medius::transport</code></td>
                <td><code>TRACE</code></td>
                <td>
                  One event per frame written or read, with <code>dir</code> (<code>"tx"</code> or{' '}
                  <code>"rx"</code>), <code>opcode</code>, <code>seq</code>, and <code>len</code>.
                </td>
              </tr>
              <tr>
                <td><code>medius::flash</code></td>
                <td><code>INFO</code>, <code>ERROR</code></td>
                <td>
                  Reboot-into-download and esptool progress (<code>INFO</code>), tool failure
                  (<code>ERROR</code>). Present only with the{' '}
                  <A href="/library/features/flash"><code>flash</code></A> feature on.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="callout callout--info">
            <p>
              Keepalive has no target of its own; the periodic frame shows up as an ordinary{' '}
              <code>medius::transport</code> tx event.
            </p>
          </div>
        </Card>
      </div>

      <div id="filtering" data-search-target>
        <Card>
          <CardHeader title="Filter by level and target" subtitle="EnvFilter and RUST_LOG" />
          <pre class="api-signature">fn with_env_filter(self, filter: impl Into&lt;EnvFilter&gt;) -&gt; Self</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            Lower the default <code>INFO</code> floor with a per-target{' '}
            <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html" target="_blank" rel="noreferrer"><code>EnvFilter</code></a>{' '}
            (names in <A href="/library/guides/tracing#targets">targets</A>).
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// Code-side: medius events at DEBUG, everything else at the default.
tracing_subscriber::fmt()
    .with_env_filter("medius=debug")
    .init();

// Or set it at runtime instead, no recompile:
//   RUST_LOG=medius=debug ./your-program
//   RUST_LOG=medius::transport=trace ./your-program   # every frame`}</code></pre>

          <div class="callout callout--warning">
            <p>
              <code>medius::transport=trace</code> emits one line per frame in both directions. Leave
              it off unless you're chasing a wire-level bug.
            </p>
          </div>
        </Card>
      </div>

      <div id="spans" data-search-target>
        <Card>
          <CardHeader title="The connect span" subtitle="A span wraps related events" />
          <p>
            The <code>connect</code> span wraps the handshake; retry and <code>connected</code> events nest inside.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// With "medius=debug" and a box that answers on the second probe,
// the fmt subscriber prints the span name on each nested event:
//
//   DEBUG connect: medius::device: handshake: version probe timed out, retrying
//   INFO  connect: medius::device: connected proto_ver=1 fw_major=1 fw_minor=2 fw_patch=0
//
// "connect:" is the span; the rest is the event with its fields.`}</code></pre>

          <p>
            Its fields are the numbers{' '}
            <A href="/library/requests#version"><code>query_version</code></A> returns as a{' '}
            <A href="/library/types/structs#version"><code>Version</code></A>.
          </p>
        </Card>
      </div>

      <div id="frames" data-search-target>
        <Card>
          <CardHeader title="Frame-level tracing" subtitle="Every tx and rx on the wire" />
          <p>
            <code>medius::transport</code> emits one <code>TRACE</code> per frame, the per-frame mirror of the{' '}
            <A href="/library/diagnostics#counters"><code>frames_tx</code> and <code>frames_rx</code></A> tallies.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`tracing_subscriber::fmt()
    .with_env_filter("medius::transport=trace")
    .init();

let device = Device::find()?;
device.move_rel(5, 0)?;
// A move sends one frame and gets no reply, so you see a lone tx line:
//   TRACE medius::transport: dir="tx" opcode=1 seq=7 len=4
//
// A query sends one tx and reads one rx:
//   TRACE medius::transport: dir="tx" opcode=16 seq=8 len=1
//   TRACE medius::transport: dir="rx" opcode=128 seq=8 len=9`}</code></pre>

          <div class="callout callout--warning">
            <p>
              High volume. Scope it tightly (<code>medius::transport=trace</code>) and turn it off
              when done.
            </p>
          </div>
        </Card>
      </div>

      <div id="device-logs" data-search-target>
        <Card>
          <CardHeader title="Device logs as events" subtitle="The box's own LOG frames, mirrored" />
          <p>
            Every <A href="/native/commands/admin#log"><code>LOG</code></A> frame the box sends is
            emitted on <code>medius::device</code> with <code>device_log=true</code>, at the level
            matching its <A href="/library/types/enums#log-level"><code>LogLevel</code></A> (<code>Error</code>{' '}
            to <code>ERROR</code>, down to <code>Verbose</code> as <code>TRACE</code>).
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// Show only the box's own logs, nothing else from the crate:
tracing_subscriber::fmt()
    .with_env_filter("medius::device=trace")
    .init();
// A box log line then prints with the device_log field:
//   WARN medius::device: mouse detached device_log=true`}</code></pre>

          <p>
            Same data as the <A href="/library/diagnostics#logs"><code>logs</code></A> stream:
            tracing prints the lines, while <code>logs</code> hands each one back as a{' '}
            <A href="/library/types/structs#log-line"><code>LogLine</code></A> to branch on programmatically.
          </p>
        </Card>
      </div>

      <div id="reconnect" data-search-target>
        <Card>
          <CardHeader title="Reconnect events" subtitle="Seeing a dropped link recover" />
          <p>
            A rescan back onto the box fires an <code>INFO</code> <code>reconnected</code> event on{' '}
            <code>medius::device</code> with <code>port</code> and <code>reason="rescan"</code>,
            ticking the <A href="/library/diagnostics#counters"><code>reconnects</code></A> counter
            (full flow in <A href="/library/lifecycle#reconnect">reconnect</A>).
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// At default INFO level, a recovered link prints:
//   INFO medius::device: reconnected port="/dev/ttyACM0" reason="rescan"`}</code></pre>
        </Card>
      </div>

      <div id="json" data-search-target>
        <Card>
          <CardHeader title="JSON output for a log stack" subtitle="Ship structured events" />
          <pre class="api-signature">fn json(self) -&gt; SubscriberBuilder</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            Swap the formatter for JSON: each event becomes one object with its fields as keys.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`tracing_subscriber::fmt()
    .json()
    .with_env_filter("medius=debug")
    .init();
// Each event is now a JSON line, e.g.:
//   {"level":"INFO","target":"medius::device","fields":{"message":"connected","proto_ver":1}}`}</code></pre>

          <div class="callout callout--info">
            <p>
              The <code>json</code> formatter needs <code>tracing-subscriber</code>'s <code>json</code>{' '}
              feature (<code>cargo add tracing-subscriber --features json</code>); see its{' '}
              <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/struct.SubscriberBuilder.html#method.json" target="_blank" rel="noreferrer">json docs</a>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Tracing;
