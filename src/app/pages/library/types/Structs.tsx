import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Structs: Component = () => {
  return (
    <>
      <div id="structs" data-search-target>
        <Card>
          <CardHeader title="Structs" subtitle="Values the box reports back" />
          <p>
            Five plain value types you get back from queries and discovery. Their fields are public.
          </p>
        </Card>
      </div>
      <div id="version" data-search-target>
        <Card>
          <CardHeader title="Version" subtitle="Firmware identity" />
          <p>
            Firmware identity from{' '}
            <A href="/library/requests#version"><code>query_version()</code></A>. <code>Display</code>{' '}
            prints <code>fw M.m.p</code> and omits <code>proto_ver</code>; read it from the field.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>proto_ver</code></td><td><code>u8</code></td><td>Wire-protocol version the firmware speaks (<code>1</code> here).</td></tr>
              <tr><td><code>fw_major</code></td><td><code>u8</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td><code>u8</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td><code>u8</code></td><td>Firmware patch version.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Version;

let v = Version { proto_ver: 1, fw_major: 2, fw_minor: 0, fw_patch: 3 };
assert_eq!(v.to_string(), "fw 2.0.3"); // Display omits proto_ver
println!("{v} (protocol {})", v.proto_ver);`}</code></pre>
        </Card>
      </div>
      <div id="health" data-search-target>
        <Card>
          <CardHeader title="Health" subtitle="Box readiness flags" />
          <p>
            Box readiness from <A href="/library/requests#health"><code>query_health()</code></A>, one
            bool per bit. <code>from_flags(u8)</code> and <code>to_flags()</code> convert the byte.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>True when</th></tr></thead>
            <tbody>
              <tr><td><code>link_up</code></td><td><code>bool</code></td><td>The link to the host chip is up.</td></tr>
              <tr><td><code>mouse_attached</code></td><td><code>bool</code></td><td>A real mouse is plugged in.</td></tr>
              <tr><td><code>clone_configured</code></td><td><code>bool</code></td><td>The PC has set up the cloned mouse.</td></tr>
              <tr><td><code>injection_active</code></td><td><code>bool</code></td><td>The box is holding at least one injected button or move.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Health;

let h = Health::from_flags(0b0000_0011); // link_up | mouse_attached
assert!(h.link_up && h.mouse_attached);
assert!(!h.clone_configured);
assert_eq!(h.to_flags(), 0b0000_0011); // round-trips to the same byte`}</code></pre>
        </Card>
      </div>
      <div id="log-line" data-search-target>
        <Card>
          <CardHeader title="LogLine" subtitle="One line from the LOG stream" />
          <p>
            One line from the box's <A href="/native/commands/admin#log"><code>LOG</code></A> stream,
            read off a <A href="/library/types/structs#logstream"><code>LogStream</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>level</code></td><td><A href="/library/types/enums#log-level"><code>LogLevel</code></A></td><td>Severity tag.</td></tr>
              <tr><td><code>text</code></td><td><code>String</code></td><td>The decoded message.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="port-info" data-search-target>
        <Card>
          <CardHeader title="PortInfo" subtitle="A discovered serial port" />
          <p>
            A serial port that looks like a Medius box, from{' '}
            <A href="/library/connection#choosing-a-port"><code>find_medius()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>path</code></td><td><code>String</code></td><td>Serial port path.</td></tr>
              <tr><td><code>vid</code></td><td><code>u16</code></td><td>USB vendor id (<code>0x1A86</code>).</td></tr>
              <tr><td><code>pid</code></td><td><code>u16</code></td><td>USB product id (<code>0x55D3</code>).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="counters-snapshot" data-search-target>
        <Card>
          <CardHeader title="CountersSnapshot" subtitle="Link statistics snapshot" />
          <p>
            Four running link totals from{' '}
            <A href="/library/diagnostics#counters"><code>counters()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>frames_tx</code></td><td><code>u64</code></td><td>Frames sent to the box.</td></tr>
              <tr><td><code>frames_rx</code></td><td><code>u64</code></td><td>Frames received from the box.</td></tr>
              <tr><td><code>crc_drops</code></td><td><code>u64</code></td><td>Inbound frames dropped on a bad <A href="/native/frame#crc">checksum</A>.</td></tr>
              <tr><td><code>reconnects</code></td><td><code>u64</code></td><td>Times the library reopened the port.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="logstream" data-search-target>
        <Card>
          <CardHeader title="LogStream" subtitle="Receiver for the device LOG stream" />
          <p>
            Receives the box's <A href="/native/commands/admin#log"><code>LOG</code></A> frames as{' '}
            <code>LogLine</code> values off a local channel, from{' '}
            <A href="/library/diagnostics#logs"><code>device.logs()</code></A>.
          </p>

          <pre class="api-signature">fn recv(&self) -&gt; Result&lt;LogLine&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>Block until the next line arrives, or <code>Err(Disconnected)</code> if the link drops.</p>

          <pre class="api-signature">fn try_recv(&self) -&gt; Option&lt;LogLine&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>The next buffered line, or <code>None</code> if nothing is queued. Never blocks.</p>

          <pre class="api-signature">fn recv_timeout(&self, timeout: Duration) -&gt; Option&lt;LogLine&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>Block up to <code>timeout</code> for the next line; <code>None</code> on timeout.</p>

          <pre class="api-signature">fn try_iter(&self) -&gt; impl Iterator&lt;Item = LogLine&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">No round-trip</span>
          </p>
          <p>
            Drain every buffered line without blocking;{' '}
            <a
              href="https://doc.rust-lang.org/std/iter/trait.IntoIterator.html"
              target="_blank"
              rel="noreferrer"
            >
              <code>IntoIterator</code>
            </a>{' '}
            lets <code>for line in stream</code> block per line until the link closes.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let stream = device.logs();

// Drain whatever has piled up so far, no blocking.
for line in stream.try_iter() {
    println!("[{:?}] {}", line.level, line.text);
}

// Then block once for the next line.
if let Ok(line) = stream.recv() {
    println!("[{:?}] {}", line.level, line.text);
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              See <A href="/library/diagnostics#logs">Logs</A> for where the stream comes from and
              when the box emits <A href="/native/commands/admin#log"><code>LOG</code></A> frames.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Structs;
