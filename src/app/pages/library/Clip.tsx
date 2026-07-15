import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Clip: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Clip" subtitle="Buffered clip playback" />
        <p>
          <A href="/library/clip#clip"><code>Device::clip()</code></A> returns a{' '}
          <A href="/library/clip#handle"><code>ClipHandle</code></A>: preload per-frame input into a
          device-side ring with <A href="/library/clip#builder"><code>ClipBuilder</code></A>, then the box
          drains one entry per native frame — box-clocked, so it carries none of the host's scheduling jitter
          and none of the per-command send floor. The clip rides the same{' '}
          <A href="/library/options#set-emit-pace">rate pacing</A> and{' '}
          <A href="/library/options#set-movement-riding">movement riding</A> as live injection; it never
          overrides them. Backs the <A href="/native/commands/clip"><code>CLIP</code></A> commands.
        </p>
        <table class="api-params">
          <thead><tr><th>You want</th><th>Method</th></tr></thead>
          <tbody>
            <tr><td>build an entry stream</td><td><A href="/library/clip#builder"><code>ClipBuilder::move_by / wheel / press / gap / frame …</code></A></td></tr>
            <tr><td>fill the ring</td><td><A href="/library/clip#append"><code>ClipHandle::append(&builder)</code></A></td></tr>
            <tr><td>play / stop</td><td><A href="/library/clip#start"><code>start</code></A> / <A href="/library/clip#start"><code>start_autolock</code></A> / <A href="/library/clip#stop"><code>stop</code></A></td></tr>
            <tr><td>fire on a physical press</td><td><A href="/library/clip#arm"><code>arm_catch</code></A> / <A href="/library/clip#arm"><code>disarm</code></A> / <A href="/library/clip#arm"><code>config</code></A></td></tr>
            <tr><td>read the ring depth &amp; state</td><td><A href="/library/clip#status"><code>status</code></A> → <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A></td></tr>
          </tbody>
        </table>
      </Card>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="clip" subtitle="Open a clip handle" />
          <pre class="api-signature">fn clip(&self) -&gt; ClipHandle</pre>
          <p>
            The handle owns the append-sequence counter the box uses to detect a dropped frame, so keep one
            handle for a clip session and top it up with <A href="/library/clip#append"><code>append</code></A>.
            Playback is RAM-backed and transient: a box reboot or reconnect drops it, so re-preload after one.
          </p>
        </Card>
      </div>

      <div id="builder" data-search-target>
        <Card>
          <CardHeader title="ClipBuilder" subtitle="Build the entry stream" />
          <p>
            Each method appends one per-frame entry: motion is a relative delta, edges are{' '}
            <A href="/library/types/enums#action"><code>Action</code></A>s that stick until a later frame
            changes them (like <A href="/library/inject#inject"><code>inject</code></A>), and{' '}
            <code>gap</code> emits nothing for N frames (a faithful idle poll). Mirrors the firmware entry
            codec byte-for-byte.
          </p>
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Entry</th></tr></thead>
            <tbody>
              <tr><td><code>gap(frames: u16)</code></td><td>emit nothing for <code>frames</code> ticks (0 = no-op)</td></tr>
              <tr><td><code>move_by(dx: i16, dy: i16)</code></td><td>a cursor-motion frame</td></tr>
              <tr><td><code>wheel(dz: i16)</code></td><td>a wheel frame</td></tr>
              <tr><td><code>press / release / force_release(button: Button)</code></td><td>a one-button frame</td></tr>
              <tr><td><code>key(key: Key, action: Action)</code></td><td>a one-key frame</td></tr>
              <tr><td><code>media(media: MediaKey, action: Action)</code></td><td>a one-media frame</td></tr>
              <tr><td><code>frame(dx, dy, wheel, edges: &[ClipEdge])</code></td><td>a motion delta plus up to 8 edges on one frame</td></tr>
            </tbody>
          </table>
          <p>
            A frame carries only edges via <code>edges(&[ClipEdge])</code>; build an edge with{' '}
            <A href="/library/types/structs#clip-edge"><code>ClipEdge::button / key / media</code></A>. Call{' '}
            <code>clear()</code> to reuse the allocation. The methods take <code>&mut self</code> and return{' '}
            <code>&mut Self</code>, so chain them or push in a loop.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipBuilder, Button};

let mut clip = ClipBuilder::new();
for _ in 0..200 {
    clip.move_by(10, 0);   // 200 frames of +10 dx
}
clip.press(Button::Left)   // a click that spans a hold
    .gap(20)               // ... held for 20 frames
    .release(Button::Left);`}</code></pre>
        </Card>
      </div>

      <div id="handle" data-search-target>
        <Card>
          <CardHeader title="ClipHandle" subtitle="Drive playback" />
          <p>
            From <A href="/library/clip#clip"><code>Device::clip()</code></A>. Cloning shares the same
            append-sequence counter. The append and control methods are{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>; <code>status</code> is a query.
          </p>
        </Card>
      </div>

      <div id="append" data-search-target>
        <Card>
          <CardHeader title="append" subtitle="Top up the ring" />
          <pre class="api-signature">fn append(&self, clip: &ClipBuilder) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Sends the builder's entries as <A href="/native/commands/clip#append"><code>CLIP_APPEND</code></A>{' '}
            frames. A clip larger than one frame splits into whole-entry frames (never a partial entry), each
            stamped with the next append-sequence number so the box flags a dropped frame. Flow-control by
            keeping <A href="/library/clip#status"><code>status()</code></A><code>.free</code> above what you
            push.
          </p>
        </Card>
      </div>

      <div id="start" data-search-target>
        <Card>
          <CardHeader title="start / start_autolock" subtitle="Begin playback" />
          <pre class="api-signature">fn start(&self) -&gt; Result&lt;()&gt;
fn start_autolock(&self, lock_mask: u16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>start</code> plays from the ring head. <code>start_autolock</code> also has the box{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A> the mouse targets it drives (that the host
            hasn't already locked) for the duration, releasing them on <code>stop</code> — a lock the host set
            itself is untouched. <code>lock_mask</code> = 0 locks all mouse axes + buttons.
          </p>
        </Card>
      </div>

      <div id="stop" data-search-target>
        <Card>
          <CardHeader title="stop" subtitle="Stop and flush" />
          <pre class="api-signature">fn stop(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>Stop playback, flush the ring, and release any clip-owned auto-lock.</p>
        </Card>
      </div>

      <div id="arm" data-search-target>
        <Card>
          <CardHeader title="arm_catch / disarm / config" subtitle="On-device trigger" />
          <pre class="api-signature">fn arm_catch(&self, button: Option&lt;Button&gt;) -&gt; Result&lt;()&gt;
fn disarm(&self) -&gt; Result&lt;()&gt;
fn config(&self, autolock: bool, lock_mask: u16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>arm_catch</code> starts playback on the box on a physical press of <code>button</code> (or
            any mouse button if <code>None</code>), so even the first emitted frame has no host round-trip.
            Preload the ring and optionally <code>config</code> the auto-lock first; <code>disarm</code>{' '}
            clears a pending arm.
          </p>
        </Card>
      </div>

      <div id="status" data-search-target>
        <Card>
          <CardHeader title="status" subtitle="Ring depth and playback counters" />
          <pre class="api-signature">fn status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A>: the ring{' '}
            <code>free</code>/<code>used</code> bytes (to pace top-ups) and the playback counters. A{' '}
            <A href="/library/types/enums#clip-state"><code>ClipState::Faulted</code></A> state means re-sync
            (stop, then rebuild). Backs <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let clip = device.clip();
clip.append(&builder)?;
clip.start()?;
let s = clip.status()?;
println!("{:?}  used={} free={}", s.state, s.used, s.free);`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="AsyncClipHandle" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice::clip()</code></A> returns an{' '}
            <code>AsyncClipHandle</code>: the append and control methods stay synchronous (fire-and-forget,
            same signatures); only <code>status()</code> is <code>async</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let dev = Device::find()?.into_async();
let clip = dev.clip();
clip.append(&builder)?;   // no .await
clip.start()?;
let s = clip.status().await?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
