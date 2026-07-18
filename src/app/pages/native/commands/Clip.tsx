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
          <A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A> preloads a sequence of per-frame
          entries into a ring on the box, then{' '}
          <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> drives the playback engine and the box
          drains one entry per native frame into the same{' '}
          <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed. Playback is box-clocked, so it carries no
          host scheduling jitter and no per-command send floor. Like{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> it is field-generic and{' '}
          <A href="/native/injection#state">additive</A>: one clip mixes mouse motion, buttons, keyboard, and
          media, each routed to its own interface, and follows{' '}
          <A href="/native/commands/option#move-ride">movement riding</A> and{' '}
          <A href="/native/commands/option#emit">the emit rate</A>. A clip needs a
          cloned mouse, whose native report tick is the box's frame clock; read the ring depth, playback state,
          and settings back with <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
        </p>
        <div class="api-response-label">TWO MODES</div>
        <p>
          A clip runs in one of two shapes, set by the <code>retain</code> flag on{' '}
          <A href="/native/commands/clip#set"><code>CLIP_SET</code></A>.
        </p>
        <ul>
          <li>
            <strong>Streaming</strong> (default): the box frees each entry as it plays, so a real-time host
            keeps appending to the tail while the head drains. Good for open-ended or generated input; an
            emptied ring underruns.
          </li>
          <li>
            <strong>Retained</strong>: the box keeps entries after playing them, so once you've appended the
            whole clip and marked it <A href="/native/commands/clip#ctrl"><code>FINALIZE</code></A>d you can{' '}
            <code>START</code>, <code>RESTART</code>, or <code>loop</code> it as many times as you like without
            re-appending. Good for a fixed macro you replay on a trigger.
          </li>
        </ul>
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
        <table class="api-params">
          <thead><tr><th>Opcode</th><th>Command</th><th>Direction</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>PC→box</td><td>append a batch of entries to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>PC→box</td><td>drive the playback engine (start, stop, pause, ...)</td></tr>
            <tr><td><code>0x14</code></td><td><A href="/native/commands/clip#set"><code>CLIP_SET</code></A></td><td>PC→box</td><td>set a clip setting (auto-lock, loop, retain)</td></tr>
            <tr><td><code>0x15</code></td><td><A href="/native/commands/clip#trigger"><code>CLIP_TRIGGER</code></A></td><td>PC→box</td><td>bind a physical edge to an engine verb</td></tr>
          </tbody>
        </table>
      </Card>

      <div id="entries" data-search-target>
        <Card>
          <CardHeader title="Entry format" subtitle="The bytes CLIP_APPEND carries" />
          <p>
            A clip is a byte stream of variable-length entries, little-endian. The first byte of each entry is
            a tag: <code>0x00</code> is a <code>gap run</code>, any other value is a{' '}
            <code>content tick</code>'s flags. One entry is one native frame.
          </p>
          <div class="api-response-label">GAP RUN</div>
          <p>
            Emit nothing for <code>count</code> frames. The endpoint NAKs, byte-identical to an idle mouse, so
            a gap is the faithful way to hold still or pace between actions.
          </p>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>tag</code></td><td><code>u8</code></td><td><code>0x00</code></td></tr>
              <tr><td>1</td><td><code>count</code></td><td><code>u16</code></td><td>frames to NAK, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTENT TICK</div>
          <p>
            A motion delta and/or a list of edges applied on one frame. The <code>flags</code> byte (nonzero,
            so it can't be mistaken for a gap tag) selects which fields follow.
          </p>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Present when</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>flags</code></td><td><code>u8</code></td><td>always; OR of the bits below</td></tr>
              <tr><td>+</td><td><code>dx</code>, <code>dy</code></td><td><code>i16 × 2</code></td><td><code>flags &amp; XY (0x01)</code>, cursor delta</td></tr>
              <tr><td>+</td><td><code>wheel</code></td><td><code>i16</code></td><td><code>flags &amp; WHEEL (0x02)</code></td></tr>
              <tr><td>+</td><td><code>n</code></td><td><code>u8</code></td><td><code>flags &amp; EDGES (0x04)</code>, edge count (max 8)</td></tr>
              <tr><td>+</td><td><code>edges</code></td><td><code>n × 4 bytes</code></td><td>each edge is <code>[class u8][id u16][action u8]</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EDGES</div>
          <p>
            An edge reuses <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s tuple, so
            one clip drives every input class.
          </p>
          <div class="api-response-label">CLASS</div>
          <table class="api-params">
            <thead>
              <tr><th><code>class</code></th><th>Value</th><th><code>id</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A> (0=Left .. 4=Side2)</td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keycode</A> (0xE0-0xE7 = modifier)</td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ACTION</div>
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
            still. Motion (<code>dx</code>/<code>dy</code>/<code>wheel</code>) is a per-frame delta.
          </p>
          <div class="api-response-label">MOTION AND EDGES ON ONE TICK</div>
          <p>
            Set several flag bits and the fields stack in a single tick, so a move and a press land on the
            same frame and the PC sees one report. That is what keeps "aim and hold fire" faithful: motion
            every frame, the fire button pressed on the frame it goes down.
          </p>
          <pre class="diagram">{`05 0A 00 FC FF 01 00 00 00 01
   flags=XY|EDGES   dx=+10 dy=-4   n=1   edge[class=0 button, id=0 Left, action=1 press]`}</pre>
          <div class="api-response-label">A CLIP IS A TIMELINE</div>
          <p>Entries play out one per frame, left to right.</p>
          <table class="api-params">
            <thead>
              <tr><th>Frame</th><th>Entry</th><th>The PC sees</th></tr>
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
          <p>The bytes for three example entries: move up-right, press <code>A</code>, idle 5 frames.</p>
          <pre class="diagram">{`01 0A 00 F6 FF        flags=XY,   dx=+10  dy=-10
04 01 01 04 00 01     flags=EDGES n=1  edge[class=1 key, id=0x04 'A', action=1 press]
00 05 00              tag=gap,    count=5  (NAK 5 frames)`}</pre>
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
            Because the link is <A href="/native/injection#fire-and-forget">fire-and-forget</A>, a lost frame
            shows up as a <code>SEQ</code> gap, and the box marks the clip <code>faulted</code> in{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A> so the host re-syncs
            (<code>CLEAR</code>, then rebuild) instead of playing a stream with a hole in it. Pack whole entries
            per frame; never split one entry across two appends.
          </p>
          <div class="api-response-label">FLOW CONTROL</div>
          <p>
            An append that doesn't fit the ring is dropped whole and faults the clip, never written as a
            partial entry that would desync the stream. Keep an append under{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>'s <code>free</code> bytes to
            avoid it: in streaming mode the box drains from the head while you append to the tail, so a
            real-time host tops up as <code>free</code> opens back up.
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
            One byte of <code>op</code> selects an engine verb. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x13</code>. There are no args: settings live on{' '}
            <A href="/native/commands/clip#set"><code>CLIP_SET</code></A>, so a control frame is just the verb.
          </p>
          <pre class="api-signature">CLIP_CTRL  0x13  ·  payload [op u8]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">OPS</div>
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
            Ops <code>0</code>-<code>5</code> (<code>START</code> through <code>TOGGLE</code>) double as the
            <code>action</code> byte a <A href="/native/commands/clip#trigger"><code>CLIP_TRIGGER</code></A> fires
            on a physical edge; <code>CLEAR</code> and <code>FINALIZE</code> are host-only.
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
              <tr><td><code>3</code></td><td><code>faulted</code></td><td>a <code>SEQ</code> gap or overflow desynced the stream; <code>CLEAR</code> and rebuild</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">UNDERRUN</div>
          <p>
            In streaming mode, if the ring drains with no <code>FINALIZE</code>, the box idles (NAKs, holding
            its levels) and stays <code>playing</code> until you refill it; a topping-up host or any keepalive
            holds the clip alive. A finalized clip ends when the ring empties, or replays from the head if{' '}
            <A href="/native/commands/clip#set"><code>loop</code></A> is set.
          </p>
          <div class="api-response-label">STOPS ON</div>
          <pre class="diagram">{`STOP        an explicit STOP or CLEAR op
silence     a full 1 s of control-PC silence
RESET       a RESET command
detach      the cloned mouse unplugs
link loss   the inter-chip link drops`}</pre>
          <p>
            Each halts playback and releases the clip's lock; a hard stop (<code>silence</code>,{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, detach, link loss) also flushes the
            ring. The <A href="/native/injection#safety">1&nbsp;s safety net</A> and a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> reach a clip like any other injection.
            With <A href="/native/commands/option#move-ride">movement riding</A> on, clip motion rides native
            reports and is additive to the user's own movement, so the frame-exact use case runs riding off.
          </p>
          <p>Library binding: <A href="/library/clip"><code>Device::clip()</code></A>.</p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Start playback (<code>op = 0</code>, a single-byte payload so <code>LEN = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 01 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>Every op has the same shape; only the <code>op</code> byte changes.</p>
        </Card>
      </div>

      <div id="set" data-search-target>
        <Card>
          <CardHeader title="CLIP_SET" subtitle="Set a clip setting" />
          <p>
            Set one of the clip's settings, <A href="/native/commands/option">OPTION</A>-shaped:{' '}
            an <code>id</code> byte picks the setting, a <code>value</code> byte carries it. A setting sticks
            until you change it or the clip is torn down; read them all back with{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x14</code>.
          </p>
          <pre class="api-signature">CLIP_SET  0x14  ·  payload [id u8][value u8]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">SETTINGS</div>
          <table class="api-params">
            <thead>
              <tr><th>id</th><th>Setting</th><th>value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>autolock</code></td><td>class bitmask</td><td>the physical-input classes <code>START</code> locks while playing (below)</td></tr>
              <tr><td><code>1</code></td><td><code>loop</code></td><td><code>0</code> / <code>1</code></td><td>a finalized clip replays from the head instead of ending</td></tr>
              <tr><td><code>2</code></td><td><code>retain</code></td><td><code>0</code> / <code>1</code></td><td>keep entries after playing so <code>START</code> / <code>RESTART</code> can replay them</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            The <code>autolock</code> value is a bitmask of the physical-input classes <code>START</code> locks
            while the clip plays (clip-owned, released on <code>STOP</code>), leaving the ones you don't name
            free. A host <A href="/native/commands/lock"><code>LOCK</code></A> is untouched. <code>0</code> = no
            auto-lock; <code>0x1F</code> = every class.
          </p>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Mask</th><th>Locks</th></tr></thead>
            <tbody>
              <tr><td><code>b0</code></td><td><code>0x01</code></td><td>the X and Y aim axes</td></tr>
              <tr><td><code>b1</code></td><td><code>0x02</code></td><td>the wheel</td></tr>
              <tr><td><code>b2</code></td><td><code>0x04</code></td><td>every mouse button</td></tr>
              <tr><td><code>b3</code></td><td><code>0x08</code></td><td>every keyboard key</td></tr>
              <tr><td><code>b4</code></td><td><code>0x10</code></td><td>every media usage</td></tr>
            </tbody>
          </table>
          <p>
            Library binding: <A href="/library/clip#handle"><code>set_autolock</code></A>,{' '}
            <A href="/library/clip#handle"><code>set_loop</code></A>,{' '}
            <A href="/library/clip#handle"><code>set_retain</code></A>.
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
          <CardHeader title="CLIP_TRIGGER" subtitle="Bind a physical edge to an engine verb" />
          <p>
            Fire a <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> verb the instant the user
            physically moves an input (the same physical edge{' '}
            <A href="/native/commands/catch"><code>CATCH</code></A> reports), with no host round-trip, so even
            the first emitted frame is box-timed. Triggers are a{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>-shaped managed set of up to eight bindings,
            keyed by <code>(class, id, edge)</code>. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x15</code>.
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
            <thead><tr><th><code>class</code></th><th>Value</th><th><code>id</code> is</th></tr></thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A></td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keycode</A></td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>any</td><td><code>0xFF</code></td><td>ignored (any input fires)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EDGE</div>
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
              <tr><td><code>b1</code></td><td><code>0x02</code></td><td>consume: swallow the physical edge so the app never sees it</td></tr>
            </tbody>
          </table>
          <p>
            A binding is keyed by <code>(class, id, edge)</code>, so re-sending the same key replaces it and
            clearing <code>present</code> removes it. To wipe the whole set in one frame send the clear-all
            sentinel: <code>class = 0xFF</code>, <code>id = 0xFFFF</code>, <code>edge = 0</code> (both),{' '}
            <code>flags = 0</code>. Preload the ring (and, for a replayable macro, mark it{' '}
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
    </>
  );
};

export default Clip;
