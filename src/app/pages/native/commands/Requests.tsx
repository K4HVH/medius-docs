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
          <A href="/native/commands/requests#device-info">device info</A>,{' '}
          <A href="/native/commands/requests#caps">device capabilities</A>,{' '}
          <A href="/native/commands/requests#rate">rate</A>, delivery{' '}
          <A href="/native/commands/requests#stats">stats</A>, the active input{' '}
          <A href="/native/commands/requests#locks">locks</A>, the{' '}
          <A href="/native/commands/requests#catch">catch</A> subscription, a persistent box{' '}
          <A href="/native/commands/requests#options">option</A>, or the buffered input{' '}
          <A href="/native/commands/requests#clip">clip</A>.
        </p>
      </Card>

      <div id="requests" data-search-target>
        <Card>
          <CardHeader title="QUERY" subtitle="Ask the box for state" />
          <p>
            <code>QUERY</code> asks for one piece of state, named by its <code>what</code> byte.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x05</code>.
          </p>
          <pre class="api-signature">QUERY  0x05  ·  payload 1 byte (2 for OPTIONS)</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>which state to read (see below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u8</code></td><td>only for <code>what = 9</code> (OPTIONS): which option to read; omitted otherwise</td></tr>
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
              <tr><td><code>2</code></td><td>The cloned device's USB identity, kind, and product.</td><td><A href="/native/commands/requests#device-info"><code>DEVICE_INFO</code></A></td></tr>
              <tr><td><code>3</code></td><td>The whole device's capabilities (mouse + keyboard).</td><td><A href="/native/commands/requests#caps"><code>CAPS</code></A></td></tr>
              <tr><td><code>4</code></td><td>The native report rate.</td><td><A href="/native/commands/requests#rate"><code>RATE</code></A></td></tr>
              <tr><td><code>5</code></td><td>Delivery and telemetry counters.</td><td><A href="/native/commands/requests#stats"><code>STATS</code></A></td></tr>
              <tr><td><code>6</code></td><td>The active input locks.</td><td><A href="/native/commands/requests#locks"><code>LOCKS</code></A></td></tr>
              <tr><td><code>7</code></td><td>The active catch subscription.</td><td><A href="/native/commands/requests#catch"><code>CATCH</code></A></td></tr>
              <tr><td><code>9</code></td><td>A persistent box option, by <code>id</code>.</td><td><A href="/native/commands/requests#options"><code>OPTIONS</code></A></td></tr>
              <tr><td><code>10</code></td><td>The buffered-clip ring depth and playback state.</td><td><A href="/native/commands/requests#clip"><code>CLIP</code></A></td></tr>
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
            <A href="/library/requests#device-info"><code>device_info</code></A>,{' '}
            <A href="/library/requests#caps"><code>caps</code></A>,{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>,{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>,{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A>,{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A>,{' '}
            <A href="/library/options#query-imperfect"><code>query_imperfect</code></A>,{' '}
            <A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A>.
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
            which kind it is. Each selector's payload is laid out below, with an example frame.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="VERSION" subtitle="RESP payload, what = 0" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 0</code>. <code>proto_ver</code> is the protocol version (this documentation
            describes <code>3</code>); the box reports its own firmware version, then its base{' '}
            <code>mac</code>, a stable per-box id, then a length-delimited ASCII{' '}
            <A href="/native/commands/option#name"><code>name</code></A> tail (a synthesized default
            when unset). The <code>name</code> is additive, so <code>proto_ver</code> stays{' '}
            <code>3</code>: an older box just sends an empty tail.
          </p>
          <pre class="api-signature">QUERY  what = 0  ·  RESP 11-byte header + name</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x00</td></tr>
              <tr><td>1</td><td><code>proto_ver</code></td><td><code>u8</code></td><td>protocol version, expected 3</td></tr>
              <tr><td>2</td><td><code>fw_major</code></td><td><code>u8</code></td><td>firmware major</td></tr>
              <tr><td>3</td><td><code>fw_minor</code></td><td><code>u8</code></td><td>firmware minor</td></tr>
              <tr><td>4</td><td><code>fw_patch</code></td><td><code>u8</code></td><td>firmware patch</td></tr>
              <tr><td>5</td><td><code>mac</code></td><td><code>u8[6]</code></td><td>the device chip's base MAC; the stable per-box id, rendered as 12 lowercase hex digits</td></tr>
              <tr><td>11..</td><td><code>name</code></td><td><code>ascii</code></td><td>the box's human-readable name, filling the rest of the payload (the frame <code>LEN</code> delimits it); a synthesized <code>Medius-XXXX</code> default when unset, set via <A href="/native/commands/option#name"><code>OPTION(NAME)</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box also sends this unprompted at startup, as a{' '}
            <A href="/native/connection#hello">ready signal</A>. The <code>mac</code> stays fixed for a
            box, so it identifies the same box across replugs and port renumbering; the{' '}
            <A href="/native/commands/option#name"><code>name</code></A> is its readable label. Library
            binding: <A href="/library/requests#version"><code>query_version</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Firmware <code>3.0.0</code>, protocol <code>3</code>, MAC <code>123456789abc</code>, name "Loki":</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 0F 00  | 00     | 03     | 03     | 00     | 00     | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | proto  | major  | minor  | patch  | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| ...    | 12 34 56 78 9A BC  | 4C 6F 6B 69  | lo hi  |
+--------+--------------------+--------------+--------+
| ...    | mac (6 bytes)      | "Loki"       | CRC16  |
+--------+--------------------+--------------+--------+`}</pre>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="HEALTH" subtitle="RESP payload, what = 1" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 1</code>: a single <code>flags</code> byte, each bit an independent status.
          </p>
          <pre class="api-signature">QUERY  what = 1  ·  RESP 2 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
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
            The first three bits set means the box is ready for input to reach the PC.
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

      <div id="device-info" data-search-target>
        <Card>
          <CardHeader title="DEVICE_INFO" subtitle="RESP payload, what = 2" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 2</code>: the USB identity, kind, and product string the box read from the real
            device. The clone shows up on the game PC, not here, so this is the only way the control PC can
            read it. The header is fixed at 11 bytes, then a length-delimited UTF-8 <code>product</code>{' '}
            tail (which may be empty). Every field is zero when nothing is attached.
          </p>
          <pre class="api-signature">QUERY  what = 2  ·  RESP 11-byte header + product</pre>
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
              <tr><td>10</td><td><code>primary_kind</code></td><td><code>u8</code></td><td>the cloned device's kind, from its Boot-interface protocol (see below)</td></tr>
              <tr><td>11..</td><td><code>product</code></td><td><code>UTF-8</code></td><td>the product string, filling the rest of the payload; may be empty</td></tr>
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
          <div class="api-response-label">PRIMARY_KIND</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Kind</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>unknown</td></tr>
              <tr><td><code>1</code></td><td>keyboard</td></tr>
              <tr><td><code>2</code></td><td>mouse</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            A <code>vid</code> of <code>0</code> means nothing is attached yet. Library binding:{' '}
            <A href="/library/requests#device-info"><code>device_info</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A Logitech G502 (<code>046D:C08B</code>), USB 2.01, serial and BOS served, kind mouse, product "G502":</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 0F 00  | 02     | 6D 04  | 8B C0  | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | vid    | pid    | ...    |
+--------+--------+--------+--------+--------+--------+--------+--------+
| ...    | 10 01  | 01 02  | 03     | 02     | 47 35 30 32  | lo hi  |
+--------+--------+--------+--------+--------+--------------+--------+
| ...    | bcdDev | bcdUSB | flags  | kind   | "G502"       | CRC16  |
+--------+--------+--------+--------+--------+--------------+--------+`}</pre>
        </Card>
      </div>

      <div id="caps" data-search-target>
        <Card>
          <CardHeader title="CAPS" subtitle="RESP payload, what = 3" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 3</code>: one summary of the whole cloned device, mouse and keyboard, read from
            its HID report descriptors. Counts and yes/no flags only, never raw HID field offsets. Use it
            to check before you act: an <A href="/native/commands/inject#inject"><code>INJECT</code></A>{' '}
            for a usage the device lacks is silently ignored, so the counts tell you what is real. A class
            that is not present reads all-zero.
          </p>
          <pre class="api-signature">QUERY  what = 3  ·  RESP 7 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x03</td></tr>
              <tr><td>1</td><td><code>n_buttons</code></td><td><code>u8</code></td><td>buttons the mouse report carries</td></tr>
              <tr><td>2</td><td><code>axis_flags</code></td><td><code>u8</code></td><td>mouse axes, the bits below</td></tr>
              <tr><td>3</td><td><code>n_hid</code></td><td><code>u8</code></td><td>cloned HID interfaces; &gt;1 = composite</td></tr>
              <tr><td>4</td><td><code>n_keys</code></td><td><code>u8</code></td><td>keycode-array slots, or 0xFF for NKRO; 0 = no keyboard</td></tr>
              <tr><td>5</td><td><code>kbd_flags</code></td><td><code>u8</code></td><td>keyboard, the bits below</td></tr>
              <tr><td>6</td><td><code>change_driven</code></td><td><code>u8</code></td><td>per class: b0 mouse (continuous, 0), b1 keyboard/media (change-driven, 1 when bound)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AXIS_FLAGS</div>
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
          <div class="api-response-label">KBD_FLAGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td><code>NKRO</code>: the keyboard reports an NKRO bitmap</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td><code>CONSUMER</code>: a Consumer collection is present, so media keys are injectable</td></tr>
              <tr><td>b2</td><td><code>0x04</code></td><td><code>SYSTEM</code>: a system-control collection is present (passthrough-only)</td></tr>
              <tr><td>b3</td><td><code>0x08</code></td><td><code>REPORT_ID</code>: the keyboard report sits behind a HID report ID</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Library binding: <A href="/library/requests#caps"><code>caps</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A 5-button mouse (X/Y/wheel, one interface) plus a 6-key Consumer keyboard (<code>axis_flags = 0x07</code>, <code>kbd_flags = 0x02</code>, keyboard change-driven):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 07 00  | 03     | 05     | 07     | 01     | 06     | 02     | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | n_btn  | axis   | n_hid  | n_keys | kbdfl  | chgdrv | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="RATE" subtitle="RESP payload, what = 4" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 4</code>: how fast the active input reports, plus the poll period the clone
            advertises. The answer is class-aware, so read the field that fits the input kind:
          </p>
          <table class="api-params">
            <thead><tr><th>Input kind</th><th><code>CHANGE_DRIVEN</code></th><th>Read</th><th>Gives</th></tr></thead>
            <tbody>
              <tr><td>continuous (moving mouse)</td><td><code>0</code></td><td><code>native_period_us</code></td><td>Hz = 1e6 / period; reads 0 until learned</td></tr>
              <tr><td>change-driven (keyboard, media)</td><td><code>1</code></td><td><code>poll_period_us</code></td><td>no steady cadence, so <code>native_period_us</code> is 0</td></tr>
            </tbody>
          </table>
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
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------------+
| A5     | 06     | 00     | 11 00  | 05     | 00 10 00 00  |
+--------+--------+--------+--------+--------+--------------+
| SOF    | TYPE   | SEQ    | LEN    | what   | inject_emits |
+--------+--------+--------+--------+--------+--------------+
| 00 00  | 00 00  | 00     | 00     | 00 00  | 00 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| drops  | merges | maxdep | wedges | wakeup | resets | config | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="locks" data-search-target>
        <Card>
          <CardHeader title="LOCKS" subtitle="RESP payload, what = 6" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 6</code>: which physical inputs are currently locked by{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>, as a variable list of entries, one
            per locked field across every class, so keyboard and media locks read the same as mouse
            ones. An empty list (<code>n = 0</code>) means nothing is locked.
          </p>
          <pre class="api-signature">QUERY  what = 6  ·  RESP 2 + 4n bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x06</td></tr>
              <tr><td>1</td><td><code>n</code></td><td><code>u8</code></td><td>number of lock entries that follow</td></tr>
              <tr><td>+</td><td><code>class</code></td><td><code>u8</code></td><td>per entry: 0=button 1=key 2=media 3=axis (as <A href="/native/commands/lock"><code>LOCK</code></A>)</td></tr>
              <tr><td>+</td><td><code>id</code></td><td><code>u16</code></td><td>the locked field's id, or 0xFFFF for a whole-class blanket, little-endian</td></tr>
              <tr><td>+</td><td><code>dirbits</code></td><td><code>u8</code></td><td>which edges are locked, the bits below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRBITS</div>
          <table class="api-params">
            <thead>
              <tr><th>Bit</th><th>Mask</th><th>Set when</th></tr>
            </thead>
            <tbody>
              <tr><td>b0</td><td><code>0x01</code></td><td>the positive / press edge is locked</td></tr>
              <tr><td>b1</td><td><code>0x02</code></td><td>the negative / release edge is locked</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Read it to confirm a lock landed, or to mirror the box's lock state in a UI. Library
            binding: <A href="/library/requests#query-locks"><code>query_locks</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>One entry: the wheel's negative (scroll-down) sign locked (<code>class = 3</code> axis, <code>id = 2</code> wheel, <code>dirbits = 0x02</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 06 00  | 06     | 01     | 03     | 02 00  | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | n      | class  | id     | dirbits| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
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
              <tr><td>1</td><td><code>mask</code></td><td><code>u8</code></td><td>subscribed event classes; bits Motion 0x01, Wheel 0x02, Buttons 0x04, Keys 0x08, Media 0x10</td></tr>
              <tr><td>2</td><td><code>dropped</code></td><td><code>u32</code></td><td>events dropped box-side under back-pressure, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Read it to confirm a subscription landed, or to check whether you're losing events. Library
            binding: <A href="/library/requests#query-catch"><code>query_catch</code></A>.
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

      <div id="options" data-search-target>
        <Card>
          <CardHeader title="OPTIONS" subtitle="RESP payload, what = 9" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 9</code>: the value of one persistent box{' '}
            <A href="/native/commands/option"><code>OPTION</code></A>, echoing the queried{' '}
            <code>id</code>. The value is id-specific, so the query takes the option's <code>id</code> as
            a second byte and each option is read on its own. An unknown id gets no reply.
          </p>
          <pre class="api-signature">QUERY  what = 9, id  ·  RESP varies</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x09</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u8</code></td><td>which option this value is for</td></tr>
              <tr><td>2..</td><td><code>value</code></td><td><code>varies</code></td><td>id-specific, mirroring the matching <A href="/native/commands/option"><code>OPTION</code></A> value</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">IMPERFECT value</div>
          <p>
            The <A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A> opt-in (id 0) plus
            two derived clone-status bytes. Each is <code>0</code> or <code>1</code>; a faithful clone
            reads all-zero.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>2</td><td><code>allowed</code></td><td>the opt-in toggle; <code>1</code> = cloning an over-capacity device is allowed</td></tr>
              <tr><td>3</td><td><code>over_capacity</code></td><td>the attached device needs an interrupt-IN endpoint the box can't service</td></tr>
              <tr><td>4</td><td><code>clone_imperfect</code></td><td>the live clone is over-capacity and was cloned anyway, so one interface is dead</td></tr>
            </tbody>
          </table>
          <p>
            Read it to tell why a clone is missing (<code>over_capacity = 1</code>,{' '}
            <code>allowed = 0</code>), or to confirm an imperfect clone is live
            (<code>clone_imperfect = 1</code>). Library binding:{' '}
            <A href="/library/options#query-imperfect"><code>query_imperfect</code></A>.
          </p>
          <div class="api-response-label">MOVE_RIDE value</div>
          <p>
            The current <A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A> window (id 1).
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>2</td><td><code>timeout</code></td><td><code>u16</code>, little-endian; the ride window in ms, <code>0</code> = off</td></tr>
            </tbody>
          </table>
          <p>
            Library binding:{' '}
            <A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A>.
          </p>
          <div class="api-response-label">EMIT value</div>
          <p>
            The current <A href="/native/commands/option#emit"><code>EMIT</code></A> pacing (id 2): the
            mode, the configured fixed rate, and the rate actually in effect.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>2</td><td><code>mode</code></td><td><code>0</code> learnt, <code>1</code> interval, <code>2</code> fixed</td></tr>
              <tr><td>3</td><td><code>fixed_hz</code></td><td><code>u16</code>, little-endian; the configured fixed rate</td></tr>
              <tr><td>5</td><td><code>resolved_hz</code></td><td><code>u16</code>, little-endian; the ceiling in effect, <code>0</code> = learnt/adaptive or no device yet</td></tr>
            </tbody>
          </table>
          <p>
            Library binding:{' '}
            <A href="/library/options#query-emit-pace"><code>query_emit_pace</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Reading <code>id = 0</code>: opted in, an over-capacity device attached and cloned imperfectly:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 06     | 00     | 05 00  | 09     | 00     | 01     | 01     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | what   | id     | allow  | overcap| imperf | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="CLIP" subtitle="RESP payload, what = 10" />
          <p>
            The <A href="/native/commands/requests#resp"><code>RESP</code></A> payload when{' '}
            <code>what = 10</code>: the buffered-clip ring depth and playback state, for host flow-control.
            A fixed 21-byte prefix, then the clip's held-usage snapshot (the same class-tagged list a{' '}
            <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> carries). Read{' '}
            <code>free</code> before a{' '}
            <A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A> to avoid an overrun, and{' '}
            <code>state</code> to see a fault or that playback finished. Backs{' '}
            <A href="/library/clip#status"><code>ClipHandle::status</code></A>.
          </p>
          <pre class="api-signature">QUERY  what = 10  ·  RESP 21-byte prefix + held usages</pre>
          <p><span class="api-badge api-badge--responded">Returns RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>0x0A</td></tr>
              <tr><td>1</td><td><code>state</code></td><td><code>u8</code></td><td>0 idle / 1 armed (catch) / 2 playing / 3 faulted (an append was dropped, re-sync)</td></tr>
              <tr><td>2</td><td><code>free</code></td><td><code>u32</code></td><td>ring bytes free; pace top-ups off this, little-endian</td></tr>
              <tr><td>6</td><td><code>used</code></td><td><code>u32</code></td><td>ring bytes buffered, not yet drained</td></tr>
              <tr><td>10</td><td><code>ticks</code></td><td><code>u32</code></td><td>content ticks emitted since start (diagnostic)</td></tr>
              <tr><td>14</td><td><code>underruns</code></td><td><code>u16</code></td><td>empty-ring episodes</td></tr>
              <tr><td>16</td><td><code>overruns</code></td><td><code>u16</code></td><td>appends dropped whole because the ring was full</td></tr>
              <tr><td>18</td><td><code>seq_gaps</code></td><td><code>u16</code></td><td>dropped <code>CLIP_APPEND</code> frames detected (SEQ gaps)</td></tr>
              <tr><td>20</td><td><code>n</code></td><td><code>u8</code></td><td>number of held usages that follow</td></tr>
              <tr><td>+</td><td><code>class</code></td><td><code>u8</code></td><td>per held usage: 0=button 1=key 2=media</td></tr>
              <tr><td>+</td><td><code>id</code></td><td><code>u16</code></td><td>the held usage's id (button id, HID keycode, or Consumer usage), little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The held snapshot lists the usages the clip is currently forcing down, one class-tagged
            entry each (3 bytes), so buttons, keys, and media are reported one way. Library binding:{' '}
            <A href="/library/clip#status"><code>status</code></A>{' '}
            (<A href="/library/clip#status"><code>ClipStatus::held</code></A>).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Idle, empty ring (<code>state = 0</code>, <code>free = 1024</code>, no held usages):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------------+
| A5     | 06     | 00     | 15 00  | 0A     | 00     | 00 04 00 00  |
+--------+--------+--------+--------+--------+--------+--------------+
| SOF    | TYPE   | SEQ    | LEN    | what   | state  | free         |
+--------+--------+--------+--------+--------+--------+--------------+
| 00 00 00 00  | 00 00 00 00  | 00 00  | 00 00  | 00 00  | 00     | lo hi  |
+--------------+--------------+--------+--------+--------+--------+--------+
| used         | ticks        | undrun | ovrrun | seqgap | n      | CRC16  |
+--------------+--------------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

    </>
  );
};

export default Requests;
