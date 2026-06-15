import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const TypesAndErrors: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Types & errors" subtitle="Argument, return, and error types" />
        <p>
          Enums you pass in, structs you get back, and the one <code>Error</code> every call can fail
          with. Each maps onto a value in the <A href="/native/frame">wire protocol</A>.
        </p>
      </Card>

      <div id="enums" data-search-target>
        <Card>
          <CardHeader title="Enums" subtitle="Command and status enumerations" />
          <p>
            Four argument enums, each backed by a wire byte. The number on a variant is its wire
            value; conversion helpers map to and from that byte.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Type</th>
                <th>Variant</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/buttons#button-arg"><code>Button</code></A></td>
                <td>
                  <code>Left = 0</code>, <code>Right</code>, <code>Middle</code>, <code>Side1</code>,{' '}
                  <code>Side2 = 4</code> — the button a{' '}
                  <A href="/native/commands/buttons"><code>BUTTON</code></A> command acts on.
                </td>
                <td><code>as_id()</code> / <code>from_id(u8)</code></td>
              </tr>
              <tr>
                <td><A href="/library/buttons#methods"><code>ButtonAction</code></A></td>
                <td>
                  <code>SoftRelease = 0</code>, <code>Press = 1</code>, <code>ForceRelease = 2</code> —
                  what to do to the button a{' '}
                  <A href="/native/commands/buttons"><code>BUTTON</code></A> carries; see{' '}
                  <A href="/library/buttons#methods">Buttons</A>.
                </td>
                <td><code>as_u8()</code> / <code>from_u8(u8)</code></td>
              </tr>
              <tr>
                <td><A href="/library/admin#reboot"><code>RebootTarget</code></A></td>
                <td>
                  <code>DeviceDownload = 0</code>, <code>HostDownload = 1</code>,{' '}
                  <code>DeviceRun = 2</code>, <code>HostRun = 3</code> — which chip a{' '}
                  <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> restarts and into
                  what mode; see <A href="/library/admin#reboot"><code>reboot</code></A>.
                </td>
                <td>—</td>
              </tr>
              <tr>
                <td><A href="/library/diagnostics#logs"><code>LogLevel</code></A></td>
                <td>
                  <code>Error</code>, <code>Warn</code>, <code>Info</code>, <code>Debug</code>,{' '}
                  <code>Verbose</code> — the severity tag on a logged line.
                </td>
                <td><code>from_u8</code> (unknown &rarr; <code>Info</code>)</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="structs" data-search-target>
        <Card>
          <CardHeader title="Structs" subtitle="Values the box reports back" />
          <table class="api-params">
            <thead>
              <tr>
                <th>Type</th>
                <th>Fields</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/requests#version"><code>Version</code></A></td>
                <td>
                  Firmware identity from <A href="/library/requests#version"><code>query_version()</code></A>:{' '}
                  <code>proto_ver</code> (the protocol version the firmware speaks, <code>1</code>{' '}
                  here), then <code>fw_major</code>, <code>fw_minor</code>, <code>fw_patch</code>{' '}
                  (all <code>u8</code>). <code>Display</code> renders <code>fw M.m.p</code>.
                </td>
              </tr>
              <tr>
                <td><A href="/library/requests#health"><code>Health</code></A></td>
                <td>
                  The box's readiness from <A href="/library/requests#health"><code>query_health()</code></A>,
                  one <code>bool</code> per bit of the health byte: <code>link_up</code> (link to the
                  host chip is up), <code>mouse_attached</code> (a real mouse is plugged in),{' '}
                  <code>clone_configured</code> (the PC has set up the cloned mouse),{' '}
                  <code>injection_active</code> (the box is holding at least one injected button or
                  move). <code>from_flags(u8)</code> / <code>to_flags()</code> convert to and from
                  that byte.
                </td>
              </tr>
              <tr>
                <td><code>LogLine</code></td>
                <td>
                  One line read from the box's <A href="/native/commands/admin#log"><code>LOG</code></A>{' '}
                  stream: <code>level: LogLevel</code> and <code>text: String</code>.
                </td>
              </tr>
              <tr>
                <td><code>PortInfo</code></td>
                <td>
                  A serial port that looks like a Medius box, from <code>find_medius()</code>:{' '}
                  <code>path: String</code>, <code>vid: u16</code>, <code>pid: u16</code>.
                </td>
              </tr>
              <tr>
                <td><A href="/library/diagnostics#counters"><code>CountersSnapshot</code></A></td>
                <td>
                  Four running link totals (all <code>u64</code>): <code>frames_tx</code>,{' '}
                  <code>frames_rx</code>, <code>crc_drops</code> (frames dropped for a bad{' '}
                  <A href="/native/frame#crc">checksum</A>), <code>reconnects</code>. See{' '}
                  <A href="/library/diagnostics#counters">Counters</A>.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="logstream" data-search-target>
        <Card>
          <CardHeader title="LogStream" subtitle="Receiver for device log frames" />
          <p>
            Hands you the box's unsolicited <A href="/native/commands/admin#log"><code>LOG</code></A>{' '}
            frames as <code>LogLine</code> values, with blocking, non-blocking, and timed receive.
            See <A href="/library/diagnostics#logs">Logs</A>.
          </p>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="The Error enum and Result alias" />
          <p>
            Every fallible call returns <code>Result&lt;T&gt;</code>, the crate's alias for{' '}
            <code>core::result::Result&lt;T, Error&gt;</code>. <code>Error</code> is{' '}
            <code>#[non_exhaustive]</code>, so match it with a wildcard arm.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Io(std::io::Error)</code></td>
                <td>An underlying serial or OS error.</td>
              </tr>
              <tr>
                <td><code>NotFound</code></td>
                <td>No device matched the expected VID/PID.</td>
              </tr>
              <tr>
                <td><code>NoReply</code></td>
                <td>
                  The box never answered the version query during the{' '}
                  <A href="/native/connection#handshake">handshake</A>: wrong port or baud, or not a
                  Medius box.
                </td>
              </tr>
              <tr>
                <td><code>BadProtoVer &#123; got &#125;</code></td>
                <td>
                  The box answered, but its <code>proto_ver</code> wasn't <code>1</code>;{' '}
                  <code>got</code> carries the reported value.
                </td>
              </tr>
              <tr>
                <td><code>QueryTimeout</code></td>
                <td>
                  A <A href="/library/requests"><code>query</code></A> hit its deadline with no{' '}
                  <A href="/native/commands/requests#resp"><code>RESP</code></A> back.
                </td>
              </tr>
              <tr>
                <td><code>Disconnected</code></td>
                <td>The device disconnected.</td>
              </tr>
              <tr>
                <td><code>FrameTooLong</code></td>
                <td>
                  A payload was over the <A href="/native/frame#layout">512-byte</A> frame limit.
                </td>
              </tr>
              <tr>
                <td><code>FlashTool(String)</code></td>
                <td>The flash tool failed. Present only with the <A href="/library/features/flash"><code>flash</code></A> feature.</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default TypesAndErrors;
