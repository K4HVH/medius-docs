import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Lock: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          A scale sets how much of one <em>native</em> input reaches the game PC.{' '}
          <A href="/native/injection">Injection</A> still drives that input unweighed.
        </p>
        <pre class="diagram">{`  scale -100  native  <--   inverted
  scale 0     native  --X   blocked
  scale 40    native  -.->  40% gets through
  scale 100   native  -->   untouched
  scale 200   native  ==>   doubled

  injected    always  -->   unweighed, whatever the scale`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Weigh a...</th><th>Signed percent</th><th>Block</th><th>Release</th></tr></thead>
            <tbody>
              <tr><td>relative axis (X / Y / wheel / pan)</td><td><A href="/library/lock#scale"><code>scale</code></A> / <A href="/library/lock#lock-axis"><code>scale_axis</code></A></td><td><A href="/library/lock#lock"><code>lock</code></A> / <A href="/library/lock#lock-axis"><code>lock_axis</code></A></td><td><A href="/library/lock#unlock"><code>unlock</code></A> / <A href="/library/lock#lock-axis"><code>unlock_axis</code></A></td></tr>
              <tr><td>button, key, or media usage</td><td>truncates to a lock; a negative is refused</td><td><A href="/library/lock#lock"><code>lock</code></A></td><td><A href="/library/lock#unlock"><code>unlock</code></A></td></tr>
              <tr><td>a whole class (blanket)</td><td><A href="/library/lock#lock-all"><code>scale_all</code></A></td><td><A href="/library/lock#lock-all"><code>lock_all</code></A></td><td><A href="/library/lock#lock-all"><code>unlock_all</code></A></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          All are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.{' '}
          <A href="/library/requests#query-locks"><code>query_locks</code></A> reads the active set.
        </p>
      </PageHeader>

      <DocSection id="scale" title="scale" caption="Keep a percentage of a native input">
        <pre class="api-signature">fn scale(&self, target: impl Into&lt;LockTarget&gt;, direction: Direction, scale: i16) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>impl Into&lt;<A href="/library/types/enums#lock-target">LockTarget</A>&gt;</code></td><td>An <A href="/library/types/enums#axis"><code>Axis</code></A> (X, Y, wheel, or pan) or any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>A fixed sign or edge, or <code>With</code> / <code>Against</code> relative to the bearing. A relative direction on anything but an axis returns <A href="/library/types/errors#errors"><code>Error::RelativeDirection</code></A>. Media has no edges, so an edge on it is sent as <code>Both</code>.</td></tr>
              <tr><td><code>scale</code></td><td><code>i16</code></td><td>Percent of the native value kept. <code>LOCK_SCALE_BLOCK</code> (0) blocks and <code>LOCK_SCALE_PASS</code> (100) passes untouched. Above 100 amplifies, up to <code>LOCK_SCALE_MAX</code> (255). Below 0 reverses, down to <code>LOCK_SCALE_MIN</code> (-255). Outside that range returns <A href="/library/types/errors#errors"><code>Error::LockScaleRange</code></A>.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          A delta is weighed by one fixed-direction scale times one relative scale, so a block in
          either zeroes it. <code>With</code> and <code>Against</code> need a live bearing (
          <A href="/library/options#set-bearing"><code>set_bearing</code></A>). A momentary usage is one
          bit: any scale &lt;100 locks it, and a negative returns{' '}
          <A href="/library/types/errors#errors"><code>Error::LockScaleUsage</code></A>.
        </p>
        <p>
          The delta's sign before weighing picks which direction's scale applies:{' '}
          <code>Positive</code> at <code>-100</code> turns rightward motion leftward and leaves
          leftward motion alone.
        </p>
        <div class="callout callout--info">
          <p>
            <code>Direction::Both</code> writes the scale to the two fixed signs and a{' '}
            <A href="/native/commands/lock#direction">full pass to the relative pair</A>, so{' '}
            <code>Both</code> of 50 means 50% whether or not a bearing is live.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, Axis, Direction};

let device = Device::find()?;
device.scale(Axis::X, Direction::Against, 40)?;  // 40% of native motion opposing the injection
device.scale(Axis::X, Direction::With, 130)?;    // 130% of it along the injection
device.scale(Axis::Y, Direction::Negative, 60)?; // 60% of upward motion, always
device.scale(Axis::Y, Direction::Both, -100)?;   // Y inverted`}</code></pre>
      </DocSection>

      <DocSection id="lock" title="lock" caption="Block a native input">
        <pre class="api-signature">fn lock(&self, target: impl Into&lt;LockTarget&gt;, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <A href="/library/lock#scale"><code>scale</code></A> at <code>LOCK_SCALE_BLOCK</code>. On a
          usage, <code>Positive</code> and <code>Negative</code> are also spelled{' '}
          <code>Direction::PRESS</code> and <code>Direction::RELEASE</code>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>impl Into&lt;<A href="/library/types/enums#lock-target">LockTarget</A>&gt;</code></td><td>An <A href="/library/types/enums#axis"><code>Axis</code></A> (X, Y, wheel, or pan) or any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>Which sign or edge to block. An axis also takes the bearing-relative <code>With</code> / <code>Against</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          A lock holds until <A href="/library/lock#unlock"><code>unlock</code></A>, control-PC
          silence, <A href="/library/admin#reset"><code>reset</code></A>, inter-chip link loss, or the
          real device detaching. The wire layout is on the native{' '}
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> command.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, Axis, Button, Key, MediaKey, Direction};

let device = Device::find()?;
device.lock(Axis::X, Direction::Both)?;           // block horizontal motion
device.lock(Button::LEFT, Direction::Positive)?;  // block left-click press
device.lock(Key::LEFT_GUI, Direction::Both)?;     // block the GUI/Windows key
device.lock(MediaKey::PLAY_PAUSE, Direction::Both)?; // media has no edges
device.move_rel(50, 0)?;                          // injection still moves X`}</code></pre>
      </DocSection>

      <DocSection id="unlock" title="unlock" caption="Clear a block">
        <pre class="api-signature">fn unlock(&self, target: impl Into&lt;LockTarget&gt;, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <A href="/library/lock#scale"><code>scale</code></A> at <code>LOCK_SCALE_PASS</code> for the
          same <code>target</code> and <code>direction</code>. <code>Direction::Both</code> clears every
          direction of the target, the bearing-relative pair included.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, Axis, Direction};

let device = Device::find()?;
device.unlock(Axis::X, Direction::Both)?;   // X passes untouched again`}</code></pre>
      </DocSection>

      <DocSection id="lock-axis" title="lock_axis / unlock_axis / scale_axis" caption="Weigh a relative axis by sign">
        <pre class="api-signature">fn lock_axis(&self, axis: Axis, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">fn unlock_axis(&self, axis: Axis, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">fn scale_axis(&self, axis: Axis, direction: Direction, scale: i16) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          <A href="/library/lock#lock"><code>lock</code></A> /{' '}
          <A href="/library/lock#unlock"><code>unlock</code></A> /{' '}
          <A href="/library/lock#scale"><code>scale</code></A> for an{' '}
          <A href="/library/types/enums#axis"><code>Axis</code></A>, with a sign as the direction.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, Axis, Direction};

let device = Device::find()?;
device.lock_axis(Axis::Wheel, Direction::Positive)?; // block scroll up, keep scroll down
device.unlock_axis(Axis::Wheel, Direction::Positive)?;`}</code></pre>
      </DocSection>

      <DocSection id="lock-all" title="lock_all / unlock_all / scale_all" caption="Weigh a whole class at once">
        <pre class="api-signature">fn lock_all(&self, what: Blanket, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">fn unlock_all(&self, what: Blanket, direction: Direction) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">fn scale_all(&self, what: Blanket, direction: Direction, scale: i16) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
        <p>
          A <A href="/library/types/enums#blanket"><code>Blanket</code></A> weighs a whole input
          group. <code>direction</code> applies to every member as it would to one. <code>Keys</code>{' '}
          takes an edge; <code>Media</code> has no edges, so it sends <code>Both</code>.
        </p>
        <p>
          <code>Blanket::Aim</code> addresses X and Y together in{' '}
          <A href="/library/types/enums#bearing-mode"><code>BearingMode::Vector</code></A>, which reads
          X and Y as one vector.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, Blanket, Direction};

let device = Device::find()?;
device.lock_all(Blanket::Keys, Direction::Both)?;        // every key, both edges
device.lock_all(Blanket::Keys, Direction::Positive)?;    // press edges only: a held key still releases
device.unlock_all(Blanket::Keys, Direction::Both)?;
device.scale_all(Blanket::Aim, Direction::Against, 40)?; // 40% of motion opposing the injection, X and Y`}</code></pre>
      </DocSection>

      <DocSection id="async" title="On AsyncDevice" caption="locks fire, query_locks awaits">
        <p>
          <A href="/library/features/async"><code>AsyncDevice</code></A> keeps every lock call
          synchronous, with no reply to await: <code>scale</code>, <code>lock</code>/<code>unlock</code>,{' '}
          <code>scale_axis</code>, and <code>scale_all</code> with their lock and unlock pairs.{' '}
          <code>query_locks</code> is a future.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Axis, Direction};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.lock(Axis::Y, Direction::Both)?;       // sync, no await
let locks = block_on(device.query_locks())?;  // query awaits`}</code></pre>
      </DocSection>
    </>
  );
};

export default Lock;
