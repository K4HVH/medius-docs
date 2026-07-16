import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Quickstart: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Quickstart" subtitle="Plug in and send your first command" />
        <p>
          A Medius box sits inline between a USB device and a PC. The real device passes through, and
          your program sends input of its own (cursor and buttons for a mouse, keys and media for a
          keyboard) over a USB-serial link. Below: wire it, open the link, send one movement command.
          Every step is byte-exact firmware behavior.
        </p>
        <p>
          The box talks in <A href="/native/frame">frames</A>, small fixed-shape packets that each
          carry one command. Most are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: you send and move on with
          no reply. The exception is{' '}
          <A href="/native/commands/requests#requests"><code>QUERY</code></A>, which gets one answer
          back.
        </p>
      </Card>

      <div id="wiring" data-search-target>
        <Card>
          <CardHeader title="Wire it up" subtitle="The safe 3-port layout" />
          <ul>
            <li><code>USB1</code> (<A href="/native/hardware">clone</A>) → game PC</li>
            <li><code>USB2</code> (control) → control PC</li>
            <li><code>USB3</code> (mouse) → real mouse</li>
          </ul>
          <p>
            The clone copies the real mouse's USB identity, so the game PC sees the same device it
            would if the mouse were plugged in directly.
          </p>
          <div class="callout callout--danger">
            <p>
              Never connect <code>USB1</code> and <code>USB3</code> to the same machine. The{' '}
              <code>USB3</code> 5V rail can't be pulled low in firmware, so wiring both to one
              machine back-feeds power and can force a shutdown and drain the battery. One game PC,
              one control PC, never the same machine.
            </p>
          </div>
          <p>
            Full port map and hazard detail on <A href="/native/hardware">Hardware</A>.
          </p>
        </Card>
      </div>

      <div id="open" data-search-target>
        <Card>
          <CardHeader title="Open the link" subtitle="Open at the fixed baud, speak binary" />
          <p>
            Open <code>/dev/ttyACM0</code> (Linux) or <code>COMx</code> (Windows) at{' '}
            <code>4,000,000</code> baud, <code>8N1</code>, and speak binary immediately. There is no{' '}
            <code>115200</code> handshake and no baud-switch frame.
          </p>
          <p>
            <A href="/native/commands/requests#resp"><code>RESP</code></A> is the box's reply to a
            question. To learn the protocol version:
          </p>
          <ol>
            <li>
              On first contact the box sends one{' '}
              <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> on its own,
              with <A href="/native/frame#seq"><code>SEQ</code></A> <code>0</code>, your
              ready signal. Or send{' '}
              <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> yourself.
            </li>
            <li>
              Read <code>proto_ver</code> from the <code>VERSION</code> payload, the one-byte
              protocol version the firmware speaks.
            </li>
            <li>
              Check <code>proto_ver == 3</code> before trusting the commands here. This documents
              version <code>3</code>.
            </li>
          </ol>
          <p>
            Handshake and presence detail on <A href="/native/connection">Connection</A>.
          </p>
        </Card>
      </div>

      <div id="first-move" data-search-target>
        <Card>
          <CardHeader title="Send a MOVE" subtitle="Relative cursor movement" />
          <p>
            <A href="/native/commands/move#move"><code>MOVE</code></A> nudges the cursor on the
            PC. Its frame has the standard shape, laid out byte-by-byte below.
          </p>
          <ul>
            <li>
              <A href="/native/frame#seq"><code>SEQ</code></A> is a number you pick and increment per
              frame. For a{' '}
              <A href="/native/commands/requests#requests"><code>QUERY</code></A> the box echoes it
              in the matching <A href="/native/commands/requests#resp"><code>RESP</code></A> so you
              can pair reply to request; here <code>0</code>.
            </li>
            <li>
              <code>CRC16</code> lets the box reject a corrupted frame. It is <a href="https://en.wikipedia.org/wiki/Cyclic_redundancy_check" target="_blank" rel="noreferrer">CRC16-CCITT</a> (polynomial{' '}
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

frame = encode(0x01, 0, struct.pack('<Bhh', 0, 100, 0))
port.write(frame)`}</code></pre>
          <p>
            <A href="/native/commands/move#move"><code>MOVE</code></A> has opcode{' '}
            <code>0x01</code>. Its payload is a <code>motion</code> byte (<code>0</code> = cursor)
            then two signed 16-bit deltas, <code>dx</code> then <code>dy</code>. <code>+x</code> is
            right, <code>+y</code> is down. The example moves 100 right, 0 down.
          </p>
          <p>
            That builds the bytes{' '}
            <code>A5 01 00 05 00 00 64 00 00 00 &lt;crc&gt;</code>: start byte, opcode{' '}
            <code>0x01</code>, sequence, length, the <code>motion</code>/<code>dx</code>/<code>dy</code>{' '}
            payload, then the checksum. The byte-by-byte breakdown is on{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A>, the frame format on{' '}
            <A href="/native/frame">Frame Format</A>.
          </p>
        </Card>
      </div>

      <div id="confirm" data-search-target>
        <Card>
          <CardHeader title="Confirm" subtitle="Check the chain before relying on injection" />
          <p>
            <A href="/native/injection">Injection</A> is the input your program sends on top of the
            real mouse's passthrough. Confirm the chain (real mouse → box → PC) is live before you
            rely on it: send{' '}
            <A href="/native/commands/requests#health"><code>QUERY(HEALTH)</code></A>, read the{' '}
            <code>flags</code> byte from the{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A>, and check these bits are
            set.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>Mask</th><th>Means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>MOUSE_ATTACHED</code></td><td><code>0x02</code></td><td>A mouse is on <code>USB3</code>.</td></tr>
              <tr><td><code>CLONE_CONFIGURED</code></td><td><code>0x04</code></td><td>The game PC has enumerated the clone.</td></tr>
            </tbody>
          </table>
          <p>
            A flag is set when <code>(flags &amp; mask)</code> is non-zero. With both set, your{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> reaches the game PC. The full
            byte is on <A href="/native/commands/requests#health">HEALTH</A>.
          </p>
        </Card>
      </div>

      <div id="library" data-search-target>
        <Card>
          <CardHeader title="Skip the framing" />
          <p>
            For a ready-made client, <code>cargo add medius</code>. See the{' '}
            <A href="/library">library</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Quickstart;
