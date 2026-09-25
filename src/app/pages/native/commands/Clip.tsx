import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Clip: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="CLIP" subtitle="Preload input and let the box play it back, frame by frame" />
        <p>
          A clip is a ring of per-frame entries on the box. The box drains one entry per native frame
          into the same <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed.
        </p>
        <p>
          Playback is box-clocked: its timing does not depend on how fast or how evenly the host
          can send.
        </p>
        <p>
          Like <A href="/native/commands/inject"><code>INJECT</code></A> a clip is field-generic and{' '}
          <A href="/native/injection#state">additive</A>: one clip mixes mouse motion, buttons,
          keyboard, and media, each routed to its own interface, at{' '}
          <A href="/native/commands/option#emit">the emit rate</A>.
        </p>
        <p>
          A clip plays on any clone. One tick is the cloned mouse's native frame; with no mouse, the
          rate <A href="/native/commands/option#emit"><code>OPTION(EMIT)</code></A> fixes, else
          1&nbsp;ms. A field for a class the clone has no interface for is discarded.
        </p>
        <p>
          Read the ring depth, playback state, and settings back with{' '}
          <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
        </p>
        <div class="api-response-label">TWO MODES</div>
        <p>
          A clip runs in one of two shapes, set by the <code>retain</code> flag on{' '}
          <A href="/native/commands/clip#set"><code>CLIP_SET</code></A>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>The ring</th><th>Replay</th><th>Suits</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>streaming <em>(default)</em></td>
                <td>Each entry is freed as it plays, so the host appends to the tail while the head drains.</td>
                <td>None; an emptied ring underruns.</td>
                <td>Open-ended or generated input.</td>
              </tr>
              <tr>
                <td>retained</td>
                <td>Entries survive playback.</td>
                <td><code>START</code>, <code>RESTART</code> or <code>loop</code> without re-appending, once the clip is appended whole and marked <A href="/native/commands/clip#ctrl"><code>FINALIZE</code></A>d.</td>
                <td>A fixed macro replayed on a trigger.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre class="diagram">{`control PC                     box  (drains one entry per native frame)
      |                       +-----------------------------------------+
      |  CLIP_APPEND [e0][e1] |  ring [e0][e1][e2][e3][e4] ...          |
      | --------------------> |    |                                    |
      |  CLIP_SET loop/retain |    | one entry / frame                  |
      |  CLIP_TRIGGER bind    |    v                                    |
      |  CLIP_CTRL START      |  injection state --> mouse    report    |
      | --------------------> |                  --> keyboard report    |
      |                       |                  --> media    report    |
      |  QUERY(CLIP)          |                                         |
      | --------------------> |  ring depth + state + settings          |
      | <-------------------- |                                         |
      |                       +-----------------------------------------+
                box-clocked: host does no per-frame timing`}</pre>
        <div class="table-scroll">
        <table class="api-params">
          <thead><tr><th>Opcode</th><th>Command</th><th>Direction</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>PC→box</td><td>append a batch of entries to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>PC→box</td><td>drive the playback engine (start, stop, pause, ...)</td></tr>
            <tr><td><code>0x14</code></td><td><A href="/native/commands/clip#set"><code>CLIP_SET</code></A></td><td>PC→box</td><td>set a clip setting (auto-lock, loop, retain, ride)</td></tr>
            <tr><td><code>0x15</code></td><td><A href="/native/commands/clip#trigger"><code>CLIP_TRIGGER</code></A></td><td>PC→box</td><td>bind a physical edge or a matched packet to an engine verb</td></tr>
          </tbody>
        </table>
        </div>
      </Card>

      <div id="entries" data-search-target>
        <Card>
          <CardHeader title="Entry format" subtitle="The bytes CLIP_APPEND carries" />
          <p>
            A clip is a byte stream of variable-length entries, little-endian. The first byte of each entry is
            a tag: <code>0x00</code> is a <code>gap run</code>, any other value is a{' '}
            <code>content tick</code>'s flags.
          </p>
          <div class="api-response-label">GAP RUN</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>tag</code></td><td><code>u8</code></td><td><code>0x00</code></td></tr>
              <tr><td>1</td><td><code>count</code></td><td><code>u16</code></td><td>frames the endpoint NAKs, byte-identical to an idle mouse; little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTENT TICK</div>
          <p>
            Motion, edges, raw reports and control transfers applied on one frame; <code>flags</code>{' '}
            selects which fields follow.
          </p>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Present when</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>flags</code></td><td><code>u8</code></td><td>always; OR of the bits below, <code>0x40</code> and <code>0x80</code> reserved</td></tr>
              <tr><td>+</td><td><code>dx</code>, <code>dy</code></td><td><code>i16 x 2</code></td><td><code>flags &amp; XY (0x01)</code>, per-frame cursor delta</td></tr>
              <tr><td>+</td><td><code>wheel</code></td><td><code>i16</code></td><td><code>flags &amp; WHEEL (0x02)</code>, per-frame delta</td></tr>
              <tr><td>+</td><td><code>pan</code></td><td><code>i16</code></td><td><code>flags &amp; PAN (0x08)</code>, per-frame delta</td></tr>
              <tr><td>+</td><td><code>n</code></td><td><code>u8</code></td><td><code>flags &amp; EDGES (0x04)</code>, edge count (1 to 8)</td></tr>
              <tr><td>+</td><td><code>edges</code></td><td><code>n x 4 bytes</code></td><td>each edge is <code>[class u8][id u16][action u8]</code></td></tr>
              <tr><td>+</td><td><code>n</code></td><td><code>u8</code></td><td><code>flags &amp; RAW (0x10)</code>, raw item count (1 to 8)</td></tr>
              <tr><td>+</td><td><code>raw</code></td><td><code>n items</code></td><td>each a <A href="/native/commands/clip#items">raw item</A></td></tr>
              <tr><td>+</td><td><code>n</code></td><td><code>u8</code></td><td><code>flags &amp; XFER (0x20)</code>, transfer item count (1 or more)</td></tr>
              <tr><td>+</td><td><code>xfer</code></td><td><code>n items</code></td><td>each a <A href="/native/commands/clip#items">transfer item</A></td></tr>
            </tbody>
          </table>
          <p>
            The fields follow in the table's order, and an entry is at most 512 bytes, one{' '}
            <A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A> payload.
          </p>
          <p>
            An entry that can never be valid (a reserved bit, a count out of range, a length past 512
            bytes) faults the clip as soon as playback reaches it.
          </p>
          <div class="api-response-label">EDGES</div>
          <p>
            An edge reuses <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s tuple, so
            one clip drives every input class.
          </p>
          <div class="api-response-label">CLASS</div>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Value</th><th><code>id</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A> (0=Left .. 4=Side2)</td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keycode</A> (0xE0-0xE7 = modifier)</td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Action</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>soft-release</td><td><code>0</code></td><td>Drop the override; a physical hold stays active.</td></tr>
              <tr><td>press</td><td><code>1</code></td><td>Force the usage active.</td></tr>
              <tr><td>force-release</td><td><code>2</code></td><td>Force it inactive, masking a physical hold too.</td></tr>
            </tbody>
          </table>
          <p>
            An edge is a level: it sticks until a later tick changes it, and the box NAKs while it is held
            still.
          </p>
          <div class="api-response-label">COMBINED TICK</div>
          <p>
            Several flag bits stack their fields in one tick: a move, a pan and a press on the same
            frame, in one report.
          </p>
          <pre class="diagram">{`0D 0A 00 FC FF 02 00 01 00 00 00 01
   flags=XY|PAN|EDGES   dx=+10 dy=-4   pan=+2   n=1   edge[class=0 button, id=0 Left, action=1 press]`}</pre>
          <div class="api-response-label">PLAYBACK ORDER</div>
          <table class="api-params">
            <thead>
              <tr><th>Frame</th><th>Entry</th><th>The clone emits</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>motion</td><td>cursor moves</td></tr>
              <tr><td><code>1</code></td><td>Left press</td><td>left button down</td></tr>
              <tr><td><code>2-4</code></td><td>gap 3</td><td>nothing sent (NAK); left stays down</td></tr>
              <tr><td><code>5</code></td><td>Left release</td><td>left button up</td></tr>
              <tr><td><code>6</code></td><td>motion</td><td>cursor moves</td></tr>
              <tr><td><code>7</code></td><td>key <code>A</code> press</td><td><code>A</code> down</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE ENTRIES</div>
          <p>Move up-right, press <code>A</code>, idle 5 frames.</p>
          <pre class="diagram">{`01 0A 00 F6 FF        flags=XY,   dx=+10  dy=-10
04 01 01 04 00 01     flags=EDGES n=1  edge[class=1 key, id=0x04 'A', action=1 press]
00 05 00              tag=gap,    count=5  (NAK 5 frames)`}</pre>
        </Card>
      </div>

      <div id="items" data-search-target>
        <Card>
          <CardHeader title="Raw and transfer items" subtitle="Raw reports and control transfers on a content tick" />
          <p>
            A raw item is <A href="/native/commands/raw#raw"><code>RAW</code></A>'s payload with its length,
            and a transfer item is{' '}
            <A href="/native/commands/transfer#transfer"><code>TRANSFER</code></A>'s payload. Both need{' '}
            <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>, read as the
            tick plays: with it off the item is discarded and counted in{' '}
            <A href="/native/commands/requests#clip"><code>gated</code></A>.
          </p>
          <div class="api-response-label">RAW ITEM</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep_num</code></td><td><code>u8</code></td><td>cloned endpoint number</td></tr>
              <tr><td>1</td><td><code>dir</code></td><td><code>u8</code></td><td><code>1</code> = IN, onto cloned IN endpoint <code>ep_num</code>; <code>2</code> = OUT, relayed to the real device</td></tr>
              <tr><td>2</td><td><code>len</code></td><td><code>u16</code></td><td>length of <code>bytes</code>, little-endian</td></tr>
              <tr><td>4</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>the report, verbatim; sent in entry order, ahead of the tick's report</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TRANSFER ITEM</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep</code></td><td><code>u8</code></td><td><code>0</code> = EP0, or a control endpoint the device declares</td></tr>
              <tr><td>1</td><td><code>setup</code></td><td><code>u8[8]</code></td><td>the setup packet</td></tr>
              <tr><td>9</td><td><code>data</code></td><td><code>u8[]</code></td><td>the OUT data: <code>wLength</code> bytes when bit 7 of the first setup byte (the request type) is clear, absent when it is set</td></tr>
            </tbody>
          </table>
          <p>
            The box queues transfers (1&nbsp;KiB) and runs them one at a time. Each answer comes back as a{' '}
            <A href="/native/commands/catch#traffic-event"><code>CLIP_XFER</code></A> event, in the order
            the items drained.
          </p>
          <div class="api-response-label">TRANSFER QUEUE</div>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>PAUSE</code>, the natural end</td><td>still run</td></tr>
              <tr><td><code>STOP</code>, <code>RESTART</code>, <code>CLEAR</code>, a fault, a <A href="/native/commands/clip#ctrl">hard stop</A></td><td>dropped</td></tr>
              <tr><td>a <code>0xFE</code> (no answer) status that took 250&nbsp;ms or longer</td><td>those behind it dropped into <code>xfer_errs</code></td></tr>
              <tr><td><code>OPTION(IMPERFECT)</code> turned off</td><td>dropped, each counted in <code>gated</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">NATIVE STATE</div>
          <table class="api-params">
            <thead>
              <tr><th>Report</th><th>What release does</th></tr>
            </thead>
            <tbody>
              <tr><td>a raw IN item on the mouse, keyboard or media report the box injects into</td><td>emitted once in its native state, if that differs from the raw bytes outside the relative fields</td></tr>
              <tr><td>a raw IN item on any other report</td><td>stays as sent, as after a <A href="/native/commands/raw#raw"><code>RAW</code></A> command</td></tr>
            </tbody>
          </table>
          <p>
            The clip releases its held input on <code>STOP</code>, its natural end, a loop wrap,{' '}
            <code>RESTART</code>, <code>CLEAR</code>, a fault and a hard stop. A native report or a later
            raw report that reaches the wire first replaces the raw bytes.
          </p>
          <div class="api-response-label">EXAMPLE ENTRIES</div>
          <p>
            One raw report OUT on endpoint 2, then a <code>SET_REPORT</code> with two bytes of OUT data
            on EP0.
          </p>
          <pre class="diagram">{`10 01 02 02 03 00 A1 B2 C3
   flags=RAW   n=1   item[ep_num=2, dir=2 OUT, len=3, bytes=A1 B2 C3]
20 01 00 21 09 00 03 00 00 02 00 04 01
   flags=XFER  n=1   item[ep=0, setup=21 09 00 03 00 00 02 00 (wLength=2), data=04 01]`}</pre>
        </Card>
      </div>

      <div id="append" data-search-target>
        <Card>
          <CardHeader title="CLIP_APPEND" subtitle="Fill the ring" />
          <p>
            Append a batch of whole <A href="/native/commands/clip#entries">entries</A> to the tail of the
            ring. Send it while stopped to preload, or while playing (streaming mode) to keep topping up in
            real time. <A href="/native/frame#opcodes">Opcode</A> <code>0x12</code>.
          </p>
          <pre class="api-signature">CLIP_APPEND  0x12  ·  payload = one or more whole entries</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>entries</code></td><td><code>bytes</code></td><td>a whole number of <A href="/native/commands/clip#entries">entries</A>, back to back (up to the 512-byte frame limit)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DROP DETECTION</div>
          <p>
            The frame <A href="/native/frame#seq"><code>SEQ</code></A> doubles as an append sequence
            number: the box expects each <code>CLIP_APPEND</code> to be the previous <code>SEQ</code> plus one.
          </p>
          <p>
            The link is <A href="/native/injection#fire-and-forget">fire-and-forget</A>, so a lost frame
            shows up as a <code>SEQ</code> gap and the box marks the clip <code>faulted</code> in{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>. Recover with{' '}
            <code>CLEAR</code>, then rebuild.
          </p>
          <p>
            Pack whole entries per frame; never split one entry across two appends.
          </p>
          <div class="api-response-label">FLOW CONTROL</div>
          <p>
            An append that doesn't fit the ring is dropped whole and faults the clip, never written as a
            partial entry.
          </p>
          <p>
            Keep an append under{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>'s <code>free</code> bytes.
            In streaming mode the box drains from the head while you append to the tail, so{' '}
            <code>free</code> opens back up as it plays. The ring itself is 64 KB on a box with PSRAM and
            16 KB on one without, so never assume a size.
          </p>
          <pre class="diagram">{`  the ring, read by QUERY(CLIP):

       free                        buffered (total)
  +----------------+----------------------------------------+
  |    (append     | [e5][e6][e7][e8][e9] ...               | --> drained
  |    here, <=    |     buffered, not yet played           |     1 / frame
  |    free)       |                                        |
  +----------------+----------------------------------------+
   append > free  -->  dropped whole + clip faulted`}</pre>
          <p>
            Library binding: <A href="/library/clip#builder"><code>ClipBuilder</code></A> +{' '}
            <A href="/library/clip#handle"><code>append</code></A>, which splits a large clip into whole-entry
            frames for you.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Append one content tick, cursor <code>dx = 10</code> (a 5-byte entry, so <code>LEN = 5</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 12     | 00     | 05 00  | 01     | 0A 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | flags  | dx     | dy     | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+
                    ^ append seq     \\- one XY content tick --/`}</pre>
        </Card>
      </div>

      <div id="ctrl" data-search-target>
        <Card>
          <CardHeader title="CLIP_CTRL" subtitle="Drive the playback engine" />
          <p>
            One byte of <code>op</code> selects an engine verb; settings live on{' '}
            <A href="/native/commands/clip#set"><code>CLIP_SET</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x13</code>.
          </p>
          <pre class="api-signature">CLIP_CTRL  0x13  ·  payload [op u8]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="api-params">
            <thead>
              <tr><th>op</th><th>Name</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>START</code></td><td>play from the ring head, applying the <code>autolock</code> setting</td></tr>
              <tr><td><code>1</code></td><td><code>STOP</code></td><td>halt playback and release the clip's auto-lock; buffered entries survive in retained mode</td></tr>
              <tr><td><code>2</code></td><td><code>PAUSE</code></td><td>freeze the playhead where it is; held levels stay down, motion stops</td></tr>
              <tr><td><code>3</code></td><td><code>RESUME</code></td><td>continue a paused clip from where it stopped</td></tr>
              <tr><td><code>4</code></td><td><code>RESTART</code></td><td>jump back to the head and play from the top (retained clip)</td></tr>
              <tr><td><code>5</code></td><td><code>TOGGLE</code></td><td>start if stopped, stop if playing</td></tr>
              <tr><td><code>6</code></td><td><code>CLEAR</code></td><td>stop and empty the ring, dropping every buffered entry and clearing a fault</td></tr>
              <tr><td><code>7</code></td><td><code>FINALIZE</code></td><td>mark the buffered clip complete; the box stops treating an emptied ring as an underrun</td></tr>
            </tbody>
          </table>
          <p>
            Ops <code>0</code>-<code>5</code> (<code>START</code> through <code>TOGGLE</code>) double as the{' '}
            <code>action</code> byte a <A href="/native/commands/clip#trigger"><code>CLIP_TRIGGER</code></A> fires
            on a physical edge or a <A href="/native/commands/clip#packet-triggers">matched packet</A>;{' '}
            <code>CLEAR</code> and <code>FINALIZE</code> are host-only.
          </p>
          <div class="api-response-label">STATE</div>
          <p>
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A> reports one of four states.
          </p>
          <table class="api-params">
            <thead><tr><th>Value</th><th>State</th><th>Means</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>idle</code></td><td>not playing; ring may hold a retained clip</td></tr>
              <tr><td><code>1</code></td><td><code>playing</code></td><td>draining one entry per frame</td></tr>
              <tr><td><code>2</code></td><td><code>paused</code></td><td>frozen mid-clip by <code>PAUSE</code>, holding its levels</td></tr>
              <tr><td><code>3</code></td><td><code>faulted</code></td><td>a <code>SEQ</code> gap, an overflow or an <A href="/native/commands/clip#entries">invalid entry</A> broke the stream; <code>CLEAR</code> and rebuild</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">UNDERRUN</div>
          <p>
            In streaming mode, if the ring drains with no <code>FINALIZE</code>, the box idles (NAKs, holding
            its levels) and stays <code>playing</code> until you refill it; a topping-up host or any keepalive
            resets the 1 s silence timer.
          </p>
          <p>
            A finalized clip ends when the ring empties, or replays from the head if{' '}
            <A href="/native/commands/clip#set"><code>loop</code></A> is set.
          </p>
          <div class="api-response-label">STOPS ON</div>
          <pre class="diagram">{`STOP        an explicit STOP or CLEAR op
silence     a full 1 s of control-PC silence
RESET       a RESET command
detach      the cloned device unplugs
link loss   the inter-chip link drops
re-clone    the box clones a device again`}</pre>
          <p>
            Each halts playback and releases the clip's lock; a hard stop (<code>silence</code>,{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, detach, link loss,{' '}
            <A href="/native/commands/patch#presentation">re-clone</A>) also clears the
            ring, the settings and the trigger set, and a host reloads the clip and its config. The{' '}
            <A href="/native/injection#safety">1&nbsp;s silence auto-clear</A> reaches a clip like any
            other injection.
          </p>
          <p>A hard stop moves the <A href="/native/commands/requests#stats"><code>session</code></A> count.</p>
          <p>Library binding: <A href="/library/clip"><code>Device::clip()</code></A>.</p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Start playback (<code>op = 0</code>, a single-byte payload so <code>LEN = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 01 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="set" data-search-target>
        <Card>
          <CardHeader title="CLIP_SET" subtitle="Set a clip setting" />
          <p>
            Set one of the clip's settings, <A href="/native/commands/option">OPTION</A>-shaped. A setting
            sticks until you change it or a <A href="/native/commands/clip#ctrl">hard stop</A> clears it;
            read them all back with{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x14</code>.
          </p>
          <pre class="api-signature">CLIP_SET  0x14  ·  payload [id u8][value u8]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>id</code></td><td><code>u8</code></td><td>the setting, as the table below</td></tr>
              <tr><td>1</td><td><code>value</code></td><td><code>u8</code></td><td>the setting's new value</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SETTINGS</div>
          <table class="api-params">
            <thead>
              <tr><th>id</th><th>Setting</th><th>value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>autolock</code></td><td>class bitmask</td><td>the physical-input classes <code>START</code> locks while playing (below)</td></tr>
              <tr><td><code>1</code></td><td><code>loop</code></td><td><code>0</code> / <code>1</code></td><td>a finalized clip replays from the head instead of ending</td></tr>
              <tr><td><code>2</code></td><td><code>retain</code></td><td><code>0</code> / <code>1</code></td><td>keep entries after playing so <code>START</code> / <code>RESTART</code> can replay them</td></tr>
              <tr><td><code>3</code></td><td><code>ride</code></td><td><code>0</code> / <code>1</code></td><td>the clip's motion waits to ride a native report; <code>0</code> (the default) plays it on the box's own clock (below)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            The <code>autolock</code> value is a bitmask of the physical-input classes <code>START</code> locks
            while the clip plays, clip-owned and released on <code>STOP</code>. A host{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A> is untouched. <code>0</code> = no
            auto-lock; <code>0x1F</code> = every class.
          </p>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Mask</th><th>Locks</th></tr></thead>
            <tbody>
              <tr><td><code>b0</code></td><td><code>0x01</code></td><td>the X and Y cursor axes</td></tr>
              <tr><td><code>b1</code></td><td><code>0x02</code></td><td>the wheel and pan</td></tr>
              <tr><td><code>b2</code></td><td><code>0x04</code></td><td>every mouse button</td></tr>
              <tr><td><code>b3</code></td><td><code>0x08</code></td><td>every keyboard key</td></tr>
              <tr><td><code>b4</code></td><td><code>0x10</code></td><td>every media usage</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">RIDE</div>
          <p>
            A clip's motion bypasses <A href="/native/commands/option#move-ride">movement riding</A> by
            default, so it plays on its own timeline; <code>ride</code> puts it back on the ride,
            additive to physical motion and dropped while the user holds still.
          </p>
          <p>
            While <A href="/native/commands/option#render">rendering</A> is on with a profile armed, a
            clip's cursor motion is rendered like a <A href="/native/commands/move"><code>MOVE</code></A>{' '}
            with no flag and rides the same way; <code>ride</code> then applies to the wheel and pan
            alone. Edges stay on the clip tick, ahead of the rendered motion.
          </p>
          <p>
            Library binding: <A href="/library/clip#handle"><code>set_autolock</code></A>,{' '}
            <A href="/library/clip#handle"><code>set_loop</code></A>,{' '}
            <A href="/library/clip#handle"><code>set_retain</code></A>,{' '}
            <A href="/library/clip#handle"><code>set_ride</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Turn looping on (<code>id = 1</code>, <code>value = 1</code>, so <code>LEN = 2</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 14     | 00     | 02 00  | 01     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | value  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="trigger" data-search-target>
        <Card>
          <CardHeader title="CLIP_TRIGGER" subtitle="Bind a physical edge or a matched packet to an engine verb" />
          <p>
            Fire a <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> verb on the box from a
            physical edge, the same edge <A href="/native/commands/catch"><code>CATCH</code></A> reports,
            or from a matched packet. There's no host round-trip, so even the first emitted frame is
            box-timed.
          </p>
          <p>
            Triggers are a{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>-shaped managed set. The{' '}
            <code>class</code> byte picks the kind: an input class makes one of up to eight bindings,
            keyed by <code>(class, id, edge)</code>, and a traffic class makes one of up to eight{' '}
            <A href="/native/commands/clip#packet-triggers">packet triggers</A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x15</code>.
          </p>
          <pre class="api-signature">CLIP_TRIGGER  0x15  ·  payload [class u8][id u16][edge u8][action u8][flags u8]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>input class (below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>usage within the class, little-endian; <code>0xFFFF</code> = any</td></tr>
              <tr><td>3</td><td><code>edge</code></td><td><code>u8</code></td><td>which edge fires (below)</td></tr>
              <tr><td>4</td><td><code>action</code></td><td><code>u8</code></td><td>the <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> op to fire, <code>0</code>-<code>5</code></td></tr>
              <tr><td>5</td><td><code>flags</code></td><td><code>u8</code></td><td>bit0 present, bit1 consume (below)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLASS</div>
          <table class="api-params">
            <thead><tr><th>Name</th><th>Value</th><th><code>id</code> is</th></tr></thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A></td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keycode</A></td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>any</td><td><code>0xFF</code></td><td>ignored (any input fires)</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Edge</th><th>Value</th><th>Fires on</th></tr></thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>press and release</td></tr>
              <tr><td>press</td><td><code>1</code></td><td>the physical press</td></tr>
              <tr><td>release</td><td><code>2</code></td><td>the physical release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Mask</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>b0</code></td><td><code>0x01</code></td><td>present: set to add or replace the binding, clear to remove it</td></tr>
              <tr><td><code>b1</code></td><td><code>0x02</code></td><td>consume: lock the trigger usage while it stays active. Press edge only; a release-edge binding stores the flag and never acts on it</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TWO KINDS</div>
          <pre class="diagram">{`  class 0..2, 0xFF                          class 4..9
  a physical edge                           a packet on a traffic surface
  button, key, media                        HID_IN, HID_OUT, VEND_INTR, VEND_BULK, CONTROL, EMIT
          |                                         |
          v                                         v
  [ 8 input bindings ]                      [ 8 packet triggers ]
    key (class, id, edge)                     key (class, id, dir, mlen, match, mask)
    the most specific acts on the edge        the most specific acts on the packet
          |                                         |
          +------------> one CLIP_CTRL op <---------+
                         0 START .. 5 TOGGLE, run on the box`}</pre>
          <p>
            Re-sending the same <code>(class, id, edge)</code> key replaces that binding; clearing{' '}
            <code>present</code> removes it.
          </p>
          <p>
            To wipe the whole set in one frame send the clear-all sentinel:{' '}
            <code>class = 0xFF</code>, <code>id = 0xFFFF</code>, <code>edge = 0</code> (both),{' '}
            <code>flags = 0</code>. It clears the input bindings and the packet triggers alike.
          </p>
          <p>
            Preload the ring (and, for a replayable macro, mark it{' '}
            <A href="/native/commands/clip#ctrl"><code>FINALIZE</code></A>d) before you bind.
          </p>
          <p>
            Library binding: <A href="/library/clip#handle"><code>bind</code></A>,{' '}
            <A href="/library/clip#handle"><code>unbind</code></A>,{' '}
            <A href="/library/clip#handle"><code>clear_triggers</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Bind the <code>A</code> key's press to <code>START</code> (<code>class = 1</code>,{' '}
            <code>id = 0x04</code>, <code>edge = 1</code> press, <code>action = 0</code> start,{' '}
            <code>flags = 0x01</code> present):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 15     | 00     | 06 00  | 01     | 04 00  | 01     | 00     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | edge   | action | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="packet-triggers" data-search-target>
        <Card>
          <CardHeader title="Packet triggers" subtitle="CLIP_TRIGGER with a traffic class" />
          <p>
            A traffic class in the <code>class</code> byte makes the binding a packet trigger: a
            packet on that surface whose head matches runs the verb, as an input edge does for the
            input classes. The frame carries the match after the six bytes every binding has.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x15</code>.
          </p>
          <pre class="api-signature">CLIP_TRIGGER  0x15  ·  packet payload 8 + 2 x mlen bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <div class="table-scroll">
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>traffic class, <code>4</code>-<code>9</code> (below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>the class's address as <A href="/native/commands/catch#catch"><code>CATCH</code></A> gives it, little-endian; <code>0xFFFF</code> = any</td></tr>
              <tr><td>3</td><td><code>dir</code></td><td><code>u8</code></td><td>the packet's direction: <code>0</code> both, <code>1</code> IN, <code>2</code> OUT</td></tr>
              <tr><td>4</td><td><code>action</code></td><td><code>u8</code></td><td>the <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> op to fire, <code>0</code>-<code>5</code></td></tr>
              <tr><td>5</td><td><code>flags</code></td><td><code>u8</code></td><td>bit0 present, bit1 consume, bit2 <code>RUN</code> (below)</td></tr>
              <tr><td>6</td><td><code>slen</code></td><td><code>u8</code></td><td>selector length: below <code>mlen</code> with <code>RUN</code>, <code>0</code> without</td></tr>
              <tr><td>7</td><td><code>mlen</code></td><td><code>u8</code></td><td>match length, <code>0</code>-<code>16</code>; <code>0</code> takes every packet on the address</td></tr>
              <tr><td>8</td><td><code>match</code></td><td><code>u8[]</code></td><td><code>mlen</code> head bytes to compare</td></tr>
              <tr><td>8+mlen</td><td><code>mask</code></td><td><code>u8[]</code></td><td><code>mlen</code> mask bytes: a packet matches when each head byte ANDed with its mask byte equals the match byte; bytes past the mask are ignored</td></tr>
            </tbody>
          </table>
          </div>
          <div class="api-response-label">SURFACES</div>
          <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Class</th><th>Value</th><th>Carries</th><th>The head is</th></tr></thead>
            <tbody>
              <tr><td><code>HID_IN</code></td><td><code>4</code></td><td>IN</td><td>the device's report as it arrived, ahead of any rewrite</td></tr>
              <tr><td><code>HID_OUT</code></td><td><code>5</code></td><td>OUT</td><td>a report the PC writes to the device</td></tr>
              <tr><td><code>VEND_INTR</code></td><td><code>6</code></td><td>IN, OUT</td><td>a relayed vendor interrupt packet</td></tr>
              <tr><td><code>VEND_BULK</code></td><td><code>7</code></td><td>IN, OUT</td><td>a relayed vendor bulk packet</td></tr>
              <tr><td><code>CONTROL</code></td><td><code>8</code></td><td>IN, OUT</td><td>a control request: the 8 setup bytes, then the first 8 OUT data bytes</td></tr>
              <tr><td><code>EMIT</code></td><td><code>9</code></td><td>IN</td><td>an emitted report, the clip's own frames included; a clip's <A href="/native/commands/clip#items">raw items</A> pass unmatched</td></tr>
            </tbody>
          </table>
          </div>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Mask</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>b0</code></td><td><code>0x01</code></td><td>present: set to add or replace the trigger, clear to remove it</td></tr>
              <tr><td><code>b1</code></td><td><code>0x02</code></td><td>consume: drop every packet the trigger is the most specific match for, as a <code>DROP</code> <A href="/native/commands/rewrite">rewrite rule</A> would, before a rule sees it</td></tr>
              <tr><td><code>b2</code></td><td><code>0x04</code></td><td><code>RUN</code>: run the verb on the first of a run of matching packets, where a trigger without it runs the verb on every packet it is the most specific match for</td></tr>
            </tbody>
          </table>
          <p>
            The key is <code>(class, id, dir, mlen, match, mask)</code>: the same key overwrites, and{' '}
            <code>present</code> clear with the same key removes. The box holds 8 packet triggers
            beside the 8 bindings, with 112 match bytes between them.
          </p>
          <div class="api-response-label">A PACKET'S PATH</div>
          <pre class="diagram">{`  packet at a surface
        |
        v
  [ packet triggers ]   read the bytes as they arrived; only the most specific one acts
        |     |
        |     +--> the top-ranked trigger's verb, run on the frame clock's next tick
        |     +--> consume: the packet stops here
        v
  [ rewrite table ]     sees the packet next, and applies its own top-ranked rule
        |
        v
  delivered             to the game PC (IN) or the real device (OUT)`}</pre>
          <div class="api-response-label">RULES</div>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>What the box does</th></tr>
            </thead>
            <tbody>
              <tr><td>surfaces</td><td>A trigger sees a packet at every surface a <A href="/native/commands/rewrite">rewrite rule</A> does, ahead of it. The two are independent: one packet can run a verb and then match a rule.</td></tr>
              <tr><td>rank</td><td>Only the most specific trigger a packet matches acts on it, ranked in the rewrite table's order: an exact <code>id</code> over <code>0xFFFF</code>, more masked bits over fewer, a named <code>dir</code> over both, then the earlier one. One verb runs per packet.</td></tr>
              <tr><td>tick</td><td>The verb runs on the frame clock's next tick, within one frame of the matching packet (1&nbsp;ms at the default pace), and one that starts the clip plays its first entry on that tick.</td></tr>
              <tr><td>consume</td><td>A consumed <code>HID_IN</code> report is the whole report, so a release edge in it reaches the PC with the next report. Consuming needs <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>: turning it off removes the consuming triggers. A trigger that only watches works with it off.</td></tr>
              <tr><td>catch</td><td><A href="/native/commands/catch#traffic-event"><code>CATCH</code></A> reports a consumed <code>HID_IN</code> or OUT packet, whose taps sit ahead of the triggers. A consumed vendor IN packet or emitted report goes unreported.</td></tr>
              <tr><td>run</td><td>With <code>RUN</code>, a device that repeats a held state every poll fires once per hold; the release is a second trigger matching the released bytes. The first <code>slen</code> match bytes select the stream within the address (a report ID) and the rest are the condition. A packet that fails the selector leaves the run as it was.</td></tr>
              <tr><td>first packet</td><td>A run starts on the first matching packet the trigger sees. A trigger whose condition already holds when it is set fires on the next packet, so one matching the at-rest bytes of a device that reports every poll fires once when it is set.</td></tr>
              <tr><td>shadowed</td><td>A trigger a more specific one outranks still tracks its run, so removing that trigger mid-hold fires nothing.</td></tr>
              <tr><td>re-send</td><td>An identical re-send keeps the run and the count. An overwrite starts both again, and a bus reset or a configuration change starts every run again.</td></tr>
              <tr><td>hits</td><td>Each trigger counts the packets it matched as the top-ranked trigger, saturating at 65535, read back in <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>. An outranked trigger's count stays still while it tracks its run.</td></tr>
              <tr><td>lifetime</td><td>Packet triggers are clip config: soft state, cleared with the rest of it on a <A href="/native/commands/clip#ctrl">hard stop</A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">REFUSED</div>
          <p>
            A refused frame is dropped whole, with no reply, and leaves the set as it was: a new key is
            not held and an existing key keeps its trigger. Compare what{' '}
            <code>QUERY(CLIP)</code> reads back with what was sent.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Frame</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>shorter than <code>8 + 2 x mlen</code>, <code>mlen</code> above 16, <code>dir</code> above 2, <code>action</code> above 5, a reserved flag bit</td><td>Malformed.</td></tr>
              <tr><td>a ninth trigger, or match bytes past the pool of 112</td><td>The set is full.</td></tr>
              <tr><td>consume with <code>OPTION(IMPERFECT)</code> off</td><td>Consuming is dropping traffic.</td></tr>
              <tr><td>consume on <code>CONTROL</code></td><td>A control transfer always runs to completion.</td></tr>
              <tr><td><code>RUN</code> on <code>CONTROL</code>, with <code>id = 0xFFFF</code>, or with <code>dir = 0</code></td><td>A run is over one stream: a report class, a concrete <code>id</code> and a concrete <code>dir</code>.</td></tr>
              <tr><td><code>RUN</code> with <code>slen</code> at or above <code>mlen</code>, or <code>slen</code> above <code>0</code> without <code>RUN</code></td><td>The bytes past the selector are the condition.</td></tr>
              <tr><td><code>RUN</code> whose condition bytes have no masked bit</td><td>Every packet of the stream would meet it, so the run would never end.</td></tr>
              <tr><td>a match bit outside its mask</td><td>No packet can match it.</td></tr>
              <tr><td><code>dir = 2</code> on <code>HID_IN</code> or <code>EMIT</code>, <code>dir = 1</code> on <code>HID_OUT</code></td><td>The class never carries that direction.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            No reply. Library binding:{' '}
            <A href="/library/clip#packet-triggers"><code>bind_packet</code></A>,{' '}
            <A href="/library/clip#packet-triggers"><code>unbind_packet</code></A>,{' '}
            <A href="/library/clip#handle"><code>clear_triggers</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Bind <code>HID_IN</code> interface 2, IN, to <code>START</code>, with consume and{' '}
            <code>RUN</code> (<code>flags = 0x07</code>): report ID <code>0x07</code> is the selector
            (<code>slen = 1</code>) and bit 5 of the next byte is the condition, so{' '}
            <code>LEN = 12</code>.
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 15     | 00     | 0C 00  | 04     | 02 00  | 01     | 00     | 07     |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | action | flags  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+

| 01     | 02     | 07 20  | FF 20  | lo hi  |
+--------+--------+--------+--------+--------+
| slen   | mlen   | match  | mask   | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
          <p>The same trigger removed: the key stays, <code>action</code>, <code>flags</code> and <code>slen</code> are zero.</p>
          <pre class="diagram">{`04 02 00 01 00 00 00 02 07 20 FF 20
   class=4 HID_IN   id=2   dir=1 IN   action=0   flags=0   slen=0   mlen=2   match=07 20   mask=FF 20`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
