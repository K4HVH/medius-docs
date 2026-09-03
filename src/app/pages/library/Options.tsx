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
          Seven box settings, each set and read on its own. All persist in NVS and survive a reboot. See
          the native <A href="/native/commands/option"><code>OPTION</code></A>{' '}
          command for the wire contract.
        </p>
        <table class="api-params">
          <thead><tr><th>Option</th><th>Set</th><th>Read</th></tr></thead>
          <tbody>
            <tr><td>imperfect clone</td><td><A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A></td><td><A href="/library/options#query-imperfect"><code>query_imperfect</code></A></td></tr>
            <tr><td>movement riding</td><td><A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A></td><td><A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A></td></tr>
            <tr><td>emit-rate pacing</td><td><A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A></td><td><A href="/library/options#query-emit-pace"><code>query_emit_pace</code></A></td></tr>
            <tr><td>box name</td><td><A href="/library/options#set-name"><code>set_name</code></A> / <A href="/library/options#clear-name"><code>clear_name</code></A></td><td><A href="/library/types/structs#version"><code>Version::name</code></A></td></tr>
            <tr><td>bearing</td><td><A href="/library/options#set-bearing"><code>set_bearing</code></A></td><td><A href="/library/options#query-bearing"><code>query_bearing</code></A></td></tr>
            <tr><td>motion texture</td><td><A href="/library/options#set-render"><code>set_render</code></A></td><td><A href="/library/options#query-render"><code>query_render</code></A></td></tr>
            <tr><td>injection spreading</td><td><A href="/library/options#set-spread"><code>set_spread</code></A></td><td><A href="/library/options#query-spread"><code>query_spread</code></A></td></tr>
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

      <div id="set-emit-pace" data-search-target>
        <Card>
          <CardHeader title="set_emit_pace" subtitle="Pick what paces injected motion, and what rate the clone runs at" />
          <pre class="api-signature">fn set_emit_pace(&self, pace: EmitPace, force_hz: Option&lt;u16&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>force_hz</code> writes a <code>bInterval</code> onto every HID interrupt-IN endpoint
            the clone serves and polls the device at it, so a mouse declaring 125 Hz can run at 1 kHz.
            It snaps to <code>1000/n</code> Hz, and a low-speed clone floors at <code>bInterval</code> 16 (62 Hz).
          </p>
          <div class="callout callout--warning">
            <p>
              A forced rate applies only with{' '}
              <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
              on, because the descriptor stops matching the real device. Changing the resolved interval
              re-clones the box, which drops the control port for a few seconds.
            </p>
          </div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>pace</code></td><td><A href="/library/types/enums#emit-pace"><code>EmitPace</code></A></td><td>The rate ceiling for injected motion.</td></tr>
              <tr><td><code>force_hz</code></td><td><code>Option&lt;u16&gt;</code></td><td>The rate the clone advertises and the box polls the device at; <code>None</code> leaves the native interval.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
device.set_emit_pace(EmitPace::Fixed(1000), None)?;   // a fixed 1 kHz ceiling
device.set_emit_pace(EmitPace::Learned, None)?;       // back to the box's own default`}</code></pre>
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
device.set_name("Loki")?;              // stored in NVS, reported on Version
let name = device.query_version()?.name;  // read it back off Version`}</code></pre>
        </Card>
      </div>

      <div id="clear-name" data-search-target>
        <Card>
          <CardHeader title="clear_name" subtitle="Back to the synthesised default" />
          <pre class="api-signature">fn clear_name(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Clears the custom name, reverting the box to a firmware-synthesised{' '}
            <code>Medius-XXXX</code> default derived from its MAC.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.clear_name()?;                  // back to "Medius-XXXX"`}</code></pre>
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
            <code>BEARING_WINDOW_DEFAULT</code> (20 ms) in <code>PerAxis</code> is the factory
            setting.
          </p>
          <div class="callout callout--warning">
            <p>
              <A href="/library/types/enums#bearing-mode"><code>Vector</code></A> weighs a report
              twice: block <code>Y</code> negative while the injection runs diagonally and a purely
              horizontal flick can come out with its vertical share removed.
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
device.scale(Axis::X, Direction::Against, 40)?;  // motion opposing the injection, at 40%
device.set_bearing(None, BearingMode::PerAxis)?; // and off again`}</code></pre>
        </Card>
      </div>

      <div id="set-render" data-search-target>
        <Card>
          <CardHeader title="set_render" subtitle="Pick the texture motion is rendered with" />
          <pre class="api-signature">fn set_render(&self, mode: RenderMode, full: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>Off</code> is the paced fill: one frame per{' '}
            <A href="/library/options#set-emit-pace">emit-rate</A> tick while injection is pending. The
            other three push motion through an{' '}
            <a href="https://github.com/optima-manent/ABCurves" target="_blank" rel="noreferrer">ABCurves</a>{' '}
            model (MIT) fitted live from native reports, and differ only in the smoother the
            model is fed.
          </p>
          <p>
            <code>full</code> is whose motion the model renders: injected motion alone, or the mouse's
            own cursor delta taken out of the relayed report and joined to it as one stream. Buttons,
            the wheel and every other field stay relayed either way.
          </p>
          <div class="callout callout--warning">
            <p>
              Rendering adds a small amount of latency, which reaches native motion when{' '}
              <code>full</code> is on. Motion asking for exact timing skips the model:{' '}
              <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>,{' '}
              <A href="/library/move#flush-motion"><code>flush_motion</code></A> and{' '}
              <A href="/library/move#discard-motion"><code>discard_motion</code></A> take the paced
              path, and with <code>full</code> on the rendered stream ignores{' '}
              <A href="/library/options#set-movement-riding">movement riding</A>.
            </p>
            <p>
              The renderer stays out of the path until a profile arms, and while <code>mode</code> is{' '}
              <code>Off</code>:{' '}
              <A href="/library/options#query-render"><code>query_render</code></A> reports both.
            </p>
          </div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#render-mode"><code>RenderMode</code></A></td><td>The texture motion is rendered with; the box boots at <code>Despiked</code>.</td></tr>
              <tr><td><code>full</code></td><td><code>bool</code></td><td>Whether native motion is rendered by the model rather than relayed; the box boots with it off.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, RenderMode};

let device = Device::find()?;
device.set_render(RenderMode::Despiked, false)?;   // the box's own default
device.set_render(RenderMode::Despiked, true)?;    // render native motion too
device.set_render(RenderMode::Off, false)?;        // renderer out of the path, the paced fill`}</code></pre>
        </Card>
      </div>

      <div id="set-spread" data-search-target>
        <Card>
          <CardHeader title="set_spread" subtitle="Set how far an injected delta is spread in time" />
          <pre class="api-signature">fn set_spread(&self, percent: u16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            An aim loop slower than the native report rate hands the box a delta worth several native
            reports. <code>percent</code> is how much of the interval between commands the box releases
            it across: <code>0</code> puts the whole delta on the next report, <code>100</code> spreads
            it evenly over one interval, and above <code>100</code> carries a standing backlog.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>percent</code></td><td><code>u16</code></td><td>Share of the command interval, in percent; the box boots at <code>100</code>.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              Spreading costs half the interval in latency on average, about 4 ms on a 125 Hz loop.
              The delivered total never changes, and a loop matched to the native report rate emits
              exactly what it did before.
            </p>
            <p>
              Motion asking for exact timing is not spread:{' '}
              <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>,{' '}
              <A href="/library/move#flush-motion"><code>flush_motion</code></A> and{' '}
              <A href="/library/move#discard-motion"><code>discard_motion</code></A>. Neither is wheel
              motion.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.set_spread(100)?;   // the box's own default: one whole command interval
device.set_spread(50)?;    // half of it, for half the added latency
device.set_spread(0)?;     // off: the whole delta on the next report`}</code></pre>
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

      <div id="query-emit-pace" data-search-target>
        <Card>
          <CardHeader title="query_emit_pace" subtitle="Read the pacing mode and the rate the clone runs at" />
          <pre class="api-signature">fn query_emit_pace(&self) -&gt; Result&lt;EmitPaceStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns an{' '}
            <A href="/library/types/structs#emit-pace-status"><code>EmitPaceStatus</code></A>{' '}
            carrying the pace and the rates. <code>advertised_hz</code> is what the clone advertises now: the
            native rate while nothing is forced, the forced rate once something is, with no
            record of what the device declared before a force was applied.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
let status = device.query_emit_pace()?;
if let EmitPace::Fixed(hz) = status.mode {
    println!("fixed {hz} Hz, emitting at {} Hz", status.resolved_hz);
}
println!("the clone advertises {} Hz", status.advertised_hz);`}</code></pre>
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

      <div id="query-render" data-search-target>
        <Card>
          <CardHeader title="query_render" subtitle="Read the texture and whether a profile has armed" />
          <pre class="api-signature">fn query_render(&self) -&gt; Result&lt;RenderStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#render-status"><code>RenderStatus</code></A>.{' '}
            <code>ready</code> is false until a profile arms; until then motion is relayed and injection
            takes the paced fill whatever <code>mode</code> says.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_render()?;
println!("{:?}, own motion rendered: {}", status.mode, status.full);
if !status.ready {
    println!("move the mouse: nothing is rendered until a profile arms");
}`}</code></pre>
        </Card>
      </div>

      <div id="query-spread" data-search-target>
        <Card>
          <CardHeader title="query_spread" subtitle="Read the percent and the interval in effect" />
          <pre class="api-signature">fn query_spread(&self) -&gt; Result&lt;SpreadStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#spread-status"><code>SpreadStatus</code></A>.{' '}
            <code>span_us</code> is <code>0</code> while <code>percent</code> is <code>0</code> and
            until the box has learned the host's command period. In both the whole delta goes out on
            the next report.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_spread()?;
println!("{}% over {} us", status.percent, status.span_us);
if status.span_us == 0 {
    println!("send a few moves: the command period is not learned yet");
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="setters fire, queries await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps the setters
            fire-and-forget (no await) and makes <code>query_imperfect</code>,{' '}
            <code>query_movement_riding</code>, <code>query_bearing</code>,{' '}
            <code>query_emit_pace</code>, and <code>query_render</code> futures, like the other
            queries.
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
