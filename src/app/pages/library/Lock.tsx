import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lock" subtitle="Block one physical input; injection still drives it" />
        <p>
          A lock blocks the <em>physical</em> device from one input, while host{' '}
          <A href="/native/injection">injection</A> still drives that same input. Lock what the user
          shouldn't touch, then drive it yourself.
        </p>
        <pre class="diagram">{`  a locked input:
     physical  --X   blocked
     injected  -->   still reaches the PC`}</pre>
        <table class="api-params">
          <thead><tr><th>Block a...</th><th>Lock</th><th>Release</th></tr></thead>
          <tbody>
            <tr><td>relative axis (X / Y / wheel)</td><td><A href="/library/lock#lock"><code>lock</code></A> / <A href="/library/lock#lock-axis"><code>lock_axis</code></A></td><td><A href="/library/lock#unlock"><code>unlock</code></A> / <A href="/library/lock#lock-axis"><code>unlock_axis</code></A></td></tr>
            <tr><td>button, key, or media usage</td><td><A href="/library/lock#lock"><code>lock</code></A></td><td><A href="/library/lock#unlock"><code>unlock</code></A></td></tr>
            <tr><td>a whole class (blanket)</td><td><A href="/library/lock#lock-all"><code>lock_all</code></A></td><td><A href="/library/lock#lock-all"><code>unlock_all</code></A></td></tr>
          </tbody>
        </table>
        <p>
          All are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.{' '}
          <A href="/library/requests#query-locks"><code>query_locks</code></A> reads the active set.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="lock" subtitle="Block a physical input" />
          <pre class="api-signature">fn lock(&self, target: impl Into&lt;LockTarget&gt;, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> picks the input and{' '}
            <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A> picks the sign
            or edge. For an axis or the wheel the direction is a sign, so you can block scrolling up but
            not down; for a usage it's an edge, so you can block the press but not the release.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>impl Into&lt;<A href="/library/types/enums#lock-target">LockTarget</A>&gt;</code></td><td>An <A href="/library/types/enums#axis"><code>Axis</code></A> (X, Y, or wheel) or any <A href="/library/types/enums#usage"><code>Usage</code></A> (a button, key, or media usage).</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#lock-direction"><code>LockDirection</code></A></td><td><code>Both</code>, <code>Positive</code> (axis +, usage press), or <code>Negative</code> (axis -, usage release).</td></tr>
            </tbody>
          </table>
          <p>
            A lock blocks the physical device only, and holds until you{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A> it. The box also clears every lock on
            control-PC silence, on <A href="/library/admin#reset"><code>reset</code></A>, or on
            inter-chip link loss. See the native{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A> command for the wire layout.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Button, Key, LockDirection};

let device = Device::find()?;
device.lock(Axis::X, LockDirection::Both)?;              // freeze horizontal motion
device.lock(Button::Left, LockDirection::Positive)?;     // block left-click press
device.lock(Key::LEFT_GUI, LockDirection::Both)?;        // block the GUI/Windows key
device.move_rel(50, 0)?;                                 // injection still moves X`}</code></pre>
        </Card>
      </div>

      <div id="unlock" data-search-target>
        <Card>
          <CardHeader title="unlock" subtitle="Clear a block" />
          <pre class="api-signature">fn unlock(&self, target: impl Into&lt;LockTarget&gt;, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The inverse of <A href="/library/lock#lock"><code>lock</code></A>: same{' '}
            <code>target</code> and <code>direction</code>, but it clears the block instead of setting
            it. Hand a physical input back to the user.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, LockDirection};

let device = Device::find()?;
device.unlock(Axis::X, LockDirection::Both)?;   // hand horizontal motion back`}</code></pre>
        </Card>
      </div>

      <div id="lock-axis" data-search-target>
        <Card>
          <CardHeader title="lock_axis / unlock_axis" subtitle="Block a relative axis by sign" />
          <pre class="api-signature">fn lock_axis(&self, axis: Axis, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_axis(&self, axis: Axis, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Convenience for <A href="/library/lock#lock"><code>lock</code></A> /{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A> with an{' '}
            <A href="/library/types/enums#axis"><code>Axis</code></A>. The direction is a sign, so a
            positive-only lock freezes scroll-up while scroll-down still passes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, LockDirection};

let device = Device::find()?;
device.lock_axis(Axis::Wheel, LockDirection::Positive)?; // block scroll up, keep scroll down
device.unlock_axis(Axis::Wheel, LockDirection::Positive)?;`}</code></pre>
        </Card>
      </div>

      <div id="lock-all" data-search-target>
        <Card>
          <CardHeader title="lock_all / unlock_all" subtitle="Blanket-block a whole class" />
          <pre class="api-signature">fn lock_all(&self, what: Blanket, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_all(&self, what: Blanket, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Block an entire input group at once with a{' '}
            <A href="/library/types/enums#blanket"><code>Blanket</code></A> (<code>Aim</code>,{' '}
            <code>Wheel</code>, <code>Buttons</code>, <code>Keys</code>, or <code>Media</code>);{' '}
            <code>direction</code> applies to the whole group. Injection still drives any field you choose
            to.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Blanket, LockDirection};

let device = Device::find()?;
device.lock_all(Blanket::Keys, LockDirection::Both)?;   // every physical key blocked
device.unlock_all(Blanket::Keys, LockDirection::Both)?;`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="locks fire, query_locks awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps every lock call
            synchronous (<code>lock</code>/<code>unlock</code>, <code>lock_axis</code>, and{' '}
            <code>lock_all</code> with their unlock pairs) since they expect no reply;{' '}
            <code>query_locks</code> is a future like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Axis, LockDirection};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.lock(Axis::Y, LockDirection::Both)?;   // sync, no await
let locks = block_on(device.query_locks())?;  // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
