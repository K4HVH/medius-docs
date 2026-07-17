import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Frame: Component = () => {
  return (
    <>
      <div id="layout" data-search-target>
        <Card>
          <CardHeader title="Frame format" subtitle="The one packet shape" />
          <p>
            Every message, both directions, is a frame with one fixed shape. The whole protocol is
            frames; each command is the same machinery with a different opcode and payload.
          </p>
          <pre class="api-signature">[SOF 0xA5][TYPE u8][SEQ u8][LEN u16 LE][PAYLOAD ≤512][CRC16 u16 LE]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Field</th><th>Bytes</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>SOF</code></td><td>1</td><td>start-of-frame marker, always <code>0xA5</code></td></tr>
              <tr><td><code>TYPE</code></td><td>1</td><td>the opcode</td></tr>
              <tr><td><code>SEQ</code></td><td>1</td><td>per-frame sequence number</td></tr>
              <tr><td><code>LEN</code></td><td>2</td><td>payload byte count, little-endian</td></tr>
              <tr><td><code>PAYLOAD</code></td><td>0-512</td><td>the command's data; empty for argument-free commands</td></tr>
              <tr><td><code>CRC16</code></td><td>2</td><td>checksum over the frame body</td></tr>
            </tbody>
          </table>
          <p>
            Max payload 512 bytes, so a frame is at most 519. Every multi-byte number is little-endian:
            the 16-bit value <code>100</code> is the bytes <code>64 00</code>.
          </p>
        </Card>
      </div>

      <div id="seq" data-search-target>
        <Card>
          <CardHeader title="Sequence numbers" subtitle="Matching a reply to its request" />
          <p>
            <code>SEQ</code> is a one-byte counter you set per frame, typically incrementing and
            wrapping at 255.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Command</th><th>Role of <code>SEQ</code></th></tr>
            </thead>
            <tbody>
              <tr><td>Ordinary commands</td><td>Only helps you spot a dropped frame.</td></tr>
              <tr><td><A href="/native/commands/requests#requests"><code>QUERY</code></A></td><td>The box copies your <code>SEQ</code> onto the <A href="/native/commands/requests#resp"><code>RESP</code></A>, so with several requests outstanding the matching <code>SEQ</code> tells you which reply answers which.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="opcodes" data-search-target>
        <Card>
          <CardHeader title="Opcodes" subtitle="The TYPE byte" />
          <p>
            The opcodes run from <code>0x01</code> to <code>0x13</code>. Four values are reserved,
            retired by the unified-input collapse. An unrecognised opcode is ignored harmlessly, which
            keeps newer and older firmware compatible.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Opcode</th><th>Name</th><th>Direction</th><th>Payload</th><th>Reply</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0x01</code></td><td><A href="/native/commands/move#move"><code>MOVE</code></A></td><td>PC→box</td><td>3 or 5 bytes</td><td>none</td></tr>
              <tr><td><code>0x02</code></td><td>reserved</td><td>-</td><td>-</td><td>-</td></tr>
              <tr><td><code>0x03</code></td><td><A href="/native/commands/inject#inject"><code>INJECT</code></A></td><td>PC→box</td><td>4 bytes</td><td>none</td></tr>
              <tr><td><code>0x04</code></td><td><A href="/native/commands/admin#reset"><code>RESET</code></A></td><td>PC→box</td><td>0 bytes</td><td>none</td></tr>
              <tr><td><code>0x05</code></td><td><A href="/native/commands/requests#requests"><code>QUERY</code></A></td><td>PC→box</td><td>1 byte</td><td><A href="/native/commands/requests#resp"><code>RESP</code></A></td></tr>
              <tr><td><code>0x06</code></td><td><A href="/native/commands/requests#resp"><code>RESP</code></A></td><td>box→PC</td><td>varies</td><td>none</td></tr>
              <tr><td><code>0x07</code></td><td><A href="/native/commands/admin#reboot"><code>REBOOT</code></A></td><td>PC→box</td><td>1 byte</td><td>none</td></tr>
              <tr><td><code>0x08</code></td><td><A href="/native/commands/admin#log"><code>LOG</code></A></td><td>box→PC</td><td>varies</td><td>none</td></tr>
              <tr><td><code>0x09</code></td><td><A href="/native/commands/led#led"><code>LED</code></A></td><td>PC→box</td><td>3 bytes</td><td>none</td></tr>
              <tr><td><code>0x0A</code></td><td><A href="/native/commands/lock#lock"><code>LOCK</code></A></td><td>PC→box</td><td>5 bytes</td><td>none</td></tr>
              <tr><td><code>0x0B</code></td><td><A href="/native/commands/catch#catch"><code>CATCH</code></A></td><td>PC→box</td><td>1 byte</td><td>none</td></tr>
              <tr><td><code>0x0C</code></td><td><A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A></td><td>box→PC</td><td>6 bytes</td><td>none</td></tr>
              <tr><td><code>0x0D</code></td><td>reserved</td><td>-</td><td>-</td><td>-</td></tr>
              <tr><td><code>0x0E</code></td><td>reserved</td><td>-</td><td>-</td><td>-</td></tr>
              <tr><td><code>0x0F</code></td><td><A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A></td><td>box→PC</td><td>varies</td><td>none</td></tr>
              <tr><td><code>0x10</code></td><td>reserved</td><td>-</td><td>-</td><td>-</td></tr>
              <tr><td><code>0x11</code></td><td><A href="/native/commands/option#option"><code>OPTION</code></A></td><td>PC→box</td><td>varies</td><td>none</td></tr>
              <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>PC→box</td><td>varies</td><td>none</td></tr>
              <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>PC→box</td><td>varies</td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            <code>0x02</code>, <code>0x0D</code>, and <code>0x0E</code> were the old <code>WHEEL</code>,{' '}
            <code>KEY</code>, and <code>CONSUMER</code> commands, folded into{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> (motion-tagged) and{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A> (class-tagged). <code>0x10</code>{' '}
            was <code>CONS_EVENT</code>, folded into the class-tagged{' '}
            <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A>. The old numbers are
            never reused.
          </p>
        </Card>
      </div>

      <div id="crc" data-search-target>
        <Card>
          <CardHeader title="Checksum & integrity" subtitle="Rejecting corrupted frames" />
          <p>
            The last two bytes are a <a href="https://en.wikipedia.org/wiki/Cyclic_redundancy_check" target="_blank" rel="noreferrer">CRC16-CCITT</a> checksum over{' '}
            <code>TYPE | SEQ | LEN | PAYLOAD</code> (everything but <code>SOF</code> and the checksum
            itself), stored little-endian. On a mismatch the box silently drops the frame and resyncs
            at the next <code>0xA5</code>, so corrupted frames are never acted on.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Polynomial</td><td><code>0x1021</code></td></tr>
              <tr><td>Initial value</td><td><code>0xFFFF</code></td></tr>
              <tr><td>Bit reflection</td><td>None</td></tr>
              <tr><td>Final XOR</td><td>None</td></tr>
            </tbody>
          </table>
          <pre><code class="language-python">{`def crc16_ccitt(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc

def encode_frame(type, seq, payload):
    body = bytes([type, seq]) + len(payload).to_bytes(2, "little") + payload
    crc = crc16_ccitt(body)
    return bytes([0xA5]) + body + crc.to_bytes(2, "little")`}</code></pre>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Example: a MOVE frame" />
          <p>
            A cursor <A href="/native/commands/move#move"><code>MOVE</code></A> of{' '}
            <code>dx = 100</code>, <code>dy = 0</code>.
          </p>
          <ul>
            <li>Opcode <code>0x01</code>.</li>
            <li>Payload is the <code>motion</code> byte (<code>00</code> = cursor) then the two 16-bit values <code>dx</code> and <code>dy</code> (<code>64 00</code>, <code>00 00</code>).</li>
            <li><code>LEN</code> is <code>05 00</code>.</li>
          </ul>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 01     | 00     | 05 00  | 00     | 64 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | motion | dx     | dy     | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            The CRC bytes are the little-endian <code>crc16_ccitt</code> of{' '}
            <code>01 00 05 00 00 64 00 00 00</code>. Compute them rather than copying a literal.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Frame;
