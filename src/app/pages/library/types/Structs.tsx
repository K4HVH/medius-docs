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
            Plain value types you get back from queries and discovery. Their fields are public.
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
              <tr><td><code>rate_confident</code></td><td><code>bool</code></td><td>The native-rate estimator window is full, so <A href="/library/types/structs#rate"><code>Rate</code></A> is trustworthy.</td></tr>
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
      <div id="mouse-info" data-search-target>
        <Card>
          <CardHeader title="MouseInfo" subtitle="The cloned mouse's USB identity" />
          <p>
            USB identity from{' '}
            <A href="/library/requests#query-mouse-info"><code>query_mouse_info()</code></A>. Every
            field is zero when no mouse is cloned. <code>Display</code> prints <code>VVVV:PPPP</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>vid</code></td><td><code>u16</code></td><td>USB vendor id (idVendor).</td></tr>
              <tr><td><code>pid</code></td><td><code>u16</code></td><td>USB product id (idProduct).</td></tr>
              <tr><td><code>bcd_device</code></td><td><code>u16</code></td><td>Device release (bcdDevice).</td></tr>
              <tr><td><code>bcd_usb</code></td><td><code>u16</code></td><td>USB version (bcdUSB), e.g. <code>0x0200</code>.</td></tr>
              <tr><td><code>has_serial</code></td><td><code>bool</code></td><td>The clone serves a serial string.</td></tr>
              <tr><td><code>has_bos</code></td><td><code>bool</code></td><td>The clone serves a BOS descriptor.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::MouseInfo;

let m = MouseInfo { vid: 0x046D, pid: 0xC08B, bcd_device: 0, bcd_usb: 0x0201, has_serial: true, has_bos: true };
assert_eq!(m.to_string(), "046D:C08B"); // Display is VVVV:PPPP`}</code></pre>
        </Card>
      </div>
      <div id="caps" data-search-target>
        <Card>
          <CardHeader title="Caps" subtitle="What the emulated mouse can do" />
          <p>
            Semantic capabilities from <A href="/library/requests#query-caps"><code>query_caps()</code></A>.
            Every field is zero when no relative-axis mouse interface is bound.{' '}
            <code>is_composite()</code> is true when <code>n_hid &gt; 1</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_buttons</code></td><td><code>u8</code></td><td>Buttons the mouse report carries.</td></tr>
              <tr><td><code>has_x</code></td><td><code>bool</code></td><td>The report carries an X axis.</td></tr>
              <tr><td><code>has_y</code></td><td><code>bool</code></td><td>The report carries a Y axis.</td></tr>
              <tr><td><code>has_wheel</code></td><td><code>bool</code></td><td>The report carries a wheel.</td></tr>
              <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>The mouse report sits behind a HID report ID.</td></tr>
              <tr><td><code>n_hid</code></td><td><code>u8</code></td><td>Cloned HID interfaces; <code>&gt;1</code> = composite.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Caps;

let c = Caps { n_buttons: 5, has_x: true, has_y: true, has_wheel: true, has_report_id: false, n_hid: 1 };
assert!(!c.is_composite()); // single HID interface`}</code></pre>
        </Card>
      </div>
      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="Rate" subtitle="The native report rate the box tracks" />
          <p>
            Live rate from <A href="/library/requests#query-rate"><code>query_rate()</code></A>.{' '}
            <code>native_hz()</code> converts the period to a frequency, returning <code>None</code>{' '}
            while <code>native_period_us</code> is still <code>0</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>native_period_us</code></td><td><code>u16</code></td><td>Realised native report period in µs; <code>0</code> = not learned.</td></tr>
              <tr><td><code>poll_period_us</code></td><td><code>u16</code></td><td>Cloned inject-endpoint poll period in µs.</td></tr>
              <tr><td><code>confident</code></td><td><code>bool</code></td><td>The estimator window is full and the value is trustworthy.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Rate;

let r = Rate { native_period_us: 1000, poll_period_us: 1000, confident: true };
assert_eq!(r.native_hz(), Some(1000.0));`}</code></pre>
        </Card>
      </div>
      <div id="stats" data-search-target>
        <Card>
          <CardHeader title="Stats" subtitle="Delivery and telemetry counters" />
          <p>
            Delivery counters from <A href="/library/requests#query-stats"><code>query_stats()</code></A>.
            A nonzero <code>tx_drops</code> or <code>tx_wedges</code> means delivery degraded under
            load. The narrowed fields saturate instead of wrapping.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>inject_emits</code></td><td><code>u32</code></td><td>Pure-injection reports emitted.</td></tr>
              <tr><td><code>tx_drops</code></td><td><code>u16</code></td><td>Reports dropped on TX-queue overflow (should stay 0).</td></tr>
              <tr><td><code>tx_merges</code></td><td><code>u16</code></td><td>Backed-up reports merged instead of queued.</td></tr>
              <tr><td><code>tx_maxdepth</code></td><td><code>u8</code></td><td>Deepest the TX queue has reached.</td></tr>
              <tr><td><code>tx_wedges</code></td><td><code>u8</code></td><td>Wedged-endpoint recoveries.</td></tr>
              <tr><td><code>wakeups</code></td><td><code>u16</code></td><td>Remote-wakeups issued.</td></tr>
              <tr><td><code>reset_count</code></td><td><code>u16</code></td><td>USB bus resets seen.</td></tr>
              <tr><td><code>config_count</code></td><td><code>u16</code></td><td>SET_CONFIGURATION events (re-enumerations).</td></tr>
            </tbody>
          </table>
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
            <A href="/library/guides/connection#choosing-a-port"><code>find_medius()</code></A>.
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
