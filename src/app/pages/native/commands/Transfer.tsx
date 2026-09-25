import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transfer: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transfer" subtitle="Run one control request against the real device" />
        <p>
          <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A> puts one USB control
          transfer on the real device, from the control PC, and{' '}
          <A href="/native/commands/transfer#transfer-resp"><code>TRANSFER_RESP</code></A> carries the
          device's answer back: a descriptor, a string, a vendor value, or the handshake that ended it.
        </p>
        <pre class="diagram">{`  control PC           DEVICE chip            HOST chip            real device
      |                     |                      |                     |
      |-- TRANSFER, SEQ n ->|                      |                     |
      |                     |-- link request ----->|                     |
      |                     |                      |-- SETUP, OUT data ->|
      |                     |                      |<-- IN data, status -|
      |                     |<-- link answer ------|                     |
      |<- TRANSFER_RESP, n -|                      |                     |`}</pre>
        <p>
          The request crosses the inter-chip link on its own messages and joins the game PC's control
          requests in the host chip's <A href="/native/commands/transfer#proxy">control queue</A>.
        </p>
        <div class="callout callout--warning">
          <p>
            <code>TRANSFER</code> is part of the advanced control layer and runs only under the{' '}
            <A href="/native/commands/option#imperfect">imperfect-clone opt-in</A>. With it off, a
            request with a full setup packet answers <code>0xFC</code> and never reaches the device.
          </p>
        </div>
      </Card>

      <div id="transfer" data-search-target>
        <Card>
          <CardHeader title="TRANSFER" subtitle="One control request, answered once" />
          <p>
            <code>TRANSFER</code> carries a target endpoint, an eight-byte setup packet, and the OUT
            data stage if the request has one.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x1A</code>.
          </p>
          <pre class="api-signature">TRANSFER  0x1A  ·  payload 9..512 bytes</pre>
          <p><span class="api-badge api-badge--responded">Reply</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep</code></td><td><code>u8</code></td><td><code>0</code> = EP0, else a control endpoint the real device declares, matched on bits 0-3</td></tr>
              <tr><td>1</td><td><code>bmRequestType</code></td><td><code>u8</code></td><td>bit 7 sets the direction: <code>1</code> IN, <code>0</code> OUT</td></tr>
              <tr><td>2</td><td><code>bRequest</code></td><td><code>u8</code></td><td>the request code</td></tr>
              <tr><td>3</td><td><code>wValue</code></td><td><code>u16</code></td><td>little-endian</td></tr>
              <tr><td>5</td><td><code>wIndex</code></td><td><code>u16</code></td><td>little-endian</td></tr>
              <tr><td>7</td><td><code>wLength</code></td><td><code>u16</code></td><td>data stage length, little-endian, at most <code>504</code></td></tr>
              <tr><td>9..</td><td><code>data</code></td><td><code>u8[]</code></td><td>OUT only: the first <code>wLength</code> bytes are the data stage</td></tr>
            </tbody>
          </table>
          <p>
            Offsets 1 to 8 are the setup packet exactly as the device receives it. The box never
            rewrites or retries it.
          </p>
          <div class="api-response-label">DATA STAGE</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td>bit 7 = 1, IN</td><td>bytes after offset 8 ignored; the reply carries what the device sent, up to <code>wLength</code></td></tr>
              <tr><td>bit 7 = 0, OUT</td><td>the first <code>wLength</code> bytes sent, the rest ignored; fewer is refused</td></tr>
            </tbody>
          </table>
          <p>
            An OUT stage tops out at 503 bytes, what a 512-byte{' '}
            <A href="/native/frame#layout">payload</A> leaves after <code>ep</code> and the setup packet.
          </p>
          <div class="callout callout--warning">
            <p>
              A <code>SET_CONFIGURATION</code> or <code>SET_INTERFACE</code> sent here changes the
              real device only. The clone, and the endpoints the host chip polls, stay where the game
              PC put them.
            </p>
          </div>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>The box sends</th></tr>
            </thead>
            <tbody>
              <tr><td>the payload is shorter than 9 bytes</td><td>nothing; the frame is discarded</td></tr>
              <tr><td>the <A href="/native/commands/option#imperfect">opt-in</A> is off</td><td><code>0xFC</code></td></tr>
              <tr><td><code>wLength</code> is above <code>504</code></td><td><code>0xFC</code></td></tr>
              <tr><td>an OUT request carries fewer than <code>wLength</code> data bytes</td><td><code>0xFC</code></td></tr>
              <tr><td>the host chip's <A href="/native/commands/transfer#proxy">control queue</A> is full, from any of its users</td><td><code>0xFC</code></td></tr>
              <tr><td><code>ep</code> is not <code>0</code> and names no declared control endpoint</td><td><code>0xFE</code>, or <code>0xFF</code> with no device attached</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            <code>GET_DESCRIPTOR(device)</code> on EP0, 18 bytes: setup{' '}
            <code>80 06 00 01 00 00 12 00</code>.
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+
| A5     | 1A     | 07     | 09 00  | 00     |
+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep     |
+--------+--------+--------+--------+--------+

+---------------+----------+--------+--------+--------+--------+
| 80            | 06       | 00 01  | 00 00  | 12 00  | lo hi  |
+---------------+----------+--------+--------+--------+--------+
| bmRequestType | bRequest | wValue | wIndex | wLength| CRC16  |
+---------------+----------+--------+--------+--------+--------+`}</pre>
          <p>
            An OUT request: <code>SET_REPORT(Output)</code> on interface 0 with one data byte,{' '}
            <code>02</code>, the Caps Lock LED of a boot keyboard.
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+
| A5     | 1A     | 08     | 0A 00  | 00     |
+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep     |
+--------+--------+--------+--------+--------+

+---------------+----------+--------+--------+--------+--------+--------+
| 21            | 09       | 00 02  | 00 00  | 01 00  | 02     | lo hi  |
+---------------+----------+--------+--------+--------+--------+--------+
| bmRequestType | bRequest | wValue | wIndex | wLength| data   | CRC16  |
+---------------+----------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/advanced/transfer#transfer"><code>transfer</code></A>,{' '}
            <A href="/library/advanced/transfer#transfer"><code>transfer_timeout</code></A>, and the{' '}
            <A href="/library/advanced/transfer#async"><code>AsyncDevice</code></A> forms.
          </p>
        </Card>
      </div>

      <div id="transfer-resp" data-search-target>
        <Card>
          <CardHeader title="TRANSFER_RESP" subtitle="The device's answer to one TRANSFER" />
          <p>
            One reply per <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A> with a
            full setup packet, its <A href="/native/frame#seq"><code>SEQ</code></A> echoing the
            command's. <A href="/native/frame#opcodes">Opcode</A> <code>0x1B</code>.
          </p>
          <pre class="api-signature">TRANSFER_RESP  0x1B  ·  payload 2..506 bytes</pre>
          <p><span class="api-badge api-badge--responded">Reply</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep</code></td><td><code>u8</code></td><td>echoes the command's <code>ep</code> byte</td></tr>
              <tr><td>1</td><td><code>status</code></td><td><code>u8</code></td><td>how the transfer ended, in the table below</td></tr>
              <tr><td>2..</td><td><code>data</code></td><td><code>u8[]</code></td><td>the IN data stage, present only on an IN request with <code>status = 0</code>; the frame <A href="/native/frame#layout"><code>LEN</code></A> gives its length</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">STATUS</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>State</th><th>Means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0x00</code></td><td>completed</td><td>the device finished the status stage; an IN request's data follows</td></tr>
              <tr><td><code>0xFC</code></td><td>refused</td><td>stopped before the device, per the <A href="/native/commands/transfer#transfer">refusals</A></td></tr>
              <tr><td><code>0xFD</code></td><td>STALL</td><td>the device STALLed the request</td></tr>
              <tr><td><code>0xFE</code></td><td>no answer</td><td>the device did not finish within 500 ms or the transfer failed on the bus, the endpoint is undeclared, or no answer crossed the link within 800 ms</td></tr>
              <tr><td><code>0xFF</code></td><td>no device</td><td>nothing attached on the host chip, or the host chip is re-enumerating it</td></tr>
            </tbody>
          </table>
          <p>
            The same codes flag a <A href="/native/commands/catch#traffic-event"><code>CLIP_XFER</code></A>{' '}
            event, the transfer a <A href="/native/commands/clip#items">clip</A> runs.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>The device descriptor, answering <code>SEQ 07</code> (18 data bytes, so <code>LEN = 20</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1B     | 07     | 14 00  | 00     | 00     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep     | status |
+--------+--------+--------+--------+--------+--------+

+--------------------------------------------+--------+
| 12 01 00 02 00 00 00 40 ...  (18 bytes)    | lo hi  |
+--------------------------------------------+--------+
| IN data: the device descriptor             | CRC16  |
+--------------------------------------------+--------+`}</pre>
          <p>A device that STALLs <code>SEQ 08</code>'s request (no data):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 1B     | 08     | 02 00  | 00     | FD     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep     | status | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="in-flight" data-search-target>
        <Card>
          <CardHeader title="One at a time" subtitle="A TRANSFER holds the control port until it answers" />
          <p>
            The box runs a <code>TRANSFER</code> to completion before it reads the next control
            frame, so one is in flight at a time and replies arrive in command order.
          </p>
          <pre class="diagram">{`  TRANSFER A --> [ runs, up to 800 ms ] --> TRANSFER_RESP A
  TRANSFER B --> waits on the box -------------------------> [ runs ] --> TRANSFER_RESP B
  MOVE, ...  --> waits on the box -------------------------> applied in arrival order`}</pre>
          <div class="api-response-label">TIMING</div>
          <table class="api-params">
            <thead>
              <tr><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Device answer, on the host chip</td><td>500 ms, then <code>0xFE</code>.</td></tr>
              <tr><td>Link answer, on the device chip</td><td>800 ms, then <code>0xFE</code>.</td></tr>
              <tr><td>Frames held while one runs</td><td>63 frames, the running one included, or just under 16 KiB of payload; a frame past either is dropped.</td></tr>
              <tr><td>Injection silence timer</td><td>Restarts when the frame is read, and again when an answer arrives; an 800 ms timeout leaves it counting from the frame.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              Every other command waits behind a running <code>TRANSFER</code>, including{' '}
              <A href="/native/commands/move#move"><code>MOVE</code></A> and{' '}
              <A href="/native/commands/inject#inject"><code>INJECT</code></A>. Keep transfers out of
              a stream that has to land on time.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              An <code>0xFE</code> from the 800 ms window leaves the request queued on the host chip.
              It can still reach the device after the reply, and its late answer is dropped.
            </p>
          </div>
        </Card>
      </div>

      <div id="proxy" data-search-target>
        <Card>
          <CardHeader title="One control queue" subtitle="Every request to the real device takes its turn" />
          <p>
            The host chip feeds the real device one control request at a time from a single queue,
            six deep. A <code>TRANSFER</code> takes its turn there beside the game PC's requests, the
            transfers a <A href="/native/commands/clip#items">clip</A> runs, and the box's own.
          </p>
          <pre class="diagram">{`  game PC ------EP0------> clone -----------------+
                                                  |
  clip transfer items ---> DEVICE chip -----------+
                                                  |
  control PC --TRANSFER--> DEVICE chip -----------+--> HOST chip queue --> real device
                                                  |    six deep            one at a time
  halt clears, baseline reads (HOST chip) --------+`}</pre>
          <p>
            A queue filled by any of them answers a <code>TRANSFER</code> with <code>0xFC</code>.
          </p>
          <div class="api-response-label">TAPS</div>
          <p>
            A <code>TRANSFER</code> runs outside every tap, rule and trigger:{' '}
            <A href="/native/commands/catch#traffic-event"><code>CATCH CONTROL</code></A>,{' '}
            <A href="/native/commands/rewrite"><code>REWRITE</code></A> on <code>CONTROL</code>, and{' '}
            <A href="/native/commands/clip#packet-triggers">clip packet triggers</A> cover the game
            PC's traffic only.
          </p>
          <div class="callout callout--warning">
            <p>
              A slow request holds the device's EP0 for up to 500 ms, and a game PC request queued
              behind it waits that long for its answer.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Transfer;
