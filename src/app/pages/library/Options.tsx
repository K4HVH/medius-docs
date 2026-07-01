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
          Options are persistent box settings, each one set and read on its own. There are three:
          imperfect clones, movement riding, and emit-rate pacing. All persist in NVS and survive a
          reboot. See the native <A href="/native/commands/option"><code>OPTION</code></A> command for
          the wire contract.
        </p>
        <table class="api-params">
          <thead><tr><th>Option</th><th>Set</th><th>Read</th></tr></thead>
          <tbody>
            <tr><td>imperfect clone</td><td><A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A></td><td><A href="/library/options#query-imperfect"><code>query_imperfect</code></A></td></tr>
            <tr><td>movement riding</td><td><A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A></td><td><A href="/library/options#query-movement-riding"><code>query_movement_riding</code></A></td></tr>
            <tr><td>emit-rate pacing</td><td><A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A></td><td><A href="/library/options#query-emit-pace"><code>query_emit_pace</code></A></td></tr>
          </tbody>
        </table>
      </Card>

      <div id="allow-imperfect-clones" data-search-target>
        <Card>
          <CardHeader title="allow_imperfect_clones" subtitle="Clone an over-capacity device anyway" />
          <pre class="api-signature">fn allow_imperfect_clones(&self, allow: bool) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            By default the box refuses a device it can't clone faithfully. <code>true</code> opts into
            cloning an over-capacity device anyway, the rest faithful and the over-capacity interface
            dead; <code>false</code> is faithful-only (the default). It's persisted in NVS. When the
            setting changes for an <em>attached over-capacity</em> device the box reboots itself to
            re-clone, so it lands without unplugging anything; a normal device is unaffected (no reboot).
          </p>
          <div class="api-response-label">PARAMETERS</div>
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
            <code>Some(window)</code> turns movement riding on: injected cursor and wheel motion ride a
            native cursor-motion report seen within <code>window</code>, the box emits no synthetic
            motion frame, and motion left unridden past the window is dropped rather than dumped on the
            next move. So injected motion's report density matches the real mouse's, erasing the
            density tell. <code>None</code> turns it off (the default). The window rounds to whole
            milliseconds, a non-zero <code>Some</code> is at least 1 ms, and it clamps to 65535 ms;
            persisted in NVS.
          </p>
          <p>
            The tradeoff is deliberate: pure idle injection, moving the cursor while the user holds
            still, stops working while riding is on. Button, key, and media injection are unaffected.
          </p>
          <div class="api-response-label">PARAMETERS</div>
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
          <CardHeader title="set_emit_pace" subtitle="Pick what paces injected motion" />
          <pre class="api-signature">fn set_emit_pace(&self, pace: EmitPace) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Picks what sets the emit-rate ceiling for injected motion.{' '}
            <A href="/library/types/enums#emit-pace"><code>EmitPace::Learned</code></A> is the default:
            the box paces injection to the rate the real mouse actually reports at.{' '}
            <code>EmitPace::Interval</code> paces to the cloned mouse's declared poll rate (its
            <code>bInterval</code>). <code>EmitPace::Fixed(hz)</code> paces to a rate you set; the 1 ms
            frame clock snaps it to <code>1000/n</code> Hz and caps it at 1 kHz. It raises the ceiling
            only, so idle stays idle (the box still emits a frame solely when injection is pending).
            Persisted in NVS.
          </p>
          <p>
            The learnt default keeps injected motion's cadence matched to the native mouse. The other
            modes are for a host that models its own report density and wants the box to stop re-pacing
            an already-shaped stream.
          </p>
          <div class="api-response-label">PARAMETERS</div>
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
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>allow_imperfect_clones</code>, <code>set_movement_riding</code>, and{' '}
            <code>set_emit_pace</code> fire-and-forget (no await) and makes <code>query_imperfect</code>,
            {' '}<code>query_movement_riding</code>, and <code>query_emit_pace</code> futures, like the
            other queries.
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
