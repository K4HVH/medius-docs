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
          gets a reply, a <A href="/native/commands/requests#resp"><code>RESP</code></A>. Pick what to
          read with the <code>what</code> selector: the firmware{' '}
          <A href="/native/commands/requests#version">version</A>, the box's{' '}
          <A href="/native/commands/requests#health">health</A>, the cloned{' '}
          <A href="/native/commands/requests#mouse-info">mouse info</A>,{' '}
          <A href="/native/commands/requests#mouse-caps">mouse capabilities</A>,{' '}
          <A href="/native/commands/requests#rate">rate</A>, delivery{' '}
          <A href="/native/commands/requests#stats">stats</A>, the active input{' '}
          <A href="/native/commands/requests#locks">locks</A>, the{' '}
          <A href="/native/commands/requests#catch">catch</A> subscription, or the cloned{' '}
          <A href="/native/commands/requests#kbd-caps">keyboard capabilities</A>.
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
              <tr><td><code>2</code></td><td>The cloned mouse's USB identity.</td><td><A href="/native/commands/requests#mouse-info"><code>MOUSE_INFO</code></A></td></tr>
              <tr><td><code>3</code></td><td>The emulated mouse's capabilities.</td><td><A href="/native/commands/requests#mouse-caps"><code>MOUSE_CAPS</code></A></td></tr>
              <tr><td><code>4</code></td><td>The native report rate.</td><td><A href="/native/commands/requests#rate"><code>RATE</code></A></td></tr>
              <tr><td><code>5</code></td><td>Delivery and telemetry counters.</td><td><A href="/native/commands/requests#stats"><code>STATS</code></A></td></tr>
              <tr><td><code>6</code></td><td>The active input locks.</td><td><A href="/native/commands/requests#locks"><code>LOCKS</code></A></td></tr>
              <tr><td><code>7</code></td><td>The active catch subscription.</td><td><A href="/native/commands/requests#catch"><code>CATCH</code></A></td></tr>
              <tr><td><code>8</code></td><td>The cloned keyboard's capabilities.</td><td><A href="/native/commands/requests#kbd-caps"><code>KBD_CAPS</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box replies with a <A href="/native/commands/requests#resp"><code>RESP</code></A>{' '}
            carrying the same <code>what</code> and the requested data, one per selector in the table
            above. <code>QUERY</code> is the only command that gets a reply; everything else is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>. Library bindings:{' '}
            <A href="/library/requests#version"><code>query_version</code></A>,{' '}
            <A href="/library/requests#health"><code>query_health</code></A>,{' '}
            <A href="/library/requests#query-mouse-info"><code>query_mouse_info</code></A>,{' '}
            <A href="/library/requests#query-mouse-caps"><code>query_mouse_caps</code></A>,{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>,{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>,{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A>,{' '}
            <A href="/library/catch#query-catch"><code>query_catch</code></A>,{' '}
            <A href="/library/requests#query-kbd-caps"><code>query_kbd_caps</code></A>.
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
              <tr><td>1..</td><td><code>data</code></td><td><code>varies</code></td><td>the layout for the requested <code>what</code> (see the <A href="/native/commands/requests#requests">selectors</A>)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            You get exactly one <code>RESP</code> per <code>QUERY</code>. Its{' '}
            <A href="/native/frame#seq"><code>SEQ</code></A> matches the request's and{' '}
            <code>what</code> echoes the selector, so you can pair a reply with its request and tell
            which kind it is. Each selector's payload is laid out below, with an example frame:{' '}
            <A href="/native/commands/requests#version"><code>VERSION</code></A>,{' '}
            <A href="/native/commands/requests#health"><code>HEALTH</code></A>,{' '}
            <A href="/native/commands/requests#mouse-info"><code>MOUSE_INFO</code></A>,{' '}
            <A href="/native/commands/requests#mouse-caps"><code>MOUSE_CAPS</code></A>,{' '}
            <A href="/native/commands/requests#rate"><code>RATE</code></A>,{' '}
            <A href="/native/commands/requests#stats"><code>STATS</code></A>,{' '}
            <A href="/native/commands/requests#locks"><code>LOCKS</code></A>,{' '}
            <A href="/native/commands/requests#catch"><code>CATCH</code></A>, and{' '}
            <A href="/native/commands/requests#kbd-caps"><code>KBD_CAPS</code></A>.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="VERSION" subtitle="RESP payload, what = 0" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 0</code>. <code>proto_ver</code> is the protocol version (this documentation
            describes <code>2</code>); the box reports its own firmware version in the bytes that follow.
          </p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x00</td></tr>
              <tr><td>1</td><td><code>proto_ver</code></td><td><code>u8</code></td><td>protocol version, expected 2</td></tr>
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
          <p>Firmware <code>1.6.0</code>, protocol <code>2</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 05 00  | 00     | 02     | 01     | 06     | 00     | lo hi  |
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
              <tr><td>b4</td><td><code>0x10</code></td><td><code>RATE_CONFIDENT</code>: the native-rate estimator window is full, so the <A href="/native/commands/requests#rate"><code>RATE</code></A> value is trustworthy</td></tr>
              <tr><td>b5</td><td><code>0x20</code></td><td><code>LOCK_ON</code>: at least one input <A href="/native/commands/lock"><code>LOCK</code></A> is active</td></tr>
              <tr><td>b6</td><td><code>0x40</code></td><td><code>CATCH_ON</code>: a <A href="/native/commands/catch"><code>CATCH</code></A> subscription is active, physical-input events are streaming</td></tr>
              <tr><td>b7</td><td><code>0x80</code></td><td><code>KBD_ATT</code>: a keyboard is attached on the host chip, cloned and injectable</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The first three set means the box is ready for input to reach the PC.
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

      <div id="mouse-info" data-search-target>
        <Card>
          <CardHeader title="MOUSE_INFO" subtitle="RESP payload, what = 2" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 2</code>: the USB identity the box read from the real mouse, its vendor and
            product id numbers, its USB version, and whether it has a serial number. The clone shows up
            on the game PC, not here, so this is the only way the control PC can read it. Every field is
            zero when no mouse is attached.
          </p>
          <pre class="api-signature">QUERY  what = 2  ·  RESP 10 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x02</td></tr>
              <tr><td>1</td><td><code>vid</code></td><td><code>u16</code></td><td>idVendor, little-endian</td></tr>
              <tr><td>3</td><td><code>pid</code></td><td><code>u16</code></td><td>idProduct, little-endian</td></tr>
              <tr><td>5</td><td><code>bcd_device</code></td><td><code>u16</code></td><td>bcdDevice, the device release</td></tr>
              <tr><td>7</td><td><code>bcd_usb</code></td><td><code>u16</code></td><td>bcdUSB, e.g. 0x0200 or 0x0201</td></tr>
              <tr><td>9</td><td><code>flags</code></td><td><code>u8</code></td><td>the bits below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td><code>HAS_SERIAL</code>: the clone serves a serial string</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td><code>HAS_BOS</code>: the clone serves a BOS descriptor</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            A <code>vid</code> of <code>0</code> means nothing is attached yet. Library binding:{' '}
            <A href="/library/requests#query-mouse-info"><code>query_mouse_info</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A Logitech G502 (<code>046D:C08B</code>), USB 2.01, serial and BOS served:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 0A 00  | 02     | 6D 04  | 8B C0  | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | vid    | pid    | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+
| ...    | 00 00  | 01 02  | 03     | lo hi  |
+--------+--------+--------+--------+--------+
| ...    | bcdDev | bcdUSB | flags  | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="mouse-caps" data-search-target>
        <Card>
          <CardHeader title="MOUSE_CAPS" subtitle="RESP payload, what = 3" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 3</code>: a plain summary of what the cloned mouse can do, read from its HID
            report descriptor. Counts and yes/no flags only, never raw HID field offsets. Use it to
            check before you act: an <A href="/native/commands/inject#button"><code>INJECT</code></A>{' '}
            for a button the mouse doesn't have is silently ignored, so <code>n_buttons</code> tells you
            which ids are real. Every field is zero when no mouse is bound. The keyboard's capabilities are{' '}
            <A href="/native/commands/requests#kbd-caps"><code>KBD_CAPS</code></A>.
          </p>
          <pre class="api-signature">QUERY  what = 3  ·  RESP 4 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x03</td></tr>
              <tr><td>1</td><td><code>n_buttons</code></td><td><code>u8</code></td><td>buttons the mouse report carries</td></tr>
              <tr><td>2</td><td><code>axis_flags</code></td><td><code>u8</code></td><td>the bits below</td></tr>
              <tr><td>3</td><td><code>n_hid</code></td><td><code>u8</code></td><td>cloned HID interfaces; &gt;1 = composite</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td><code>X</code>: the report carries an X axis</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td><code>Y</code>: the report carries a Y axis</td></tr>
              <tr><td>b2</td><td><code>0x04</code></td><td><code>WHEEL</code>: the report carries a wheel</td></tr>
              <tr><td>b3</td><td><code>0x08</code></td><td><code>REPORT_ID</code>: the mouse report sits behind a HID report ID</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Library binding: <A href="/library/requests#query-mouse-caps"><code>query_mouse_caps</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A 5-button mouse with X, Y, and wheel, single HID interface (<code>axis_flags = 0x07</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 04 00  | 03     | 05     | 07     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | n_btn  | axis   | n_hid  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="RATE" subtitle="RESP payload, what = 4" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 4</code>: how fast the active input reports, plus the poll period the clone
            advertises. The answer is class-aware. A continuous input (a moving mouse) carries a
            learned <code>native_period_us</code>, the gap between reports in microseconds, so the rate
            in Hz is <code>1e6 / period</code>; it reads <code>0</code> until the box has learned it. A
            change-driven input (a keyboard or media device) has no steady cadence, so it sets the{' '}
            <code>CHANGE_DRIVEN</code> flag and reports <code>native_period_us = 0</code>; the honest
            figure is then <code>poll_period_us</code>, the cloned endpoint's <code>bInterval</code>{' '}
            floor. Reading it tells you what the box actually sees rather than a made-up number.
          </p>
          <pre class="api-signature">QUERY  what = 4  ·  RESP 6 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x04</td></tr>
              <tr><td>1</td><td><code>native_period_us</code></td><td><code>u16</code></td><td>realised native period in µs; 0 = not learned, or change-driven (see flags), Hz = 1e6/period</td></tr>
              <tr><td>3</td><td><code>poll_period_us</code></td><td><code>u16</code></td><td>cloned inject-endpoint bInterval poll period in µs; the honest figure for a change-driven input</td></tr>
              <tr><td>5</td><td><code>flags</code></td><td><code>u8</code></td><td>the bits below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td><code>CONFIDENT</code>: the estimator window is full, same source as HEALTH <A href="/native/commands/requests#health"><code>RATE_CONFIDENT</code></A></td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td><code>CHANGE_DRIVEN</code>: the active input is event-driven (keyboard / media), so there is no continuous cadence and <code>native_period_us</code> is 0</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            A 1 kHz mouse reads ~1000 µs once learned. Library binding:{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A 1 kHz mouse, 1000 µs poll, estimator confident (<code>flags = 0x01</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 06 00  | 04     | E8 03  | E8 03  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | native | poll   | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="stats" data-search-target>
        <Card>
          <CardHeader title="STATS" subtitle="RESP payload, what = 5" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 5</code>: counters the box keeps about whether your commands were delivered.
            Commands are <A href="/native/injection#fire-and-forget">fire-and-forget</A> with no
            acknowledgement, so these counters are the only way to tell that everything you sent landed.
            A nonzero <code>tx_drops</code> or <code>tx_wedges</code> means delivery slipped under load.
            Wide counters clamp at their max instead of wrapping around.
          </p>
          <pre class="api-signature">QUERY  what = 5  ·  RESP 17 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x05</td></tr>
              <tr><td>1</td><td><code>inject_emits</code></td><td><code>u32</code></td><td>pure-injection reports emitted, little-endian</td></tr>
              <tr><td>5</td><td><code>tx_drops</code></td><td><code>u16</code></td><td>reports dropped on TX-queue overflow; should stay 0</td></tr>
              <tr><td>7</td><td><code>tx_merges</code></td><td><code>u16</code></td><td>backed-up reports merged instead of queued</td></tr>
              <tr><td>9</td><td><code>tx_maxdepth</code></td><td><code>u8</code></td><td>deepest the TX queue has reached</td></tr>
              <tr><td>10</td><td><code>tx_wedges</code></td><td><code>u8</code></td><td>wedged-endpoint recoveries</td></tr>
              <tr><td>11</td><td><code>wakeups</code></td><td><code>u16</code></td><td>remote-wakeups issued</td></tr>
              <tr><td>13</td><td><code>reset_count</code></td><td><code>u16</code></td><td>USB bus resets seen</td></tr>
              <tr><td>15</td><td><code>config_count</code></td><td><code>u16</code></td><td>SET_CONFIGURATION events (re-enumerations)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            <code>inject_emits</code> counts the no-halving / 1 kHz path. The rest are merge, queue,
            wakeup, reset, and reconfig counters. Library binding:{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>4096 emits, no drops, no wedges:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------------+--------+
| A5     | 06     | 00     | 11 00  | 05     | 00 10 00 00  | 00 00  | ...
+--------+--------+--------+--------+--------+--------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | inject_emits | drops  | ...
+--------+--------+--------+--------+--------+--------------+--------+`}</pre>
        </Card>
      </div>

      <div id="locks" data-search-target>
        <Card>
          <CardHeader title="LOCKS" subtitle="RESP payload, what = 6" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 6</code>: which physical inputs are currently locked by{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>, as a 16-bit <code>mask</code>. Two
            bits per target, one for each direction, so you can read back a per-direction lock exactly
            as you set it. A zero mask means nothing is locked.
          </p>
          <pre class="api-signature">QUERY  what = 6  ·  RESP 3 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x06</td></tr>
              <tr><td>1</td><td><code>mask</code></td><td><code>u16</code></td><td>active locks, little-endian; bit layout below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">BIT LAYOUT</div>
          <p>
            Each <A href="/native/commands/lock"><code>target</code></A> owns two bits. Bit{' '}
            <code>target*2</code> is the positive/press direction, bit <code>target*2 + 1</code> the
            negative/release direction. So <code>X+</code> is bit 0, <code>X−</code> bit 1,{' '}
            <code>Y+</code> bit 2, up to <code>Side2</code> release at bit 15.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x0001</code></td><td><code>X</code> positive is locked</td></tr>
              <tr><td>b1</td><td><code>0x0002</code></td><td><code>X</code> negative is locked</td></tr>
              <tr><td>b2 / b3</td><td><code>0x0004</code> / <code>0x0008</code></td><td><code>Y</code> positive / negative</td></tr>
              <tr><td>b4 / b5</td><td><code>0x0010</code> / <code>0x0020</code></td><td><code>Wheel</code> up / down</td></tr>
              <tr><td>b6 / b7</td><td><code>0x0040</code> / <code>0x0080</code></td><td><code>Left</code> press / release</td></tr>
              <tr><td>b8..b15</td><td><code>0x0100</code>+</td><td><code>Right</code>, <code>Middle</code>, <code>Side1</code>, <code>Side2</code>, press then release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Read it to confirm a lock landed, or to mirror the box's lock state in a UI. Library
            binding: <A href="/library/requests#query-locks"><code>query_locks</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Only the wheel's negative (scroll-down) direction locked (<code>mask = 0x0020</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 03 00  | 06     | 20 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | mask   | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="catch" data-search-target>
        <Card>
          <CardHeader title="CATCH" subtitle="RESP payload, what = 7" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 7</code>: the active <A href="/native/commands/catch"><code>CATCH</code></A>{' '}
            subscription <code>mask</code>, plus the box-side count of event frames dropped under
            back-pressure. A zero mask means nothing is subscribed. Mirrors the{' '}
            <A href="/native/commands/requests#health"><code>CATCH_ON</code></A> health bit.
          </p>
          <pre class="api-signature">QUERY  what = 7  ·  RESP 6 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x07</td></tr>
              <tr><td>1</td><td><code>mask</code></td><td><code>u8</code></td><td>subscribed event classes; bits Motion 0x01, Wheel 0x02, Buttons 0x04, Keys 0x08</td></tr>
              <tr><td>2</td><td><code>dropped</code></td><td><code>u32</code></td><td>events dropped box-side under back-pressure, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Read it to confirm a subscription landed, or to check whether you're losing events. Library
            binding: <A href="/library/catch#query-catch"><code>query_catch</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Motion and buttons subscribed, no drops (<code>mask = 0x05</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------------+--------+
| A5     | 06     | 00     | 06 00  | 07     | 05     | 00 00 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | mask   | dropped      | CRC16  |
+--------+--------+--------+--------+--------+--------+--------------+--------+`}</pre>
        </Card>
      </div>

      <div id="kbd-caps" data-search-target>
        <Card>
          <CardHeader title="KBD_CAPS" subtitle="RESP payload, what = 8" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 8</code>: a plain summary of what the cloned keyboard can do. Counts and yes/no
            flags only. Use it to feature-detect a board: the <code>CONSUMER</code> flag gates media
            injection (<A href="/native/commands/inject#media"><code>INJECT</code> class media</A>), and{' '}
            <code>n_keys</code> / <code>NKRO</code> describe its rollover. Every field is zero when no
            keyboard is bound, so check the{' '}
            <A href="/native/commands/requests#health"><code>KBD_ATT</code></A> health bit first.
          </p>
          <pre class="api-signature">QUERY  what = 8  ·  RESP 3 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x08</td></tr>
              <tr><td>1</td><td><code>n_keys</code></td><td><code>u8</code></td><td>keycode-array slots, or 0xFF for an NKRO bitmap keyboard</td></tr>
              <tr><td>2</td><td><code>flags</code></td><td><code>u8</code></td><td>the bits below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td><code>NKRO</code>: the keyboard reports an NKRO bitmap</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td><code>CONSUMER</code>: a Consumer collection is present, so media keys are injectable</td></tr>
              <tr><td>b2</td><td><code>0x04</code></td><td><code>SYSTEM</code>: a system-control collection is present (passthrough-only, not injectable)</td></tr>
              <tr><td>b3</td><td><code>0x08</code></td><td><code>REPORT_ID</code>: the keyboard report sits behind a HID report ID</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Library binding: <A href="/library/requests#query-kbd-caps"><code>query_kbd_caps</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A 6KRO board with a Consumer collection (<code>n_keys = 6</code>, <code>flags = 0x02</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 03 00  | 08     | 06     | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | n_keys | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Requests;
