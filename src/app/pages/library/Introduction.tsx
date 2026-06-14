import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Introduction: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Medius Rust Library" subtitle="Official Rust client" />
        <p>
          A Medius box plugs inline between a mouse and a PC. The real mouse passes through, and
          your program sends movement, buttons, and scroll over a USB-serial link. The{' '}
          <code>medius</code> crate drives that link from Rust.
        </p>
        <p>
          It is a 1:1 binding of the firmware's <A href="/native/frame">frames</A> (the packets the
          box speaks on the wire), plus the <A href="/native/connection#handshake">handshake</A>,
          a <A href="/library/lifecycle">keepalive</A>, and automatic reconnect. Nothing automates or
          paces input, so the caller owns timing.
        </p>
        <table class="api-params">
          <thead>
            <tr>
              <th>Call kind</th>
              <th>Reply</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><A href="/native/injection#fire-and-forget">Fire-and-forget</A> (move, button, scroll)</td>
              <td>None. Each call sends one frame.</td>
            </tr>
            <tr>
              <td><A href="/native/commands/requests#requests"><code>QUERY</code></A></td>
              <td>Asks the box for state and gets a reply.</td>
            </tr>
          </tbody>
        </table>
        <table class="api-params">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Crate version</td>
              <td><code>0.1.0</code></td>
            </tr>
            <tr>
              <td>Edition</td>
              <td><code>2024</code></td>
            </tr>
            <tr>
              <td>MSRV (minimum supported Rust version)</td>
              <td><code>1.85</code></td>
            </tr>
            <tr>
              <td>License</td>
              <td><code>MIT</code></td>
            </tr>
            <tr>
              <td>Transport</td>
              <td>4 Mbaud, framed-only</td>
            </tr>
            <tr>
              <td>Thread safety</td>
              <td><code>Send + Sync</code> (clone freely)</td>
            </tr>
            <tr>
              <td>Safety</td>
              <td><code>#![forbid(unsafe_code)]</code></td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div id="installation" data-search-target>
        <Card>
          <CardHeader title="Installation" />
          <pre><code>cargo add medius</code></pre>
          <p>With optional features:</p>
          <pre><code>cargo add medius --features async,mock</code></pre>
          <table class="api-params">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/features/async"><code>async</code></A></td>
                <td>Runtime-agnostic <code>AsyncDevice</code>, async queries.</td>
              </tr>
              <tr>
                <td><A href="/library/features/mock"><code>mock</code></A></td>
                <td>In-process fake box for tests.</td>
              </tr>
              <tr>
                <td><A href="/library/features/flash"><code>flash</code></A></td>
                <td><code>esptool</code> firmware flashing.</td>
              </tr>
              <tr>
                <td><code>tracing</code></td>
                <td>Tracing instrumentation across the connection lifecycle.</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="quick-start" data-search-target>
        <Card>
          <CardHeader title="Quick start" />
          <pre><code>{`use medius::{Device, Button};

let device = Device::find()?;
device.move_rel(100, -50)?;
device.press(Button::Left)?;
device.soft_release(Button::Left)?;
device.wheel(3)?;`}</code></pre>
          <table class="api-params">
            <thead>
              <tr>
                <th>Method</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/connection#open"><code>find</code></A></td>
                <td>Scans the serial ports, opens the box, and runs the handshake.</td>
              </tr>
              <tr>
                <td><A href="/library/movement#move-rel"><code>move_rel</code></A></td>
                <td>Moves by <code>dx</code> and <code>dy</code> steps.</td>
              </tr>
              <tr>
                <td><A href="/library/buttons#methods"><code>press</code></A> / <A href="/library/buttons#methods"><code>soft_release</code></A></td>
                <td>Holds and lets go of a button.</td>
              </tr>
              <tr>
                <td><A href="/library/movement#wheel"><code>wheel</code></A></td>
                <td>Scrolls.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Every method takes <code>&self</code>, so one{' '}
            <A href="/library/connection"><code>Device</code></A> clones across threads.
          </p>
        </Card>
      </div>

      <div id="getting-started" data-search-target>
        <Card>
          <CardHeader title="Getting started" />
          <div class="docs-grid">
            <A href="/library/connection" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Connection" subtitle="Open, find, handshake" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="api" data-search-target>
        <Card>
          <CardHeader title="API" />
          <div class="docs-grid">
            <A href="/library/movement" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Movement" subtitle="move_rel, wheel" />
              </Card>
            </A>
            <A href="/library/buttons" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Buttons" subtitle="press, release, force-release" />
              </Card>
            </A>
            <A href="/library/requests" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Requests" subtitle="query_version, query_health" />
              </Card>
            </A>
            <A href="/library/admin" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Admin" subtitle="reset, reboot" />
              </Card>
            </A>
            <A href="/library/lifecycle" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Keepalive & reconnect" subtitle="Holding the link open" />
              </Card>
            </A>
            <A href="/library/diagnostics" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Logs & counters" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="features" data-search-target>
        <Card>
          <CardHeader title="Features" />
          <div class="docs-grid">
            <A href="/library/features/async" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="async" subtitle="AsyncDevice" />
              </Card>
            </A>
            <A href="/library/features/mock" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="mock" subtitle="In-process fake box" />
              </Card>
            </A>
            <A href="/library/features/flash" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="flash" subtitle="esptool flashing" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="reference" data-search-target>
        <Card>
          <CardHeader title="Reference" />
          <div class="docs-grid">
            <A href="/library/types" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Types & errors" subtitle="Enums, Result, Error" />
              </Card>
            </A>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Introduction;
