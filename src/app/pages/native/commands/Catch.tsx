import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Stream the traffic the box carries, addressed the way a lock is" />
        <p>
          <A href="/native/commands/catch#catch"><code>CATCH</code></A> subscribes to what passes
          through the box: physical input, the vendor-interface endpoints, proxied control
          transactions, the raw bytes of HID interfaces the semantic model does not parse, what the
          clone emitted, and the bus lifecycle.
        </p>
        <p>
          A subscription is a <strong>table of <code>(class, id, dir)</code> entries</strong>,
          addressed the way a <A href="/native/commands/lock"><code>LOCK</code></A> is.
        </p>
        <p>
          While subscribed the box pushes a{' '}
          <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A> for movement and
          the wheel, a{' '}
          <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> for buttons, keys
          and media, and a{' '}
          <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A> for everything
          byte-oriented. Subscribing is{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>; the box streams until you
          unsubscribe.
        </p>
        <div class="api-response-label">WHERE THE TAPS SIT</div>
        <pre class="diagram">{`  real device --USB3--> HOST chip ----link----> DEVICE chip --USB1--> game PC
                        |                       |
                        | clk = 0, host chip    | clk = 1, device chip
                        |                       |
                        +- HID_IN               +- HID_OUT, every OUT direction
                        +- VEND_INTR  IN        +- CONTROL
                        +- VEND_BULK  IN        +- EMIT   (after inject + lock)
                        +- BTN KEY MEDIA AXIS   +- BUS
                           at the merge point,
                           before the lock scale and before injection`}</pre>
        <p>
          Addressing doubles as the filter. The control link runs at 4&nbsp;Mbaud and vendor bulk
          alone measures ~250&nbsp;KiB/s through the box, so every class at once cannot be delivered.
        </p>
      </Card>

      <div id="catch" data-search-target>
        <Card>
          <CardHeader title="CATCH" subtitle="Add or remove one subscription-table entry" />
          <p>
            <code>CATCH</code> carries one table entry: an address, a direction, whether to subscribe
            or unsubscribe, and how much of each packet to capture. Send one frame per entry.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0B</code>.
          </p>
          <pre class="api-signature">CATCH  0x0B  ·  payload 6 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>the address class (table below), or <code>0xFF</code> = every class</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>class-specific, or <code>0xFFFF</code> = every id in that class, little-endian</td></tr>
              <tr><td>3</td><td><code>dir</code></td><td><code>u8</code></td><td>0 <code>BOTH</code>, 1 <code>POS</code>/IN, 2 <code>NEG</code>/OUT (the <A href="/native/commands/lock"><code>LOCK</code></A> direction byte)</td></tr>
              <tr><td>4</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> = subscribe, <code>0</code> = unsubscribe</td></tr>
              <tr><td>5</td><td><code>snaplen</code></td><td><code>u8</code></td><td>bytes captured per event; <code>0</code> = the whole packet</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ADDRESS CLASSES</div>
          <p>
            Classes 0 to 3 are the <A href="/native/commands/lock"><code>LOCK</code></A> classes
            unchanged. Classes 4 and up reach the byte-oriented traffic.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Value</th><th><code>id</code> means</th><th>With <code>id = 0xFFFF</code></th></tr>
            </thead>
            <tbody>
              <tr><td><code>BTN</code></td><td><code>0</code></td><td>button id</td><td>every button</td></tr>
              <tr><td><code>KEY</code></td><td><code>1</code></td><td>HID keyboard usage</td><td>every key and modifier</td></tr>
              <tr><td><code>MEDIA</code></td><td><code>2</code></td><td>16-bit Consumer usage</td><td>every media usage</td></tr>
              <tr><td><code>AXIS</code></td><td><code>3</code></td><td><code>TGT_X</code> / <code>TGT_Y</code> / <code>TGT_WHEEL</code></td><td>every axis</td></tr>
              <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>interface number</td><td>every HID interface</td></tr>
              <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>endpoint address</td><td>every interrupt-OUT endpoint</td></tr>
              <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>endpoint address</td><td>every vendor interrupt endpoint</td></tr>
              <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>endpoint address</td><td>every vendor bulk endpoint</td></tr>
              <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>endpoint number (<code>0</code> = EP0)</td><td>every control endpoint</td></tr>
              <tr><td><code>EMIT</code></td><td><code>9</code></td><td>endpoint address</td><td>every emitting endpoint</td></tr>
              <tr><td><code>BUS</code></td><td><code>10</code></td><td>unused</td><td>-</td></tr>
              <tr><td><code>ANY</code></td><td><code>0xFF</code></td><td>must be <code>0xFFFF</code></td><td>every class</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Input classes (0 to 3)</th><th>Traffic classes (4 to 10)</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code> <code>BOTH</code></td><td>press and release</td><td>IN and OUT</td></tr>
              <tr><td><code>1</code> <code>POS</code></td><td>the press edge, or the <code>+</code> sign of an axis</td><td>IN: device to PC</td></tr>
              <tr><td><code>2</code> <code>NEG</code></td><td>the release edge, or the <code>-</code> sign of an axis</td><td>OUT: PC to device</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SNAPLEN</div>
          <p>
            <code>snaplen</code> is per entry, so one subscription can take a 64-byte report whole
            while another cuts a bulk pipe to 16. A cut capture still carries the packet's real
            length in{' '}
            <A href="/native/commands/catch#traffic-event"><code>true_len</code></A>.
          </p>
          <div class="api-response-label">PHYSICAL ONLY, AND BEFORE THE SCALE</div>
          <p>
            The input classes are captured at the emission merge point <em>before</em> any{' '}
            <A href="/native/commands/lock#scale"><code>LOCK</code> scale</A> or{' '}
            <A href="/native/injection">injection</A>, so an input you have weighed down, or blocked
            outright, is still reported here at its full physical value.
          </p>
          <p>
            <code>EMIT</code> is the mirror: what the clone put on the wire <em>after</em> injection,
            locks, and the suppression gate.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Subscribe to every vendor interrupt endpoint, both directions, capturing the first 32
            bytes of each packet (<code>class = 6</code>, <code>id = 0xFFFF</code>,{' '}
            <code>snaplen = 32</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0B     | 00     | 06 00  | 06     | FF FF  | 00     | 01     | 20     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | state  | snaplen| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Subscribe to everything: <code>class=0xFF, id=0xFFFF, dir=BOTH, state=1</code>.
            Unsubscribe everything: the same with <code>state=0</code>, which clears the whole table
            in one frame:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0B     | 01     | 06 00  | FF     | FF FF  | 00     | 00     | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | state  | snaplen| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            A blanket is one table entry, not an expansion into per-id entries, which is how a{' '}
            <A href="/native/commands/lock#blanket"><code>LOCK</code> blanket</A> (<code>id = 0xFFFF</code>)
            already behaves. Library binding:{' '}
            <A href="/library/catch#catch-events"><code>catch_events</code></A>.
          </p>
        </Card>
      </div>

      <div id="matching" data-search-target>
        <Card>
          <CardHeader title="The table" subtitle="Most-specific-first matching, 32 entries, and how a refusal shows up" />
          <p>
            An exact <code>(class, id)</code> entry beats a class blanket, which beats{' '}
            <code>class = 0xFF</code>; ties go to the earlier entry. The winning entry supplies the{' '}
            <code>snaplen</code>.
          </p>
          <pre class="diagram">{`  table (insertion order)
    #0  class = ANY        id = ALL     snaplen = 16
    #1  class = VEND_INTR  id = ALL     snaplen = 32
    #2  class = VEND_INTR  id = 0x83    snaplen = 0

  a 64-byte packet on vendor interrupt endpoint 0x83
    +- exact (class, id)?   #2  HIT  --> snaplen 0   -> all 64 bytes captured
    +- class blanket?       #1  (not reached)
    +- class = ANY?         #0  (not reached)

  the same 64-byte packet on endpoint 0x81
    +- exact (class, id)?       miss
    +- class blanket?       #1  HIT  --> snaplen 32  -> 32 bytes, true_len = 64
    +- class = ANY?         #0  (not reached)

  a control transaction on EP0
    +- exact (class, id)?       miss
    +- class blanket?           miss
    +- class = ANY?         #0  HIT  --> snaplen 16`}</pre>
          <div class="api-response-label">CAPACITY AND REFUSAL</div>
          <p>
            The table holds <strong>32</strong> entries. <code>CATCH</code> has no reply, so a refused
            entry shows up as its absence from{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>, plus the
            table-full flag in that reply's header.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>the table already holds 32 entries</td><td>nothing is evicted; the header's <code>b0</code> flag says an entry was turned away</td></tr>
              <tr><td><code>class</code> is one the firmware does not know</td><td>an unknown class has no tap to attach to</td></tr>
              <tr><td><code>dir</code> is outside <code>0..2</code></td><td>a subscription is addressed before any bearing is read, so only <code>0</code>-<code>2</code> name anything a tap can match</td></tr>
              <tr><td><code>class = 0xFF</code> with a specific <code>id</code></td><td><code>id</code> is class-specific, so a wildcard class with a real id addresses nothing coherent</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LIFECYCLE</div>
          <p>
            A subscription is PC-owned state, cleared by control-PC silence (the ~1&nbsp;s timeout), a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a mouse detach, inter-chip
            link loss, or an explicit unsubscribe.
          </p>
          <p>
            The host library holds an open table alive with the same keepalive it uses for injection
            holds, re-asserting the whole table after a device-side blip and across a control-link
            reconnect; its own <code>RESET</code> ends the event stream cleanly.
          </p>
          <p>
            The HEALTH <A href="/native/commands/requests#health"><code>CATCH_ON</code></A> bit means
            the table is non-empty.
          </p>
        </Card>
      </div>

      <div id="clocks" data-search-target>
        <Card>
          <CardHeader title="The clk byte" subtitle="Two chips, two clocks, one byte saying which" />
          <p>
            All three event frames lead with <code>ts_us</code> and then <code>clk</code>. The two
            ESP32-S3s boot independently, so nothing relates their timers: a stamp is only meaningful
            against another from the same domain.
          </p>
          <table class="api-params">
            <thead>
              <tr><th><code>clk</code></th><th>Stamped by</th><th>Which classes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>the <strong>host</strong> chip, in USB interrupt context, when the real device's transfer completed</td><td><code>MOTION</code> / <code>USAGE</code>, <code>HID_IN</code>, <code>VEND_INTR</code> / <code>VEND_BULK</code> IN</td></tr>
              <tr><td><code>1</code></td><td>the <strong>device</strong> chip, at the tap</td><td><code>HID_OUT</code>, both OUT directions, <code>CONTROL</code>, <code>EMIT</code>, <code>BUS</code></td></tr>
            </tbody>
          </table>
          <p>
            Both clocks are box-local, with no relationship to any clock on the control PC.
          </p>
          <p>
            Each wraps every ~71.6 minutes (a 32-bit microsecond counter) and returns to zero when
            that chip reboots, so a value below the previous one is a wrap, a reboot, or a domain
            change.
          </p>
          <pre class="diagram">{`  clk = 0   HID_IN  ts_us = 1286497017   (host chip)
  clk = 0   HID_IN  ts_us = 1286544017   (host chip)
                            ----------
                    delta =      47000 us / 1000 us poll = 47 polls
                                            -> 46 polls where the device said nothing

  clk = 1   EMIT    ts_us =  902114550   (device chip)
                    ^ smaller than the stamps above, and NOT earlier:
                      a different chip, a different epoch. Subtracting across
                      domains without the measured offset is meaningless.`}</pre>
          <div class="api-response-label">PUTTING BOTH DOMAINS ON ONE TIMELINE</div>
          <p>
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A> carries a measured
            offset between the two clocks, its drift rate, and the round trip that bounds its error.
            Applying it is optional; the <code>clk</code> byte stays authoritative.
          </p>
          <p>
            Divide a gap by{' '}
            <A href="/native/commands/requests#rate"><code>RESP(RATE)</code></A>'s{' '}
            <code>poll_period_us</code> for a poll count, but only where that reply's{' '}
            <A href="/native/commands/requests#rate"><code>CHANGE_DRIVEN</code></A> flag is clear: a change-driven device never puts its
            idle polls on the wire, so they cannot be counted.
          </p>
        </Card>
      </div>

      <div id="motion-event" data-search-target>
        <Card>
          <CardHeader title="MOTION_EVENT" subtitle="One physical relative-axis snapshot, box → PC" />
          <p>
            While an <code>AXIS</code> subscription is active the box pushes a{' '}
            <code>MOTION_EVENT</code> for each physical report whose motion changed.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0C</code>.
          </p>
          <p>
            There's no <A href="/native/commands/requests#requests"><code>QUERY</code></A> to
            correlate. <A href="/native/frame#seq"><code>SEQ</code></A> is instead a rolling per-event
            counter shared with{' '}
            <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> and{' '}
            <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A>, stamped as
            each event leaves the box, so it orders the stream whatever mix of frame types is in it.
          </p>
          <p>
            <code>SEQ</code> is not a drop detector: events are dropped before they reach the stamp,
            so it runs gapless and losses are read from{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>.
          </p>
          <pre class="api-signature">MOTION_EVENT  0x0C  ·  payload 11 bytes</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ts_us</code></td><td><code>u32</code></td><td>report arrival time in box microseconds, little-endian</td></tr>
              <tr><td>4</td><td><code>clk</code></td><td><code>u8</code></td><td>always <code>0</code> (host chip); see <A href="/native/commands/catch#clocks">the clk byte</A></td></tr>
              <tr><td>5</td><td><code>dx</code></td><td><code>i16</code></td><td>physical X this report; + = right, little-endian</td></tr>
              <tr><td>7</td><td><code>dy</code></td><td><code>i16</code></td><td>physical Y this report; + = down, little-endian</td></tr>
              <tr><td>9</td><td><code>dz</code></td><td><code>i16</code></td><td>physical wheel delta this report; + = up, little-endian</td></tr>
            </tbody>
          </table>
          <p>
            The stamp is taken the instant the device's interrupt-IN transfer completed, which is why
            it is always the host chip's.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>The user moves +10 right, no vertical or wheel motion (<code>dx = 10</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+
| A5     | 0C     | 2A     | 0B 00  | 40 42 0F 00 | 00     | 0A 00  | 00 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | dx     | dy     | dz     | CRC16  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="usage-event" data-search-target>
        <Card>
          <CardHeader title="USAGE_EVENT" subtitle="One physical held-usage snapshot, box → PC" />
          <p>
            While a <code>BTN</code>, <code>KEY</code>, or <code>MEDIA</code> subscription is active
            the box pushes a <code>USAGE_EVENT</code> when that class changes: a class-tagged snapshot
            of the usages currently held.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0F</code>.
          </p>
          <p>
            It's a full snapshot, not edge deltas, so a dropped frame self-corrects on the next one.
          </p>
          <pre class="api-signature">USAGE_EVENT  0x0F  ·  payload 8 + 3n bytes</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ts_us</code></td><td><code>u32</code></td><td>report arrival time in box microseconds, little-endian</td></tr>
              <tr><td>4</td><td><code>clk</code></td><td><code>u8</code></td><td>always <code>0</code> (host chip); see <A href="/native/commands/catch#clocks">the clk byte</A></td></tr>
              <tr><td>5</td><td><code>cls</code></td><td><code>u8</code></td><td>the snapshot's class: 0=button 1=key 2=media</td></tr>
              <tr><td>6</td><td><code>dir</code></td><td><code>u8</code></td><td>the edge that produced it: <code>POS</code> the set grew, <code>NEG</code> it shrank</td></tr>
              <tr><td>7</td><td><code>n</code></td><td><code>u8</code></td><td>number of held usages that follow</td></tr>
              <tr><td>+</td><td><code>class</code></td><td><code>u8</code></td><td>per usage: same vocabulary as <code>cls</code> (as <A href="/native/commands/inject#inject"><code>INJECT</code></A>)</td></tr>
              <tr><td>+</td><td><code>id</code></td><td><code>u16</code></td><td>the held usage's id (a button id, HID keycode with 0xE0-0xE7 modifiers, or Consumer usage), little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ONE CLASS PER EVENT</div>
          <p>
            Each entry is 3 bytes and the snapshot is <code>n</code> of them, all one class, since
            one physical report is one class.
          </p>
          <p>
            Only the held usages that resolve against the table appear, and no event is emitted when
            none do.
          </p>
          <p>
            A snapshot lists what is currently <em>held</em>, so the release of a usage is the
            snapshot that no longer names it. Without <code>cls</code>, "all buttons released" and
            "all keys released" are the same bytes.
          </p>
          <p>
            The box resolves each usage against its entry's direction, but while any other subscriber
            holds a wider entry it emits on both edges, and only <code>dir</code> tells the two apart.
          </p>
          <p>
            Route these by <strong>class</strong>, not by which usages appear, and diff successive
            snapshots for the usages you care about. Matching on the usages present drops the release
            edge whenever another subscription's usage is still held.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Left Shift held while pressing <code>A</code> (a keys snapshot, two usages both <code>class = 1</code>: Left Shift <code>id = 0xE1</code>, then A <code>id = 0x04</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+----------+----------+--------+
| A5     | 0F     | 2B     | 0E 00  | 40 42 0F 00 | 00     | 01     | 01     | 02     | 01 E1 00 | 01 04 00 | lo hi  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+----------+----------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | cls    | dir    | n      | usage[0] | usage[1] | CRC16  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+----------+----------+--------+`}</pre>
        </Card>
      </div>

      <div id="traffic-event" data-search-target>
        <Card>
          <CardHeader title="TRAFFIC_EVENT" subtitle="Bytes off any of the byte-oriented classes, box → PC" />
          <p>
            One frame type carries <code>HID_IN</code>, <code>HID_OUT</code>,{' '}
            <code>VEND_INTR</code>, <code>VEND_BULK</code>, <code>CONTROL</code>, <code>EMIT</code>{' '}
            and <code>BUS</code>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x16</code>.
          </p>
          <pre class="api-signature">TRAFFIC_EVENT  0x16  ·  payload 12 + n bytes</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ts_us</code></td><td><code>u32</code></td><td>when the tap fired, little-endian</td></tr>
              <tr><td>4</td><td><code>clk</code></td><td><code>u8</code></td><td>which chip's clock stamped it; see <A href="/native/commands/catch#clocks">the clk byte</A></td></tr>
              <tr><td>5</td><td><code>class</code></td><td><code>u8</code></td><td>the address class (<A href="/native/commands/catch#catch">table above</A>)</td></tr>
              <tr><td>6</td><td><code>id</code></td><td><code>u16</code></td><td>endpoint address, interface number, or endpoint number, little-endian</td></tr>
              <tr><td>8</td><td><code>dir</code></td><td><code>u8</code></td><td><code>1</code> = IN (device to PC), <code>2</code> = OUT (PC to device), <code>0</code> for <code>BUS</code>, which is not a transfer</td></tr>
              <tr><td>9</td><td><code>flags</code></td><td><code>u8</code></td><td>class-specific (table below)</td></tr>
              <tr><td>10</td><td><code>true_len</code></td><td><code>u16</code></td><td>the packet's length <em>before</em> <code>snaplen</code> truncation, little-endian</td></tr>
              <tr><td>12</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>up to <code>snaplen</code> bytes; the frame <A href="/native/frame#layout"><code>LEN</code></A> delimits how many arrived</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TRUNCATION</div>
          <pre class="diagram">{`  frame LEN = 12 + 16   ->  16 bytes arrived
  true_len  = 64        ->  the packet was 64 bytes
                            ------------------------
                            48 bytes were cut by snaplen, not absent from the wire

  frame LEN = 12 + 4    ->  4 bytes arrived
  true_len  = 4         ->  the packet really was 4 bytes long`}</pre>
          <div class="api-response-label">FLAGS BY CLASS</div>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th><code>flags</code></th></tr>
            </thead>
            <tbody>
              <tr><td><code>VEND_BULK</code></td><td>b0 end-of-transfer, b1 zero-length packet</td></tr>
              <tr><td><code>CONTROL</code></td><td>the real device's answer: <code>0</code> OK, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed to timeout</td></tr>
              <tr><td><code>BUS</code></td><td>the event kind (table below)</td></tr>
              <tr><td>every other class</td><td><code>0</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL: ONE EVENT PER TRANSACTION</div>
          <p>
            <code>CONTROL</code> carries one event per <em>completed transaction</em>, not one per
            stage: <code>bytes</code> is <code>[setup 8][data…]</code> and <code>dir</code> says which
            way the data stage went.
          </p>
          <p>
            A request answered from the box's own value cache still produces an event.
          </p>
          <pre class="diagram">{`  bytes = 80 06 00 01 00 00 12 00   12 01 00 02 00 00 00 40 ...
          '------ setup (8) ------'   '---- data stage -------'
          GET_DESCRIPTOR(device)      dir = 1 (IN), flags = 0 (the device answered)`}</pre>
          <div class="api-response-label">BUS EVENT KINDS</div>
          <p>
            <code>BUS</code> carries <code>[a][b]</code> in <code>bytes</code> with the kind in{' '}
            <code>flags</code>. A bus event is not a transfer, so its <code>dir</code> is <code>0</code>{' '}
            and <code>true_len</code> is just the operand count.
          </p>
          <p>
            The same events drive <A href="/native/commands/requests#health">HEALTH</A> bits and{' '}
            <A href="/native/commands/requests#stats">STATS</A> counters; here they carry a timestamp
            and their place in the stream.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Kind</th><th>Meaning</th><th><code>a</code>, <code>b</code></th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>RESET</code></td><td>-</td></tr>
              <tr><td><code>1</code></td><td><code>SUSPEND</code></td><td>-</td></tr>
              <tr><td><code>2</code></td><td><code>RESUME</code></td><td>-</td></tr>
              <tr><td><code>3</code></td><td><code>CONFIGURED</code></td><td>configuration index</td></tr>
              <tr><td><code>4</code></td><td><code>DECONFIGURED</code></td><td>-</td></tr>
              <tr><td><code>5</code></td><td><code>SET_INTERFACE</code></td><td>interface, alternate setting</td></tr>
              <tr><td><code>6</code></td><td><code>DEV_ATTACHED</code></td><td>-</td></tr>
              <tr><td><code>7</code></td><td><code>DEV_DETACHED</code></td><td>-</td></tr>
              <tr><td><code>8</code></td><td><code>CLONE_UP</code></td><td>-</td></tr>
              <tr><td><code>9</code></td><td><code>CLONE_DOWN</code></td><td>-</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            A 64-byte vendor interrupt report arriving IN on endpoint <code>0x83</code>, captured
            under a <code>snaplen = 16</code> entry (<code>class = 6</code>, <code>dir = 1</code>,{' '}
            <code>true_len = 64</code>, 16 bytes present, so payload <code>LEN = 28</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| A5     | 16     | 3C     | 1C 00  | 40 42 0F 00 | 00     | 06     | 83 00  | 01     |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | class  | id     | dir    |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+

+--------+--------+---------------------------------------+--------+
| 00     | 40 00  | 04 01 12 00 ...        (16 bytes)      | lo hi  |
+--------+--------+---------------------------------------+--------+
| flags  |true_len| bytes: 16 of 64, so the rest was cut   | CRC16  |
+--------+--------+---------------------------------------+--------+`}</pre>
          <p>
            A <code>SET_INTERFACE</code> bus event on interface 1, alternate setting 2 (
            <code>class = 10</code>, <code>flags = 5</code>, two operand bytes, so payload{' '}
            <code>LEN = 14</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| A5     | 16     | 3D     | 0E 00  | 41 42 0F 00 | 01     | 0A     | 00 00  | 00     |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | class  | id     | dir    |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+
| 05     | 02 00  | 01     | 02     | lo hi  |
+--------+--------+--------+--------+--------+
| flags  |true_len| a=iface| b=alt  | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="delivery" data-search-target>
        <Card>
          <CardHeader title="Delivery" subtitle="Best-effort, ranked, and counted per entry" />
          <p>
            Events drain through strict-priority queues.
          </p>
          <pre class="diagram">{`  BTN KEY MEDIA AXIS BUS    -->  [ queue 0 ]  --+
  HID_IN HID_OUT                                |
  VEND_INTR EMIT            -->  [ queue 1 ]  --+--->  control link, 4 Mbaud
  CONTROL                   -->  [ queue 2 ]  --+
  VEND_BULK                 -->  [ queue 3 ]  --+

  strict priority: each queue drains fully before the next`}</pre>
          <p>
            Bulk can starve completely under a busy mouse: bulk plus input is the combination the
            control link cannot carry.
          </p>
          <p>
            Under back-pressure the box drops events rather than stalling the report path, so the
            stream never delays the game-PC-facing reports. Every drop is counted{' '}
            <em>per entry</em> in{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Catch;
