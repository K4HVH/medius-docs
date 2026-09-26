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
          Medius is replacement firmware for MAKCU-class USB input-passthrough boxes plus an open
          binary control protocol.
        </p>
        <p>
          The box sits between a USB device and a PC. The device (mouse, keyboard, or combo) passes
          through unchanged while a program injects over a separate USB-serial link: cursor and
          buttons for a mouse, keys and media for a keyboard.
        </p>
        <p>
          Drive it from any language; the Rust <A href="/library">library</A> is the official client.
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
              <td><code>3.4.2</code></td>
            </tr>
            <tr>
              <td>Protocol version</td>
              <td><code>9</code></td>
            </tr>
            <tr>
              <td>Transport</td>
              <td>6 Mbaud, framed-only (<a href="https://www.wch-ic.com/products/CH343.html" target="_blank" rel="noreferrer">CH343</a>)</td>
            </tr>
            <tr>
              <td>USB ID</td>
              <td>VID <code>0x1A86</code> / PID <code>0x55D3</code></td>
            </tr>
            <tr>
              <td>Delivery</td>
              <td>
                Fire-and-forget;{' '}
                <A href="/native/commands/requests#requests"><code>QUERY</code></A> →{' '}
                <A href="/native/commands/requests#resp"><code>RESP</code></A> is the only round-trip
              </td>
            </tr>
          </tbody>
        </table>
        <p>Before connecting:</p>
        <table class="api-params">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Protocol version</td>
              <td>
                These pages cover version <code>9</code>. Check <code>proto_ver</code> in the{' '}
                <A href="/native/commands/requests#version"><code>VERSION</code></A> reply during
                the <A href="/native/connection#handshake">handshake</A>; any other value is
                firmware these pages don't cover.
              </td>
            </tr>
            <tr>
              <td>Wire format</td>
              <td>
                <A href="/native/frame">Framed binary</A> from the first byte; no startup baud or
                text mode.
              </td>
            </tr>
            <tr>
              <td>Port discovery</td>
              <td>Scan for the CH343's VID/PID pair.</td>
            </tr>
            <tr>
              <td>Correlation</td>
              <td>
                <A href="/native/injection#fire-and-forget">Fire-and-forget</A> has no ack or echo.{' '}
                <A href="/native/frame#seq"><code>SEQ</code></A> pairs a{' '}
                <A href="/native/commands/requests#requests"><code>QUERY</code></A> with its{' '}
                <A href="/native/commands/requests#resp"><code>RESP</code></A>.
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
                <CardHeader title="Transport" subtitle="6 Mbaud, framed-only" />
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
            <A href="/native/commands/inject" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Inject" subtitle="Press buttons, keys, media" />
              </Card>
            </A>
            <A href="/native/commands/move" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Move" subtitle="Cursor and wheel" />
              </Card>
            </A>
            <A href="/native/commands/lock" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Lock" subtitle="Weigh a physical input" />
              </Card>
            </A>
            <A href="/native/commands/catch" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Catch" subtitle="Stream input and raw traffic" />
              </Card>
            </A>
            <A href="/native/commands/transform" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Transform" subtitle="Swap or remap a field" />
              </Card>
            </A>
            <A href="/native/commands/clip" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Clip" subtitle="Buffered clip playback" />
              </Card>
            </A>
            <A href="/native/commands/requests" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Requests" subtitle="QUERY, RESP, sixteen selectors" />
              </Card>
            </A>
            <A href="/native/commands/led" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="LED" subtitle="Override the status LEDs" />
              </Card>
            </A>
            <A href="/native/commands/admin" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Admin" subtitle="RESET, REBOOT, LOG" />
              </Card>
            </A>
            <A href="/native/commands/option" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Option" subtitle="Name, imperfect clones, movement riding, bearing, emit rate" />
              </Card>
            </A>
            <A href="/native/commands/update" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Update" subtitle="Replace either chip's firmware" />
              </Card>
            </A>
            <A href="/native/commands/usage" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Usage IDs" subtitle="Button, key, media numbers" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

      <div id="advanced" data-search-target>
        <Card>
          <CardHeader title="Advanced control" />
          <div class="docs-grid">
            <A href="/native/commands/raw" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Raw" subtitle="Bytes on a cloned endpoint" />
              </Card>
            </A>
            <A href="/native/commands/transfer" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Transfer" subtitle="A control transfer on the device" />
              </Card>
            </A>
            <A href="/native/commands/rewrite" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Rewrite" subtitle="Rewrite packets in flight" />
              </Card>
            </A>
            <A href="/native/commands/patch" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Patch" subtitle="Patch cloned descriptors" />
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
