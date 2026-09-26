import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Move: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Move" subtitle="Cursor motion, scroll, and pan" />
        <p>
          <A href="/library/move#move"><code>move_axis</code></A> drives every relative axis; the rest
          wrap it. Each call queues one{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
          <A href="/native/commands/move#move"><code>MOVE</code></A> frame.
        </p>
        <table class="api-params">
          <thead><tr><th>Drive a...</th><th>Rides a real move</th><th>Next report</th></tr></thead>
          <tbody>
            <tr><td>cursor</td><td><A href="/library/move#move-rel"><code>move_rel</code></A></td><td><A href="/library/move#move-rel-now"><code>move_rel_now</code></A></td></tr>
            <tr><td>wheel</td><td><A href="/library/move#wheel"><code>wheel</code></A></td><td><A href="/library/move#wheel-now"><code>wheel_now</code></A></td></tr>
            <tr><td>pan</td><td><A href="/library/move#pan"><code>pan</code></A></td><td><A href="/library/move#pan-now"><code>pan_now</code></A></td></tr>
          </tbody>
        </table>
        <p>
          The right-hand column puts the whole delta on the box's next mouse report, whatever{' '}
          <A href="/library/options#set-movement-riding">movement riding</A>,{' '}
          <A href="/library/options#set-spread">spreading</A> and{' '}
          <A href="/library/options#set-render">rendering</A> are set to.{' '}
          <A href="/library/move#flush-motion"><code>flush_motion</code></A> and{' '}
          <A href="/library/move#discard-motion"><code>discard_motion</code></A> act on motion still
          held from earlier moves.
        </p>
      </Card>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="move_axis" subtitle="Field-generic motion verb" />
          <pre class="api-signature">fn move_axis(&self, motion: Motion, timing: MoveTiming, pending: PendingMotion) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>motion</code></td><td><A href="/library/types/enums#motion"><code>Motion</code></A></td><td>Axis and delta: <code>Cursor {'{'} dx, dy {'}'}</code>, <code>Wheel(dz)</code>, or <code>Pan(dz)</code>.</td></tr>
              <tr><td><code>timing</code></td><td><A href="/library/types/enums#move-timing"><code>MoveTiming</code></A></td><td>Wait for a real move, or leave on the next report.</td></tr>
              <tr><td><code>pending</code></td><td><A href="/library/types/enums#pending-motion"><code>PendingMotion</code></A></td><td>What happens to motion already held for a real move.</td></tr>
            </tbody>
          </table>
          <p>
            Backs <A href="/native/commands/move#move"><code>MOVE</code></A>; the last two are its{' '}
            <A href="/native/commands/move#flags">flags byte</A>. With{' '}
            <A href="/library/options#set-movement-riding">movement riding</A> off,{' '}
            <code>Now</code> still skips spreading and rendering, and <code>Flush</code> and{' '}
            <code>Discard</code> act on what those hold of earlier moves.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Motion, MoveTiming, PendingMotion};

device.move_axis(Motion::Cursor { dx: 20, dy: 20 }, MoveTiming::Ride, PendingMotion::Keep)?;
device.move_axis(Motion::Wheel(1), MoveTiming::Ride, PendingMotion::Keep)?;
// Send this one now, and the held motion with it.
device.move_axis(Motion::Cursor { dx: 5, dy: 0 }, MoveTiming::Now, PendingMotion::Flush)?;`}</code></pre>
        </Card>
      </div>

      <div id="move-rel" data-search-target>
        <Card>
          <CardHeader title="move_rel" subtitle="Relative cursor movement" />
          <pre class="api-signature">fn move_rel(&self, dx: i16, dy: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/move#move"><code>move_axis</code></A> with <code>Motion::Cursor</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset in mouse counts. Positive right, negative left.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset in mouse counts. Positive down, negative up.</td></tr>
            </tbody>
          </table>
          <p>
            The OS pointer speed and acceleration curve scale counts to pixels. Both span the full{' '}
            <code>i16</code> range (<code>-32768 to 32767</code>).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.move_rel(20, 20)?;  // right and down
device.move_rel(-40, 0)?;  // left
device.move_rel(0, -10)?;  // up`}</code></pre>
        </Card>
      </div>

      <div id="wheel" data-search-target>
        <Card>
          <CardHeader title="wheel" subtitle="Wheel scroll" />
          <pre class="api-signature">fn wheel(&self, delta: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            A wrapper over <A href="/library/move#move"><code>move_axis</code></A> with{' '}
            <code>Motion::Wheel</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Scroll steps. Positive up, negative down.</td></tr>
            </tbody>
          </table>
          <p>
            <code>delta</code> spans the full <code>i16</code> range (<code>-32768 to 32767</code>) and
            feeds the same <A href="/native/injection#state">accumulator</A> as cursor motion, pacing
            large values across reports.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.wheel(3)?;   // up three notches
device.wheel(-1)?;  // down one notch`}</code></pre>
        </Card>
      </div>

      <div id="pan" data-search-target>
        <Card>
          <CardHeader title="pan" subtitle="AC Pan (horizontal scroll)" />
          <pre class="api-signature">fn pan(&self, delta: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/move#move"><code>move_axis</code></A> with <code>Motion::Pan</code>, a full
            peer of <A href="/library/move#wheel"><code>wheel</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Pan steps (horizontal scroll). Positive right, negative left.</td></tr>
            </tbody>
          </table>
          <p>
            <code>delta</code> spans the full <code>i16</code> range (<code>-32768 to 32767</code>) and
            feeds the same <A href="/native/injection#state">accumulator</A> as the wheel, pacing large
            values across reports. Only on a device whose descriptor declares AC Pan; check{' '}
            <A href="/library/requests#caps"><code>caps</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.pan(3)?;   // pan right
device.pan(-1)?;  // pan left`}</code></pre>
        </Card>
      </div>

      <div id="move-rel-now" data-search-target>
        <Card>
          <CardHeader title="move_rel_now" subtitle="Cursor movement that bypasses riding" />
          <pre class="api-signature">fn move_rel_now(&self, dx: i16, dy: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset in mouse counts. Positive right, negative left.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset in mouse counts. Positive down, negative up.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/move#move-rel"><code>move_rel</code></A> with{' '}
            <code>MoveTiming::Now</code>: the delta leaves on the box's next mouse report instead of
            waiting for a real move, and held motion stays held. The box sends its own report for it on the
            first poll no native report can be ready for; a native report that reaches the box first
            carries the delta instead.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.set_movement_riding(Some(Duration::from_millis(20)))?;
device.move_rel(100, 0)?;      // waits for a real move, dropped without one
device.move_rel_now(100, 0)?;  // emits either way`}</code></pre>
        </Card>
      </div>

      <div id="wheel-now" data-search-target>
        <Card>
          <CardHeader title="wheel_now" subtitle="Scroll that bypasses riding" />
          <pre class="api-signature">fn wheel_now(&self, delta: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Scroll steps. Positive scrolls up, negative scrolls down.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/move#wheel"><code>wheel</code></A> with <code>MoveTiming::Now</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.wheel_now(-1)?;  // one notch down, on the next report`}</code></pre>
        </Card>
      </div>

      <div id="pan-now" data-search-target>
        <Card>
          <CardHeader title="pan_now" subtitle="Pan that bypasses riding" />
          <pre class="api-signature">fn pan_now(&self, delta: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Pan steps (horizontal scroll). Positive pans right, negative pans left.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/move#pan"><code>pan</code></A> with <code>MoveTiming::Now</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.pan_now(-1)?;  // one step left, on the next report`}</code></pre>
        </Card>
      </div>

      <div id="flush-motion" data-search-target>
        <Card>
          <CardHeader title="flush_motion" subtitle="Send what riding holds" />
          <pre class="api-signature">fn flush_motion(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead><tr><th>Accumulator</th><th>What flush does</th></tr></thead>
            <tbody>
              <tr><td>Riding</td><td>Emptied into the immediate accumulator, regardless of the ride window. Sends no motion of its own.</td></tr>
              <tr><td>Immediate</td><td>Gains that amount, sent on the box's next mouse report.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`for _ in 0..10 {
    device.move_rel(4, 0)?;   // accumulates, waiting for a real move
}
device.flush_motion()?;       // 40 counts, now`}</code></pre>
        </Card>
      </div>

      <div id="discard-motion" data-search-target>
        <Card>
          <CardHeader title="discard_motion" subtitle="Drop what riding holds" />
          <pre class="api-signature">fn discard_motion(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead><tr><th>State</th><th>What discard does</th></tr></thead>
            <tbody>
              <tr><td>Riding accumulator</td><td>Zeroed; never reaches the game PC.</td></tr>
              <tr><td>Immediate accumulator</td><td>Untouched, so a move sent with <code>MoveTiming::Now</code> still lands.</td></tr>
              <tr><td><A href="/native/commands/lock#bearing">Bearing</A></td><td>Cleared, so every <code>With</code> / <code>Against</code> scale stops applying until the box injects again.</td></tr>
            </tbody>
          </table>
          <p>
            Unlike <A href="/library/admin#reset"><code>reset</code></A>, no held usage or lock is released.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.move_rel(400, 0)?;   // queued, then superseded
device.discard_motion()?;   // it never reaches the game PC`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Movement stays synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps every movement verb
            synchronous: no <code>.await</code>, same signatures.{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>{' '}
            is only for async queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let dev = Device::find()?.into_async();
dev.move_rel(40, 0)?;  // no .await
dev.wheel(1)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Move;
