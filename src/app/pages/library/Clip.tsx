import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Clip: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Clip" subtitle="Preload input and let the box play it back" />
        <p>
          Build a sequence of per-frame input with a{' '}
          <A href="/library/clip#builder"><code>ClipBuilder</code></A>, hand it to the{' '}
          <A href="/library/clip#handle"><code>ClipHandle</code></A> from{' '}
          <A href="/library/clip#clip"><code>Device::clip()</code></A>, and the box drains one entry per native
          frame into the same injection state your live <A href="/library/move">move</A> and{' '}
          <A href="/library/inject">inject</A> calls feed. Playback is clocked by the box, so it carries none of
          the host's scheduling jitter and none of the per-command send floor: this is how you play a{' '}
          frame-exact motion path or a canned macro. It is field-generic (mouse, keyboard, and media in one
          clip) and backs the <A href="/native/commands/clip"><code>CLIP</code></A> commands.
        </p>
        <pre class="diagram">{`  ClipBuilder                 ClipHandle = device.clip()          box
  ------------                 -------------------------           ---
  clip.move_by(10, 0)          handle.append(&clip)   --------->  ring fills
  clip.press(Button::Left)     handle.start()         --------->  plays 1 / frame
  clip.gap(20)          -->     handle.status()        <---------  free / used / state
  clip.release(...)            handle.stop()`}</pre>
      </Card>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="clip" subtitle="Open a clip handle" />
          <pre class="api-signature">fn clip(&self) -&gt; ClipHandle</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Returns a <A href="/library/clip#handle"><code>ClipHandle</code></A> bound to this box. The handle
            owns the append-sequence counter the box uses to spot a dropped append, so keep one handle for a
            clip session (top it up through that handle) rather than reopening one per append. Playback lives
            in the box's RAM: a reboot or reconnect drops it, so re-preload after one. A clip needs a cloned
            mouse (its frame clock is the mouse's report tick); keyboard and media edges ride that tick.
          </p>
        </Card>
      </div>

      <div id="builder" data-search-target>
        <Card>
          <CardHeader title="ClipBuilder" subtitle="Build the entry stream" />
          <pre class="api-signature">fn new() -&gt; ClipBuilder</pre>
          <p>
            Each method appends one per-frame entry, so a builder is a timeline read top to bottom. Motion is
            a relative delta; an edge (button, key, or media) is an{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> that stays held until a later frame
            changes it; a <code>gap</code> is N idle frames (the box NAKs, like an idle mouse). The methods
            take <code>&amp;mut self</code> and return <code>&amp;mut Self</code>, so chain them or push in a
            loop; <code>clear()</code> reuses the allocation.
          </p>
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Appends</th></tr>
            </thead>
            <tbody>
              <tr><td><code>gap(frames: u16)</code></td><td>N idle frames (0 is a no-op).</td></tr>
              <tr><td><code>move_by(dx, dy)</code></td><td>a cursor-motion frame.</td></tr>
              <tr><td><code>wheel(dz)</code></td><td>a wheel frame.</td></tr>
              <tr><td><code>press / release / force_release(button: Button)</code></td><td>a one-button frame (press, soft-release, force-release).</td></tr>
              <tr><td><code>key(key: Key, action: Action)</code></td><td>a one-key frame.</td></tr>
              <tr><td><code>media(media: MediaKey, action: Action)</code></td><td>a one-media frame.</td></tr>
              <tr><td><code>edge(input, action: Action)</code></td><td>a one-edge frame for any <A href="/library/types/enums#input"><code>Input</code></A> class.</td></tr>
              <tr><td><code>frame(dx, dy, wheel, &amp;[(Input, Action)])</code></td><td>a motion delta plus up to 8 edges, all on one frame.</td></tr>
            </tbody>
          </table>
          <p>
            <code>press</code>/<code>release</code>/<code>key</code>/<code>media</code> are wrappers over{' '}
            <code>edge</code>, which is a wrapper over <code>frame</code>. Reach for <code>frame</code> only
            when you need motion and edges (or several edges) on the same frame, e.g. moving while a button is
            held, which is how a faithful recording of "aim and hold fire" looks.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipBuilder, Button, Key, Action};

let mut clip = ClipBuilder::new();
for _ in 0..200 { clip.move_by(10, 0); }   // 200 box-timed frames of +10 dx
clip.press(Button::Left)                   // a click, held for 20 frames
    .gap(20)
    .release(Button::Left);
clip.key(Key::A, Action::Press)            // then type 'a'
    .gap(3)
    .key(Key::A, Action::SoftRelease);`}</code></pre>
        </Card>
      </div>

      <div id="handle" data-search-target>
        <Card>
          <CardHeader title="ClipHandle" subtitle="Fill the ring and drive playback" />
          <p>
            From <A href="/library/clip#clip"><code>Device::clip()</code></A>. Every method here except{' '}
            <A href="/library/clip#status"><code>status</code></A> is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>: it queues a frame and returns.
          </p>
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>append(&amp;ClipBuilder)</code></td><td>Send the builder's entries to the ring; splits a large clip into whole-entry frames with contiguous append seqs.</td></tr>
              <tr><td><code>start()</code></td><td>Play from the ring head.</td></tr>
              <tr><td><code>start_autolock()</code></td><td>Play, and lock all physical input the host hasn't already locked, released on <code>stop</code>.</td></tr>
              <tr><td><code>stop()</code></td><td>Stop, flush the ring, release the clip's lock.</td></tr>
              <tr><td><code>config(autolock: bool)</code></td><td>Set whether a catch-triggered <code>start</code> auto-locks, without starting.</td></tr>
              <tr><td><code>arm_catch(Option&lt;Button&gt;)</code></td><td>Fire <code>start</code> on the box on a physical press of that button (any if <code>None</code>), no host round-trip.</td></tr>
              <tr><td><code>disarm()</code></td><td>Clear a pending catch-arm.</td></tr>
              <tr><td><code>status()</code></td><td>Read the ring depth and playback state (blocks); see <A href="/library/clip#status">below</A>.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A dropped append (or an overflow) leaves the clip{' '}
              <A href="/library/types/enums#clip-state"><code>ClipState::Faulted</code></A>. Recover by
              <code>stop</code>-ping and rebuilding, not by appending more; a faulted stream has a hole in it.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <p>Preload, play with auto-lock, and top up in real time, pacing against <code>free</code>:</p>
          <pre><code class="language-rust">{`use medius::ClipState;
use std::time::Duration;

let handle = device.clip();     // device: an open Device
handle.append(&clip)?;          // preload (clip, next_chunk: ClipBuilders you built)
handle.start_autolock()?;       // play, and block the user's hand for the duration

loop {
    let s = handle.status()?;
    if s.state != ClipState::Playing { break; }        // done, or faulted
    if s.free as usize > next_chunk.as_bytes().len() {
        handle.append(&next_chunk)?;                   // stream more while there's room
    }
    std::thread::sleep(Duration::from_millis(5));
}
handle.stop()?;`}</code></pre>
        </Card>
      </div>

      <div id="status" data-search-target>
        <Card>
          <CardHeader title="status" subtitle="Ring depth and playback counters" />
          <pre class="api-signature">fn status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Reads a <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A>. Pace top-ups off{' '}
            <code>free</code> (append only when it exceeds what you'll push), watch <code>state</code> for the{' '}
            <A href="/library/types/enums#clip-state"><code>Faulted</code></A> re-sync signal or for playback
            reaching <code>Idle</code>, and use the <code>underruns</code>/<code>overruns</code>/{' '}
            <code>seq_gaps</code> counters to tell whether you're feeding it fast enough. Backs{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
          </p>
          <div class="api-response-label">FIELDS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>state</code></td><td><A href="/library/types/enums#clip-state"><code>ClipState</code></A></td><td>idle / armed / playing / faulted.</td></tr>
              <tr><td><code>free</code> / <code>used</code></td><td><code>u32</code></td><td>ring bytes free (pace top-ups off this) / buffered.</td></tr>
              <tr><td><code>ticks</code></td><td><code>u32</code></td><td>entries played since the last start.</td></tr>
              <tr><td><code>underruns</code> / <code>overruns</code> / <code>seq_gaps</code></td><td><code>u16</code></td><td>ran dry / append didn't fit / dropped append frames.</td></tr>
              <tr><td><code>held</code></td><td><code>bool</code></td><td>a catch-trigger button is currently held.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="AsyncClipHandle: control fires, status awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice::clip()</code></A> returns an{' '}
            <code>AsyncClipHandle</code> that keeps <code>append</code> and the control methods synchronous
            (they just queue a frame), while <code>status().await</code> is a future like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let device = Device::find()?.into_async();
let handle = device.clip();
handle.append(&clip)?;          // sync, no await
handle.start()?;
let s = handle.status().await?; // the query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
