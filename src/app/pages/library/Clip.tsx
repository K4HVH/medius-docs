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
          frame into the same injection state your live <A href="/library/move"><code>move</code></A> and{' '}
          <A href="/library/inject"><code>inject</code></A> calls feed. Playback is box-clocked, so it carries
          no host scheduling jitter. It's field-generic (mouse, keyboard, and media in one clip) and backs
          the <A href="/native/commands/clip"><code>CLIP</code></A> commands.
        </p>
        <pre class="diagram">{`  1. build a clip with ClipBuilder
       clip.move_by(10, 0)
       clip.press(Button::Left)
       clip.gap(20)
       clip.release(...)

  2. drive playback through a ClipHandle
       handle = device.clip();
       handle.append(&clip)     ──▶  copy the entries into the box's ring
       handle.start()           ──▶  box plays one entry per native frame
       handle.query_status()    ◀──  ring depth + progress + playback state
       handle.stop()            ──▶  stop (retained: rewind; streaming: flush)

  or let the box play it on a physical key, no host round-trip:
       handle.bind(ClipTrigger::new(Key::F1, Edge::Press, ClipAction::Start))`}</pre>
      </Card>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="clip" subtitle="Open a clip handle" />
          <pre class="api-signature">fn clip(&self) -&gt; ClipHandle</pre>
          <p>
            Returns a <A href="/library/clip#handle"><code>ClipHandle</code></A> bound to this box. The handle
            owns the append-sequence counter the box uses to spot a dropped append, so keep one handle for a
            clip session (top it up through that handle) rather than reopening one per append.
          </p>
          <div class="callout callout--info">
            <p>
              Playback lives in the box's RAM: a <A href="/library/admin#reboot">reboot</A> or{' '}
              <A href="/library/lifecycle#reconnect">reconnect</A> drops the loaded clip, so re-preload after one.
              The <A href="/library/clip#config">config</A> (auto-lock, loop, retain, and the trigger set) is
              re-asserted for you on reconnect. A clip needs a cloned mouse, since its frame clock is the
              mouse's report tick; keyboard and media edges ride that tick.
            </p>
          </div>
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
              <tr><td><code>gap(frames)</code></td><td>N idle frames (0 is a no-op).</td></tr>
              <tr><td><code>move_by(dx, dy)</code></td><td>a cursor-motion frame.</td></tr>
              <tr><td><code>wheel(dz)</code></td><td>a wheel frame.</td></tr>
              <tr><td><code>press / release / force_release(usage)</code></td><td>a one-frame press, soft-release, or force-release of any <A href="/library/types/enums#usage"><code>Usage</code></A> (button, key, or media), like <A href="/library/inject#inject"><code>Device::press</code></A>.</td></tr>
              <tr><td><code>edge(usage, action)</code></td><td>a one-edge frame for any <A href="/library/types/enums#usage"><code>Usage</code></A> with an explicit <A href="/library/types/enums#action"><code>Action</code></A>.</td></tr>
              <tr><td><code>frame(dx, dy, wheel, edges)</code></td><td>a motion delta plus up to 8 <A href="/library/types/enums#usage"><code>Usage</code></A> / <A href="/library/types/enums#action"><code>Action</code></A> edges on one frame.</td></tr>
            </tbody>
          </table>
          <p>
            <code>press</code>/<code>release</code>/<code>force_release</code> are wrappers over{' '}
            <code>edge</code>, which is a wrapper over <code>frame</code>. Reach for <code>frame</code> only
            when you need motion and edges (or several edges) on the same frame, e.g. moving while a button is
            held, which is how a faithful recording of "aim and hold fire" looks.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipBuilder, Button, Key};

let mut clip = ClipBuilder::new();
for _ in 0..200 { clip.move_by(10, 0); }   // 200 box-timed frames of +10 dx
clip.press(Button::Left)                   // a click, held for 20 frames
    .gap(20)
    .release(Button::Left);
clip.press(Key::A)                         // then type 'a'
    .gap(3)
    .release(Key::A);`}</code></pre>
        </Card>
      </div>

      <div id="handle" data-search-target>
        <Card>
          <CardHeader title="ClipHandle" subtitle="Fill the ring, configure, and drive playback" />
          <p>
            From <A href="/library/clip#clip"><code>Device::clip()</code></A>. Every method here except the two{' '}
            <A href="/library/clip#status">queries</A> is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>: it queues a frame and returns.
            The <A href="/library/lock">auto-lock</A>, loop, and retain settings and the trigger set are the
            clip's <A href="/library/clip#config">config</A>; the engine verbs drive playback.
          </p>
          <div class="api-response-label">LOAD &amp; SETTINGS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>append(clip: &amp;ClipBuilder)</code></td><td>Send a <A href="/library/clip#builder"><code>ClipBuilder</code></A>'s entries to the ring; splits a large clip into whole-entry frames with contiguous append seqs.</td></tr>
              <tr><td><code>set_autolock(scope: &amp;[Blanket])</code></td><td>Which <A href="/library/lock">input groups</A> to lock while playing (clip-owned, released on stop).</td></tr>
              <tr><td><code>set_loop(on: bool)</code></td><td>Loop playback at the clip end (retained mode only).</td></tr>
              <tr><td><code>set_retain(on: bool)</code></td><td>Retain the clip so it can rewind and replay (<code>false</code> = streaming, the default). Set before the first <code>append</code>.</td></tr>
              <tr><td><code>finalize()</code></td><td>Close a retained clip: fix its end so it can replay and loop.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TRIGGERS (a managed set)</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>bind(trigger: <A href="/library/types/structs#clip-trigger">ClipTrigger</A>)</code></td><td>Add or overwrite a binding: a physical edge drives an action on the box, no host round-trip.</td></tr>
              <tr><td><code>unbind(usage, edge: <A href="/library/types/enums#edge">Edge</A>)</code></td><td>Remove the binding on that usage and edge.</td></tr>
              <tr><td><code>clear_triggers()</code></td><td>Remove every binding.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ENGINE VERBS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>start()</code></td><td>Rewind to the clip start and play (resume from a pause).</td></tr>
              <tr><td><code>stop()</code></td><td>Stop, release held input and the clip lock; a streaming clip flushes, a retained clip rewinds and is kept.</td></tr>
              <tr><td><code>pause()</code> / <code>resume()</code></td><td>Halt mid-clip keeping the cursor and held input / continue from the paused cursor.</td></tr>
              <tr><td><code>restart()</code></td><td>Force a rewind and play, even mid-playback.</td></tr>
              <tr><td><code>toggle()</code></td><td>Play if idle/paused, stop if playing.</td></tr>
              <tr><td><code>clear()</code></td><td>Discard the loaded clip, free the ring, clear a fault.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A dropped append (or an overflow) leaves the clip{' '}
              <A href="/library/types/enums#clip-state"><code>ClipState::Faulted</code></A> and stops it.
              Recover with <code>clear</code> and rebuild, not by appending more; a faulted stream has a hole
              in it.
            </p>
          </div>
        </Card>
      </div>

      <div id="modes" data-search-target>
        <Card>
          <CardHeader title="Streaming and retained" subtitle="Drain-and-discard, or keep-and-replay" />
          <p>
            <b>Streaming</b> is the default: the box drains and reclaims as it plays, so the clip is unbounded
            (top it up in real time) but not replayable, and <code>stop</code> flushes it. <b>Retained</b> mode
            (<code>set_retain(true)</code> before the first <code>append</code>) keeps the whole loaded clip
            (up to 64 KiB) and advances a play cursor, so it rewinds and replays; <code>finalize</code> fixes
            its end, which is what enables a real end-of-clip, <code>loop</code>, and a physical play/stop
            replay loop. Append after <code>finalize</code> is rejected, so reload with <code>clear</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Streaming: preload, play with auto-lock, and top up in real time, pacing against <code>free</code>:</p>
          <pre><code class="language-rust">{`use medius::{Blanket, ClipState};
use std::time::Duration;

let handle = device.clip();       // device: an open Device
handle.set_autolock(&[Blanket::Aim])?;   // lock only the aim axes while playing
handle.append(&clip)?;                    // preload (clip, next_chunk: ClipBuilders you built)
handle.start()?;

loop {
    let s = handle.query_status()?;
    if s.state == ClipState::Idle { break; }           // done, or stopped
    if s.free as usize > next_chunk.as_bytes().len() {
        handle.append(&next_chunk)?;                   // stream more while there's room
    }
    std::thread::sleep(Duration::from_millis(5));
}
handle.stop()?;`}</code></pre>
        </Card>
      </div>

      <div id="triggers" data-search-target>
        <Card>
          <CardHeader title="Triggers" subtitle="Play, stop, or toggle on a physical key" />
          <p>
            A <A href="/library/types/structs#clip-trigger"><code>ClipTrigger</code></A> binds an{' '}
            <A href="/library/types/enums#edge"><code>Edge</code></A> of a usage to a{' '}
            <A href="/library/types/enums#clip-action"><code>ClipAction</code></A>, so the box drives playback
            itself with no host round-trip. Bindings are a managed set keyed by <code>(usage, edge)</code>,
            like a <A href="/library/lock">lock</A>: <code>bind</code> adds, <code>unbind</code> drops,{' '}
            <code>clear_triggers</code> wipes, and a physical edge runs the one most-specific match (a key for{' '}
            <code>F1</code> beats an any-key binding). <code>.consume()</code> suppresses the trigger input
            from the game for the length of the hold.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, ClipAction, ClipTrigger, Edge, Key};

let clip = device.clip();
clip.set_retain(true)?;      // set the mode before loading
clip.append(&recording)?;
clip.finalize()?;            // close it so it can replay

// Hold-to-play: F1 down starts, F1 up stops. Consume F1 so the game never sees it.
clip.bind(ClipTrigger::new(Key::F1, Edge::Press, ClipAction::Start).consume())?;
clip.bind(ClipTrigger::new(Key::F1, Edge::Release, ClipAction::Stop).consume())?;

// Or one side-button that toggles play/stop:
clip.bind(ClipTrigger::new(Button::Side1, Edge::Press, ClipAction::Toggle))?;`}</code></pre>
        </Card>
      </div>

      <div id="status" data-search-target>
        <Card>
          <CardHeader title="query_status" subtitle="Ring depth, progress, and playback counters" />
          <pre class="api-signature">fn query_status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Reads a <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A>. Pace top-ups off{' '}
            <code>free</code>, watch <code>state</code> for the{' '}
            <A href="/library/types/enums#clip-state"><code>Faulted</code></A> re-sync signal or for playback
            reaching <code>Idle</code>, and use <code>played</code>/<code>total</code> for retained progress.
            Backs <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
          </p>
          <div class="api-response-label">FIELDS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>state</code></td><td><A href="/library/types/enums#clip-state"><code>ClipState</code></A></td><td>idle / playing / paused / faulted.</td></tr>
              <tr><td><code>free</code></td><td><code>u32</code></td><td>ring bytes free.</td></tr>
              <tr><td><code>total</code></td><td><code>u32</code></td><td>retained clip size (streaming: buffered-but-undrained bytes).</td></tr>
              <tr><td><code>played</code></td><td><code>u32</code></td><td>bytes played from the clip start (retained progress; ~0 while streaming).</td></tr>
              <tr><td><code>ticks</code></td><td><code>u32</code></td><td>content frames drained since the last start (gap runs excluded).</td></tr>
              <tr><td><code>underruns</code></td><td><code>u16</code></td><td>times the ring ran dry mid-playback.</td></tr>
              <tr><td><code>overruns</code></td><td><code>u16</code></td><td>appends dropped because the ring was full.</td></tr>
              <tr><td><code>seq_gaps</code></td><td><code>u16</code></td><td>dropped append frames detected.</td></tr>
              <tr><td><code>held</code></td><td><code>Vec&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code></td><td>the usages the clip is holding down (buttons, keys, and media in one list); test one with <code>is_held(usage)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="config" data-search-target>
        <Card>
          <CardHeader title="query_config" subtitle="Read the config back" />
          <pre class="api-signature">fn query_config(&self) -&gt; Result&lt;ClipSettings&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            The config view of the same <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>{' '}
            frame <A href="/library/clip#status"><code>query_status</code></A> reads: a{' '}
            <A href="/library/types/structs#clip-settings"><code>ClipSettings</code></A> with the auto-lock,
            loop, retain, finalized flag, and <A href="/library/clip#triggers">triggers</A> you set. Nothing
            is write-only; every setting round-trips.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let cfg = handle.query_config()?;
println!("{} triggers, loop={}", cfg.triggers.len(), cfg.loop_);`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="AsyncClipHandle: control fires, queries await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice::clip()</code></A> returns an{' '}
            <code>AsyncClipHandle</code> that keeps <code>append</code>, the settings, and the engine verbs
            synchronous (they just queue a frame), while <code>query_status().await</code> and{' '}
            <code>query_config().await</code> are futures like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let device = Device::find()?.into_async();
let handle = device.clip();
handle.append(&clip)?;          // sync, no await
handle.start()?;                // sync
let s = handle.query_status().await?;   // the query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Clip;
