import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Quickstart: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Quickstart" subtitle="Wiring to first command" />
        <p>
          The box sits between a USB device and a PC. The device passes through while a program
          injects over a USB-serial link: cursor and buttons for a mouse, keys and media for a
          keyboard.
        </p>
        <p>
          The box speaks in <A href="/native/frame">frames</A>, fixed-shape packets of one command
          each. Most are <A href="/native/injection#fire-and-forget">fire-and-forget</A>, with no
          reply; <A href="/native/commands/requests#requests"><code>QUERY</code></A> gets one.
        </p>
      </Card>

      <div id="wiring" data-search-target>
        <Card>
          <CardHeader title="Wiring" subtitle="Safe 3-port layout" />
          <ul>
            <li><code>USB1</code> (<A href="/native/hardware">clone</A>) → game PC</li>
            <li><code>USB2</code> (control) → control PC</li>
            <li><code>USB3</code> (mouse) → real mouse</li>
          </ul>
          <p>
            The clone copies the mouse's USB identity, so the game PC enumerates the same device as a
            direct connection.
          </p>
          <div class="callout callout--danger">
            <p>
              Never connect <code>USB1</code> and <code>USB3</code> to the same machine. The{' '}
              <code>USB3</code> 5V rail can't be pulled low in firmware, so the pair back-feeds
              power, which can force a shutdown and drain the battery.
            </p>
          </div>
          <p>
            Full port map and hazard detail on <A href="/native/hardware">Hardware</A>.
          </p>
        </Card>
      </div>

      <div id="open" data-search-target>
        <Card>
          <CardHeader title="Open the link" subtitle="Fixed baud, binary" />
          <p>
            Open <code>/dev/ttyACM0</code> (Linux) or <code>COMx</code> (Windows) at{' '}
            <code>6,000,000</code> baud, <code>8N1</code>, and send binary immediately; no{' '}
            <code>115200</code> handshake or baud-switch frame.
          </p>
          <p>
            <A href="/native/commands/requests#resp"><code>RESP</code></A> carries the box's
            replies. To read the protocol version:
          </p>
          <ol>
            <li>
              On first contact the box sends one unsolicited{' '}
              <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> with{' '}
              <A href="/native/frame#seq"><code>SEQ</code></A> <code>0</code>, the ready signal. Or
              send <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>.
            </li>
            <li>
              Read <code>proto_ver</code>, the one-byte protocol version, from the{' '}
              <code>VERSION</code> payload.
            </li>
            <li>
              Check <code>proto_ver == 9</code> before trusting the commands here.
            </li>
          </ol>
          <p>
            Serial framing detail on <A href="/native/transport#serial">Transport</A>; handshake
            and presence detail on <A href="/native/connection">Connection</A>.
          </p>
        </Card>
      </div>

      <div id="first-move" data-search-target>
        <Card>
          <CardHeader title="Send a MOVE" subtitle="Relative cursor movement" />
          <p>
            <A href="/native/commands/move#move"><code>MOVE</code></A> moves the PC's cursor.
          </p>
          <ul>
            <li>
              <A href="/native/frame#seq"><code>SEQ</code></A> is a caller-chosen number, incremented
              per frame. A <A href="/native/commands/requests#requests"><code>QUERY</code></A>'s{' '}
              <A href="/native/commands/requests#resp"><code>RESP</code></A> echoes it; here{' '}
              <code>0</code>.
            </li>
            <li>
              <code>CRC16</code> lets the box reject a corrupted frame: <a href="https://en.wikipedia.org/wiki/Cyclic_redundancy_check" target="_blank" rel="noreferrer">CRC16-CCITT</a> (polynomial{' '}
              <code>0x1021</code>, initial value <code>0xFFFF</code>) over{' '}
              <code>TYPE | SEQ | LEN | PAYLOAD</code>, stored little-endian.
            </li>
          </ul>
          <pre><code class="language-python">{`import struct

def crc16_ccitt(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = (crc << 1) ^ 0x1021 if crc & 0x8000 else crc << 1
            crc &= 0xFFFF
    return crc

def encode(type, seq, payload):
    head = bytes([type, seq]) + struct.pack('<H', len(payload)) + payload
    return bytes([0xA5]) + head + struct.pack('<H', crc16_ccitt(head))

frame = encode(0x01, 0, struct.pack('<BhhB', 0, 100, 0, 0))
port.write(frame)`}</code></pre>
          <p>
            <A href="/native/commands/move#move"><code>MOVE</code></A> is opcode <code>0x01</code>.
            Payload: a <code>motion</code> byte (<code>0</code> = cursor), signed 16-bit{' '}
            <code>dx</code> then <code>dy</code>, and a{' '}
            <A href="/native/commands/move#flags"><code>flags</code></A> byte (<code>0</code> for a
            plain move). <code>+x</code> is right, <code>+y</code> is down; the example moves 100
            right, 0 down.
          </p>
          <p>
            That builds <code>A5 01 00 06 00 00 64 00 00 00 00 &lt;crc&gt;</code>. Byte breakdown
            on <A href="/native/commands/move#move"><code>MOVE</code></A>, frame format on{' '}
            <A href="/native/frame">Frame Format</A>.
          </p>
        </Card>
      </div>

      <div id="confirm" data-search-target>
        <Card>
          <CardHeader title="Confirm" subtitle="Check the chain before injecting" />
          <p>
            <A href="/native/injection">Injection</A> is input added on top of the mouse's
            passthrough. Before relying on it, send{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A> and check these
            bits in the <A href="/native/commands/requests#resp"><code>RESP</code></A>'s{' '}
            <code>flags</code> word.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>Mask</th><th>Means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>LINK_UP</code></td><td><code>0x01</code></td><td>Host-chip link is up.</td></tr>
              <tr><td><code>MOUSE_ATTACHED</code></td><td><code>0x02</code></td><td>A mouse is on <code>USB3</code>.</td></tr>
              <tr><td><code>CLONE_CONFIGURED</code></td><td><code>0x04</code></td><td>The game PC has enumerated the clone.</td></tr>
            </tbody>
          </table>
          <p>
            A flag is set when <code>(flags &amp; mask)</code> is non-zero. With all three set, a{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> reaches the game PC. Full
            word on <A href="/native/commands/requests#health">HEALTH</A>.
          </p>
        </Card>
      </div>

      <div id="library" data-search-target>
        <Card>
          <CardHeader title="Rust library" />
          <p>
            Ready-made client: <code>cargo add medius</code>. See the{' '}
            <A href="/library">library</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Quickstart;
