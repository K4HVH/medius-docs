import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Options: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          Seven box settings, each set and read separately, all persisted in NVS across a reboot. The
          wire contract is on the native <A href="/native/commands/option"><code>OPTION</code></A>{' '}
          command. <A href="/library/admin#factory-reset"><code>factory_reset</code></A> returns all
          seven to their defaults.
        </p>
        <div class="table-scroll">
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
        </div>
      </PageHeader>

      <DocSection id="allow-imperfect-clones" title="allow_imperfect_clones" caption="Clone anyway, and enable the advanced control layer">
        <pre class="api-signature">fn allow_imperfect_clones(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          By default the box refuses a real device it can't clone faithfully. <code>true</code> clones
          it anyway, as an imperfect clone. If such a device is <em>attached</em>, or a forced rate is
          pending, a change reboots the device chip to re-clone. Otherwise the clone re-presents only
          if the change alters the <A href="/library/advanced/patch">patch set</A> it serves: turning
          the opt-in on with a stored set the box hasn't refused, or off while it serves a set.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>allow</code></td><td><code>bool</code></td><td>Clone anyway, or stay faithful-only.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">GATES</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Feature</th><th>Opt-in off</th></tr>
            </thead>
            <tbody>
              <tr><td>a real device the box can't clone faithfully</td><td>Refused: no clone appears.</td></tr>
              <tr><td>a forced rate, <A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A>'s <code>force_hz</code></td><td>Not applied.</td></tr>
              <tr><td><A href="/library/advanced/rewrite">rewrite rules</A></td><td><code>set_rewrite</code> returns <A href="/library/types/errors#errors"><code>ImperfectRequired</code></A>. <code>clear_rewrite</code> still runs, and turning the opt-in off clears the table.</td></tr>
              <tr><td><A href="/library/advanced/patch">descriptor patches</A></td><td>Stored, not applied. <code>apply_patch</code> returns <code>ImperfectRequired</code>.</td></tr>
              <tr><td><A href="/library/advanced/transfer">control transfers</A></td><td>Replied <code>Refused</code>.</td></tr>
              <tr><td><A href="/library/advanced/raw">raw reports</A>, and a clip's raw and transfer items</td><td>Dropped by the box. Turning the opt-in off drops queued clip transfers.</td></tr>
              <tr><td>a <A href="/library/clip#packet-triggers">clip packet trigger</A> that consumes</td><td>Refused by the box. Turning the opt-in off removes held ones.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--info">
          <p>
            The box can't clone a real device faithfully if it: has &gt;4 IN endpoints live at once or
            &gt;6 HID interfaces; runs at high speed; has configurations the box didn't capture; has a
            vendor bulk or isochronous endpoint; has a setting carrying more endpoint descriptors than
            it declares (what fits is cloned, the rest left undriven); or has a report descriptor
            truncated or never captured.
          </p>
        </div>
        <div class="callout callout--warning">
          <p>
            A change that reboots the device chip or re-presents the clone drops the box's session
            state and a loaded clip. The library re-sends what it holds once the new clone is up (
            <A href="/library/lifecycle#restart">session recovery</A>).
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.allow_imperfect_clones(true)?;   // re-clones if the attached device needs the opt-in`}</code></pre>
      </DocSection>

      <DocSection id="set-movement-riding" title="set_movement_riding" caption="Inject motion only on a native move">
        <pre class="api-signature">fn set_movement_riding(&self, window: Option&lt;Duration&gt;) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <code>Some(window)</code> turns riding on. Injected cursor and wheel motion then ride a
          native cursor-motion report received within <code>window</code>, with no synthetic motion
          frame. Motion still unridden after the window is dropped, not emitted on the next move.{' '}
          <code>None</code> (the default) is off.
        </p>
        <p>
          The window rounds to whole milliseconds and clamps to 65535 ms. A non-zero{' '}
          <code>Some</code> is ≥1 ms.
        </p>
        <p>
          While riding is on, idle injection (motion while the mouse is still) needs{' '}
          <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>. Button, key and media
          injection are unaffected.
        </p>
        <div class="callout callout--warning">
          <p>
            A change drops motion held for a ride and clears the standing{' '}
            <A href="/native/commands/lock#bearing">bearing</A>, so every <code>With</code> /{' '}
            <code>Against</code> scale stops applying at once.
          </p>
        </div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td><code>Some</code> with the ride window, or <code>None</code> to turn it off.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use std::time::Duration;
use medius::Device;

let device = Device::find()?;
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // ride native moves
device.set_movement_riding(None)?;                             // back to gapless fill`}</code></pre>
      </DocSection>

      <DocSection id="set-emit-pace" title="set_emit_pace" caption="Injected-motion pace and clone rate">
        <pre class="api-signature">fn set_emit_pace(&self, pace: EmitPace, force_hz: Option&lt;u16&gt;) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <code>force_hz</code> writes a <code>bInterval</code> onto every HID interrupt-IN endpoint
          the clone serves, and the box polls the real device at that interval. A mouse declaring
          125 Hz can then run at 1 kHz. The rate resolves to a power-of-two <code>bInterval</code>:
          1000/<code>force_hz</code> ms rounded to the nearest millisecond, then down to a power of
          two (600 Hz gives 500 Hz). A low-speed clone floors at <code>bInterval</code> 16
          (62 Hz).
        </p>
        <div class="callout callout--warning">
          <p>
            A forced rate applies only with{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            on, because the descriptor stops matching the real device. Changing the resolved interval
            re-clones the box: the device chip reboots, and queries time out for a few seconds.
          </p>
        </div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>pace</code></td><td><A href="/library/types/enums#emit-pace"><code>EmitPace</code></A></td><td>Rate ceiling for injected motion.</td></tr>
              <tr><td><code>force_hz</code></td><td><code>Option&lt;u16&gt;</code></td><td>The rate the clone advertises and the box polls the real device at. <code>None</code> keeps the native <code>bInterval</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
device.set_emit_pace(EmitPace::Fixed(1000), None)?;   // a fixed 1 kHz ceiling
device.set_emit_pace(EmitPace::Learned, None)?;       // back to the default`}</code></pre>
      </DocSection>

      <DocSection id="set-name" title="set_name" caption="Human-readable box name">
        <pre class="api-signature">fn set_name(&self, name: &str) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          Sets the box's name, the readable partner to its{' '}
          <A href="/library/discovery#identity">MAC</A>. The firmware keeps the leading printable-ASCII
          run, capped at 32 bytes. An empty string clears the name. It reads back on{' '}
          <A href="/library/types/structs#version"><code>Version::name</code></A>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>name</code></td><td><code>&amp;str</code></td><td>The new name, 1-32 printable ASCII characters.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.set_name("Loki")?;              // stored in NVS, reported on Version
let name = device.query_version()?.name;  // read it back off Version`}</code></pre>
      </DocSection>

      <DocSection id="clear-name" title="clear_name" caption="Back to the synthesised default">
        <pre class="api-signature">fn clear_name(&self) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          Clears the custom name. The box reverts to the <code>Medius-XXXX</code> default derived
          from its MAC.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.clear_name()?;                  // back to "Medius-XXXX"`}</code></pre>
      </DocSection>

      <DocSection id="set-bearing" title="set_bearing" caption="What With and Against are measured against">
        <pre class="api-signature">fn set_bearing(&self, window: Option&lt;Duration&gt;, mode: BearingMode) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          Sets the <A href="/native/commands/lock#bearing">bearing</A>: the direction the box is
          injecting. <code>Direction::With</code> and <code>Direction::Against</code> in{' '}
          <A href="/library/lock#scale"><code>scale</code></A> weigh against it. Each axis holds the
          direction of its last injected delta until <code>window</code> passes with no injected
          motion still owed. Then the axis has no bearing, and both relative directions stop
          applying.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td><code>Some</code> with the hold window, or <code>None</code> to turn the bearing off. With it off, the relative directions do nothing, whatever their scale.</td></tr>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#bearing-mode"><code>BearingMode</code></A></td><td><code>PerAxis</code> or <code>Vector</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <code>BEARING_WINDOW_DEFAULT</code> (20 ms) in <code>PerAxis</code> is the factory
          setting.
        </p>
        <div class="callout callout--warning">
          <p>
            <A href="/library/types/enums#bearing-mode"><code>Vector</code></A> weighs a report
            twice. If <code>Y</code> negative is blocked while the injection runs diagonally, a purely
            horizontal flick can come out with its vertical share removed.
          </p>
          <p>
            A change to either field drops the standing bearing and the box's banked fractions. While
            a relative scale is live, this shows as a visible step.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use std::time::Duration;
use medius::{Axis, BearingMode, Device, Direction};

let device = Device::find()?;
device.set_bearing(Some(Duration::from_millis(20)), BearingMode::PerAxis)?;
device.scale(Axis::X, Direction::Against, 40)?;  // motion opposing the injection, at 40%
device.set_bearing(None, BearingMode::PerAxis)?; // and off again`}</code></pre>
      </DocSection>

      <DocSection id="set-render" title="set_render" caption="Motion texture">
        <pre class="api-signature">fn set_render(&self, mode: RenderMode, full: bool) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <code>Off</code> is the paced fill: one frame per{' '}
          <A href="/library/options#set-emit-pace">emit-rate</A> tick while injection is pending. The
          other three render motion through an{' '}
          <a href="https://github.com/optima-manent/ABCurves" target="_blank" rel="noreferrer">ABCurves</a>{' '}
          model (MIT) fitted live from native reports. They differ only in the smoother that feeds the
          model.
        </p>
        <p>
          <code>full</code> picks what the model renders: injected motion alone, or injected and native
          cursor motion as one stream (the native delta is taken out of the relayed report). Buttons,
          the wheel and
          every other field stay relayed either way.
        </p>
        <div class="callout callout--warning">
          <p>
            Rendering adds the smoother's group delay: 4 ms <code>Stock</code>, 2.7 ms <code>Despiked</code>, none <code>Unsmoothed</code>. With{' '}
            <code>full</code> on, native motion gets that delay +1 ms.{' '}
            <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>,{' '}
            <A href="/library/move#flush-motion"><code>flush_motion</code></A> and{' '}
            <A href="/library/move#discard-motion"><code>discard_motion</code></A> skip the model and
            take the paced path. With <code>full</code> on, the rendered stream ignores{' '}
            <A href="/library/options#set-movement-riding">movement riding</A>.
          </p>
          <p>
            The renderer stays out of the path until a profile arms, and while <code>mode</code> is{' '}
            <code>Off</code>.{' '}
            <A href="/library/options#query-render"><code>query_render</code></A> reports both.
          </p>
        </div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#render-mode"><code>RenderMode</code></A></td><td>Rendering texture. The box boots at <code>Despiked</code>.</td></tr>
              <tr><td><code>full</code></td><td><code>bool</code></td><td>Render native motion instead of relaying it. The box boots with it off.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, RenderMode};

let device = Device::find()?;
device.set_render(RenderMode::Despiked, false)?;   // the default
device.set_render(RenderMode::Despiked, true)?;    // render native motion too
device.set_render(RenderMode::Off, false)?;        // renderer out of the path, the paced fill`}</code></pre>
      </DocSection>

      <DocSection id="set-spread" title="set_spread" caption="Injected-delta spread in time">
        <pre class="api-signature">fn set_spread(&self, percent: u16) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          A command loop slower than the native report rate sends deltas worth several native
          reports. <code>percent</code> is the share of the command interval that the box spreads each
          delta across. <code>0</code> emits the whole delta on the next report. <code>100</code>{' '}
          spreads it evenly over one interval. Above <code>100</code> carries a standing backlog.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>percent</code></td><td><code>u16</code></td><td>Share of the command interval, in percent. The box boots at <code>100</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--warning">
          <p>
            On average, spreading adds half the command interval of latency (~4 ms on a 125 Hz loop).
            The delivered total never changes. A loop at the native report rate keeps each command
            whole, alone on one report.
          </p>
          <p>
            <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>,{' '}
            <A href="/library/move#flush-motion"><code>flush_motion</code></A>,{' '}
            <A href="/library/move#discard-motion"><code>discard_motion</code></A> and wheel motion are
            never spread.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.set_spread(100)?;   // the default: one whole command interval
device.set_spread(50)?;    // half the interval, for half the added latency
device.set_spread(0)?;     // off: the whole delta on the next report`}</code></pre>
      </DocSection>

      <DocSection id="query-imperfect" title="query_imperfect" caption="Imperfect-clone state">
        <pre class="api-signature">fn query_imperfect(&self) -&gt; Result&lt;ImperfectStatus&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Returns an{' '}
          <A href="/library/types/structs#imperfect-status"><code>ImperfectStatus</code></A>: the
          opt-in toggle, whether the attached real device is over-capacity, and whether the live
          clone is imperfect.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_imperfect()?;
if status.over_capacity && !status.allowed {
    // the device was refused; opt in to clone it imperfectly
    device.allow_imperfect_clones(true)?;
}`}</code></pre>
      </DocSection>

      <DocSection id="query-movement-riding" title="query_movement_riding" caption="Ride window">
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
      </DocSection>

      <DocSection id="query-emit-pace" title="query_emit_pace" caption="Pacing mode and clone rate">
        <pre class="api-signature">fn query_emit_pace(&self) -&gt; Result&lt;EmitPaceStatus&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Returns an{' '}
          <A href="/library/types/structs#emit-pace-status"><code>EmitPaceStatus</code></A>{' '}
          with the pace and the rates. <code>advertised_hz</code> is the clone's current rate: the
          native rate while nothing is forced, otherwise the forced rate. It keeps no record of the
          native rate from before the force.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, EmitPace};

let device = Device::find()?;
let status = device.query_emit_pace()?;
if let EmitPace::Fixed(hz) = status.mode {
    println!("fixed {hz} Hz, emitting at {} Hz", status.resolved_hz);
}
println!("the clone advertises {} Hz", status.advertised_hz);`}</code></pre>
      </DocSection>

      <DocSection id="query-bearing" title="query_bearing" caption="Bearing window and geometry">
        <pre class="api-signature">fn query_bearing(&self) -&gt; Result&lt;Bearing&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Returns the configured{' '}
          <A href="/library/types/structs#bearing"><code>Bearing</code></A>: the window and the
          mode.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let bearing = device.query_bearing()?;
if bearing.is_live() {
    println!("{:?} over {:?}", bearing.mode, bearing.window);
}`}</code></pre>
      </DocSection>

      <DocSection id="query-render" title="query_render" caption="Texture, and whether a profile armed">
        <pre class="api-signature">fn query_render(&self) -&gt; Result&lt;RenderStatus&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Returns a <A href="/library/types/structs#render-status"><code>RenderStatus</code></A>.{' '}
          <code>ready</code> is false until a profile arms, and while the box's two chips haven't yet
          agreed which one holds the motion. Until then, motion is relayed and injection takes the
          paced fill, whatever <code>mode</code> says.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_render()?;
println!("{:?}, native motion rendered: {}", status.mode, status.full);
if !status.ready {
    println!("move the mouse: nothing is rendered until a profile arms");
}`}</code></pre>
      </DocSection>

      <DocSection id="query-spread" title="query_spread" caption="Percent and interval in effect">
        <pre class="api-signature">fn query_spread(&self) -&gt; Result&lt;SpreadStatus&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Returns a <A href="/library/types/structs#spread-status"><code>SpreadStatus</code></A>.{' '}
          <code>span_us</code> is <code>0</code> in three cases: while <code>percent</code> is{' '}
          <code>0</code>, until the box has learned the command interval, and while the box's two
          chips haven't yet agreed which one holds the motion. In each case the whole delta is emitted
          on the next report.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let status = device.query_spread()?;
println!("{}% over {} us", status.percent, status.span_us);
if status.span_us == 0 {
    println!("send a few moves: the command interval is not learned yet");
}`}</code></pre>
      </DocSection>

      <DocSection id="async" title="On AsyncDevice" caption="setters fire, queries await">
        <p>
          <A href="/library/features/async"><code>AsyncDevice</code></A> keeps the setters
          fire-and-forget (no await) and makes <code>query_imperfect</code>,{' '}
          <code>query_movement_riding</code>, <code>query_bearing</code>,{' '}
          <code>query_emit_pace</code>, <code>query_render</code>, and <code>query_spread</code> futures.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use std::time::Duration;
use medius::Device;

let device = Device::find()?.into_async();
device.set_movement_riding(Some(Duration::from_millis(20)))?;  // sync, no await
let window = device.query_movement_riding().await?;            // awaits`}</code></pre>
      </DocSection>
    </>
  );
};

export default Options;
