import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Move: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Move" subtitle="Cursor motion and scroll" />
        <p>
          One field-generic verb, <A href="/library/move#move"><code>move_axis</code></A>, drives the
          relative axes; the rest are thin wrappers over it. Each call queues one{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
          <A href="/native/commands/move#move"><code>MOVE</code></A> frame.
        </p>
        <table class="api-params">
          <thead><tr><th>Drive a...</th><th>Rides a real move</th><th>Goes on the box's clock</th></tr></thead>
          <tbody>
            <tr><td>cursor</td><td><A href="/library/move#move-rel"><code>move_rel</code></A></td><td><A href="/library/move#move-rel-now"><code>move_rel_now</code></A></td></tr>
            <tr><td>wheel</td><td><A href="/library/move#wheel"><code>wheel</code></A></td><td><A href="/library/move#wheel-now"><code>wheel_now</code></A></td></tr>
          </tbody>
        </table>
        <p>
          The right-hand column only differs while{' '}
          <A href="/library/options#set-movement-riding">movement riding</A> is on.{' '}
          <A href="/library/move#flush-motion"><code>flush_motion</code></A> and{' '}
          <A href="/library/move#discard-motion"><code>discard_motion</code></A> act on motion it is
          already holding.
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
              <tr><td><code>motion</code></td><td><A href="/library/types/enums#motion"><code>Motion</code></A></td><td>The axis to drive: <code>Cursor {'{'} dx, dy {'}'}</code> or <code>Wheel(dz)</code>.</td></tr>
              <tr><td><code>timing</code></td><td><A href="/library/types/enums#move-timing"><code>MoveTiming</code></A></td><td>Whether this delta waits for a real move or emits on the box's own clock.</td></tr>
              <tr><td><code>pending</code></td><td><A href="/library/types/enums#pending-motion"><code>PendingMotion</code></A></td><td>What happens to motion the box is already holding for a real move.</td></tr>
            </tbody>
          </table>
          <p>
            Backs the <A href="/native/commands/move#move"><code>MOVE</code></A> command; the last two
            are its <A href="/native/commands/move#flags">flags byte</A>. With{' '}
            <A href="/library/options#set-movement-riding">movement riding</A> off,{' '}
            <code>Now</code> and <code>Flush</code> change nothing, while <code>Discard</code> still
            drops whatever has accumulated since the last emit.
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
            A wrapper over <A href="/library/move#move"><code>move_axis</code></A> with{' '}
            <code>Motion::Cursor</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset in mouse counts. Positive moves right, negative moves left.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset in mouse counts. Positive moves down, negative moves up (screen-style, not math-style).</td></tr>
            </tbody>
          </table>
          <p>
            Counts are not pixels: the OS pointer-speed and acceleration curve scale them. Both span
            the full <code>i16</code> range (<code>-32768 to 32767</code>).
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
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Scroll steps. Positive scrolls up, negative scrolls down.</td></tr>
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
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset in mouse counts. Positive moves right, negative moves left.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset in mouse counts. Positive moves down, negative moves up.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/move#move-rel"><code>move_rel</code></A> with{' '}
            <code>MoveTiming::Now</code>: the delta emits on the box's own clock rather than waiting for
            a real move to carry it, and leaves held motion held.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.set_movement_riding(Some(Duration::from_millis(20)))?;
device.move_rel(100, 0)?;      // waits for the user to move, dropped if they don't
device.move_rel_now(100, 0)?;  // lands whether they move or not`}</code></pre>
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
          <pre><code class="language-rust">{`device.wheel_now(-1)?;  // one notch down, on the box's clock`}</code></pre>
        </Card>
      </div>

      <div id="flush-motion" data-search-target>
        <Card>
          <CardHeader title="flush_motion" subtitle="Send what riding is holding" />
          <pre class="api-signature">fn flush_motion(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead><tr><th>Accumulator</th><th>What flush does</th></tr></thead>
            <tbody>
              <tr><td>Riding</td><td>Emptied onto the box's own clock, whatever the ride window says. Sends no motion of its own.</td></tr>
              <tr><td>Immediate</td><td>Gains that amount, so it goes out on the next frame the box emits.</td></tr>
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
          <CardHeader title="discard_motion" subtitle="Drop what riding is holding" />
          <pre class="api-signature">fn discard_motion(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead><tr><th>Accumulator</th><th>What discard does</th></tr></thead>
            <tbody>
              <tr><td>Riding</td><td>Zeroed. That motion never reaches the game PC.</td></tr>
              <tr><td>Immediate</td><td>Untouched, so a move sent with <code>MoveTiming::Now</code> still lands.</td></tr>
            </tbody>
          </table>
          <p>
            Unlike <A href="/library/admin#reset"><code>reset</code></A>, no held usage or lock is released.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.move_rel(400, 0)?;   // a flick the aim loop changed its mind about
device.discard_motion()?;   // it never reaches the game PC`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Movement stays synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps every movement verb
            synchronous: no <code>.await</code>, same signatures. The{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>{' '}
            pattern is only for async queries.
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
