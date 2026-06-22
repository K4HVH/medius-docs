import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lock" subtitle="Block one input from the physical mouse" />
        <p>
          <A href="/library/lock#lock"><code>lock</code></A> stops the real mouse from driving one
          axis, the wheel, or one button, while <A href="/library/lock#unlock"><code>unlock</code></A>{' '}
          clears the block. Host <A href="/native/injection">injection</A> still reaches a locked
          target, so you can take an input over without the user fighting you. Both are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="lock" subtitle="Block a physical input" />
          <pre class="api-signature">fn lock(&self, target: LockTarget, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> picks the input and{' '}
            <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A> picks the sign
            or edge; both enums and their bytes are on{' '}
            <A href="/library/types/enums">Types</A>. For an axis or the wheel the direction is a sign,
            so you can block scrolling up but not down. For a button it's an edge, so you can block the
            press but not the release.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#lock-target"><code>LockTarget</code></A></td><td><code>X</code>, <code>Y</code>, <code>Wheel</code>, or <code>Button(Button)</code>.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#lock-direction"><code>LockDirection</code></A></td><td><code>Both</code>, <code>Positive</code> (axis +, button press), or <code>Negative</code> (axis −, button release).</td></tr>
            </tbody>
          </table>
          <p>
            A lock blocks the physical mouse only. A lock holds until you{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A> it, and the box also clears every
            lock on control-PC silence, on <A href="/library/admin#reset"><code>reset</code></A>, or on
            inter-chip link loss. See the native{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A> command for the wire layout.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Button, LockTarget, LockDirection};

let device = Device::find()?;
device.lock(LockTarget::X, LockDirection::Both)?;                // freeze horizontal motion
device.lock(LockTarget::Button(Button::Left), LockDirection::Positive)?; // block left-click press
device.move_rel(50, 0)?;                                         // injection still moves X`}</code></pre>
        </Card>
      </div>

      <div id="unlock" data-search-target>
        <Card>
          <CardHeader title="unlock" subtitle="Clear a block" />
          <pre class="api-signature">fn unlock(&self, target: LockTarget, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The inverse of <A href="/library/lock#lock"><code>lock</code></A>: same{' '}
            <code>target</code> and <code>direction</code>, but it clears the block instead of setting
            it. Hand a physical input back to the user.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, LockTarget, LockDirection};

let device = Device::find()?;
device.unlock(LockTarget::X, LockDirection::Both)?;   // hand horizontal motion back`}</code></pre>
        </Card>
      </div>

      <div id="query-locks" data-search-target>
        <Card>
          <CardHeader title="query_locks" subtitle="Read the active locks" />
          <pre class="api-signature">fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#locks"><code>Locks</code></A>, the set of
            currently locked inputs. <code>is_locked(target, direction)</code> answers whether one
            particular lock is set. Read it to confirm a lock landed, or to mirror the box's state in a
            UI. See the native{' '}
            <A href="/native/commands/requests#locks"><code>LOCKS</code></A> reply for the bit layout.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, LockTarget, LockDirection};

let device = Device::find()?;
let locks = device.query_locks()?;
if locks.is_locked(LockTarget::X, LockDirection::Both) {
    println!("horizontal motion is frozen");
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="lock and unlock fire, query_locks awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>lock</code> and <code>unlock</code> synchronous, since they expect no reply.{' '}
            <code>query_locks</code> is a future, like the other queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::{AsyncDevice, LockTarget, LockDirection};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.lock(LockTarget::Y, LockDirection::Both)?;     // sync, no await
let locks = block_on(device.query_locks())?;          // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
