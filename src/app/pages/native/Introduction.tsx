import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const NativeIntroduction: Component = () => {
  return (
    <>
      <Card>
        <CardHeader
          title="Medius Native API"
          subtitle="The binary control protocol"
        />
        <p>
          Medius is replacement firmware for MAKCU-class USB mouse-passthrough boxes plus an open
          binary control protocol. The box sits inline between a mouse and a PC: the real mouse
          passes through unchanged while your program injects movement, buttons, and scroll
          over a separate USB-serial link. Drive it from any language; the Rust{' '}
          <A href="/library">library</A> is the official client.
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
              <td>Firmware version</td>
              <td><code>1.5.0</code></td>
            </tr>
            <tr>
              <td>Protocol version</td>
              <td><code>1</code></td>
            </tr>
            <tr>
              <td>Transport</td>
              <td>4 Mbaud, framed-only (<a href="https://www.wch-ic.com/products/CH343.html" target="_blank" rel="noreferrer">CH343</a>)</td>
            </tr>
            <tr>
              <td>USB id</td>
              <td>VID <code>0x1A86</code> / PID <code>0x55D3</code></td>
            </tr>
            <tr>
              <td>Delivery</td>
              <td>
                Fire-and-forget;{' '}
                <A href="/native/commands/requests#requests"><code>QUERY</code></A> &rarr;{' '}
                <A href="/native/commands/requests#resp"><code>RESP</code></A> is the only round-trip
              </td>
            </tr>
          </tbody>
        </table>
        <p>Before you talk to the box:</p>
        <table class="api-params">
          <thead>
            <tr>
              <th>Topic</th>
              <th>What to know</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Protocol version</td>
              <td>
                These pages describe version <code>1</code>. Confirm it during the{' '}
                <A href="/native/connection#handshake">handshake</A> from the{' '}
                <code>proto_ver</code> field of the{' '}
                <A href="/native/commands/requests#version"><code>VERSION</code></A> reply; a
                different value means firmware these pages don't cover.
              </td>
            </tr>
            <tr>
              <td>Wire format</td>
              <td>
                The box speaks <A href="/native/frame">framed binary</A> from the first byte. No
                startup baud, no text mode.
              </td>
            </tr>
            <tr>
              <td>Finding the port</td>
              <td>Scan for the CH343's VID/PID pair to locate the box's serial port.</td>
            </tr>
            <tr>
              <td>Correlation</td>
              <td>
                <A href="/native/injection#fire-and-forget">Fire-and-forget</A> has no ack or echo.
                A <A href="/native/commands/requests#requests"><code>QUERY</code></A> is correlated
                to its <A href="/native/commands/requests#resp"><code>RESP</code></A> by{' '}
                <code>SEQ</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div id="overview" data-search-target>
        <Card>
          <CardHeader title="Overview" />
          <div class="docs-grid">
            <A href="/native/quickstart" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Quickstart" subtitle="Open the port and inject" />
              </Card>
            </A>
            <A href="/native/architecture" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Architecture" subtitle="Clone, passthrough, inject" />
              </Card>
            </A>
            <A href="/native/hardware" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Hardware" subtitle="Three USB ports and the chips" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="protocol" data-search-target>
        <Card>
          <CardHeader title="Protocol" />
          <div class="docs-grid">
            <A href="/native/transport" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Transport" subtitle="4 Mbaud, framed-only" />
              </Card>
            </A>
            <A href="/native/connection" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Connection" subtitle="Handshake and hello" />
              </Card>
            </A>
            <A href="/native/frame" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Frame Format" subtitle="SOF, type, CRC16" />
              </Card>
            </A>
            <A href="/native/injection" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Injection Model" subtitle="Accumulator and emission" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="commands" data-search-target>
        <Card>
          <CardHeader title="Commands" />
          <div class="docs-grid">
            <A href="/native/commands/movement" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Movement" subtitle="MOVE and WHEEL" />
              </Card>
            </A>
            <A href="/native/commands/buttons" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Buttons" subtitle="Press, release, force-release" />
              </Card>
            </A>
            <A href="/native/commands/requests" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Requests" subtitle="QUERY and its RESP, all eight selectors" />
              </Card>
            </A>
            <A href="/native/commands/admin" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Admin" subtitle="RESET, REBOOT, LOG" />
              </Card>
            </A>
            <A href="/native/commands/led" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="LED" subtitle="Override the status LEDs" />
              </Card>
            </A>
            <A href="/native/commands/lock" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Lock" subtitle="Block a physical input" />
              </Card>
            </A>
            <A href="/native/commands/catch" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Catch" subtitle="Stream physical input" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="reference" data-search-target>
        <Card>
          <CardHeader title="Reference" />
          <div class="docs-grid">
            <A href="/native/flashing" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Flashing" subtitle="Reboot to ROM and flash" />
              </Card>
            </A>
            <A href="/native/troubleshooting" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Troubleshooting" subtitle="Common problems and fixes" />
              </Card>
            </A>
          </div>
        </Card>
      </div>
    </>
  );
};

export default NativeIntroduction;
