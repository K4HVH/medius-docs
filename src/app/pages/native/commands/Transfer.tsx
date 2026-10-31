import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../../shell/PageHeader';
import { DocSection } from '../../../shell/DocSection';
import { ByteStrip } from '../../../shell/ByteStrip';
import { Anchor } from '../../../shell/Anchor';

const Transfer: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A> runs one USB control
          transfer on the real device from the control PC.{' '}
          <A href="/native/commands/transfer#transfer-resp"><code>TRANSFER_RESP</code></A> returns how
          it ended and what came back, a chunk a frame.
        </p>
        <pre class="diagram">{`  control PC               DEVICE chip            HOST chip            real device
      |                         |                     |                     |
      |-- TRANSFER, SEQ n ----->|                     |                     |
      |                         |-- link request ---->|                     |
      |                         |                     |-- SETUP, OUT data ->|
      |                         |                     |<- IN data, status --|
      |                         |<- reply, in chunks -|                     |
      |<- TRANSFER_RESP, n -----|                     |                     |
      |<- TRANSFER_RESP, n -----|                     |                     |
      |<- TRANSFER_RESP, LAST --|                     |                     |`}</pre>
        <p>
          The game PC's requests on the same endpoint{' '}
          <A href="/native/commands/transfer#proxy">come first</A>.
        </p>
        <div class="callout callout--warning">
          <p>
            <code>TRANSFER</code> is advanced control and runs only under the{' '}
            <A href="/native/commands/option#imperfect">imperfect-clone opt-in</A>. Otherwise a
            request with a full setup packet gets <code>0xFC</code> REFUSED and never reaches the real
            device.
          </p>
        </div>
      </PageHeader>

      <DocSection id="transfer" title="TRANSFER" caption="One control transfer on the real device">
        <p>
          <code>TRANSFER</code> carries an endpoint, how long the box waits, an eight-byte setup
          packet, and any OUT data stage.{' '}
          <A href="/native/frame#opcodes">Opcode</A> <code>0x1A</code>.
        </p>
        <pre class="api-signature">TRANSFER  0x1A  ·  payload 11..512 bytes</pre>
        <p><span class="api-badge api-badge--responded">Reply</span></p>
        <div class="api-response-label">PAYLOAD</div>
        <div class="table-scroll">
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep</code></td><td><code>u8</code></td><td>endpoint number: <code>0</code> = EP0, else a control endpoint the real device declares</td></tr>
              <tr><td>1</td><td><code>timeout_ms</code></td><td><code>u16</code></td><td>the box's wait on the real device, <code>1</code>-<code>65535</code> ms, little-endian</td></tr>
              <tr><td>3</td><td><code>bmRequestType</code></td><td><code>u8</code></td><td>bit 7 is direction: <code>1</code> IN, <code>0</code> OUT</td></tr>
              <tr><td>4</td><td><code>bRequest</code></td><td><code>u8</code></td><td>request code</td></tr>
              <tr><td>5</td><td><code>wValue</code></td><td><code>u16</code></td><td>little-endian</td></tr>
              <tr><td>7</td><td><code>wIndex</code></td><td><code>u16</code></td><td>little-endian</td></tr>
              <tr><td>9</td><td><code>wLength</code></td><td><code>u16</code></td><td>data stage length, little-endian</td></tr>
              <tr><td>11..</td><td><code>data</code></td><td><code>u8[]</code></td><td>OUT only: the <code>wLength</code> bytes of the data stage, ≤501</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Offsets 3-10 are the setup packet as the real device receives it.
        </p>
        <div class="api-response-label">TIMEOUT</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>refused with <code>0xFC</code>; nothing reaches the real device</td></tr>
              <tr><td><code>1</code>-<code>65535</code></td><td>the box waits that many ms on the real device, the time the game PC holds the pipe included; then <code>0xFE</code> NO_ANSWER, or <code>0xF9</code> BUSY if the game PC held the pipe throughout</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">DATA STAGE</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td>bit 7 = 1, IN</td><td>bytes after offset 10 ignored; the data stage comes back in the <A href="/native/commands/transfer#transfer-resp">reply</A></td></tr>
              <tr><td>bit 7 = 0, OUT</td><td>the first <code>wLength</code> bytes sent, the rest ignored; fewer is refused</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          An OUT stage tops out at 501 bytes, what a 512-byte{' '}
          <A href="/native/frame#layout">payload</A> leaves after <code>ep</code>,{' '}
          <code>timeout_ms</code> and the setup packet. An IN stage has no such limit: the reply comes
          in chunks.
        </p>
        <div class="callout callout--warning">
          <p>
            A <code>SET_CONFIGURATION</code> or <code>SET_INTERFACE</code> sent here changes only the
            real device. The clone, and the endpoints the host chip polls, stay as the game PC set
            them.
          </p>
        </div>
        <div class="api-response-label">REFUSALS</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>Sends</th></tr>
            </thead>
            <tbody>
              <tr><td>payload &lt;11 bytes</td><td>nothing; frame discarded</td></tr>
              <tr><td><A href="/native/commands/option#imperfect">opt-in</A> off</td><td><code>0xFC</code></td></tr>
              <tr><td><code>timeout_ms</code> = <code>0</code></td><td><code>0xFC</code></td></tr>
              <tr><td>OUT request with fewer than <code>wLength</code> data bytes</td><td><code>0xFC</code></td></tr>
              <tr><td><code>ep</code> naming no control endpoint the real device declares</td><td><code>0xFC</code></td></tr>
              <tr><td>another <code>TRANSFER</code> <A href="/native/commands/transfer#in-flight">outstanding</A></td><td><code>0xFC</code></td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <p>
          <code>GET_DESCRIPTOR(device)</code> on EP0, 18 bytes, waiting 1000 ms (<code>E8 03</code>):
          setup <code>80 06 00 01 00 00 12 00</code>.
        </p>
        <ByteStrip
          fields={[
            { value: 'A5', name: 'SOF' },
            { value: '1A', name: 'TYPE' },
            { value: '07', name: 'SEQ' },
            { value: '0B 00', name: 'LEN' },
            { value: '00', name: 'ep' },
            { value: 'E8 03', name: 'timeout_ms' },
            { value: '80', name: 'bmRequestType' },
            { value: '06', name: 'bRequest' },
            { value: '00 01', name: 'wValue' },
            { value: '00 00', name: 'wIndex' },
            { value: '12 00', name: 'wLength' },
            { value: 'lo hi', name: 'CRC16' },
          ]}
        />
        <p>
          An OUT request: <code>SET_REPORT(Output)</code> on interface 0 with one data byte,{' '}
          <code>02</code>, a boot keyboard's Caps Lock LED, waiting 500 ms (<code>F4 01</code>).
        </p>
        <ByteStrip
          fields={[
            { value: 'A5', name: 'SOF' },
            { value: '1A', name: 'TYPE' },
            { value: '08', name: 'SEQ' },
            { value: '0C 00', name: 'LEN' },
            { value: '00', name: 'ep' },
            { value: 'F4 01', name: 'timeout_ms' },
            { value: '21', name: 'bmRequestType' },
            { value: '09', name: 'bRequest' },
            { value: '00 02', name: 'wValue' },
            { value: '00 00', name: 'wIndex' },
            { value: '01 00', name: 'wLength' },
            { value: '02', name: 'data' },
            { value: 'lo hi', name: 'CRC16' },
          ]}
        />
        <p>
          Library bindings:{' '}
          <A href="/library/advanced/transfer#transfer"><code>transfer</code></A>,{' '}
          <A href="/library/advanced/transfer#transfer"><code>transfer_timeout</code></A>, and the{' '}
          <A href="/library/advanced/transfer#async"><code>AsyncDevice</code></A> forms.
        </p>
      </DocSection>

      <DocSection id="transfer-resp" title="TRANSFER_RESP" caption="Reply, a chunk a frame">
        <p>
          One or more frames per <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A>{' '}
          with a full setup packet, each echoing its <A href="/native/frame#seq"><code>SEQ</code></A>.{' '}
          <A href="/native/frame#opcodes">Opcode</A> <code>0x1B</code>.
        </p>
        <pre class="api-signature">TRANSFER_RESP  0x1B  ·  payload 6..454 bytes</pre>
        <p><span class="api-badge api-badge--responded">Reply</span></p>
        <div class="api-response-label">PAYLOAD</div>
        <div class="table-scroll">
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep</code></td><td><code>u8</code></td><td>echoes the command's <code>ep</code> byte</td></tr>
              <tr><td>1</td><td><code>status</code></td><td><code>u8</code></td><td>how the transfer ended, as below; read it on the <code>LAST</code> chunk only</td></tr>
              <tr><td>2</td><td><code>stage</code></td><td><code>u8</code></td><td>where it ended: <code>0</code> SETUP, <code>1</code> data, <code>2</code> status; read it on the <code>LAST</code> chunk only</td></tr>
              <tr><td>3</td><td><code>flags</code></td><td><code>u8</code></td><td>bit 0 <code>LAST</code>: the reply's last chunk</td></tr>
              <tr><td>4</td><td><code>offset</code></td><td><code>u16</code></td><td>where <code>data</code> sits in the reply, little-endian</td></tr>
              <tr><td>6..</td><td><code>data</code></td><td><code>u8[]</code></td><td>≤448 bytes of the reply; length from the frame <A href="/native/frame#layout"><code>LEN</code></A></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Put the chunks together by <code>offset</code>, and resolve the <code>TRANSFER</code> on the{' '}
          <code>LAST</code> one, as the library's{' '}
          <A href="/library/advanced/transfer#reply"><code>transfer</code></A> does.
        </p>
        <div class="api-response-label">DATA</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Request</th><th>Reply data</th></tr></thead>
            <tbody>
              <tr><td>IN, with a data stage</td><td>the data stage as the box received it: the bytes before a STALL included, and bytes past <code>wLength</code> where the real device sent more in the packets a host asks for</td></tr>
              <tr><td>OUT, or <code>wLength</code> = <code>0</code></td><td>what the real device sent where the status stage was due, ≤1 packet; usually none</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--info">
          <p>
            Every status can carry data. A PC sees data past <code>wLength</code>, and data in a status
            stage, as the transfer failing.
          </p>
        </div>
        <Anchor id="status" label="STATUS">
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Value</th><th>Name</th><th>Means</th></tr>
              </thead>
              <tbody>
                <tr><td><code>0x00</code></td><td><code>OK</code></td><td>the transfer completed</td></tr>
                <tr><td><code>0xF9</code></td><td><code>BUSY</code></td><td>the game PC's transfer held the pipe until the timeout, and nothing was sent (stage <code>0</code>); or the game PC's next request on that endpoint, or a bus event it caused, took the pipe in <code>stage</code></td></tr>
                <tr><td><code>0xFA</code></td><td><code>SUSPENDED</code></td><td>the game PC has suspended the clone, and the real device with it; nothing was sent</td></tr>
                <tr><td><code>0xFB</code></td><td><code>ERROR</code></td><td>the real device's packets were corrupt past three tries, or ran past the buffer the host asked for; or the host chip had no channel free to send it on</td></tr>
                <tr><td><code>0xFC</code></td><td><code>REFUSED</code></td><td>never sent, per the <A href="/native/commands/transfer#transfer">refusals</A></td></tr>
                <tr><td><code>0xFD</code></td><td><code>STALL</code></td><td>the real device STALLed, in <code>stage</code></td></tr>
                <tr><td><code>0xFE</code></td><td><code>NO_ANSWER</code></td><td>the real device NAKed until the timeout, in <code>stage</code>; or the host chip's reply was lost between the chips; or the reply's next chunk waited 1 s to be passed on to the control port (<code>stage</code> 1)</td></tr>
                <tr><td><code>0xFF</code></td><td><code>NO_DEVICE</code></td><td>no device attached</td></tr>
              </tbody>
            </table>
          </div>
        </Anchor>
        <p>
          The same codes flag a <A href="/native/commands/catch#traffic-event"><code>CLIP_XFER</code></A>{' '}
          event, the transfer a <A href="/native/commands/clip#items">clip</A> runs.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <p>
          The device descriptor for <code>SEQ 07</code>, one chunk (18 data bytes, so{' '}
          <code>LEN = 24</code>):
        </p>
        <ByteStrip
          fields={[
            { value: 'A5', name: 'SOF' },
            { value: '1B', name: 'TYPE' },
            { value: '07', name: 'SEQ' },
            { value: '18 00', name: 'LEN' },
            { value: '00', name: 'ep' },
            { value: '00', name: 'status' },
            { value: '02', name: 'stage' },
            { value: '01', name: 'flags' },
            { value: '00 00', name: 'offset' },
            { value: '12 01 00 02 00 00 00 40 ... (18 bytes)', name: 'data: the device descriptor' },
            { value: 'lo hi', name: 'CRC16' },
          ]}
        />
        <p>
          <code>SEQ 09</code> reads 1000 bytes of a configuration descriptor, three frames:
        </p>
        <pre class="diagram">{`  frame   flags       offset   data        reply bytes
  1       0x00        0        448 bytes   0-447
  2       0x00        448      448 bytes   448-895
  3       0x01 LAST   896      104 bytes   896-999       status 0x00 OK, stage 2`}</pre>
        <p>The real device STALLs <code>SEQ 0A</code>'s 192-byte read after 64 bytes:</p>
        <ByteStrip
          fields={[
            { value: 'A5', name: 'SOF' },
            { value: '1B', name: 'TYPE' },
            { value: '0A', name: 'SEQ' },
            { value: '46 00', name: 'LEN' },
            { value: '00', name: 'ep' },
            { value: 'FD', name: 'status' },
            { value: '01', name: 'stage' },
            { value: '01', name: 'flags' },
            { value: '00 00', name: 'offset' },
            { value: '... (64 bytes)', name: 'data: before the STALL' },
            { value: 'lo hi', name: 'CRC16' },
          ]}
        />
      </DocSection>

      <DocSection id="in-flight" title="One at a time" caption="One TRANSFER outstanding, every other command on arrival">
        <p>
          One <code>TRANSFER</code> is outstanding at a time, until its <code>LAST</code> chunk. One the box
          ended at a 1 s chunk wait stays outstanding until the real device finishes it. The control port keeps
          reading frames while it waits.
        </p>
        <pre class="diagram">{`  TRANSFER A --> [ waits on the real device ] --> TRANSFER_RESP A ... LAST
  TRANSFER B --> TRANSFER_RESP B, 0xFC REFUSED, while A waits
  MOVE, ...  --> applied as each arrives, while A waits`}</pre>
        <div class="api-response-label">TIMING</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>The box's wait on the real device</td><td><code>timeout_ms</code>, the time the game PC holds the pipe included. The time a long reply waits for its next chunk to be passed on to the control port is not counted, up to 1 s a chunk.</td></tr>
              <tr><td>The <code>LAST</code> chunk</td><td>Within <code>timeout_ms</code> + 0.5 s of the box taking the <code>TRANSFER</code>, plus any time its chunks waited for the control port. A reply lost between the chips still ends in one: <code>0xFE</code> NO_ANSWER. A reply whose next chunk waits 1 s to be passed on ends there too: NO_ANSWER in stage 1, with the data passed on so far. The box still runs the real device's transfer to its end.</td></tr>
              <tr><td>A client's wait for it</td><td>At least <code>timeout_ms</code> + 0.5 s, plus the client's serial latency. The library waits <code>timeout_ms</code> + 2 s.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--warning">
          <p>
            A <code>TRANSFER</code> doesn't hold off the 1 s silence clear (
            <A href="/native/injection#safety">safety</A>). A client holding injection state keeps
            sending keepalives while one waits.
          </p>
        </div>
      </DocSection>

      <DocSection id="proxy" title="Shared endpoints" caption="The game PC's requests come first">
        <p>
          Each control endpoint of the real device is one pipe. The game PC's requests on it come
          before a <code>TRANSFER</code>, and a <code>TRANSFER</code> never waits on another endpoint.
        </p>
        <pre class="diagram">{`  game PC ----- EP0 ---> clone ------+
                                     |
  control PC -- TRANSFER, ep 0 ------+--> EP0 pipe --------> real device EP0
                                     |    game PC first
  clip -------- transfer item, ep 0 -+

  game PC ----- endpoint 2 -> clone -+
                                     +--> endpoint 2 pipe -> real device endpoint 2
  control PC -- TRANSFER, ep 2 ------+`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Game PC</th><th><code>TRANSFER</code></th></tr>
            </thead>
            <tbody>
              <tr><td>has a request waiting on that endpoint</td><td>waits behind it, inside <code>timeout_ms</code></td></tr>
              <tr><td>gave up on a request there and sent no SETUP after it</td><td>waits behind it until the box ends it, 250-300 ms after the game PC's last poll; <code>0xF9</code> BUSY in stage <code>0</code> if <code>timeout_ms</code> runs out first</td></tr>
              <tr><td>holds the pipe until <code>timeout_ms</code> runs out</td><td><code>0xF9</code> BUSY in stage <code>0</code>: nothing sent</td></tr>
              <tr><td>sends its next request on that endpoint, or causes a bus event, mid-transfer</td><td><code>0xF9</code> BUSY in the stage it reached</td></tr>
              <tr><td>uses another endpoint</td><td>runs on, unaffected</td></tr>
              <tr><td>has the clone suspended</td><td><code>0xFA</code> SUSPENDED: nothing sent</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">TAPS</div>
        <p>
          A <code>TRANSFER</code> runs outside every tap, rule and trigger:{' '}
          <A href="/native/commands/catch#traffic-event"><code>CATCH CONTROL</code></A>,{' '}
          <A href="/native/commands/rewrite"><code>REWRITE</code></A> on <code>CONTROL</code>, and{' '}
          <A href="/native/commands/clip#packet-triggers">clip packet triggers</A> cover the game
          PC's traffic only.
        </p>
      </DocSection>
    </>
  );
};

export default Transfer;
