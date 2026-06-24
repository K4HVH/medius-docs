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
            <tr><td>mouse axis / wheel / button</td><td><A href="/library/lock#lock"><code>lock</code></A></td><td><code>unlock</code></td></tr>
            <tr><td>keyboard key</td><td><A href="/library/lock#lock-key"><code>lock_key</code></A></td><td><code>unlock_key</code></td></tr>
            <tr><td>media usage</td><td><A href="/library/lock#lock-media"><code>lock_media</code></A></td><td><code>unlock_media</code></td></tr>
            <tr><td>a whole class (blanket)</td><td><A href="/library/lock#lock-all"><code>lock_all</code></A></td><td><code>unlock_all</code></td></tr>
          </tbody>
        </table>
        <p>
          All are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.{' '}
          <A href="/library/lock#query-locks"><code>query_locks</code></A> reads the active mouse set.
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

      <div id="lock-key" data-search-target>
        <Card>
          <CardHeader title="lock_key / unlock_key" subtitle="Block a physical key" />
          <pre class="api-signature">fn lock_key(&self, key: Key, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_key(&self, key: Key, direction: LockDirection) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Block one physical keyboard <A href="/library/types/structs#key"><code>Key</code></A> by
            edge: <A href="/library/types/enums#lock-direction"><code>Positive</code></A> stops new
            presses, <code>Negative</code> latches a held key down. Injection still drives the key.{' '}
            <code>unlock_key</code> clears the block.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Key, LockDirection};

device.lock_key(Key::LEFT_GUI, LockDirection::Both)?;   // block the GUI/Windows key
device.unlock_key(Key::LEFT_GUI, LockDirection::Both)?;`}</code></pre>
        </Card>
      </div>

      <div id="lock-media" data-search-target>
        <Card>
          <CardHeader title="lock_media / unlock_media" subtitle="Block a physical media key" />
          <pre class="api-signature">fn lock_media(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_media(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Drop one physical <A href="/library/types/structs#media-key"><code>MediaKey</code></A> usage
            from the report. Injection still drives it; <code>unlock_media</code> hands it back.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::MediaKey;

device.lock_media(MediaKey::VOLUME_UP)?;
device.unlock_media(MediaKey::VOLUME_UP)?;`}</code></pre>
        </Card>
      </div>

      <div id="lock-all" data-search-target>
        <Card>
          <CardHeader title="lock_all / unlock_all" subtitle="Blanket-block a whole class" />
          <pre class="api-signature">fn lock_all(&self, what: Blanket) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_all(&self, what: Blanket) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Block an entire input class at once with a{' '}
            <A href="/library/types/enums#blanket"><code>Blanket</code></A>: <code>Keys</code>,{' '}
            <code>Media</code>, or <code>Buttons</code>. Injection still drives any field you choose to.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Blanket;

device.lock_all(Blanket::Keys)?;    // every physical key blocked
device.unlock_all(Blanket::Keys)?;`}</code></pre>
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
            <code>lock</code> and <code>unlock</code> synchronous, since they expect no reply, and{' '}
            <code>query_locks</code> is a future like the other queries. The key, media, and blanket
            variants live on <A href="/library/connection#async"><code>Device</code></A> only; reach
            them with <code>into_inner()</code> if you hold an <code>AsyncDevice</code>.
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
