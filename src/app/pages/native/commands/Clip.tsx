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
          <A href="/native/commands/clip#append"><code>CLIP</code></A> preloads a sequence of per-frame entries
          into a ring on the box, then <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> starts it
          and the box drains one entry per native frame into the same{' '}
          <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed. Playback is box-clocked, so it carries no
          host scheduling jitter and no per-command send floor. Like{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> it is field-generic and{' '}
          <A href="/native/injection#state">additive</A>: one clip mixes mouse motion, buttons, keyboard, and
          media, each routed to its own interface, and follows{' '}
          <A href="/native/commands/option#move-ride">movement riding</A> and the emit rate. A clip needs a
          cloned mouse, whose native report tick is the box's frame clock; read the ring depth and state back
          with <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
        </p>
        <pre class="diagram">{`control PC                     box  (drains one entry per native frame)
      |                       +-----------------------------------------+
      |  CLIP_APPEND [e0][e1] |  ring [e0][e1][e2][e3][e4] ...          |
      | --------------------> |    |                                    |
      |                       |    | one entry / frame                  |
      |  CLIP_CTRL START      |    v                                    |
      | --------------------> |  injection state --> mouse    report    |
      |                       |                  --> keyboard report    |
      |  QUERY(CLIP) <-- depth|                  --> media    report    |
      +---------------------> +-----------------------------------------+
                box-clocked: host does no per-frame timing`}</pre>
        <table class="api-params">
          <thead><tr><th>Opcode</th><th>Command</th><th>Direction</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>PC→box</td><td>append a batch of entries to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>PC→box</td><td>start, stop, or arm a trigger</td></tr>
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
            An edge reuses <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s{' '}
            <code>[class u8][id u16][action u8]</code> tuple, so one clip drives every input class.
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
          <div class="api-response-label">A CLIP IS A TIMELINE</div>
          <p>Entries play out one per frame, left to right; an edge stays held until a later entry releases it.</p>
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
          <p>The bytes for three of those entries: move up-right, press <code>A</code>, idle 5 frames.</p>
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
            ring. Send it while stopped to preload, or while playing to keep topping up in real time.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x12</code>.
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
            The frame <A href="/native/frame#layout"><code>SEQ</code></A> doubles as an append sequence
            number: the box expects each <code>CLIP_APPEND</code> to be the previous <code>SEQ</code> plus one.
            Because the link is <A href="/native/injection#fire-and-forget">fire-and-forget</A>, a lost frame
            shows up as a <code>SEQ</code> gap, and the box marks the clip <code>faulted</code> in{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A> so the host re-syncs (stop,
            then rebuild) instead of playing a stream with a hole in it. Pack whole entries per frame; never
            split one entry across two appends.
          </p>
          <div class="api-response-label">FLOW CONTROL</div>
          <p>
            An append that doesn't fit the ring is dropped whole and faults the clip, never written as a
            partial entry that would desync the stream. Keep an append under{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>'s <code>free</code> bytes to
            avoid it: the box drains from the head while you append to the tail, so a real-time host tops up as
            <code>free</code> opens back up.
          </p>
          <pre class="diagram">{`  the ring, read by QUERY(CLIP):

       free                        used
  +----------------+----------------------------------------+
  |    (append     | [e5][e6][e7][e8][e9] ...               | --> drained
  |    here, <=    |     buffered, not yet played           |     1 / frame
  |    free)       |                                        |
  +----------------+----------------------------------------+
   append > free  ->  dropped whole + clip faulted`}</pre>
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
          <CardHeader title="CLIP_CTRL" subtitle="Start, stop, arm" />
          <p>
            One byte of <code>op</code>, then op-specific args. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x13</code>.
          </p>
          <pre class="api-signature">CLIP_CTRL  0x13  ·  payload [op u8][args]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">OPS</div>
          <table class="api-params">
            <thead>
              <tr><th>op</th><th>Name</th><th>Args</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>START</code></td><td><code>[scope u8]</code></td><td>play from the ring head; <code>scope</code> = the auto-lock class bitmask (below)</td></tr>
              <tr><td><code>1</code></td><td><code>STOP</code></td><td>none</td><td>stop, flush the ring, release the clip's lock</td></tr>
              <tr><td><code>2</code></td><td><code>ARM_CATCH</code></td><td><code>[cond_class u8][cond_id u16][scope u8]</code></td><td>fire <code>START</code> on a physical input press (button / key / media), auto-locking <code>scope</code> on that start</td></tr>
              <tr><td><code>3</code></td><td><code>DISARM</code></td><td>none</td><td>clear a pending catch-arm</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            The <code>scope</code> byte is a bitmask of the physical-input classes <code>START</code> locks
            while playing (clip-owned, released on <code>STOP</code>), leaving the ones you don't name free. A
            host <A href="/native/commands/lock"><code>LOCK</code></A> is untouched. <code>0</code> = no
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
          <div class="api-response-label">CATCH TRIGGER</div>
          <p>
            <code>ARM_CATCH</code> starts a preloaded clip on the box the instant the user physically presses
            the armed input (the same physical edge <A href="/native/commands/catch"><code>CATCH</code></A>{' '}
            reports), with no host round-trip, so even the first emitted frame is box-timed. The condition is
            field-generic, like <A href="/native/commands/inject#inject"><code>INJECT</code></A>:{' '}
            <code>cond_class</code> selects the input class and <code>cond_id</code> the usage.
          </p>
          <table class="api-params">
            <thead><tr><th><code>cond_class</code></th><th>Value</th><th><code>cond_id</code> is</th></tr></thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A></td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keycode</A></td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>any</td><td><code>0xFF</code></td><td>ignored (any input fires)</td></tr>
            </tbody>
          </table>
          <p>
            <code>cond_id</code> <code>0xFFFF</code> = any usage within the class. The trailing <code>scope</code>{' '}
            byte is the auto-lock that triggered start applies (the same bitmask as <code>START</code>). Preload
            the ring before arming.
          </p>
          <div class="api-response-label">UNDERRUN</div>
          <p>
            If the ring drains with no <code>STOP</code>, the box idles and stays playing until you refill it;
            a topping-up host or any keepalive holds the clip alive.
          </p>
          <div class="api-response-label">STOPS ON</div>
          <pre class="diagram">{`STOP        an explicit STOP op
silence     a full 1 s of control-PC silence
RESET       a RESET command
detach      the cloned mouse unplugs
link loss   the inter-chip link drops`}</pre>
          <p>
            Each stops the clip and flushes the ring, the box's{' '}
            <A href="/native/injection#safety">1&nbsp;s safety net</A> and a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> reaching a clip like any injection.
            With <A href="/native/commands/option#move-ride">movement riding</A> on, clip motion rides native
            reports and is additive to the user's own movement, so the frame-exact use case runs riding off.
          </p>
          <p>Library binding: <A href="/library/clip"><code>Device::clip()</code></A>.</p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Start auto-locking every class (<code>op = 0</code>, <code>scope = 0x1F</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 02 00  | 00     | 1F     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | scope  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>Arm a catch trigger on the <code>A</code> key, auto-locking every class on the triggered start (<code>op = 2</code>, <code>class = 1</code>, <code>cond_id = 0x04</code>, <code>scope = 0x1F</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 05 00  | 02     | 01     | 04 00  | 1F     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | class  | cond_id| scope  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
