import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Clip: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Clip" subtitle="Buffered clip playback" />
        <p>
          The host preloads per-frame input into a ring on the box; the box drains one entry per native frame
          into the same <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed, and the frame clock emits it. Playback is
          box-clocked, so it carries none of the host's scheduling jitter and none of the per-command send
          floor. It is field-generic: one clip mixes mouse motion, mouse buttons, keyboard keys, and media
          usages, each routed to its class.
        </p>
        <table class="api-params">
          <thead><tr><th>Opcode</th><th>Command</th><th>Carries</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>a batch of whole entries, appended to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>start / stop / arm / config</td></tr>
          </tbody>
        </table>
        <p>
          Read the ring depth and state with{' '}
          <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>. Needs a cloned mouse: the
          frame clock is the mouse's native tick, and keyboard/media edges ride it.
        </p>
      </Card>

      <div id="entries" data-search-target>
        <Card>
          <CardHeader title="Entry format" subtitle="The per-frame byte stream" />
          <p>
            A clip is a byte stream of little-endian entries. The first byte is a tag: <code>0x00</code> is a
            gap run, anything else is a content tick's flags.
          </p>
          <div class="api-response-label">ENTRIES</div>
          <table class="byte-table">
            <thead><tr><th>Entry</th><th>Bytes</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td>Gap run</td><td><code>[0x00][count u16]</code></td><td>emit nothing for <code>count</code> frames (NAK, byte-identical to an idle mouse)</td></tr>
              <tr><td>Content tick</td><td><code>[flags u8]</code>, then the fields its flags select</td><td>a motion delta and/or edges, applied this frame</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTENT FLAGS</div>
          <table class="byte-table">
            <thead><tr><th>Flag</th><th>Adds</th></tr></thead>
            <tbody>
              <tr><td><code>XY 0x01</code></td><td><code>[dx i16][dy i16]</code> cursor delta</td></tr>
              <tr><td><code>WHEEL 0x02</code></td><td><code>[wheel i16]</code></td></tr>
              <tr><td><code>EDGES 0x04</code></td><td><code>[n u8]</code>, then <code>n ×</code> <code>[class u8][id u16][action u8]</code> (max 8)</td></tr>
            </tbody>
          </table>
          <p>
            Edges reuse <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s encoding:{' '}
            <code>class</code> 0 button / 1 key / 2 media, <code>action</code> 0 soft-release / 1 press / 2
            force-release, sticky until a later tick changes it. A held button is a <code>press</code> then a
            later <code>release</code>; the box NAKs while it's held-still. Tag <code>0x00</code> is always a
            gap, so an all-zero content tick encodes as a zero-motion <code>XY</code> tick.
          </p>
          <div class="api-response-label">EXAMPLE ENTRIES</div>
          <pre class="diagram">{`01 0A 00 F6 FF     content: XY, dx=+10 dy=-10
04 01 01 04 00 01  content: EDGES n=1, key(class 1, id 0x04 'A', press)
00 05 00           gap: NAK for 5 frames`}</pre>
        </Card>
      </div>

      <div id="append" data-search-target>
        <Card>
          <CardHeader title="CLIP_APPEND" subtitle="Fill the ring" />
          <p>
            The payload is a batch of whole entries appended to the ring.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x12</code>.
          </p>
          <pre class="api-signature">CLIP_APPEND  0x12  ·  payload = a batch of whole entries</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">RULES</div>
          <pre class="diagram">{`seq     the frame SEQ is an append counter; a gap in it (a lost frame) marks
        the clip faulted in QUERY(CLIP) so the host re-syncs, never a stuck key
whole   pack whole entries per frame; never split one entry across two appends
full    an append that doesn't fit is dropped whole and faults (never a partial
        entry); flow-control off QUERY(CLIP).free to avoid it`}</pre>
        </Card>
      </div>

      <div id="ctrl" data-search-target>
        <Card>
          <CardHeader title="CLIP_CTRL" subtitle="Start, stop, arm, config" />
          <pre class="api-signature">CLIP_CTRL  0x13  ·  [op u8][args]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="byte-table">
            <thead><tr><th>op</th><th>Name</th><th>Args</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>START</code></td><td><code>[config u8]</code></td><td>play from the ring head; <code>config</code> bit0 = auto-lock</td></tr>
              <tr><td><code>1</code></td><td><code>STOP</code></td><td>none</td><td>stop, flush the ring, release the clip lock</td></tr>
              <tr><td><code>2</code></td><td><code>ARM_CATCH</code></td><td><code>[cond_class u8][cond_id u16]</code></td><td>start locally on a physical button press (class 0; <code>cond_id</code> = button id, <code>0xFFFF</code> = any)</td></tr>
              <tr><td><code>3</code></td><td><code>DISARM</code></td><td>none</td><td>clear a pending catch-arm</td></tr>
              <tr><td><code>4</code></td><td><code>CONFIG</code></td><td><code>[config u8]</code></td><td>set the auto-lock a catch-triggered start uses, without starting</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            <code>config</code> bit0 locks all physical input (every mouse axis+button, keyboard, media) the
            host hasn't already locked, releasing exactly that on <code>STOP</code>. A lock the host set
            itself is untouched. For selective locking, <A href="/native/commands/lock"><code>LOCK</code></A>{' '}
            what you want and use a plain <code>START</code>.
          </p>
          <div class="api-response-label">CATCH TRIGGER</div>
          <p>
            <code>ARM_CATCH</code> fires <code>START</code> on the box on a physical mouse-button press, no
            host round-trip, so even the first emitted frame is box-timed. The clip it fires can still drive
            keyboard and media edges.
          </p>
          <div class="api-response-label">TEARDOWN &amp; RIDING</div>
          <p>
            An empty ring idles until refill or <code>STOP</code>. Full{' '}
            <A href="/native/injection#safety">1 s silence</A>,{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a detach, or link loss stop the clip
            and flush the ring. <A href="/native/commands/option#move-ride">Movement riding</A> is followed:
            with riding on, clip motion rides native reports (additive to physical motion), so the frame-exact
            use case runs riding off. Library binding:{' '}
            <A href="/library/clip"><code>Device::clip()</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Clip;
