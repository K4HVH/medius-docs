import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Options: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Options" subtitle="Persistent box settings" />
        <p>
          Five box settings, each set and read on its own. All persist in NVS and survive a reboot. See
          the native <A href="/native/commands/option"><code>OPTION</code></A>{' '}
          command for the wire contract.
        </p>
        <table class="api-params">
          <thead><tr><th>Option</th><th>Set</th><th>Read</th></tr></thead>
          <tbody>
            <tr><td>imperfect clone</td><td><A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A></td><td><A href="/library/options#query-imperfect"><code>query_imperfect</code></A></td></tr>
            <tr><td>movement riding</td><td><A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A></td><td><A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A></td></tr>
            <tr><td>aim bearing</td><td><A href="/library/options#set-bearing"><code>set_bearing</code></A></td><td><A href="/library/options#query-bearing"><code>query_bearing</code></A></td></tr>
            <tr><td>emit-rate pacing</td><td><A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A></td><td><A href="/library/options#query-emit-pace"><code>query_emit_pace</code></A></td></tr>
            <tr><td>box name</td><td><A href="/library/options#set-name"><code>set_name</code></A> / <A href="/library/options#clear-name"><code>clear_name</code></A></td><td><A href="/library/types/structs#version"><code>Version::name</code></A></td></tr>
          </tbody>
        </table>
      </Card>

      <div id="allow-imperfect-clones" data-search-target>
        <Card>
          <CardHeader title="allow_imperfect_clones" subtitle="Clone an over-capacity device anyway" />
          <pre class="api-signature">fn allow_imperfect_clones(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            By default the box refuses a device it can't clone faithfully. <code>true</code> clones an
            over-capacity device anyway, the rest faithful and the over-capacity interface dead. Changing
            the setting while such a device is <em>attached</em> reboots the box to re-clone; a normal
            device is unaffected.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>allow</code></td><td><code>bool</code></td><td>Clone an over-capacity device anyway, or stay faithful-only.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.allow_imperfect_clones(true)?;   // reboots + re-clones if an over-capacity device is attached`}</code></pre>
        </Card>
      </div>

      <div id="set-movement-riding" data-search-target>
        <Card>
          <CardHeader title="set_movement_riding" subtitle="Inject motion only on a native move" />
          <pre class="api-signature">fn set_movement_riding(&self, window: Option&lt;Duration&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>Some(window)</code> turns riding on: injected cursor and wheel motion ride a native
            cursor-motion report seen within <code>window</code>; the box emits no synthetic motion frame.
            Motion unridden past the window is dropped, not dumped on the next move.{' '}
            <code>None</code> (the default) is off.
          </p>
          <p>
            The window rounds to whole milliseconds, a non-zero <code>Some</code> is at least 1 ms,
            and it clamps to 65535 ms.
          </p>
          <p>
            Pure idle injection, moving the cursor while the user holds still, stops working while
            riding is on, unless a move opts out with{' '}
            <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>. Button, key and media
            injection are unaffected.
          </p>
          <div class="callout callout--warning">
            <p>
              A change to this setting drops whatever motion was held for a ride, and clears the
              standing <A href="/native/commands/lock#bearing">bearing</A> with it, so every{' '}
              <code>With</code> / <code>Against</code> scale stops applying at that instant.
            </p>
          </div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td><code>Some</code> with the ride window, or <code>None</code> to turn it off.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use std::time::Duration;
use medius::Device;

let device = Device::find()?;
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // ride native moves
device.set_movement_riding(None)?;                             // back to gapless fill`}</code></pre>
        </Card>
      </div>

      <div id="set-bearing" data-search-target>
        <Card>
          <CardHeader title="set_bearing" subtitle="What With and Against are measured against" />
          <pre class="api-signature">fn set_bearing(&self, window: Option&lt;Duration&gt;, mode: BearingMode) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Sets the <A href="/native/commands/lock#bearing">bearing</A>, the direction the box is
            injecting, which <code>Direction::With</code> and <code>Direction::Against</code> weigh
            against in <A href="/library/lock#scale"><code>scale</code></A>. Each axis holds the
            direction of its last injected delta for <code>window</code> past the last one still owed,
            then has none and both relative directions stop applying.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td><code>Some</code> with the hold window, or <code>None</code> to turn the bearing off, leaving the relative directions inert whatever their scale.</td></tr>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#bearing-mode"><code>BearingMode</code></A></td><td><code>PerAxis</code> or <code>Vector</code>.</td></tr>
            </tbody>
          </table>
          <p>
            Persisted in NVS, so a box that has been set boots at its own value.{' '}
            <code>BEARING_WINDOW_DEFAULT</code> (20 ms) in <code>PerAxis</code> is the factory one.
          </p>
          <div class="callout callout--warning">
            <p>
              <code>Vector</code> weighs a report twice, and the second pass reads whatever the
              projection left standing on each axis, not what the hand moved. Block <code>Y</code>{' '}
              negative while the aim runs diagonally and a purely horizontal flick can come out with its
              vertical share removed.
            </p>
            <p>
              A change to either field drops the standing bearing and the box's banked fractions, which
              is a visible step while a relative scale is live.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use std::time::Duration;
use medius::{Axis, BearingMode, Device, Direction};

let device = Device::find()?;
device.set_bearing(Some(Duration::from_millis(20)), BearingMode::PerAxis)?;
device.scale(Axis::X, Direction::Against, 40)?;  // counter-aim damped to 40%
device.set_bearing(None, BearingMode::PerAxis)?; // and off again`}</code></pre>
        </Card>
      </div>

      <div id="set-emit-pace" data-search-target>
        <Card>
          <CardHeader title="set_emit_pace" subtitle="Pick what paces injected motion" />
          <pre class="api-signature">fn set_emit_pace(&self, pace: EmitPace) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Picks the emit-rate ceiling for injected motion.{' '}
            <A href="/library/types/enums#emit-pace"><code>EmitPace::Learned</code></A> (the default)
            paces injection to the rate the real mouse reports at.{' '}
            <code>EmitPace::Interval</code> paces to the cloned mouse's declared poll rate (its
            <code>bInterval</code>). <code>EmitPace::Fixed(hz)</code> paces to a rate you set.
          </p>
          <p>
            The 1 ms frame clock snaps a fixed rate to <code>1000/n</code> Hz and caps it at 1 kHz. The
            pace raises the ceiling only: idle stays idle, and the box emits a frame solely when
            injection is pending.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>pace</code></td><td><A href="/library/types/enums#emit-pace"><code>EmitPace</code></A></td><td><code>Learned</code>, <code>Interval</code>, or <code>Fixed(hz)</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
device.set_emit_pace(EmitPace::Fixed(1000))?;  // emit at a fixed 1 kHz
device.set_emit_pace(EmitPace::Learned)?;      // back to the learnt native pace`}</code></pre>
        </Card>
      </div>

      <div id="set-name" data-search-target>
        <Card>
          <CardHeader title="set_name" subtitle="Give the box a human-readable name" />
          <pre class="api-signature">fn set_name(&self, name: &str) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Sets the box's name, the readable partner to its{' '}
            <A href="/library/discovery#identity">MAC</A>. The firmware keeps the leading printable-ASCII
            run, capped at 32 bytes; an empty string clears it. Read it back off{' '}
            <A href="/library/types/structs#version"><code>Version::name</code></A>, not a query.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>name</code></td><td><code>&amp;str</code></td><td>The new name, 1 to 32 printable ASCII characters.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.set_name("Loki")?;              // the box now answers to "Loki"
let name = device.query_version()?.name;  // read it back off Version`}</code></pre>
        </Card>
      </div>

      <div id="clear-name" data-search-target>
        <Card>
          <CardHeader title="clear_name" subtitle="Back to the synthesized default" />
          <pre class="api-signature">fn clear_name(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Clears the custom name, reverting the box to a firmware-synthesized{' '}
            <code>Medius-XXXX</code> default derived from its MAC.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.clear_name()?;                  // back to "Medius-XXXX"`}</code></pre>
        </Card>
      </div>

      <div id="query-imperfect" data-search-target>
        <Card>
          <CardHeader title="query_imperfect" subtitle="Read the imperfect-clone state" />
          <pre class="api-signature">fn query_imperfect(&self) -&gt; Result&lt;ImperfectStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns an{' '}
            <A href="/library/types/structs#imperfect-status"><code>ImperfectStatus</code></A>: the
            opt-in toggle, whether the attached device is over-capacity, and whether the live clone went
            over-capacity anyway with one interface dead.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_imperfect()?;
if status.over_capacity && !status.allowed {
    // the device was refused; opt in to clone it imperfectly
    device.allow_imperfect_clones(true)?;
}`}</code></pre>
        </Card>
      </div>

      <div id="query-movement-riding" data-search-target>
        <Card>
          <CardHeader title="query_movement_riding" subtitle="Read the ride window" />
          <pre class="api-signature">fn query_movement_riding(&self) -&gt; Result&lt;Option&lt;Duration&gt;&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns the current ride window as a <code>Duration</code>, or <code>None</code> when
            movement riding is off.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
match device.query_movement_riding()? {
    Some(window) => println!("riding, window {window:?}"),
    None => println!("off"),
}`}</code></pre>
        </Card>
      </div>

      <div id="query-bearing" data-search-target>
        <Card>
          <CardHeader title="query_bearing" subtitle="Read the bearing window and geometry" />
          <pre class="api-signature">fn query_bearing(&self) -&gt; Result&lt;Bearing&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns the configured{' '}
            <A href="/library/types/structs#bearing"><code>Bearing</code></A>: the window and how the
            box reads it.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let bearing = device.query_bearing()?;
if bearing.is_live() {
    println!("{:?} over {:?}", bearing.mode, bearing.window);
}`}</code></pre>
        </Card>
      </div>

      <div id="query-emit-pace" data-search-target>
        <Card>
          <CardHeader title="query_emit_pace" subtitle="Read the pacing mode and rate" />
          <pre class="api-signature">fn query_emit_pace(&self) -&gt; Result&lt;EmitPaceStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns an{' '}
            <A href="/library/types/structs#emit-pace-status"><code>EmitPaceStatus</code></A>: the
            selected <A href="/library/types/enums#emit-pace"><code>EmitPace</code></A> mode plus{' '}
            <code>resolved_hz</code>, the ceiling actually in effect (0 when the pace is learnt/adaptive,
            or no device is attached yet in <code>Interval</code> mode).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
let status = device.query_emit_pace()?;
if let EmitPace::Fixed(hz) = status.mode {
    println!("fixed {hz} Hz, emitting at {} Hz", status.resolved_hz);
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="setters fire, queries await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps the setters
            fire-and-forget (no await) and makes <code>query_imperfect</code>,{' '}
            <code>query_movement_riding</code>, <code>query_bearing</code>, and{' '}
            <code>query_emit_pace</code> futures, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use std::time::Duration;
use medius::Device;

let device = Device::find()?.into_async();
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // sync, no await
let window = device.query_movement_riding().await?;            // awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Options;
