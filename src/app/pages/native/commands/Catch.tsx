import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Catch" subtitle="Stream box traffic, addressed like a lock" />
        <p>
          <A href="/native/commands/catch#catch"><code>CATCH</code></A> subscribes to traffic through
          the box: physical input, vendor-interface endpoints, proxied control transactions, raw
          bytes of HID interfaces the semantic model doesn't parse, what the clone emitted, bus
          lifecycle, and the control transfers a <A href="/native/commands/clip#items">clip</A> runs.
        </p>
        <p>
          A subscription is a <strong>table of <code>(class, id, dir)</code> entries</strong>,
          addressed like a <A href="/native/commands/lock"><code>LOCK</code></A>.
        </p>
        <p>
          While subscribed the box pushes a{' '}
          <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A> for movement,
          the wheel, and pan, a{' '}
          <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> for buttons, keys
          and media, and a{' '}
          <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A> for everything
          byte-oriented. Subscribing is{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>; the box streams until
          unsubscribed.
        </p>
        <div class="api-response-label">TAP POINTS</div>
        <pre class="diagram">{`  real device --USB3--> HOST chip ----link----> DEVICE chip --USB1--> game PC
                        |                       |
                        | clk = 0, host chip    | clk = 1, device chip
                        |                       |
                        +- HID_IN               +- HID_OUT, every OUT direction
                        +- VEND_INTR  IN        +- CONTROL, CLIP_XFER
                        +- VEND_BULK  IN        +- EMIT   (after inject + lock)
                        +- BTN KEY MEDIA AXIS   +- BUS
                           at the merge point,  +- VEND_INTR, VEND_BULK  IN
                           before the lock scale   from RAW or a clip raw entry
                           and before injection`}</pre>
        <p>
          Addressing is the filter: the control link runs at 6&nbsp;Mbaud and vendor bulk alone
          measures ~250&nbsp;KiB/s through the box, so every class at once can't be delivered.
        </p>
      </Card>

      <div id="catch" data-search-target>
        <Card>
          <CardHeader title="CATCH" subtitle="Add or remove one subscription-table entry" />
          <p>
            <code>CATCH</code> carries one table entry: address, direction, subscribe or unsubscribe,
            and how much of each packet to capture.{' '}
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
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>address class (table below), or <code>0xFF</code> = every class</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>class-specific, or <code>0xFFFF</code> = every id in that class, little-endian</td></tr>
              <tr><td>3</td><td><code>dir</code></td><td><code>u8</code></td><td>0 <code>BOTH</code>, 1 <code>POS</code>/IN, 2 <code>NEG</code>/OUT (the <A href="/native/commands/lock"><code>LOCK</code></A> direction byte)</td></tr>
              <tr><td>4</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> = subscribe, <code>0</code> = unsubscribe</td></tr>
              <tr><td>5</td><td><code>snaplen</code></td><td><code>u8</code></td><td>bytes captured per event; <code>0</code> = the whole packet</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ADDRESS CLASSES</div>
          <p>
            Classes 0 to 3 are the <A href="/native/commands/lock"><code>LOCK</code></A> classes; 4
            and up are byte-oriented traffic.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Value</th><th><code>id</code> means</th><th>With <code>id = 0xFFFF</code></th></tr>
            </thead>
            <tbody>
              <tr><td><code>BTN</code></td><td><code>0</code></td><td>button id</td><td>every button</td></tr>
              <tr><td><code>KEY</code></td><td><code>1</code></td><td>HID keyboard usage</td><td>every key and modifier</td></tr>
              <tr><td><code>MEDIA</code></td><td><code>2</code></td><td>16-bit Consumer usage</td><td>every media usage</td></tr>
              <tr><td><code>AXIS</code></td><td><code>3</code></td><td><code>TGT_X</code> / <code>TGT_Y</code> / <code>TGT_WHEEL</code> / <code>TGT_PAN</code></td><td>every axis</td></tr>
              <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>interface number</td><td>every HID interface</td></tr>
              <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>endpoint number</td><td>every interrupt-OUT endpoint</td></tr>
              <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>endpoint number</td><td>every vendor interrupt endpoint</td></tr>
              <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>endpoint number</td><td>every vendor bulk endpoint</td></tr>
              <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>endpoint number (<code>0</code> = EP0; on EP0, class and vendor requests)</td><td>every control endpoint</td></tr>
              <tr><td><code>EMIT</code></td><td><code>9</code></td><td>endpoint number</td><td>every emitting endpoint</td></tr>
              <tr><td><code>BUS</code></td><td><code>10</code></td><td>unused</td><td>-</td></tr>
              <tr><td><code>CLIP_XFER</code></td><td><code>11</code></td><td>endpoint number (<code>0</code> = EP0)</td><td>every control endpoint</td></tr>
              <tr><td><code>ANY</code></td><td><code>0xFF</code></td><td>must be <code>0xFFFF</code></td><td>every class</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Input classes (0 to 3)</th><th>Traffic classes (4 to 11)</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code> <code>BOTH</code></td><td>press and release</td><td>IN and OUT</td></tr>
              <tr><td><code>1</code> <code>POS</code></td><td>the press edge, or the <code>+</code> sign of an axis</td><td>IN: device to PC</td></tr>
              <tr><td><code>2</code> <code>NEG</code></td><td>the release edge, or the <code>-</code> sign of an axis</td><td>OUT: PC to device</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SNAPLEN</div>
          <p>
            <code>snaplen</code> is per entry: one subscription can take a 64-byte report whole while
            another cuts a bulk pipe to 16. A cut capture still carries the real length in{' '}
            <A href="/native/commands/catch#traffic-event"><code>true_len</code></A>.
          </p>
          <div class="api-response-label">CAPTURE POINT</div>
          <p>
            Input classes are captured at the emission merge point <em>before</em> any{' '}
            <A href="/native/commands/lock#scale"><code>LOCK</code> scale</A> or{' '}
            <A href="/native/injection">injection</A>, so a weighed or blocked input still reports
            its full physical value.
          </p>
          <p>
            <code>EMIT</code> is what the clone put on the wire <em>after</em> injection, locks, and
            the suppression gate.
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
            A blanket (<code>id = 0xFFFF</code>) stays one wildcard entry, unlike a{' '}
            <A href="/native/commands/lock#blanket"><code>LOCK</code> button or axis blanket</A>,
            which expands per member. Library binding:{' '}
            <A href="/library/catch#catch-events"><code>catch_events</code></A>.
          </p>
        </Card>
      </div>

      <div id="matching" data-search-target>
        <Card>
          <CardHeader title="Table" subtitle="Matching, capacity, refusals" />
          <p>
            An exact <code>(class, id)</code> entry ranks above a class blanket, which ranks above{' '}
            <code>class = 0xFF</code>; ties go to the earlier entry. The highest-ranked entry supplies the{' '}
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
          <div class="api-response-label">CAPACITY</div>
          <p>
            The table holds <strong>32</strong> entries. No reply: a refused entry is absent from{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>, whose header
            carries the table-full flag.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>table already at 32 entries</td><td>nothing is evicted; the header's <code>b0</code> flag marks the refusal</td></tr>
              <tr><td>unknown <code>class</code></td><td>no tap to attach to</td></tr>
              <tr><td><code>dir</code> outside <code>0..2</code></td><td>a subscription is addressed before any bearing is read, so only <code>0</code>-<code>2</code> name anything a tap can match</td></tr>
              <tr><td><code>class = 0xFF</code> with a specific <code>id</code></td><td><code>id</code> is class-specific, so a wildcard class with a real id addresses nothing coherent</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LIFECYCLE</div>
          <p>
            A subscription is PC-owned state, cleared by control-PC silence (the ~1&nbsp;s timeout), a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a mouse detach, a{' '}
            <A href="/native/commands/patch#presentation">re-clone</A>, inter-chip link loss, or an
            explicit unsubscribe. Every clear but the unsubscribe moves the{' '}
            <A href="/native/commands/requests#stats"><code>session</code></A> count.
          </p>
          <p>
            The library holds an open table past the silence timeout with its injection keepalive,
            re-asserting the whole table after a device-side blip and across a control-link reconnect;
            its own <code>RESET</code> ends the event stream.
          </p>
          <p>
            The HEALTH <A href="/native/commands/requests#health"><code>CATCH_ON</code></A> bit means
            the table is non-empty.
          </p>
        </Card>
      </div>

      <div id="clocks" data-search-target>
        <Card>
          <CardHeader title="clk byte" subtitle="Which chip's clock stamped an event" />
          <p>
            All three event frames lead with <code>ts_us</code> then <code>clk</code>. The two
            ESP32-S3s boot independently with unrelated timers, so a stamp compares only against
            another from the same domain.
          </p>
          <table class="api-params">
            <thead>
              <tr><th><code>clk</code></th><th>Stamped by</th><th>Classes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>the <strong>host</strong> chip, in USB interrupt context, when the real device's transfer completed</td><td><code>MOTION</code> / <code>USAGE</code>, <code>HID_IN</code>, the device's <code>VEND_INTR</code> / <code>VEND_BULK</code> IN</td></tr>
              <tr><td><code>1</code></td><td>the <strong>device</strong> chip, at the tap</td><td><code>HID_OUT</code>, both OUT directions, a vendor IN packet from <A href="/native/commands/raw#catch"><code>RAW</code></A> or a <A href="/native/commands/clip#items">clip raw entry</A>, <code>CONTROL</code>, <code>CLIP_XFER</code>, <code>EMIT</code>, <code>BUS</code></td></tr>
            </tbody>
          </table>
          <p>
            Both clocks are box-local, unrelated to any control-PC clock.
          </p>
          <p>
            Each wraps every ~71.6 minutes (a 32-bit microsecond counter) and returns to zero when
            that chip reboots, so a value below the previous one is a wrap, a reboot, or a domain
            change.
          </p>
          <pre class="diagram">{`  clk = 0   HID_IN  ts_us = 1286497017   (host chip)
  clk = 0   HID_IN  ts_us = 1286544017   (host chip)
                            ----------
                    delta =      47000 µs / 1000 µs poll = 47 polls
                                            -> 46 polls where the device said nothing

  clk = 1   EMIT    ts_us =  902114550   (device chip)
                    ^ smaller than the stamps above, and NOT earlier:
                      a different chip, a different epoch. Subtracting across
                      domains without the measured offset is meaningless.`}</pre>
          <div class="api-response-label">CORRELATION</div>
          <p>
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A> carries a measured
            offset between the two clocks, its drift rate, and the round trip that bounds its error.
          </p>
          <p>
            Divide a gap by{' '}
            <A href="/native/commands/requests#rate"><code>RESP(RATE)</code></A>'s{' '}
            <code>poll_period_us</code> for a poll count, but only where its{' '}
            <A href="/native/commands/requests#rate"><code>CHANGE_DRIVEN</code></A> flag is clear: a
            change-driven device's idle polls never reach the wire and can't be counted.
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
            <A href="/native/frame#seq"><code>SEQ</code></A> is a rolling per-event counter shared
            with <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> and{' '}
            <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A>, stamped as
            each event leaves the box, so it orders a mixed stream.
          </p>
          <p>
            <code>SEQ</code> doesn't detect drops: events drop before the stamp, so it runs gapless;
            losses are in{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>.
          </p>
          <pre class="api-signature">MOTION_EVENT  0x0C  ·  payload 13 bytes</pre>
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
              <tr><td>11</td><td><code>dpan</code></td><td><code>i16</code></td><td>physical AC Pan (horizontal scroll) delta this report; + = right, little-endian</td></tr>
            </tbody>
          </table>
          <p>
            The stamp is taken when the device's interrupt-IN transfer completes, so it is always the
            host chip's.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A physical +10 right, no other motion (<code>dx = 10</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+--------+
| A5     | 0C     | 2A     | 0D 00  | 40 42 0F 00 | 00     | 0A 00  | 00 00  | 00 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | dx     | dy     | dz     | dpan   | CRC16  |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+--------+--------+`}</pre>
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
              <tr><td>5</td><td><code>cls</code></td><td><code>u8</code></td><td>snapshot class: 0=button 1=key 2=media</td></tr>
              <tr><td>6</td><td><code>dir</code></td><td><code>u8</code></td><td>the edge that produced it: <code>POS</code> the set grew, <code>NEG</code> it shrank</td></tr>
              <tr><td>7</td><td><code>n</code></td><td><code>u8</code></td><td>number of held usages that follow</td></tr>
              <tr><td>+</td><td><code>class</code></td><td><code>u8</code></td><td>per usage: same vocabulary as <code>cls</code> (as <A href="/native/commands/inject#inject"><code>INJECT</code></A>)</td></tr>
              <tr><td>+</td><td><code>id</code></td><td><code>u16</code></td><td>held usage id (a button id, HID keycode with 0xE0-0xE7 modifiers, or Consumer usage), little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SNAPSHOT</div>
          <p>
            Each entry is 3 bytes and the snapshot is <code>n</code> of them, all one class, since
            one physical report is one class.
          </p>
          <p>
            Only held usages that match the table appear; with none, no event is emitted.
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
            Route by <strong>class</strong>, not by the usages present, and diff successive snapshots
            for the usages of interest; matching on present usages misses the release edge while
            another subscription's usage is held.
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
          <CardHeader title="TRAFFIC_EVENT" subtitle="Byte-oriented class traffic, box → PC" />
          <p>
            One frame type carries every{' '}
            <A href="/native/commands/catch#catch">traffic class</A>, 4 to 11.{' '}
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
              <tr><td>4</td><td><code>clk</code></td><td><code>u8</code></td><td>stamping chip's clock; see <A href="/native/commands/catch#clocks">the clk byte</A></td></tr>
              <tr><td>5</td><td><code>class</code></td><td><code>u8</code></td><td>address class (<A href="/native/commands/catch#catch">table above</A>)</td></tr>
              <tr><td>6</td><td><code>id</code></td><td><code>u16</code></td><td>endpoint number or interface number, little-endian</td></tr>
              <tr><td>8</td><td><code>dir</code></td><td><code>u8</code></td><td><code>1</code> = IN (device to PC), <code>2</code> = OUT (PC to device), <code>0</code> for <code>BUS</code>, which is not a transfer</td></tr>
              <tr><td>9</td><td><code>flags</code></td><td><code>u8</code></td><td>class-specific (table below)</td></tr>
              <tr><td>10</td><td><code>true_len</code></td><td><code>u16</code></td><td>packet length <em>before</em> truncation (by <code>snaplen</code> or the 172-byte control data-stage cap), little-endian</td></tr>
              <tr><td>12</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>up to <code>snaplen</code> bytes; the frame <A href="/native/frame#layout"><code>LEN</code></A> gives how many arrived</td></tr>
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
              <tr><td><code>HID_IN</code>, <code>HID_OUT</code>, <code>VEND_INTR</code>, <code>EMIT</code></td><td>b7 <A href="/native/commands/catch#rules"><code>RULE</code></A>; the rest <code>0</code></td></tr>
              <tr><td><code>VEND_BULK</code></td><td>b0 end-of-transfer, b1 zero-length packet, b7 <code>RULE</code></td></tr>
              <tr><td><code>CONTROL</code></td><td>b0-b1 the handshake the game PC received: <code>0</code> OK, <code>1</code> STALL, <code>2</code> NAK until the host gave up (endpoint 0 only); b7 <code>RULE</code></td></tr>
              <tr><td><code>CLIP_XFER</code></td><td>how the transfer ended, as <A href="/native/commands/transfer#transfer-resp"><code>TRANSFER_RESP</code></A>'s status: <code>0</code> OK, <code>0xFD</code> STALL, <code>0xFE</code> no answer (NAKed past the host chip's timeout, failed on the bus, an undeclared endpoint, or no reply within 4&nbsp;s), <code>0xFF</code> no device, <code>0xFC</code> refused</td></tr>
              <tr><td><code>BUS</code></td><td>the event kind (table below)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL EVENTS</div>
          <p>
            <code>CONTROL</code> carries one event per <em>completed transaction</em>:{' '}
            <code>bytes</code> is <code>[setup 8][data ...]</code> and <code>dir</code> is the data
            stage's direction.
          </p>
          <p>
            It is the transaction as the game PC received it, the same on every control endpoint. A
            request served from the box's value cache still produces an event.
          </p>
          <pre class="diagram">{`  bytes = A1 01 00 01 00 00 08 00   01 00 00 00 00 00 00 00
          '------ setup (8) ------'   '---- data stage -------'
          HID GET_REPORT(Input)       dir = 1 (IN), flags = 0 (completed OK)`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Part</th><th>Carries</th></tr>
            </thead>
            <tbody>
              <tr><td>setup</td><td>The 8 setup bytes, from byte 0 of <code>bytes</code>.</td></tr>
              <tr><td>IN data</td><td>The reply the PC received: after a <code>REPLY_PATCH</code> or <code>REPLY_REPLACE</code> <A href="/native/commands/rewrite#actions">rule</A>, or an <code>ANSWER</code>'s payload.</td></tr>
              <tr><td>OUT data</td><td>The data stage the PC sent, before a <code>PATCH</code> or <code>REPLACE</code> rule rewrote it for the device.</td></tr>
              <tr><td>b0-b1</td><td>The handshake the PC got. A request a rule refused reads STALL, or NAK for a <code>NAK</code> rule on endpoint 0; a failed request above endpoint 0 reads STALL, as the clone STALLs it there.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">NO EVENT</div>
          <table class="api-params">
            <thead>
              <tr><th>Transaction</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>a standard request on endpoint 0, such as <code>GET_DESCRIPTOR</code> or <code>SET_CONFIGURATION</code></td><td>the clone serves it itself, and only class and vendor requests are proxied; a configuration or interface change still raises a <code>BUS</code> event</td></tr>
              <tr><td>one a bus reset cut short</td><td>it never completed</td></tr>
              <tr><td>a request with a data stage past 2048 bytes</td><td>the box STALLs it before proxying it</td></tr>
              <tr><td>above endpoint 0, a request a new SETUP on that endpoint replaced, or one the box had no room to queue</td><td>the box abandons it</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLIP_XFER EVENTS</div>
          <p>
            <code>CLIP_XFER</code> carries one event per control transfer a{' '}
            <A href="/native/commands/clip#items">clip</A> sent to the real device, in{' '}
            <code>CONTROL</code>'s shape: <code>bytes</code> is <code>[setup 8][IN data]</code>.
          </p>
          <p>
            Only a transfer the box sent raises an event; the rest are counted in{' '}
            <A href="/native/commands/requests#clip"><code>RESP(CLIP)</code></A>.
          </p>
          <div class="api-response-label">BUS EVENT KINDS</div>
          <p>
            <code>BUS</code> carries <code>[a][b]</code> in <code>bytes</code> with the kind in{' '}
            <code>flags</code>, and <code>true_len</code> is the operand count.
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
            under a <code>snaplen = 16</code> entry (16 bytes present, so payload{' '}
            <code>LEN = 28</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| A5     | 16     | 3C     | 1C 00  | 40 42 0F 00 | 00     | 06     | 83 00  | 01     |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | class  | id     | dir    |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+

+--------+--------+---------------------------------------+--------+
| 00     | 40 00  | 04 01 12 00 ...        (16 bytes)     | lo hi  |
+--------+--------+---------------------------------------+--------+
| flags  |true_len| bytes: 16 of 64, so the rest was cut  | CRC16  |
+--------+--------+---------------------------------------+--------+`}</pre>
          <p>
            A <code>SET_INTERFACE</code> bus event on interface 1, alternate setting 2 (two operand
            bytes, so payload <code>LEN = 14</code>):
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
          <p>
            A <code>SET_REPORT</code> on EP0 that a <code>STALL</code> rule refused:{' '}
            <code>flags = 0x81</code>, <code>RULE</code> with handshake <code>1</code> (STALL), and the
            two data bytes the PC sent (payload <code>LEN = 22</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| A5     | 16     | 3E     | 16 00  | 42 42 0F 00 | 01     | 08     | 00 00  | 02     |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ts_us       | clk    | class  | id     | dir    |
+--------+--------+--------+--------+-------------+--------+--------+--------+--------+

+--------+--------+-------------------------+--------+--------+
| 81     | 0A 00  | 21 09 00 02 00 00 02 00 | 01 00  | lo hi  |
+--------+--------+-------------------------+--------+--------+
| flags  |true_len| setup                   | data   | CRC16  |
+--------+--------+-------------------------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="rules" data-search-target>
        <Card>
          <CardHeader title="Rules and taps" subtitle="Tap positions around the rewrite table" />
          <p>
            Flags bit 7, <code>RULE</code>, marks a packet a{' '}
            <A href="/native/commands/rewrite">rewrite rule</A> acted on at the event's own class:
            changed its bytes, dropped it, answered it or refused it. A <code>PASS</code>, or a{' '}
            <code>PATCH</code> that changed no byte, leaves it clear.
          </p>
          <pre class="diagram">{`  packet
     |
     +--> tap: HID_IN, HID_OUT, vendor OUT    the bytes as they arrived
     v
  [ rewrite table ]                           RULE set when the rule acts
     |
     +--> tap: vendor IN, EMIT                the bytes delivered
     v
  game PC or real device`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Bytes</th><th><code>RULE</code> set when</th></tr>
            </thead>
            <tbody>
              <tr><td><code>HID_IN</code></td><td>the device's report as it arrived</td><td>a rule then changed or dropped it</td></tr>
              <tr><td><code>HID_OUT</code>, <code>VEND_INTR</code> / <code>VEND_BULK</code> OUT</td><td>what the PC sent</td><td>a rule then changed or dropped it on its way to the device</td></tr>
              <tr><td><code>VEND_INTR</code> / <code>VEND_BULK</code> IN</td><td>what the PC receives</td><td>a rule changed it; a packet a rule drops raises no event</td></tr>
              <tr><td><code>EMIT</code></td><td>the wire</td><td>a rule changed the report, or a report merged into it; never on a vendor endpoint, whose rules act at <code>VEND_INTR</code> and <code>VEND_BULK</code>; a dropped report raises no event</td></tr>
              <tr><td><code>CONTROL</code></td><td>the transaction the PC received, on every control endpoint</td><td>a rule rewrote its data, answered it or refused it</td></tr>
            </tbody>
          </table>
          <p>
            <code>CLIP_XFER</code> carries a transfer status in its flags byte and never{' '}
            <code>RULE</code>: a clip's transfer runs past every rule.
          </p>
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
  VEND_INTR EMIT            -->  [ queue 1 ]  --+--->  control link, 6 Mbaud
  CONTROL CLIP_XFER         -->  [ queue 2 ]  --+
  VEND_BULK                 -->  [ queue 3 ]  --+

  strict priority: each queue drains fully before the next`}</pre>
          <p>
            Under a busy mouse, bulk can go undrained indefinitely: the control link can't carry bulk
            plus input.
          </p>
          <p>
            Under back-pressure the box drops events rather than stall the report path, so the stream
            never delays reports to the game PC. Every drop is counted{' '}
            <em>per entry</em> in{' '}
            <A href="/native/commands/requests#catch"><code>RESP(CATCH)</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Catch;
