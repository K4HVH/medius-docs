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
          <A href="/library/clip#clip"><code>Device::clip()</code></A>, and the box drains it into the same
          injection state <A href="/library/move"><code>move</code></A> and{' '}
          <A href="/library/inject"><code>inject</code></A> feed.
        </p>
        <p>
          Playback is box-clocked, so it carries no host scheduling jitter. One clip covers mouse,
          keyboard, media, raw reports, and control transfers. Backs the{' '}
          <A href="/native/commands/clip"><code>CLIP</code></A> commands.
        </p>
        <pre class="diagram">{`  1. build a clip with ClipBuilder
       clip.move_by(10, 0)
       clip.press(Button::LEFT)
       clip.gap(20)
       clip.release(...)

  2. drive playback through a ClipHandle
       handle = device.clip();
       handle.append(&clip)     -->  copy the entries into the box's ring
       handle.start()           -->  box plays one entry per native frame
       handle.query_status()    <--  ring depth + progress + playback state
       handle.stop()            -->  stop (retained: rewind; streaming: flush)

  or let the box play it on a physical key or a matched packet, no host round-trip:
       handle.bind(ClipTrigger::new(Key::F1, Edge::Press, ClipAction::Start))
       handle.bind_packet(&ClipPacketTrigger::new(
           TrafficClass::HidIn, 2, Direction::IN, ClipAction::Start))`}</pre>
      </Card>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="clip" subtitle="Open a clip handle" />
          <pre class="api-signature">fn clip(&self) -&gt; ClipHandle</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            Returns a <A href="/library/clip#handle"><code>ClipHandle</code></A> bound to this box. Keep one
            per clip session: it owns the append-sequence counter the box uses to spot a dropped append.
          </p>
          <div class="callout callout--info">
            <p>
              A clip plays on any clone. The{' '}
              <A href="/library/guides/connection#keepalive">keepalive</A> holds a loaded clip, its
              settings, and its triggers of both kinds past the silence window; a link down for
              longer clears them on the box, so reload the clip and its config.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              The ring is 64 KB on a box with PSRAM and 16 KB on one without, so never assume a
              size: <code>ClipStatus::free</code> on a cleared ring is the size.
            </p>
          </div>
        </Card>
      </div>

      <div id="builder" data-search-target>
        <Card>
          <CardHeader title="ClipBuilder" subtitle="Build the entry stream" />
          <pre class="api-signature">fn new() -&gt; ClipBuilder</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            Each method appends one per-frame entry, so a builder is a timeline read top to bottom. Motion is
            a relative delta; an edge is an{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> that stays held until a later frame
            changes it; a <code>gap</code> NAKs like an idle mouse.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Appends</th></tr>
            </thead>
            <tbody>
              <tr><td><code>gap(frames)</code></td><td>N idle frames (0 is a no-op).</td></tr>
              <tr><td><code>move_by(dx, dy)</code></td><td>a cursor-motion frame.</td></tr>
              <tr><td><code>wheel(dz)</code></td><td>a wheel frame.</td></tr>
              <tr><td><code>pan(dpan)</code></td><td>a pan (horizontal scroll) frame.</td></tr>
              <tr><td><code>press / release / force_release(usage)</code></td><td>a one-frame press, soft-release, or force-release of any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or media), like <A href="/library/inject#inject"><code>Device::press</code></A>.</td></tr>
              <tr><td><code>edge(usage, action)</code></td><td>a one-edge frame for any <A href="/library/types/structs#usage"><code>Usage</code></A> with an explicit <A href="/library/types/enums#action"><code>Action</code></A>.</td></tr>
              <tr><td><code>raw(ep, direction, bytes)</code></td><td>a frame carrying one raw report.</td></tr>
              <tr><td><code>transfer(ep, setup, out)</code></td><td>a frame carrying one control transfer.</td></tr>
              <tr><td><code>frame(frame)</code></td><td>one frame carrying whatever a <A href="/library/clip#frame"><code>ClipFrame</code></A> holds.</td></tr>
            </tbody>
          </table>
          <p>
            They take <code>&amp;mut self</code> and return <code>&amp;mut Self</code>, so chain them
            or push in a loop; <code>clear()</code> reuses the allocation, and <code>byte_len()</code> is
            the ring space the entries take. Each one-field call wraps <code>frame</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{ClipBuilder, Button, Key};

let mut clip = ClipBuilder::new();
for _ in 0..200 { clip.move_by(10, 0); }   // 200 box-timed frames of +10 dx
clip.press(Button::LEFT)                   // a click, held for 20 frames
    .gap(20)
    .release(Button::LEFT);
clip.press(Key::A)                         // then type 'a'
    .gap(3)
    .release(Key::A);`}</code></pre>
          <p>
            <code>frame</code> fills more than one field, so a move and an edge share one entry and one
            wire report.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, ClipBuilder, ClipFrame};

let mut clip = ClipBuilder::new();

// move (+10, -4) AND press Left on the same frame
clip.frame(ClipFrame::new().move_by(10, -4).press(Button::LEFT));

// press once, keep moving while held, then release
clip.frame(ClipFrame::new().move_by(8, -2).press(Button::LEFT));
for _ in 0..60 { clip.move_by(8, -2); }   // Left stays down (edges are sticky)
clip.release(Button::LEFT);`}</code></pre>
        </Card>
      </div>

      <div id="frame" data-search-target>
        <Card>
          <CardHeader title="ClipFrame" subtitle="Build one multi-field frame" />
          <pre class="api-signature">fn new() -&gt; ClipFrame</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <p>
            One frame carries any mix of motion, edges, raw reports, and control transfers, up to 512
            encoded bytes (<code>CLIP_ENTRY_MAX</code>). Each method takes <code>self</code> and returns
            the frame.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>move_by(dx, dy)</code></td><td>Set the cursor motion, a relative delta.</td></tr>
              <tr><td><code>wheel(dz)</code> / <code>pan(dpan)</code></td><td>Set the wheel or the pan (horizontal scroll) motion.</td></tr>
              <tr><td><code>press / release / force_release(usage)</code></td><td>Add a press, soft-release, or force-release edge of any <A href="/library/types/structs#usage"><code>Usage</code></A>.</td></tr>
              <tr><td><code>edge(usage, action)</code></td><td>Add an edge with an explicit <A href="/library/types/enums#action"><code>Action</code></A>. A frame holds up to 8 (<code>CLIP_EDGES_MAX</code>).</td></tr>
              <tr><td><code>raw(ep, direction, bytes)</code></td><td>Add a raw report, as <A href="/library/advanced/raw#raw"><code>Device::raw</code></A> sends one. A frame holds up to 8 (<code>CLIP_RAW_MAX</code>), sent in order ahead of the frame's report.</td></tr>
              <tr><td><code>transfer(ep, setup, out)</code></td><td>Add a control transfer, as <A href="/library/advanced/transfer#transfer"><code>Device::transfer</code></A> runs one: <code>out</code> is <code>setup.length</code> bytes for an OUT request, empty for an IN one. Each answer is a <A href="/library/types/enums#traffic-class"><code>TrafficClass::ClipTransfer</code></A> catch event.</td></tr>
              <tr><td><code>byte_len()</code></td><td>The ring bytes the frame takes, at most 512 for a frame <code>append</code> accepts.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              Raw reports and transfers need the imperfect-clone opt-in as the frame plays. With{' '}
              <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
              off, the box discards them and counts each in{' '}
              <A href="/library/types/structs#clip-status"><code>ClipStatus::gated</code></A>.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, ClipBuilder, ClipFrame, Direction, Setup};

let mut clip = ClipBuilder::new();
clip.frame(
    ClipFrame::new()
        .move_by(4, -2)
        .press(Button::LEFT)
        .raw(2, Direction::OUT, [0x10, 0xFF, 0x05])
        .transfer(0, Setup::new(0x21, 0x09, 0x0300, 0, 2), [0x04, 0x01]),
);
device.clip().append(&clip)?;`}</code></pre>
        </Card>
      </div>

      <div id="handle" data-search-target>
        <Card>
          <CardHeader title="ClipHandle" subtitle="Fill the ring, configure, and drive playback" />
          <p>
            From <A href="/library/clip#clip"><code>Device::clip()</code></A>. Every method below is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>: it queues a frame and returns.{' '}
            <A href="/library/requests#clip-status"><code>query_status</code></A> reads the ring depth and
            playback state; <A href="/library/requests#clip-config"><code>query_config</code></A> reads
            the config back.
          </p>
          <div class="api-response-label">LOAD AND SETTINGS</div>
          <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>append(clip: &amp;ClipBuilder)</code></td><td>Send a <A href="/library/clip#builder"><code>ClipBuilder</code></A>'s entries to the ring; splits a large clip into whole-entry frames with contiguous append seqs. Every entry is checked first, so a <A href="/library/types/errors#errors">refusal</A> sends nothing.</td></tr>
              <tr><td><code>set_autolock(scope: &amp;[Blanket])</code></td><td>Which <A href="/library/lock">input groups</A> to lock while playing (clip-owned, released on stop).</td></tr>
              <tr><td><code>set_loop(on: bool)</code></td><td>Loop playback at the clip end (retained mode only).</td></tr>
              <tr><td><code>set_retain(on: bool)</code></td><td>Retain the clip so it can rewind and replay (<code>false</code> = streaming, the default). Set before the first <code>append</code>.</td></tr>
              <tr><td><code>set_ride(on: bool)</code></td><td>Make the clip's motion wait for a real move under <A href="/library/options#set-movement-riding">movement riding</A> (<code>false</code> = the box's own clock, the default). Changeable mid-playback. Only its wheel and pan while rendering is on with a profile armed.</td></tr>
              <tr><td><code>finalize()</code></td><td>Close a retained clip: fix its end so it can replay and loop.</td></tr>
            </tbody>
          </table>
          </div>
          <div class="api-response-label">TRIGGERS</div>
          <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>bind(trigger: <A href="/library/types/structs#clip-trigger">ClipTrigger</A>)</code></td><td>Add or overwrite an <A href="/library/clip#input-triggers">input trigger</A>: a physical edge drives an action on the box, no host round-trip.</td></tr>
              <tr><td><code>unbind(usage, edge: <A href="/library/types/enums#edge">Edge</A>)</code></td><td>Remove the input trigger on that usage and edge.</td></tr>
              <tr><td><code>bind_packet(trigger: &amp;<A href="/library/types/structs#clip-packet-trigger">ClipPacketTrigger</A>)</code></td><td>Add or overwrite a <A href="/library/clip#packet-triggers">packet trigger</A>: a matched packet drives an action on the box's next tick.</td></tr>
              <tr><td><code>unbind_packet(trigger: &amp;ClipPacketTrigger)</code></td><td>Remove the packet trigger with that trigger's key; its action, <code>consume</code> and <code>once_per_run</code> are ignored. A key the box cannot hold is refused as <code>bind_packet</code> refuses it.</td></tr>
              <tr><td><code>clear_triggers()</code></td><td>Remove every trigger of both kinds.</td></tr>
            </tbody>
          </table>
          </div>
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
              Recover with <code>clear</code> and rebuild, not by appending more; a faulted stream is missing entries.
            </p>
          </div>
        </Card>
      </div>

      <div id="modes" data-search-target>
        <Card>
          <CardHeader title="Streaming and retained" subtitle="Drain-and-discard, or keep-and-replay" />
          <p>
            A clip runs in one of two shapes, chosen by{' '}
            <A href="/library/clip#handle"><code>set_retain</code></A> before the first{' '}
            <A href="/library/clip#handle"><code>append</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Aspect</th><th>Streaming (default)</th><th>Retained</th></tr>
            </thead>
            <tbody>
              <tr><td>Turn on</td><td>nothing, it's the default</td><td><code>set_retain(true)</code> before the first <code>append</code></td></tr>
              <tr><td>The ring</td><td>each entry is freed as it plays, so it's unbounded</td><td>entries are kept after playing, up to 64 KiB</td></tr>
              <tr><td>Top up mid-play</td><td>yes, append to the tail in real time</td><td>append until <code>finalize</code>, then it's sealed</td></tr>
              <tr><td>Replay</td><td>no, it plays once</td><td>yes, it rewinds and replays</td></tr>
              <tr><td><code>loop</code></td><td>not available</td><td>available once <code>finalize</code>d</td></tr>
              <tr><td><code>stop</code></td><td>flushes the buffer</td><td>rewinds and keeps the clip</td></tr>
              <tr><td>Best for</td><td>open-ended or generated input</td><td>a fixed macro you replay on a trigger</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`streaming (drain-and-discard)
    append --> [ e4 e3 e2 ] --> play --> freed     (unbounded, top up forever)
                   box reclaims each entry once played; no replay

retained (keep-and-replay, up to 64 KiB)
    append --> [ e0 e1 e2 e3 e4 ] --> finalize --> sealed
               base |--> play cursor --> end
                    +---- start / loop rewinds to base <----+`}</pre>
          <div class="callout callout--info">
            <p>
              <code>set_retain</code> only takes effect before the first <code>append</code>, and an{' '}
              <code>append</code> after <code>finalize</code> is rejected. To reload a retained clip,{' '}
              <A href="/library/clip#handle"><code>clear</code></A> it and build again.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`// Streaming: preload, play with auto-lock, then top up in real time, pacing against free.
use medius::{Blanket, ClipState};
use std::time::Duration;

let handle = device.clip();       // device: an open Device
handle.set_autolock(&[Blanket::Aim])?;   // lock only X and Y while playing
handle.append(&clip)?;                    // preload (clip, next_chunk: ClipBuilders you built)
handle.start()?;

loop {
    let s = handle.query_status()?;
    if s.state == ClipState::Idle { break; }           // done, or stopped
    if s.free as usize > next_chunk.byte_len() {
        handle.append(&next_chunk)?;                   // stream more while there's room
    }
    std::thread::sleep(Duration::from_millis(5));
}
handle.stop()?;`}</code></pre>
        </Card>
      </div>

      <div id="triggers" data-search-target>
        <Card>
          <CardHeader title="Triggers" subtitle="Run a clip action on a physical edge or a matched packet" />
          <p>
            A trigger runs one{' '}
            <A href="/library/types/enums#clip-action"><code>ClipAction</code></A> on the box, with no
            host round-trip. One set holds two kinds: an input trigger fires on a button, key, or
            media edge, and a packet trigger fires on a packet crossing a traffic surface.
          </p>
          <pre class="diagram">{`  a physical edge                 a packet at a traffic surface
  button, key, media              HidIn, HidOut, VendorInterrupt,
        |                         VendorBulk, Control, Emit
        v                               |
  [ input triggers ]  8                 v
    bind, unbind                  [ packet triggers ]  8
        |                           bind_packet, unbind_packet
        | action                        | action       | packet
        v                               v              v
        +-----> ClipAction <------------+        [ rewrite table ]
                run on the box                     sees it next, unless
                                                   the trigger consumed it
                                                       |
                                                       v
                                                   delivered`}</pre>
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Aspect</th><th>Input trigger</th><th>Packet trigger</th></tr>
              </thead>
              <tbody>
                <tr><td>Type</td><td><A href="/library/types/structs#clip-trigger"><code>ClipTrigger</code></A></td><td><A href="/library/types/structs#clip-packet-trigger"><code>ClipPacketTrigger</code></A></td></tr>
                <tr><td>Fires on</td><td>a press or release edge of a button, key, or media usage</td><td>a packet on a traffic surface, by a masked head compare</td></tr>
                <tr><td>Key</td><td>usage and edge</td><td>class, id, direction, match and mask</td></tr>
                <tr><td>The box holds</td><td>8</td><td>8, with 112 match bytes between them</td></tr>
                <tr><td><code>.consume()</code></td><td>locks the usage for the hold</td><td>drops every packet the trigger wins; needs the imperfect-clone opt-in</td></tr>
                <tr><td>Calls</td><td><code>bind</code>, <code>unbind</code></td><td><code>bind_packet</code>, <code>unbind_packet</code></td></tr>
                <tr><td>Reads back in</td><td><A href="/library/types/structs#clip-settings"><code>triggers</code></A></td><td><code>packet_triggers</code>, each with its <code>hits</code></td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              The <A href="/library/guides/connection#keepalive">keepalive</A> holds a bound trigger
              of either kind past the silence window. A reconnect re-sends neither kind: a trigger
              stands through a link drop shorter than that window, and a longer one clears the set on
              the box.
            </p>
          </div>

          <div id="input-triggers" data-search-target>
            <div class="api-response-label">INPUT TRIGGERS</div>
            <table class="api-params">
              <thead>
                <tr><th>Part</th><th>Is</th><th>Example</th></tr>
              </thead>
              <tbody>
                <tr><td>usage</td><td>the button, key, or media the edge is on (or any of a class)</td><td><code>Key::F1</code></td></tr>
                <tr><td>edge</td><td>which transition fires it: press, release, or both</td><td><code>Edge::Press</code></td></tr>
                <tr><td>action</td><td>the engine verb to run</td><td><code>ClipAction::Start</code></td></tr>
              </tbody>
            </table>
            <p>
              Input triggers are a managed set keyed by <code>(usage, edge)</code>, like a{' '}
              <A href="/library/lock">lock</A>. A physical edge runs the one most-specific match, so a
              trigger on <code>Key::F1</code> resolves before an any-key one.
            </p>
            <table class="api-params">
              <thead>
                <tr><th>To get</th><th>Bind</th></tr>
              </thead>
              <tbody>
                <tr><td>Hold to play</td><td><code>F1 Press -&gt; Start</code> and <code>F1 Release -&gt; Stop</code></td></tr>
                <tr><td>Toggle play/stop on one key</td><td><code>Side1 Press -&gt; Toggle</code></td></tr>
                <tr><td>Separate play and stop keys</td><td><code>F1 Press -&gt; Start</code> and <code>F2 Press -&gt; Stop</code></td></tr>
                <tr><td>Pause, then resume</td><td><code>F3 Press -&gt; Pause</code> and <code>F4 Press -&gt; Resume</code></td></tr>
              </tbody>
            </table>
            <div class="callout callout--info">
              <p>
                <code>.consume()</code> locks the trigger usage while it stays active. It applies to the
                press edge only, so a <code>Edge::Release</code> binding carries the flag with no effect.
              </p>
            </div>
            <div class="api-response-label">EXAMPLE</div>
            <pre><code class="language-rust">{`use medius::{Button, ClipAction, ClipTrigger, Edge, Key};

let clip = device.clip();
clip.set_retain(true)?;      // set the mode before loading
clip.append(&recording)?;
clip.finalize()?;            // close it so it can replay

// Hold-to-play: F1 down starts, F1 up stops. The press binding's consume locks F1
// for the whole hold, so the release binding does not need one.
clip.bind(ClipTrigger::new(Key::F1, Edge::Press, ClipAction::Start).consume())?;
clip.bind(ClipTrigger::new(Key::F1, Edge::Release, ClipAction::Stop))?;

// Or one side-button that toggles play/stop:
clip.bind(ClipTrigger::new(Button::SIDE1, Edge::Press, ClipAction::Toggle))?;`}</code></pre>
          </div>

          <div id="packet-triggers" data-search-target>
            <div class="api-response-label">PACKET TRIGGERS</div>
            <p>
              The box reads a packet for its triggers as the packet arrived, ahead of the{' '}
              <A href="/library/advanced/rewrite">rewrite table</A>, and the two are independent: one
              packet can fire a trigger and win a rule. The box's rules are on{' '}
              <A href="/native/commands/clip#packet-triggers"><code>CLIP_TRIGGER</code></A>.
            </p>
            <table class="api-params">
              <thead>
                <tr><th>Part</th><th>Is</th></tr>
              </thead>
              <tbody>
                <tr><td>address</td><td>the <A href="/library/types/enums#traffic-class"><code>TrafficClass</code></A>, the id within it (the interface number for <code>HidIn</code>, the endpoint number for the rest, or <code>ANY_ID</code>), and the <A href="/library/types/enums#direction"><code>Direction</code></A></td></tr>
                <tr><td>action</td><td>the engine verb to run, on the box's next tick</td></tr>
                <tr><td><code>.matching()</code></td><td>head bytes and their mask, one length, 16 at most; left out, every packet on the address matches</td></tr>
                <tr><td><code>.consume()</code></td><td>drop every packet the trigger wins, whether or not the action runs on it</td></tr>
                <tr><td><code>.once_per_run()</code></td><td>run the action on the first packet of a run of matching ones; the first <code>selector_len</code> match bytes select the stream, such as a report ID, and the rest are the condition</td></tr>
              </tbody>
            </table>
            <table class="api-params">
              <thead>
                <tr><th>To get</th><th>Bind</th></tr>
              </thead>
              <tbody>
                <tr><td>Hold a vendor button to play</td><td>two <code>once_per_run</code> triggers: the pressed bytes to <code>Start</code>, the released bytes to <code>Stop</code></td></tr>
                <tr><td>Keep that button from the PC</td><td><code>.consume()</code> on the pressed trigger, under <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones(true)</code></A></td></tr>
                <tr><td>Restart when the PC writes a report</td><td><code>HidOut</code> or <code>Control</code>, <code>Direction::OUT</code>, to <code>Restart</code></td></tr>
              </tbody>
            </table>
            <div class="callout callout--info">
              <p>
                A run starts on the first matching packet the trigger sees. A trigger whose condition
                already holds when it is bound fires on the next packet, so on a device that reports
                every poll, one matching the at-rest bytes fires once when it is bound.
              </p>
            </div>
            <div class="api-response-label">REFUSED</div>
            <p>
              <code>bind_packet</code> returns{' '}
              <A href="/library/types/errors#errors"><code>Error::ClipPacketTrigger</code></A> before
              anything is sent; <code>reason</code> says which. A <code>With</code> or{' '}
              <code>Against</code> direction is <code>Error::RelativeDirection</code>.
            </p>
            <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Trigger</th><th>Why</th></tr>
              </thead>
              <tbody>
                <tr><td><code>Bus</code> or <code>ClipTransfer</code> as the class</td><td>Neither is a surface packets cross.</td></tr>
                <tr><td>a match and a mask of two lengths, or past 16 bytes (<code>PKT_MATCH_MAX</code>)</td><td>The box compares them byte for byte over the packet head.</td></tr>
                <tr><td>a match bit outside its mask</td><td>No packet can match it.</td></tr>
                <tr><td><code>Direction::OUT</code> on <code>HidIn</code> or <code>Emit</code>, <code>Direction::IN</code> on <code>HidOut</code></td><td>The class never carries that flow.</td></tr>
                <tr><td><code>.consume()</code> on <code>Control</code></td><td>A control transfer always runs to completion.</td></tr>
                <tr><td><code>.once_per_run()</code> on <code>Control</code>, with <code>ANY_ID</code>, or with <code>Direction::Both</code></td><td>A run is over one stream.</td></tr>
                <tr><td><code>.once_per_run()</code> with a selector at or past the match length, or condition bytes with no masked bit</td><td>The bytes past the selector are the condition, and one every packet meets never ends its run.</td></tr>
                <tr><td>a selector length without <code>.once_per_run()</code></td><td>Only a run has a stream to select.</td></tr>
              </tbody>
            </table>
            </div>
            <div class="callout callout--warning">
              <p>
                The box makes three checks <code>bind_packet</code> cannot: a consuming trigger needs{' '}
                <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones(true)</code></A>,
                the set holds 8 triggers (<code>CLIP_PKT_TRIG_MAX</code>), and their match bytes share
                a pool of 112 (<code>CLIP_PKT_MATCH_POOL</code>). A trigger the box refused is absent
                from <A href="/library/requests#clip-config"><code>query_config</code></A>, and turning
                the opt-in off removes the consuming ones.
              </p>
            </div>
            <div class="api-response-label">EXAMPLE</div>
            <pre><code class="language-rust">{`use medius::{ClipAction, ClipPacketTrigger, Direction, TrafficClass};

let clip = device.clip();

// Interface 2 is a vendor-page HID interface. Report ID 7 carries a button in bit 5 of its
// second byte, repeated every poll while held, so the report ID is the selector.
let held = ClipPacketTrigger::new(TrafficClass::HidIn, 2, Direction::IN, ClipAction::Start)
    .matching([0x07, 0x20], [0xFF, 0x20])
    .once_per_run(1);
let let_go = ClipPacketTrigger::new(TrafficClass::HidIn, 2, Direction::IN, ClipAction::Stop)
    .matching([0x07, 0x00], [0xFF, 0x20])
    .once_per_run(1);
clip.bind_packet(&held)?;
clip.bind_packet(&let_go)?;

// A SET_REPORT on EP0 restarts the clip. These three only watch, so they hold with
// the imperfect-clone opt-in off.
let set_report = ClipPacketTrigger::new(TrafficClass::Control, 0, Direction::OUT, ClipAction::Restart)
    .matching([0x21, 0x09], [0xFF, 0xFF]);
clip.bind_packet(&set_report)?;

// Consuming drops the report, so it needs the opt-in. Same key as held: it overwrites.
device.allow_imperfect_clones(true)?;
clip.bind_packet(&held.clone().consume())?;

// The box makes checks bind_packet cannot, so read the set back.
for e in clip.query_config()?.packet_triggers {
    println!("{:?} id {} -> {:?}, {} hits", e.trigger.class, e.trigger.id, e.trigger.action, e.hits);
}

clip.unbind_packet(&let_go)?;   // by key: action, consume and once_per_run are ignored
clip.clear_triggers()?;         // both kinds`}</code></pre>
          </div>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="AsyncClipHandle: control fires, queries await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice::clip()</code></A> returns an{' '}
            <code>AsyncClipHandle</code> that keeps <code>append</code>, the settings, both kinds of
            trigger, and the engine verbs synchronous; <code>query_status().await</code> and{' '}
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
