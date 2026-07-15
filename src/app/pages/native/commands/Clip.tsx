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
          A host preloads a sequence of per-frame input entries into a ring on the box, then the box drains
          one entry per native frame into the same{' '}
          <A href="/native/injection#state">injection state</A> that{' '}
          <A href="/native/commands/inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move"><code>MOVE</code></A> feed. The existing box-clocked emission engine
          — <A href="/native/commands/option#emit">rate pacing</A>,{' '}
          <A href="/native/commands/option#move-ride">movement riding</A>, the additive-on-physical merge —
          then emits it. So playback carries none of the host's scheduling jitter and none of the ~2 ms
          per-command send floor, several inputs can land on one tick, and the lock-then-move race is closed.
        </p>
        <p>
          A clip is just another injection source: it obeys riding and the emit rate like any injection, and
          it coexists with live <code>INJECT</code>/<code>MOVE</code>. Two opcodes drive it; read its ring
          depth and state with <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
        </p>
        <table class="api-params">
          <thead><tr><th>opcode</th><th>command</th><th>carries</th></tr></thead>
          <tbody>
            <tr><td><code>0x12</code></td><td><A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A></td><td>a batch of whole entries, appended to the ring</td></tr>
            <tr><td><code>0x13</code></td><td><A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A></td><td>start / stop / arm / config</td></tr>
          </tbody>
        </table>
      </Card>

      <div id="entries" data-search-target>
        <Card>
          <CardHeader title="Entry format" subtitle="The per-frame byte stream" />
          <p>
            A clip is a byte stream of variable-length entries (little-endian). Each entry is one tag byte,
            then payload. An entry is either a <b>gap run</b> (emit nothing for N frames) or a{' '}
            <b>content tick</b> (a motion delta and/or a list of edges, applied on one frame).
          </p>
          <div class="api-response-label">ENTRY TYPES</div>
          <table class="byte-table">
            <thead>
              <tr><th>Entry</th><th>Bytes</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Gap run</td>
                <td><code>[0x00][count u16]</code></td>
                <td>emit nothing for <code>count</code> frames — the endpoint NAKs, byte-identical to an idle mouse (the faithful no-motion poll)</td>
              </tr>
              <tr>
                <td>Content tick</td>
                <td><code>[flags u8]</code> (nonzero), then per flag below</td>
                <td>a motion delta and/or an edge tuple, all applied on this one frame</td>
              </tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTENT FLAGS</div>
          <table class="byte-table">
            <thead>
              <tr><th>Flag</th><th>Adds</th><th>Field</th></tr>
            </thead>
            <tbody>
              <tr><td><code>XY 0x01</code></td><td><code>[dx i16][dy i16]</code></td><td>cursor delta this frame</td></tr>
              <tr><td><code>WHEEL 0x02</code></td><td><code>[wheel i16]</code></td><td>scroll delta this frame</td></tr>
              <tr><td><code>EDGES 0x04</code></td><td><code>[n u8]</code> then <code>n ×</code> <code>[class u8][id u16][action u8]</code></td><td>up to 8 edges on this frame</td></tr>
            </tbody>
          </table>
          <p>
            Motion (<code>dx/dy/wheel</code>) is a per-frame delta. Edges reuse{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s encoding:{' '}
            <code>class</code> ∈ {'{'}0 button, 1 key, 2 media{'}'}, <code>action</code> ∈ {'{'}0 soft-release,
            1 press, 2 force-release{'}'}, and an edge is sticky until a later tick changes it. A held button
            is one <code>press</code> edge then a <code>release</code> edge later; while held-still the box
            NAKs like an idle mouse (the clip need not re-assert it every tick). A tag byte of <code>0x00</code>
            is always a gap, so an all-zero content tick is encoded as a zero-motion <code>XY</code> tick.
          </p>
        </Card>
      </div>

      <div id="append" data-search-target>
        <Card>
          <CardHeader title="CLIP_APPEND" subtitle="Fill the ring" />
          <p>
            The payload is a batch of whole entries appended to the device ring.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x12</code>.
          </p>
          <pre class="api-signature">CLIP_APPEND  0x12  ·  payload = a batch of whole entries</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">DROP DETECTION</div>
          <p>
            The frame <A href="/native/frame#layout"><code>SEQ</code></A> is an append sequence number
            (incrementing). The box tracks the expected next <code>SEQ</code>, and because the link is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>, a lost <code>CLIP_APPEND</code>{' '}
            frame shows up as a <code>SEQ</code> gap — the box marks the clip <code>faulted</code> in{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A> so a dropped frame is caught
            and re-synced (stop and rebuild), never silently sticks a button.
          </p>
          <div class="api-response-label">RULES</div>
          <pre class="diagram">{`whole   pack whole entries per frame; never split one entry across two appends
seq     the SEQ increments per append; a gap -> faulted (host re-syncs)
overrun an append that doesn't fit is dropped WHOLE and faults (never a partial
        entry that would desync); flow-control off QUERY(CLIP).free to avoid it`}</pre>
        </Card>
      </div>

      <div id="ctrl" data-search-target>
        <Card>
          <CardHeader title="CLIP_CTRL" subtitle="Start, stop, arm, config" />
          <p>
            Control playback: <code>[op u8][args]</code>. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x13</code>.
          </p>
          <pre class="api-signature">CLIP_CTRL  0x13  ·  [op u8][args]</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="byte-table">
            <thead>
              <tr><th>op</th><th>Name</th><th>Args</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><code>START</code></td><td><code>[config u8][lock_mask u16]</code></td><td>begin playback from the ring head; <code>config</code> bit0 = auto-lock</td></tr>
              <tr><td><code>1</code></td><td><code>STOP</code></td><td>—</td><td>stop, flush the ring, release the clip-owned lock</td></tr>
              <tr><td><code>2</code></td><td><code>ARM_CATCH</code></td><td><code>[cond_class u8][cond_id u16]</code></td><td>fire <code>START</code> locally on a physical button press (class 0; <code>cond_id</code> = button id, <code>0xFFFF</code> = any)</td></tr>
              <tr><td><code>3</code></td><td><code>DISARM</code></td><td>—</td><td>clear a pending catch-arm</td></tr>
              <tr><td><code>4</code></td><td><code>CONFIG</code></td><td><code>[config u8][lock_mask u16]</code></td><td>set the auto-lock options a catch-triggered <code>START</code> will use, without starting</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">AUTO-LOCK</div>
          <p>
            Clip-owned. On <code>START</code> with <code>config</code> bit0 the box{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>s the mouse targets in <code>lock_mask</code>{' '}
            (<code>0</code> = all axes + buttons) that the host has not already locked, and releases exactly
            those on <code>STOP</code> — a lock the host set itself is untouched.
          </p>
          <div class="api-response-label">CATCH TRIGGER</div>
          <p>
            <code>ARM_CATCH</code> starts playback on a physical mouse-button press, on the box, with no host
            round-trip — so even the first emitted frame is box-timed. Preload the ring and (optionally){' '}
            <code>CONFIG</code> the auto-lock first.
          </p>
          <div class="api-response-label">UNDERRUN &amp; TEARDOWN</div>
          <p>
            If the ring runs dry with no <code>STOP</code>, the box idles and stays playing until refill (a
            topping-up host, or any keepalive, refreshes the{' '}
            <A href="/native/injection#safety">1 s silence timer</A>). Full silence,{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a mouse detach, or link loss all
            stop the clip and flush the ring. <A href="/native/commands/option#move-ride">Movement riding</A>{' '}
            is followed, not overridden: with riding on, clip motion rides native motion reports (additive to
            physical motion), so the frame-exact use case runs riding off. Library binding:{' '}
            <A href="/library/clip"><code>Device::clip()</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Clip;
