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
          Driving fast input over the control link one command at a time costs a round-trip per command and
          leaves the timing at the mercy of the host's scheduler. <code>CLIP</code> moves that off the host:
          you <A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A> a sequence of per-frame
          entries into a ring on the box, then <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A>{' '}
          starts it, and the box drains one entry per native frame into the same{' '}
          <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed. Playback is clocked by the box, so it
          carries none of the host's scheduling jitter and none of the per-command send floor.
        </p>
        <p>
          It is field-generic, like <A href="/native/commands/inject"><code>INJECT</code></A>: one clip mixes
          mouse motion, mouse buttons, keyboard keys, and media usages, each routed to its own interface, and
          several can land on one frame. It is <A href="/native/injection#state">additive</A> and follows{' '}
          <A href="/native/commands/option#move-ride">movement riding</A> and the emit rate like any injection.
        </p>
        <pre class="diagram">{`  control PC                       box   (drains one entry per native frame)
      |                            +----------------------------------------+
      |  CLIP_APPEND [e0][e1]...    |  ring  [e0][e1][e2][e3][e4] ...        |
      | -------------------------->  |          |                            |
      |                             |          | one entry / frame          |
      |  CLIP_CTRL START            |          v                            |
      | -------------------------->  |  injection state ---> mouse   report  |
      |                             |                   ---> keyboard report |
      |  QUERY(CLIP)  <-- free/used  |                   ---> media    report |
      +---------------------------->  +---------------------------------------+
                  box-clocked: the host does no per-frame timing`}</pre>
        <table class="api-params">
          <thead><tr><th>Opcode</th><th>Command</th><th>Direction</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>PC→box</td><td>append a batch of entries to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>PC→box</td><td>start, stop, arm a trigger, or configure</td></tr>
          </tbody>
        </table>
        <p>
          Read the ring depth and playback state with{' '}
          <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>. A clip needs a cloned mouse:
          the box's frame clock is the mouse's native report tick, and keyboard and media edges ride it.
        </p>
      </Card>

      <div id="entries" data-search-target>
        <Card>
          <CardHeader title="Entry format" subtitle="The bytes CLIP_APPEND carries" />
          <p>
            A clip is a byte stream of variable-length entries, little-endian. The first byte of each entry is
            a tag: <code>0x00</code> is a <b>gap run</b>, any other value is a <b>content tick</b>'s flags.
            One entry is one native frame.
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
            An edge reuses <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s tuple, so a clip
            drives every input class: <code>class</code> is <code>0</code> button, <code>1</code> key,{' '}
            <code>2</code> media, <code>id</code> is the usage within that class (a{' '}
            <A href="/native/commands/usage#buttons">button id</A>,{' '}
            <A href="/native/commands/usage#keycodes">keycode</A>, or{' '}
            <A href="/native/commands/usage#consumer">Consumer usage</A>), and <code>action</code> is{' '}
            <code>0</code> soft-release / <code>1</code> press / <code>2</code> force-release. An edge is a
            level: it sticks until a later tick changes it, so a held key is one <code>press</code> then a
            later <code>release</code>, and the box NAKs while it's held-still. Motion (<code>dx/dy/wheel</code>)
            is a per-frame delta.
          </p>
          <div class="api-response-label">A CLIP IS A TIMELINE</div>
          <p>
            The entries play out one per frame, left to right. A gap is N idle frames; an edge stays held
            until a later entry releases it. So a click that spans a hold is a <code>press</code> entry, a{' '}
            gap, then a <code>release</code> entry.
          </p>
          <pre class="diagram">{`  frame:   0       1        2   3   4       5        6        7
  entry:  [XY]   [L down]     gap 3        [L up]   [XY]    [key A]
  emits:  move   L press   .. held, NAK .. L release  move   A press
                   \\_________ left button held 4 frames _________/`}</pre>
          <div class="api-response-label">EXAMPLE ENTRIES</div>
          <p>The bytes for three of those entries: move up-left, press <code>A</code>, idle 5 frames.</p>
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

     free                          used
  +----------------+----------------------------------------+
  |    (append     | [e5][e6][e7][e8][e9] ...               | --> drained
  |     here, <=   |          buffered, not yet played       |     1 / frame
  |     free)      |                                         |
  +----------------+----------------------------------------+
   append > free  ->  dropped whole + clip faulted`}</pre>
          <p>
            Library binding: <A href="/library/clip#builder"><code>ClipBuilder</code></A> +{' '}
            <A href="/library/clip#handle"><code>append</code></A>, which splits a large clip into whole-entry
            frames for you.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Append one content tick, cursor <code>dx = 10</code> (a 5-byte entry, so <code>LEN = 5</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 12     | 00     | 05 00  | 01     | 0A 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | flags  | dx     | dy     | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
                    ^ append seq        \\------- one XY content tick -------/`}</pre>
        </Card>
      </div>

      <div id="ctrl" data-search-target>
        <Card>
          <CardHeader title="CLIP_CTRL" subtitle="Start, stop, arm, configure" />
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
              <tr><td><code>0</code></td><td><code>START</code></td><td><code>[config u8]</code></td><td>play from the ring head; <code>config</code> bit 0 = auto-lock</td></tr>
              <tr><td><code>1</code></td><td><code>STOP</code></td><td>none</td><td>stop, flush the ring, release the clip's lock</td></tr>
              <tr><td><code>2</code></td><td><code>ARM_CATCH</code></td><td><code>[cond_class u8][cond_id u16]</code></td><td>fire <code>START</code> on a physical button press</td></tr>
              <tr><td><code>3</code></td><td><code>DISARM</code></td><td>none</td><td>clear a pending catch-arm</td></tr>
              <tr><td><code>4</code></td><td><code>CONFIG</code></td><td><code>[config u8]</code></td><td>set the auto-lock a catch-triggered <code>START</code> uses, without starting</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            With <code>config</code> bit 0, <code>START</code> locks all physical input the host has not
            already locked, every mouse axis and button, the keyboard, and media, so the user's hand can't
            interfere with the clip, and releases exactly what it locked on <code>STOP</code>. A{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A> the host set itself is left alone. For
            selective locking (say, lock the buttons but leave aim free), <code>LOCK</code> what you want and
            use a plain <code>START</code>.
          </p>
          <div class="api-response-label">CATCH TRIGGER</div>
          <p>
            <code>ARM_CATCH</code> starts a preloaded clip on the box the instant the user presses a physical
            mouse button, with no host round-trip, so even the first emitted frame is box-timed.{' '}
            <code>cond_class</code> is <code>0</code> (button), and <code>cond_id</code> is a{' '}
            <A href="/native/commands/usage#buttons">button id</A> or <code>0xFFFF</code> for any button. The
            clip it fires still drives keyboard and media edges; only the <em>trigger</em> is a mouse button.
            Preload the ring and (optionally) <code>CONFIG</code> the auto-lock before arming.
          </p>
          <div class="api-response-label">UNDERRUN &amp; TEARDOWN</div>
          <p>
            If the ring drains with no <code>STOP</code>, the box idles and stays playing until you refill it.
            A topping-up host (or any keepalive) holds the clip alive; full{' '}
            <A href="/native/injection#safety">1&nbsp;s silence</A>, a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a mouse detach, or inter-chip link
            loss stop the clip and flush the ring. With{' '}
            <A href="/native/commands/option#move-ride">movement riding</A> on, clip motion rides native
            motion reports and is additive to the user's own movement, so the frame-exact use case runs riding
            off. Library binding: <A href="/library/clip"><code>Device::clip()</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Start with auto-lock (<code>op = 0</code>, <code>config = 0x01</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 02 00  | 00     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | config | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>Arm a catch trigger on any button (<code>op = 2</code>, <code>cond_id = 0xFFFF</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 13     | 00     | 04 00  | 02     | 00     | FF FF  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | class  | cond_id| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
