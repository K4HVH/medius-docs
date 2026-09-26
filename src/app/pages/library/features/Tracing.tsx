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
          The <code>tracing</code> feature emits a span and events to{' '}
          <a href="https://docs.rs/tracing" target="_blank" rel="noreferrer"><code>tracing</code></a>{' '}
          as the crate works the link, with no new functions and no behaviour change. A{' '}
          <A href="/library/features/tracing#subscriber">subscriber</A> reads them.
        </p>
        <pre><code class="language-bash">cargo add medius --features tracing</code></pre>
        <p>
          Off by default; off, the macros expand to nothing and cost nothing at runtime.
        </p>
      </Card>

      <div id="targets" data-search-target>
        <Card>
          <CardHeader title="Targets and levels" subtitle="What the crate emits and where" />
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th>Levels</th><th>Emitted</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>medius::device</code></td>
                <td><code>INFO</code>, <code>DEBUG</code>, <code>WARN</code></td>
                <td>
                  The <code>connect</code> span and <code>connected</code> event (<code>INFO</code>),
                  handshake retries (<code>DEBUG</code>) and failures (<code>WARN</code>), query resolved
                  (<code>DEBUG</code>) and timed out (<code>WARN</code>), the <code>reconnected</code>{' '}
                  event (<code>INFO</code>), plus box logs re-emitted with{' '}
                  <code>device_log=true</code>.
                </td>
              </tr>
              <tr>
                <td><code>medius::transport</code></td>
                <td><code>TRACE</code></td>
                <td>One event per frame written or read, with <code>dir</code>, <code>opcode</code>, <code>seq</code>, and <code>len</code>.</td>
              </tr>
              <tr>
                <td><code>medius::flash</code></td>
                <td><code>INFO</code>, <code>ERROR</code></td>
                <td><A href="/library/update">Firmware update</A> progress and refusals.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Keepalive frames show up as ordinary <code>medius::transport</code> tx events.
            </p>
          </div>
        </Card>
      </div>

      <div id="spans" data-search-target>
        <Card>
          <CardHeader title="connect span" subtitle="A span wraps related events" />
          <p>
            The <code>connect</code> span wraps the handshake; retry and <code>connected</code> events
            nest inside it. Its fields are the numbers{' '}
            <A href="/library/requests#version"><code>query_version</code></A> returns as a{' '}
            <A href="/library/types/structs#version"><code>Version</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// With "medius=debug" and a box that replies on the second probe, the
// fmt subscriber prints the span name on each nested event:
//   DEBUG connect: medius::device: handshake: version probe timed out, retrying
//   INFO  connect: medius::device: connected proto_ver=9 fw_major=3 fw_minor=4 fw_patch=2
// "connect:" is the span; the rest is the event with its fields.`}</code></pre>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Frames, device logs, and reconnects" subtitle="Transport, log and recovery events" />
          <p>
            <code>medius::transport</code> events mirror the{' '}
            <A href="/library/diagnostics#counters"><code>frames_tx</code> / <code>frames_rx</code></A>{' '}
            counters per frame. A re-emitted <A href="/native/commands/admin#log"><code>LOG</code></A>{' '}
            frame keeps its <A href="/library/types/enums#log-level"><code>LogLevel</code></A> and the
            text the <A href="/library/diagnostics#logs"><code>logs</code></A> stream yields. A
            recovered link fires <code>reconnected</code> with <code>port</code> and{' '}
            <code>reason</code>; <A href="/library/lifecycle#restart">session recovery</A> fires{' '}
            <code>device chip restarted</code> for a boot and{' '}
            <code>the box released the session</code> for a release.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// medius::transport=trace, one line per frame:
//   TRACE medius::transport: dir="tx" opcode=1 seq=7 len=4
// a box log, mirrored:
//   WARN  medius::device: mouse detached device_log=true
// a recovered link:
//   INFO  medius::device: reconnected port="/dev/ttyACM0" reason="rescan"
// a restarted device chip, and a session the box released:
//   INFO  medius::device: device chip restarted
//   INFO  medius::device: the box released the session session=3`}</code></pre>
        </Card>
      </div>

      <div id="subscriber" data-search-target>
        <Card>
          <CardHeader title="Install a subscriber" subtitle="Print the events to stderr" />
          <p>
            Add a subscriber alongside the feature, usually{' '}
            <a href="https://docs.rs/tracing-subscriber" target="_blank" rel="noreferrer"><code>tracing-subscriber</code></a>,
            whose <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/index.html" target="_blank" rel="noreferrer"><code>fmt</code></a>{' '}
            subscriber writes lines to stderr; call <code>init()</code> once before opening. Without one,
            every span and event is discarded.
          </p>
          <pre><code class="language-bash">cargo add tracing-subscriber</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

tracing_subscriber::fmt::init();

let device = Device::find()?;
device.move_rel(10, 0)?;
// stderr carries the connect span and an INFO event, e.g.:
//   INFO  connect: medius::device: connected proto_ver=9 fw_major=3 fw_minor=4 fw_patch=2`}</code></pre>
        </Card>
      </div>

      <div id="filtering" data-search-target>
        <Card>
          <CardHeader title="Filter by level and target" subtitle="EnvFilter and RUST_LOG" />
          <p>
            Transport events sit below the default <code>INFO</code> floor. Lower it with a per-target{' '}
            <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html" target="_blank" rel="noreferrer"><code>EnvFilter</code></a>{' '}
            (target names in <A href="/library/features/tracing#targets">targets</A>).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// Code-side: medius events at DEBUG, everything else at the default.
tracing_subscriber::fmt()
    .with_env_filter("medius=debug")
    .init();

// Or at runtime, no recompile:
//   RUST_LOG=medius=debug ./your-program
//   RUST_LOG=medius::transport=trace ./your-program   # every frame`}</code></pre>
          <div class="callout callout--warning">
            <p>
              <code>medius::transport=trace</code> emits one line per frame in both directions; use it
              for wire-level bugs.
            </p>
          </div>
        </Card>
      </div>

      <div id="json" data-search-target>
        <Card>
          <CardHeader title="JSON output" subtitle="Structured events" />
          <p>
            The JSON formatter writes each event as one object, fields as keys. Needs{' '}
            <code>tracing-subscriber</code>'s <code>json</code> feature.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// cargo add tracing-subscriber --features json
tracing_subscriber::fmt()
    .json()
    .with_env_filter("medius=debug")
    .init();
// one JSON line per event, e.g.:
//   {"level":"INFO","target":"medius::device","fields":{"message":"connected","proto_ver":9}}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Tracing;
