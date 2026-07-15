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
          <A href="/library/clip#handle"><code>ClipHandle</code></A>. Preload per-frame input (mouse, keyboard,
          media) into a device-side ring with <A href="/library/clip#builder"><code>ClipBuilder</code></A>,
          then the box drains one entry per native frame, box-clocked. It rides the same{' '}
          <A href="/library/options#set-emit-pace">rate pacing</A> and{' '}
          <A href="/library/options#set-movement-riding">movement riding</A> as live injection. Backs the{' '}
          <A href="/native/commands/clip"><code>CLIP</code></A> commands.
        </p>
      </Card>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="clip" subtitle="Open a clip handle" />
          <pre class="api-signature">fn clip(&self) -&gt; ClipHandle</pre>
          <p>
            The handle owns the append-sequence counter the box uses for drop detection, so keep one per clip
            session. Playback is RAM-backed: a box reboot or reconnect drops it.
          </p>
        </Card>
      </div>

      <div id="builder" data-search-target>
        <Card>
          <CardHeader title="ClipBuilder" subtitle="Build the entry stream" />
          <p>
            Each method appends one per-frame entry. Motion is a relative delta; edges are{' '}
            <A href="/library/types/enums#action"><code>Action</code></A>s that stick until a later frame
            changes them; <code>gap</code> emits nothing for N frames. Methods take <code>&mut self</code> and
            return <code>&mut Self</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Entry</th></tr></thead>
            <tbody>
              <tr><td><code>gap(frames: u16)</code></td><td>emit nothing for <code>frames</code> ticks (0 = no-op)</td></tr>
              <tr><td><code>move_by(dx, dy)</code> · <code>wheel(dz)</code></td><td>a motion frame</td></tr>
              <tr><td><code>press / release / force_release(button)</code></td><td>a one-button frame</td></tr>
              <tr><td><code>key(key, action)</code> · <code>media(media, action)</code></td><td>a one-key / one-media frame</td></tr>
              <tr><td><code>edge(input, action)</code></td><td>a one-edge frame, any <A href="/library/types/enums#input"><code>Input</code></A> class</td></tr>
              <tr><td><code>frame(dx, dy, wheel, &[(Input, Action)])</code></td><td>a motion delta plus up to 8 edges on one frame</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipBuilder, Button, Key, Action};

let mut clip = ClipBuilder::new();
for _ in 0..200 { clip.move_by(10, 0); } // 200 box-timed frames of +10 dx
clip.key(Key::A, Action::Press)          // type 'a' over a 20-frame hold
    .gap(20)
    .key(Key::A, Action::SoftRelease);`}</code></pre>
        </Card>
      </div>

      <div id="handle" data-search-target>
        <Card>
          <CardHeader title="ClipHandle" subtitle="Drive playback" />
          <p>
            From <A href="/library/clip#clip"><code>Device::clip()</code></A>. The append and control methods
            are <A href="/native/injection#fire-and-forget">fire-and-forget</A>; <code>status</code> blocks
            for the reply.
          </p>
          <pre class="api-signature">fn append(&self, clip: &ClipBuilder) -&gt; Result&lt;()&gt;</pre>
          <p>Sends the builder's entries, splitting a large clip into whole-entry frames with contiguous append seqs. Flow-control by keeping <code>status().free</code> above what you push.</p>
          <pre class="api-signature">fn start(&self) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn start_autolock(&self) -&gt; Result&lt;()&gt;</pre>
          <p>Play from the ring head. <code>start_autolock</code> also locks all physical input the host hasn't already locked, released on <code>stop</code>. For selective locking, <A href="/library/lock"><code>lock</code></A> what you want and use <code>start</code>.</p>
          <pre class="api-signature">fn stop(&self) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn config(&self, autolock: bool) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn arm_catch(&self, button: Option&lt;Button&gt;) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn disarm(&self) -&gt; Result&lt;()&gt;</pre>
          <p><code>arm_catch</code> starts playback on the box on a physical press of <code>button</code> (any if <code>None</code>), no host round-trip; <code>config</code> sets whether that start auto-locks.</p>
        </Card>
      </div>

      <div id="status" data-search-target>
        <Card>
          <CardHeader title="status" subtitle="Ring depth and playback counters" />
          <pre class="api-signature">fn status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A>: the ring{' '}
            <code>free</code>/<code>used</code> bytes and playback counters. A{' '}
            <A href="/library/types/enums#clip-state"><code>ClipState::Faulted</code></A> state means re-sync
            (stop, then rebuild). Backs{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="AsyncClipHandle" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice::clip()</code></A> returns an{' '}
            <code>AsyncClipHandle</code>: append and control stay synchronous (fire-and-forget); only{' '}
            <code>status()</code> is <code>async</code>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Clip;
