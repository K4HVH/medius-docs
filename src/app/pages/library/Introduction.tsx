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
          The <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer"><code>medius</code></a> crate
          injects input on top of a real mouse over a USB-serial link.
        </p>
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
              <td><code>1.5.0</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/edition-guide/rust-2024/index.html" target="_blank" rel="noreferrer">Edition</a></td>
              <td><code>2024</code></td>
            </tr>
            <tr>
              <td><a href="https://doc.rust-lang.org/cargo/reference/rust-version.html" target="_blank" rel="noreferrer">MSRV</a> (minimum supported Rust version)</td>
              <td><code>1.85</code></td>
            </tr>
            <tr>
              <td>License</td>
              <td><a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer"><code>MIT</code></a></td>
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
                <td><a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer"><code>esptool</code></a> firmware flashing.</td>
              </tr>
              <tr>
                <td><A href="/library/features/tracing"><code>tracing</code></A></td>
                <td>Tracing instrumentation across the connection lifecycle.</td>
              </tr>
            </tbody>
          </table>
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
                <CardHeader title="Requests" subtitle="version, health, and the four device-info queries" />
              </Card>
            </A>
            <A href="/library/admin" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Admin" subtitle="reset, reboot" />
              </Card>
            </A>
            <A href="/library/lifecycle" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Lifecycle" subtitle="reapply, reconnect" />
              </Card>
            </A>
            <A href="/library/diagnostics" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Logs & counters" subtitle="logs, counters" />
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
            <A href="/library/features/tracing" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="tracing" subtitle="Structured diagnostics" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="guides" data-search-target>
        <Card>
          <CardHeader title="Guides" subtitle="Behavior and how-to, outside the reference" />
          <div class="docs-grid">
            <A href="/library/guides/calls" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Calls & input" subtitle="Call kinds, async, motion, clicks" />
              </Card>
            </A>
            <A href="/library/guides/connection" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Connection" subtitle="Ports, threads, keepalive" />
              </Card>
            </A>
            <A href="/library/guides/testing" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Testing" subtitle="MockBox in tests" />
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
