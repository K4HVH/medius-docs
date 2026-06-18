import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Requests: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Requests" subtitle="Query the box for state" />
        <p>
          <A href="/native/commands/requests#requests"><code>QUERY</code></A> is the only command that
          gets a reply, a <A href="/native/commands/requests#resp"><code>RESP</code></A>. Use it to read
          the firmware <A href="/native/commands/requests#version">version</A> and the box's{' '}
          <A href="/native/commands/requests#health">health</A>.
        </p>
      </Card>

      <div id="requests" data-search-target>
        <Card>
          <CardHeader title="QUERY" subtitle="Ask the box for state" />
          <p>
            <code>QUERY</code> asks for one piece of state, named by its <code>what</code> byte.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x05</code>.
          </p>
          <pre class="api-signature">QUERY  0x05  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>which state to read (see below)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SELECTORS</div>
          <table class="api-params">
            <thead>
              <tr><th><code>what</code></th><th>Reads</th><th>Reply</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>The firmware version.</td><td><A href="/native/commands/requests#version"><code>VERSION</code></A></td></tr>
              <tr><td><code>1</code></td><td>The box's health.</td><td><A href="/native/commands/requests#health"><code>HEALTH</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box replies with a <A href="/native/commands/requests#resp"><code>RESP</code></A>{' '}
            carrying the same <code>what</code> and the requested data. Everything else is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>. Library bindings:{' '}
            <A href="/library/requests#version"><code>query_version</code></A>,{' '}
            <A href="/library/requests#health"><code>query_health</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>what = 0</code> (read the version):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 05     | 00     | 01 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="resp" data-search-target>
        <Card>
          <CardHeader title="RESP" subtitle="The box's reply" />
          <p>
            <code>RESP</code> is the box's reply to a{' '}
            <A href="/native/commands/requests#requests"><code>QUERY</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x06</code>.
          </p>
          <pre class="api-signature">RESP  0x06  ·  box → PC</pre>
          <p><span class="api-badge api-badge--responded">Reply</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>echoes the request's selector</td></tr>
              <tr><td>1..</td><td><code>data</code></td><td><code>varies</code></td><td>the version or health layout below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            You get exactly one <code>RESP</code> per <code>QUERY</code>. Its{' '}
            <A href="/native/frame#seq"><code>SEQ</code></A> matches the request's and{' '}
            <code>what</code> echoes the selector, so you can pair a reply with its request and tell
            which kind it is. The two payload layouts,{' '}
            <A href="/native/commands/requests#version"><code>VERSION</code></A> and{' '}
            <A href="/native/commands/requests#health"><code>HEALTH</code></A>, are below, each with an
            example frame.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="VERSION" subtitle="RESP payload, what = 0" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 0</code>. <code>proto_ver</code> is the protocol version (this documentation
            describes <code>1</code>); the box reports its own firmware version in the bytes that follow.
          </p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x00</td></tr>
              <tr><td>1</td><td><code>proto_ver</code></td><td><code>u8</code></td><td>protocol version, expected 1</td></tr>
              <tr><td>2</td><td><code>fw_major</code></td><td><code>u8</code></td><td>firmware major</td></tr>
              <tr><td>3</td><td><code>fw_minor</code></td><td><code>u8</code></td><td>firmware minor</td></tr>
              <tr><td>4</td><td><code>fw_patch</code></td><td><code>u8</code></td><td>firmware patch</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box also sends this unprompted at startup, as a{' '}
            <A href="/native/connection#hello">ready signal</A>. Library binding:{' '}
            <A href="/library/requests#version"><code>query_version</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Firmware <code>1.3.1</code>, protocol <code>1</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 05 00  | 00     | 01     | 01     | 03     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | proto  | major  | minor  | patch  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="HEALTH" subtitle="RESP payload, what = 1" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 1</code>: a single <code>flags</code> byte, each bit an independent status.
          </p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x01</td></tr>
              <tr><td>1</td><td><code>flags</code></td><td><code>u8</code></td><td>the status bits below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td>the link to the host chip is up</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td>a real mouse is attached</td></tr>
              <tr><td>b2</td><td><code>0x04</code></td><td>the PC has set up the cloned mouse</td></tr>
              <tr><td>b3</td><td><code>0x08</code></td><td><A href="/native/injection">injection</A> is active</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Bits b4-b7 are unused. The first three set means the box is ready for input to reach the PC.
            Library binding: <A href="/library/requests#health"><code>query_health</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Ready, with link, mouse, and clone all up (<code>flags = 0x07</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 02 00  | 01     | 07     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Requests;
