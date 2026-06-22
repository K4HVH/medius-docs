import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Requests: Component = () => {
  return (
    <>
      <div id="requests-overview" data-search-target>
        <Card>
          <CardHeader title="Requests" subtitle="Asking the box a question and waiting for the answer" />
          <p>
            Unlike <A href="/native/injection#fire-and-forget">fire-and-forget</A>, the seven queries
            are blocking: a question frame out, one answer frame back. They are{' '}
            <A href="/library/requests#version"><code>query_version</code></A>,{' '}
            <A href="/library/requests#health"><code>query_health</code></A>,{' '}
            <A href="/library/requests#query-mouse-info"><code>query_mouse_info</code></A>,{' '}
            <A href="/library/requests#query-caps"><code>query_caps</code></A>,{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>,{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>, and{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A>, each covered below.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="query_version" subtitle="Firmware identity, round-trip" />
          <pre class="api-signature">fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#version"><code>Version</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;          // or Device::open("/dev/ttyACM0")?
let v = device.query_version()?;
println!("{v}");                       // fw 1.2.3
println!("proto {}", v.proto_ver);     // proto 1`}</code></pre>

          <div class="callout callout--info">
            <p>
              <code>Device::find()</code> already runs a version query during the handshake;
              calling <code>query_version</code> again just re-reads it.
            </p>
          </div>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="query_health" subtitle="Is the mouse-to-box-to-PC chain live" />
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#health"><code>Health</code></A>, six booleans from one
            status byte. <code>link_up</code>, <code>mouse_attached</code>, and{' '}
            <code>clone_configured</code> must all be true before{' '}
            <A href="/native/injection">injection</A> has anywhere to land.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let h = device.query_health()?;
if h.link_up && h.mouse_attached && h.clone_configured {
    // chain is live, safe to inject
} else {
    eprintln!("not ready: {h:?}");
}`}</code></pre>
        </Card>
      </div>

      <div id="query-mouse-info" data-search-target>
        <Card>
          <CardHeader title="query_mouse_info" subtitle="USB identity of the emulated mouse" />
          <pre class="api-signature">fn query_mouse_info(&self) -&gt; Result&lt;MouseInfo&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#mouse-info"><code>MouseInfo</code></A>: the{' '}
            <code>vid</code>, <code>pid</code>, and USB version the box read off the real mouse. The
            clone sits on the game PC's bus, so this is the only way to see it from the control link.
            Every field is zero when no mouse is cloned. <code>Display</code> prints{' '}
            <code>VVVV:PPPP</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let m = device.query_mouse_info()?;
if m.vid == 0 {
    eprintln!("no mouse cloned yet");
} else {
    println!("{m}");                    // 046D:C08B
    println!("usb {:#06x}", m.bcd_usb);
    println!("serial={} bos={}", m.has_serial, m.has_bos);
}`}</code></pre>
        </Card>
      </div>

      <div id="query-caps" data-search-target>
        <Card>
          <CardHeader title="query_caps" subtitle="Feature-detect the cloned mouse" />
          <pre class="api-signature">fn query_caps(&self) -&gt; Result&lt;Caps&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#caps"><code>Caps</code></A>. Use it for feature
            detection: a <A href="/library/buttons#press"><code>press</code></A> on a button the mouse
            lacks is a silent no-op, so <code>n_buttons</code> tells you which ids are real.{' '}
            <code>is_composite()</code> is true when <code>n_hid &gt; 1</code>. Every field is zero
            when no relative-axis mouse interface is bound.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let c = device.query_caps()?;
println!("{} buttons", c.n_buttons);
if c.has_wheel {
    device.wheel(1)?;
}
if c.is_composite() {
    println!("{} HID interfaces", c.n_hid);
}`}</code></pre>
        </Card>
      </div>

      <div id="query-rate" data-search-target>
        <Card>
          <CardHeader title="query_rate" subtitle="Read the live native report rate" />
          <pre class="api-signature">fn query_rate(&self) -&gt; Result&lt;Rate&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#rate"><code>Rate</code></A>.{' '}
            <code>native_hz()</code> converts the period to a frequency, returning <code>None</code>{' '}
            while <code>native_period_us</code> is still <code>0</code> (not learned yet).{' '}
            <code>confident</code> is true once the estimator window is full and the value is
            trustworthy.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let r = device.query_rate()?;
match r.native_hz() {
    Some(hz) if r.confident => println!("{hz:.0} Hz"),
    Some(hz)                => println!("{hz:.0} Hz (still settling)"),
    None                    => println!("rate not learned yet"),
}`}</code></pre>
        </Card>
      </div>

      <div id="query-stats" data-search-target>
        <Card>
          <CardHeader title="query_stats" subtitle="Read the delivery counters" />
          <pre class="api-signature">fn query_stats(&self) -&gt; Result&lt;Stats&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#stats"><code>Stats</code></A>.{' '}
            <code>inject_emits</code> counts pure-injection reports emitted; a nonzero{' '}
            <code>tx_drops</code> or <code>tx_wedges</code> is the signal that delivery degraded under
            load. The narrowed counters saturate, so a maxed field clamps instead of wrapping.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

let device = Device::find()?;
let s = device.query_stats()?;
println!("{} emits", s.inject_emits);
if s.tx_drops > 0 || s.tx_wedges > 0 {
    eprintln!("delivery degraded: {} drops, {} wedges", s.tx_drops, s.tx_wedges);
}`}</code></pre>
        </Card>
      </div>

      <div id="query-locks" data-search-target>
        <Card>
          <CardHeader title="query_locks" subtitle="Read the active input locks" />
          <pre class="api-signature">fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#locks"><code>Locks</code></A>, the inputs
            currently blocked by <A href="/library/lock#lock"><code>lock</code></A>.{' '}
            <code>is_locked(target, direction)</code> answers whether one particular lock is set. Read
            it to confirm a lock landed, or to mirror the box's lock state in a UI.
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
          <CardHeader title="Async queries" subtitle="The same seven queries on AsyncDevice" />
          <pre class="api-signature">async fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <pre class="api-signature">async fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <pre class="api-signature">async fn query_mouse_info(&self) -&gt; Result&lt;MouseInfo&gt;</pre>
          <pre class="api-signature">async fn query_caps(&self) -&gt; Result&lt;Caps&gt;</pre>
          <pre class="api-signature">async fn query_rate(&self) -&gt; Result&lt;Rate&gt;</pre>
          <pre class="api-signature">async fn query_stats(&self) -&gt; Result&lt;Stats&gt;</pre>
          <pre class="api-signature">async fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <pre><code>cargo add medius --features async</code></pre>

          <p>
            With the <code>async</code> feature, <code>Device::into_async()</code> yields an{' '}
            <A href="/library/features/async"><code>AsyncDevice</code></A> whose queries are futures;
            other methods stay synchronous. All seven queries are
            futures here. The crate is
            runtime-agnostic (no tokio), so drive a future with anything, such as{' '}
            <a
              href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html"
              target="_blank"
              rel="noreferrer"
            ><code>futures::executor::block_on</code></a>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use futures::executor::block_on;
use medius::Device;

let device = Device::find()?.into_async();
let v = block_on(device.query_version())?;
let h = block_on(device.query_health())?;
println!("{v} link_up={}", h.link_up);`}</code></pre>
        </Card>
      </div>

    </>
  );
};

export default Requests;
