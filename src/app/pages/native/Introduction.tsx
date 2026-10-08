import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';

const NativeIntroduction: Component = () => {
  return (
    <>
      <PageHeader lead="The binary control protocol">
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
              <td><code>3.4.5</code></td>
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
      </PageHeader>

      <DocSection id="overview" title="Overview">
        <IndexRow href="/native/quickstart" title="Quickstart" tag="Open the port and inject" />
        <IndexRow href="/native/architecture" title="Architecture" tag="Clone, passthrough, inject" />
        <IndexRow href="/native/hardware" title="Hardware" tag="Three USB ports and the chips" />
      </DocSection>

      <DocSection id="protocol" title="Protocol">
        <IndexRow href="/native/transport" title="Transport" tag="6 Mbaud, framed-only" />
        <IndexRow href="/native/connection" title="Connection" tag="Handshake and hello" />
        <IndexRow href="/native/frame" title="Frame Format" tag="SOF, type, CRC16" />
        <IndexRow href="/native/injection" title="Injection Model" tag="Accumulator and emission" />
      </DocSection>

      <DocSection id="commands" title="Commands">
        <IndexRow href="/native/commands/inject" title="Inject" tag="Press buttons, keys, media" />
        <IndexRow href="/native/commands/move" title="Move" tag="Cursor and wheel" />
        <IndexRow href="/native/commands/lock" title="Lock" tag="Weigh a physical input" />
        <IndexRow href="/native/commands/catch" title="Catch" tag="Stream input and raw traffic" />
        <IndexRow href="/native/commands/transform" title="Transform" tag="Swap or remap a field" />
        <IndexRow href="/native/commands/clip" title="Clip" tag="Buffered clip playback" />
        <IndexRow href="/native/commands/requests" title="Requests" tag="QUERY, RESP, sixteen selectors" />
        <IndexRow href="/native/commands/led" title="LED" tag="Override the status LEDs" />
        <IndexRow href="/native/commands/admin" title="Admin" tag="RESET, REBOOT, LOG" />
        <IndexRow href="/native/commands/option" title="Option" tag="Name, imperfect clones, movement riding, bearing, emit rate" />
        <IndexRow href="/native/commands/update" title="Update" tag="Replace either chip's firmware" />
        <IndexRow href="/native/commands/usage" title="Usage IDs" tag="Button, key, media numbers" />
      </DocSection>

      <DocSection id="advanced" title="Advanced control">
        <IndexRow href="/native/commands/raw" title="Raw" tag="Bytes on a cloned endpoint" />
        <IndexRow href="/native/commands/transfer" title="Transfer" tag="A control transfer on the device" />
        <IndexRow href="/native/commands/rewrite" title="Rewrite" tag="Rewrite packets in flight" />
        <IndexRow href="/native/commands/patch" title="Patch" tag="Patch cloned descriptors" />
      </DocSection>

      <DocSection id="reference" title="Reference">
        <IndexRow href="/native/flashing" title="Flashing" tag="Reboot to ROM and flash" />
        <IndexRow href="/native/troubleshooting" title="Troubleshooting" tag="Common problems and fixes" />
      </DocSection>
    </>
  );
};

export default NativeIntroduction;
