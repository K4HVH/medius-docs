import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lock" subtitle="Weigh one physical input; injection still drives it" />
        <p>
          A scale sets how much of one <em>physical</em> input reaches the game PC;{' '}
          <A href="/native/injection">injection</A> still drives that input unweighed. Blocking and
          passing are its two ends.
        </p>
        <pre class="diagram">{`  scale -100  physical  <--   inverted
  scale 0     physical  --X   blocked
  scale 40    physical  -.->  40% gets through
  scale 100   physical  -->   untouched
  scale 200   physical  ==>   doubled

  injection always -->  unweighed, whatever the scale`}</pre>
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
      </Card>

      <div id="scale" data-search-target>
        <Card>
          <CardHeader title="scale" subtitle="Keep a percentage of a physical input" />
          <pre class="api-signature">fn scale(&self, target: impl Into&lt;LockTarget&gt;, direction: Direction, scale: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>impl Into&lt;<A href="/library/types/enums#lock-target">LockTarget</A>&gt;</code></td><td>An <A href="/library/types/enums#axis"><code>Axis</code></A> (X, Y, wheel, or pan) or any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>A fixed sign or edge, or <code>With</code> / <code>Against</code> relative to the bearing. A relative direction on anything but an axis is <A href="/library/types/errors#errors"><code>Error::RelativeDirection</code></A>. Media has no edges, so an edge on it goes out as <code>Both</code>.</td></tr>
              <tr><td><code>scale</code></td><td><code>i16</code></td><td>Percent of the physical value kept. <code>LOCK_SCALE_BLOCK</code> (0) blocks, <code>LOCK_SCALE_PASS</code> (100) passes untouched, up to <code>LOCK_SCALE_MAX</code> (255) amplifies, and down to <code>LOCK_SCALE_MIN</code> (-255) reverses. Outside that is <A href="/library/types/errors#errors"><code>Error::LockScaleRange</code></A>.</td></tr>
            </tbody>
          </table>
          <p>
            A delta gets one fixed-direction scale times one relative one, so a block in either zeroes
            the product. <code>With</code> and <code>Against</code> need a live bearing (
            <A href="/library/options#set-bearing"><code>set_bearing</code></A>). A momentary usage is one
            bit: any scale under 100 locks it, and a negative is{' '}
            <A href="/library/types/errors#errors"><code>Error::LockScaleUsage</code></A>.
          </p>
          <p>
            The slot comes from the delta's sign before weighing: <code>Positive</code> at{' '}
            <code>-100</code> turns rightward motion leftward and leaves leftward motion alone.
          </p>
          <div class="callout callout--info">
            <p>
              <code>Direction::Both</code> writes the scale to the two fixed signs and a full pass to
              the relative pair, so <code>Both</code> of 50 means 50% whether or not a bearing is live.{' '}
              <A href="/native/commands/lock#direction">Why</A>.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Direction};

let device = Device::find()?;
device.scale(Axis::X, Direction::Against, 40)?;  // 40% of physical motion opposing the injection
device.scale(Axis::X, Direction::With, 130)?;    // 130% of it along the injection
device.scale(Axis::Y, Direction::Negative, 60)?; // 60% of upward motion, always
device.scale(Axis::Y, Direction::Both, -100)?;   // Y inverted`}</code></pre>
        </Card>
      </div>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="lock" subtitle="Block a physical input" />
          <pre class="api-signature">fn lock(&self, target: impl Into&lt;LockTarget&gt;, direction: Direction) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/lock#scale"><code>scale</code></A> at <code>LOCK_SCALE_BLOCK</code>.{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> picks the input and{' '}
            <A href="/library/types/enums#direction"><code>Direction</code></A> picks the sign or edge,
            also spelled <code>Direction::PRESS</code> and <code>Direction::RELEASE</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>impl Into&lt;<A href="/library/types/enums#lock-target">LockTarget</A>&gt;</code></td><td>An <A href="/library/types/enums#axis"><code>Axis</code></A> (X, Y, wheel, or pan) or any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>Which sign or edge to block. An axis also takes the bearing-relative <code>With</code> / <code>Against</code>.</td></tr>
            </tbody>
          </table>
          <p>
            A lock holds until <A href="/library/lock#unlock"><code>unlock</code></A>, control-PC
            silence, <A href="/library/admin#reset"><code>reset</code></A>, inter-chip link loss, or the
            real device detaching. The wire layout is on the native{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A> command.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Button, Key, MediaKey, Direction};

let device = Device::find()?;
device.lock(Axis::X, Direction::Both)?;           // freeze horizontal motion
device.lock(Button::LEFT, Direction::Positive)?;  // block left-click press
device.lock(Key::LEFT_GUI, Direction::Both)?;     // block the GUI/Windows key
device.lock(MediaKey::PLAY_PAUSE, Direction::Both)?; // media has no edges
device.move_rel(50, 0)?;                          // injection still moves X`}</code></pre>
        </Card>
      </div>

      <div id="unlock" data-search-target>
        <Card>
          <CardHeader title="unlock" subtitle="Clear a block" />
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
        </Card>
      </div>

      <div id="lock-axis" data-search-target>
        <Card>
          <CardHeader title="lock_axis / unlock_axis / scale_axis" subtitle="Weigh a relative axis by sign" />
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
        </Card>
      </div>

      <div id="lock-all" data-search-target>
        <Card>
          <CardHeader title="lock_all / unlock_all / scale_all" subtitle="Weigh a whole class at once" />
          <pre class="api-signature">fn lock_all(&self, what: Blanket, direction: Direction) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn unlock_all(&self, what: Blanket, direction: Direction) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn scale_all(&self, what: Blanket, direction: Direction, scale: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            A <A href="/library/types/enums#blanket"><code>Blanket</code></A> weighs a whole input
            group. <code>direction</code> reaches every member as it reaches one: <code>Keys</code> takes
            an edge, and <code>Media</code>, having none, sends <code>Both</code>.
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
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="locks fire, query_locks awaits" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps every lock call
            synchronous (<code>scale</code>, <code>lock</code>/<code>unlock</code>,{' '}
            <code>scale_axis</code>, and <code>scale_all</code> with their lock and unlock pairs), with no
            reply to await; <code>query_locks</code> is a future.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Axis, Direction};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.lock(Axis::Y, Direction::Both)?;       // sync, no await
let locks = block_on(device.query_locks())?;  // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
