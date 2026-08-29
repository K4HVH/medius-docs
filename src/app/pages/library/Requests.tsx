import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Requests: Component = () => {
  return (
    <>
      <div id="requests-overview" data-search-target>
        <Card>
          <CardHeader title="Requests" subtitle="One QUERY frame out, one RESP frame back" />
          <p>
            Unlike the <A href="/native/injection#fire-and-forget">fire-and-forget</A> calls, the queries
            block: one <code>QUERY</code> frame out, one <code>RESP</code> frame back. They are{' '}
            <A href="/library/requests#version"><code>query_version</code></A>,{' '}
            <A href="/library/requests#health"><code>query_health</code></A>,{' '}
            <A href="/library/requests#device-info"><code>device_info</code></A>,{' '}
            <A href="/library/requests#caps"><code>caps</code></A>,{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>,{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>,{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A>, and{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A>, plus{' '}
            <A href="/library/requests#clip-status"><code>query_status</code></A> and{' '}
            <A href="/library/requests#clip-config"><code>query_config</code></A> on the{' '}
            <A href="/library/clip#handle">clip handle</A>.
          </p>
        </Card>
      </div>

      <div id="version" data-search-target>
        <Card>
          <CardHeader title="query_version" subtitle="Firmware identity, round-trip" />
          <pre class="api-signature">fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#version"><code>Version</code></A>. The box's{' '}
            <A href="/library/options#set-name">name</A> rides on it, in the <code>name</code> field.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;          // or Device::open("/dev/ttyACM0")?
let v = device.query_version()?;
println!("{v}");                       // fw 3.3.1
println!("proto {}", v.proto_ver);     // proto 6
println!("name {}", v.name);           // Loki`}</code></pre>

          <div class="callout callout--info">
            <p>
              <A href="/library/connection#open"><code>Device::find()</code></A> already runs a version query during the handshake;
              calling <code>query_version</code> again just re-reads it.
            </p>
          </div>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="query_health" subtitle="The status bits of the device-to-box-to-PC path" />
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#health"><code>Health</code></A>, eight booleans from one
            status byte. <code>link_up</code>, <code>mouse_attached</code>, and{' '}
            <code>clone_configured</code> must all be true before{' '}
            <A href="/native/injection">injection</A> is emitted at all.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let h = device.query_health()?;
if h.link_up && h.mouse_attached && h.clone_configured {
    // chain is live, safe to inject
} else {
    eprintln!("not ready: {h:?}");
}`}</code></pre>
        </Card>
      </div>

      <div id="device-info" data-search-target>
        <Card>
          <CardHeader title="device_info" subtitle="USB identity, kind, and product of the clone" />
          <pre class="api-signature">fn device_info(&self) -&gt; Result&lt;DeviceInfo&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#device-info"><code>DeviceInfo</code></A>: the{' '}
            <code>vid</code>, <code>pid</code>, USB version, a{' '}
            <A href="/library/types/enums#device-kind"><code>DeviceKind</code></A>, and the{' '}
            <code>product</code> string the box read off the real device. Every field is zero/empty when
            nothing is cloned. <code>Display</code> prints <code>VVVV:PPPP product</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, DeviceKind};

let device = Device::find()?;
let d = device.device_info()?;
if d.vid == 0 {
    eprintln!("nothing cloned yet");
} else {
    println!("{d}");                    // 046D:C08B G502
    println!("usb {:#06x}", d.bcd_usb);
    println!("kind={} serial={} bos={}", d.kind, d.has_serial, d.has_bos);
    if d.kind == DeviceKind::Mouse {
        // the clone is a mouse
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="caps" data-search-target>
        <Card>
          <CardHeader title="caps" subtitle="Feature-detect the whole device" />
          <pre class="api-signature">fn caps(&self) -&gt; Result&lt;Caps&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#caps"><code>Caps</code></A>: a{' '}
            <A href="/library/types/structs#mouse-caps"><code>mouse</code></A> half, a{' '}
            <A href="/library/types/structs#kbd-caps"><code>keyboard</code></A> half, and the per-class
            change-driven flags. An absent class reads all-zero; <code>has_mouse()</code> and{' '}
            <code>has_keyboard()</code> say which are bound. An{' '}
            <A href="/library/inject#inject"><code>inject</code></A> for a usage the device lacks is dropped with no error, so feature-detect here first.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let caps = device.caps()?;
println!("{} buttons", caps.mouse.n_buttons);
if caps.mouse.has_wheel {
    device.wheel(1)?;
}
if caps.has_keyboard() && caps.keyboard.has_consumer {
    device.press(medius::MediaKey::MUTE)?;
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
          <pre><code class="language-rust">{`use medius::Device;

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
          <pre><code class="language-rust">{`use medius::Device;

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
          <CardHeader title="query_locks" subtitle="Read the active input scales" />
          <pre class="api-signature">fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#locks"><code>Locks</code></A>, every direction
            currently weighed by <A href="/library/lock#scale"><code>scale</code></A>.{' '}
            <code>scale_of(target, direction)</code> reads the percentage in effect and{' '}
            <code>is_locked(target, direction)</code> reports whether it is blocked outright. What a
            blanket, a media usage, and a vector-mode relative direction report is on{' '}
            <A href="/library/types/structs#locks">Locks</A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Direction};

let device = Device::find()?;
let locks = device.query_locks()?;
if locks.is_locked(Axis::X, Direction::Both) {
    println!("horizontal motion is frozen");
}
println!("opposing the injection at {}%", locks.scale_of(Axis::X, Direction::Against));`}</code></pre>
        </Card>
      </div>

      <div id="query-catch" data-search-target>
        <Card>
          <CardHeader title="query_catch" subtitle="Read the active catch subscription" />
          <pre class="api-signature">fn query_catch(&self) -&gt; Result&lt;CatchState&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#catch-state"><code>CatchState</code></A>: the
            live subscription table as a list of{' '}
            <A href="/library/types/structs#catch-entry"><code>CatchEntry</code></A>, the{' '}
            <code>table_full</code> flag, the box-wide <code>dropped</code> count, and a{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A> relating the
            two chips' timers.
          </p>
          <p>
            <A href="/library/catch#catch-events"><code>catch_events</code></A> is fire-and-forget:
            the box sends no reply to a subscription. Each entry returns the{' '}
            <code>class / id / direction / capture</code> the box accepted, so checking the list
            against the <A href="/library/types/structs#catch-filter">filters</A> you sent is the only
            way to confirm every one was accepted.
          </p>
          <p>
            A filter that is missing was refused. <code>table_full</code> says which reason: the
            32-entry table was full, or the filter itself was malformed.
          </p>

          <div class="api-response-label">DROPS AND THE CLOCK</div>
          <p>
            <code>CatchState::dropped</code> is box-wide and{' '}
            <A href="/library/types/structs#catch-entry"><code>CatchEntry::dropped</code></A> is per
            entry, with a lost event charged to every entry it resolved against. Drops on the entry you
            care about mean the subscription is too broad for the link.
          </p>
          <p>
            The two chips stamp events on clocks that share no epoch. <code>clock</code> is the
            measured gap between them, and what its fields mean is on{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Capture, CatchFilter, Class, Device, TrafficClass};

let device = Device::find()?;
// Bind the stream: dropping it unsubscribes, and the query below would then find an empty table.
let _events = device.catch_events([
    CatchFilter::watch_class(Class::Key),
    CatchFilter::traffic(TrafficClass::VendorBulk, 0x02).with_capture(Capture::First(16)),
])?;

let c = device.query_catch()?;
if c.table_full {
    eprintln!("the 32-entry table is full: some filters were refused");
}
for e in &c.entries {
    let f = e.filter;
    println!("{:?} {:?} capture={:?} dropped={}", f.class(), f.id(), f.capture(), e.dropped);
}
println!("{} dropped box-wide", c.dropped);
if let Some(age) = c.clock.age {
    println!("clocks differ by {} us (+/- {}, {age:?} old)", c.clock.offset_us, c.clock.delay_us / 2);
}`}</code></pre>
        </Card>
      </div>

      <div id="clip-status" data-search-target>
        <Card>
          <CardHeader title="query_status (clip)" subtitle="Read the buffered-clip ring depth, progress, and playback state" />
          <pre class="api-signature">fn query_status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            On the <A href="/library/clip#handle"><code>ClipHandle</code></A> from{' '}
            <A href="/library/clip#clip"><code>device.clip()</code></A>, not <code>Device</code> itself.
            Returns a <A href="/library/types/structs#clip-status"><code>ClipStatus</code></A>:{' '}
            <code>state</code> (including{' '}
            <A href="/library/types/enums#clip-state"><code>Faulted</code></A>), ring <code>free</code>,
            retained <code>played</code>/<code>total</code>, the drain counters, and the{' '}
            <code>held</code> usages. Backs{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let clip = device.clip();
let s = clip.query_status()?;
if s.state == medius::ClipState::Faulted { clip.clear()?; }
println!("{} free, {} played", s.free, s.played);`}</code></pre>
        </Card>
      </div>

      <div id="clip-config" data-search-target>
        <Card>
          <CardHeader title="query_config (clip)" subtitle="Read the whole clip config back" />
          <pre class="api-signature">fn query_config(&self) -&gt; Result&lt;ClipSettings&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            The config view of the same{' '}
            <A href="/native/commands/requests#clip"><code>QUERY(CLIP)</code></A> frame{' '}
            <A href="/library/requests#clip-status"><code>query_status</code></A> reads, also on the{' '}
            <A href="/library/clip#handle"><code>ClipHandle</code></A>. Returns a{' '}
            <A href="/library/types/structs#clip-settings"><code>ClipSettings</code></A> with the auto-lock,
            loop, retain, finalized flag, and <A href="/library/clip#triggers">triggers</A> you set. Every
            setting round-trips.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let cfg = device.clip().query_config()?;
println!("{} triggers, loop={}", cfg.triggers.len(), cfg.loop_);`}</code></pre>
        </Card>
      </div>

      <div id="firmware-info" data-search-target>
        <Card>
          <CardHeader title="firmware_info" subtitle="Read both chips' versions, slots, and what is staged" />
          <pre class="api-signature">fn firmware_info(&self) -&gt; Result&lt;FirmwareInfo&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Backs <A href="/native/commands/requests#firmware"><code>QUERY(FIRMWARE)</code></A>. The
            other firmware calls live on{' '}
            <A href="/library/update">the update page</A>.
          </p>
          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>device</code></td><td><code>ChipFirmware</code></td><td>version, slot, and image state</td></tr>
              <tr><td><code>host</code></td><td><code>Option&lt;ChipFirmware&gt;</code></td><td><code>None</code> when the host chip has not answered over the inter-chip link</td></tr>
              <tr><td><code>slot_size</code></td><td><code>u32</code></td><td>usable bytes in a spare slot, the same on both chips</td></tr>
              <tr><td><code>device_staged</code></td><td><code>bool</code></td><td>an image is written and waiting to be activated</td></tr>
              <tr><td><code>host_staged</code></td><td><code>bool</code></td><td>the same, for the host chip</td></tr>
            </tbody>
          </table>
          <p>
            This is the only call that reports the host chip's version.{' '}
            <A href="/library/requests#version"><code>query_version</code></A> reports the device
            chip alone.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let fw = device.firmware_info()?;
println!("device {}", fw.device);
match fw.host {
    Some(h) => println!("host {h}"),
    None => println!("host chip not answering"),
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="Async queries" subtitle="The same queries on AsyncDevice" />
          <pre class="api-signature">async fn query_version(&self) -&gt; Result&lt;Version&gt;</pre>
          <pre class="api-signature">async fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <pre class="api-signature">async fn device_info(&self) -&gt; Result&lt;DeviceInfo&gt;</pre>
          <pre class="api-signature">async fn caps(&self) -&gt; Result&lt;Caps&gt;</pre>
          <pre class="api-signature">async fn query_rate(&self) -&gt; Result&lt;Rate&gt;</pre>
          <pre class="api-signature">async fn query_stats(&self) -&gt; Result&lt;Stats&gt;</pre>
          <pre class="api-signature">async fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <pre class="api-signature">async fn query_catch(&self) -&gt; Result&lt;CatchState&gt;</pre>
          <pre class="api-signature">async fn query_imperfect(&self) -&gt; Result&lt;ImperfectStatus&gt;</pre>
          <pre class="api-signature">async fn query_movement_riding(&self) -&gt; Result&lt;Option&lt;Duration&gt;&gt;</pre>
          <pre class="api-signature">async fn query_bearing(&self) -&gt; Result&lt;Bearing&gt;</pre>
          <pre class="api-signature">async fn query_emit_pace(&self) -&gt; Result&lt;EmitPaceStatus&gt;</pre>
          <pre class="api-signature">async fn query_status(&self) -&gt; Result&lt;ClipStatus&gt;</pre>
          <pre class="api-signature">async fn query_config(&self) -&gt; Result&lt;ClipSettings&gt;</pre>
          <pre class="api-signature">async fn firmware_info(&self) -&gt; Result&lt;FirmwareInfo&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <pre><code class="language-bash">cargo add medius --features async</code></pre>

          <p>
            With the <code>async</code> feature, <code>Device::into_async()</code> yields an{' '}
            <A href="/library/features/async"><code>AsyncDevice</code></A> whose queries are futures;
            other methods stay synchronous. The crate is
            runtime-agnostic (no tokio), so drive a future with anything, such as{' '}
            <a
              href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html"
              target="_blank"
              rel="noreferrer"
            ><code>futures::executor::block_on</code></a>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
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
