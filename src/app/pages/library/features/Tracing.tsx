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
          <a href="https://docs.rs/tracing" target="_blank" rel="noreferrer"><code>tracing</code></a>:
          it emits a span and events as it works the link, but adds no medius functions and changes no
          behavior. The sections below are what it emits; you read them by installing a{' '}
          <A href="#subscriber">subscriber</A>.
        </p>
        <pre><code>cargo add medius --features tracing</code></pre>
        <p>
          Off by default; with the feature off the macros expand to nothing, so there's no runtime cost.
        </p>
      </Card>

      <div id="targets" data-search-target>
        <Card>
          <CardHeader title="Targets and levels" subtitle="What the crate emits and where" />
          <div class="api-response-label">TARGETS</div>
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
                  event (<code>INFO</code>), plus the box's own logs re-emitted with{' '}
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
                <td>Reboot-into-download and esptool progress, then tool failure. Present only with the <A href="/library/features/flash"><code>flash</code></A> feature.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Keepalive has no target of its own; its periodic frame shows up as an ordinary{' '}
              <code>medius::transport</code> tx event.
            </p>
          </div>
        </Card>
      </div>

      <div id="spans" data-search-target>
        <Card>
          <CardHeader title="The connect span" subtitle="A span wraps related events" />
          <p>
            The <code>connect</code> span wraps the handshake; retry and <code>connected</code> events
            nest inside it. Its fields are the numbers{' '}
            <A href="/library/requests#version"><code>query_version</code></A> returns as a{' '}
            <A href="/library/types/structs#version"><code>Version</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// With "medius=debug" and a box that answers on the second probe, the
// fmt subscriber prints the span name on each nested event:
//   DEBUG connect: medius::device: handshake: version probe timed out, retrying
//   INFO  connect: medius::device: connected proto_ver=1 fw_major=1 fw_minor=2 fw_patch=0
// "connect:" is the span; the rest is the event with its fields.`}</code></pre>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Frames, device logs, and reconnects" subtitle="The events worth knowing" />
          <p>
            <code>medius::transport</code> emits one <code>TRACE</code> per frame, the per-frame mirror of
            the <A href="/library/diagnostics#counters"><code>frames_tx</code> / <code>frames_rx</code></A>{' '}
            counters. Each <A href="/native/commands/admin#log"><code>LOG</code></A> frame the box sends is
            re-emitted on <code>medius::device</code> with <code>device_log=true</code> at its matching{' '}
            <A href="/library/types/enums#log-level"><code>LogLevel</code></A> (the same data the{' '}
            <A href="/library/diagnostics#logs"><code>logs</code></A> stream hands back). A recovered link
            fires an <code>INFO</code> <code>reconnected</code> event with <code>port</code> and{' '}
            <code>reason</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// medius::transport=trace, one line per frame:
//   TRACE medius::transport: dir="tx" opcode=1 seq=7 len=4
// a box log, mirrored:
//   WARN  medius::device: mouse detached device_log=true
// a recovered link:
//   INFO  medius::device: reconnected port="/dev/ttyACM0" reason="rescan"`}</code></pre>
        </Card>
      </div>

      <div id="subscriber" data-search-target>
        <Card>
          <CardHeader title="Install a subscriber" subtitle="Print the events to stderr" />
          <p>
            The crate ships no subscriber, so add one alongside the feature, usually{' '}
            <a href="https://docs.rs/tracing-subscriber" target="_blank" rel="noreferrer"><code>tracing-subscriber</code></a>.
            The <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/index.html" target="_blank" rel="noreferrer"><code>fmt</code></a>{' '}
            subscriber writes lines to stderr; call <code>init()</code> once before opening. Without one,
            every span and event is dropped silently.
          </p>
          <pre><code>cargo add tracing-subscriber</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

tracing_subscriber::fmt::init();

let device = Device::find()?;
device.move_rel(10, 0)?;
// stderr now carries the connect span and an INFO event, e.g.:
//   INFO connect: medius::device: connected proto_ver=1 fw_major=1 fw_minor=2 fw_patch=0`}</code></pre>
        </Card>
      </div>

      <div id="filtering" data-search-target>
        <Card>
          <CardHeader title="Filter by level and target" subtitle="EnvFilter and RUST_LOG" />
          <p>
            Transport events sit below the default <code>INFO</code> floor. Lower it with a per-target{' '}
            <a href="https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html" target="_blank" rel="noreferrer"><code>EnvFilter</code></a>{' '}
            (target names in <A href="#targets">targets</A>).
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
              <code>medius::transport=trace</code> emits one line per frame in both directions. Leave it
              off unless you're chasing a wire-level bug.
            </p>
          </div>
        </Card>
      </div>

      <div id="json" data-search-target>
        <Card>
          <CardHeader title="JSON output" subtitle="Ship structured events" />
          <p>
            Swap the formatter for JSON and each event becomes one object with its fields as keys. Needs{' '}
            <code>tracing-subscriber</code>'s <code>json</code> feature.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// cargo add tracing-subscriber --features json
tracing_subscriber::fmt()
    .json()
    .with_env_filter("medius=debug")
    .init();
// Each event is now a JSON line, e.g.:
//   {"level":"INFO","target":"medius::device","fields":{"message":"connected","proto_ver":1}}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Tracing;
