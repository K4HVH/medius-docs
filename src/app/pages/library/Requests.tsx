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
            Unlike <A href="/native/injection#fire-and-forget">fire-and-forget</A>, the queries are
            blocking: a question frame out, one answer frame back. They are{' '}
            <A href="/library/requests#version"><code>query_version</code></A>,{' '}
            <A href="/library/requests#health"><code>query_health</code></A>,{' '}
            <A href="/library/requests#device-info"><code>device_info</code></A>,{' '}
            <A href="/library/requests#caps"><code>caps</code></A>,{' '}
            <A href="/library/requests#query-rate"><code>query_rate</code></A>,{' '}
            <A href="/library/requests#query-stats"><code>query_stats</code></A>,{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A>,{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A>, each covered below. The{' '}
            <A href="/library/clip#handle">clip handle</A> adds{' '}
            <A href="/library/requests#clip-status"><code>query_status</code></A> and{' '}
            <A href="/library/requests#clip-config"><code>query_config</code></A>, also here.
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
println!("{v}");                       // fw 3.1.0
println!("proto {}", v.proto_ver);     // proto 4
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
          <CardHeader title="query_health" subtitle="Is the mouse-to-box-to-PC chain live" />
          <pre class="api-signature">fn query_health(&self) -&gt; Result&lt;Health&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#health"><code>Health</code></A>, eight booleans from one
            status byte. <code>link_up</code>, <code>mouse_attached</code>, and{' '}
            <code>clone_configured</code> must all be true before{' '}
            <A href="/native/injection">injection</A> has anywhere to land.
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
            <code>product</code> string the box read off the real device. The clone sits on the game PC's
            bus, so this is the only way to see it from the control link. Every field is zero/empty when
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
            One query describes the whole cloned device. Returns a{' '}
            <A href="/library/types/structs#caps"><code>Caps</code></A> with a{' '}
            <A href="/library/types/structs#mouse-caps"><code>mouse</code></A> half and a{' '}
            <A href="/library/types/structs#kbd-caps"><code>keyboard</code></A> half, plus the per-class
            change-driven flags. Use it for feature detection: an{' '}
            <A href="/library/inject#inject"><code>inject</code></A> for a usage the device lacks is a
            silent no-op, so the counts tell you what is real. A class that is not present reads
            all-zero; <code>has_mouse()</code> and <code>has_keyboard()</code> say which are bound.
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
          <CardHeader title="query_locks" subtitle="Read the active input locks" />
          <pre class="api-signature">fn query_locks(&self) -&gt; Result&lt;Locks&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Returns a <A href="/library/types/structs#locks"><code>Locks</code></A>, the list of inputs
            currently blocked by <A href="/library/lock#lock"><code>lock</code></A>.{' '}
            <code>entries()</code> walks them and <code>is_locked(target, direction)</code> answers
            whether one particular lock is set. Read it to confirm a lock landed, or to mirror the box's
            lock state in a UI.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, LockDirection};

let device = Device::find()?;
let locks = device.query_locks()?;
if locks.is_locked(Axis::X, LockDirection::Both) {
    println!("horizontal motion is frozen");
}`}</code></pre>
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
            This query carries more weight than the other seven, because{' '}
            <A href="/library/catch#catch-events"><code>catch_events</code></A> is
            fire-and-forget: the box never answers a subscription directly. Each entry comes back with
            the <code>class / id / direction / snaplen</code> the box accepted, so comparing the
            returned list against the{' '}
            <A href="/library/types/structs#catch-filter">filters</A> you sent is the only way to see
            that all of them landed. A filter that is missing was refused; whether that was because the
            32-entry table was full or because the filter itself was malformed is what{' '}
            <code>table_full</code> tells you.
          </p>

          <div class="api-response-label">TWO DROP COUNTS</div>
          <p>
            <code>CatchState::dropped</code> is box-wide and{' '}
            <A href="/library/types/structs#catch-entry"><code>CatchEntry::dropped</code></A> is per
            entry, and the pair is deliberate. Delivery is three strict-priority queues, input and bus
            first, then the byte-oriented classes, then vendor bulk, so under a busy mouse it is normal
            for one entry to starve while the rest are untouched. The box-wide number says you are
            losing events; only the per-entry number says <em>which</em> ones, and that is the
            difference between a trace you can still trust and one you cannot. Bulk starving beside a
            clean key-press entry means narrow the bulk address or cut its <code>snaplen</code>; drops
            on the entry you actually care about mean the subscription is too broad for a 4 Mbaud link.
          </p>

          <div class="api-response-label">THE CLOCK ESTIMATE</div>
          <pre class="diagram">{`  device chip                              host chip
      t1  ------- request -------------------> t2
                                               |
      t4  <---------------- reply ------------ t3

      offset_us = ((t2 - t1) + (t3 - t4)) / 2   ->  host clock minus device clock
      delay_us  =  (t4 - t1) - (t3 - t2)        ->  the error bound is delay_us / 2`}</pre>
          <p>
            Events are stamped by whichever chip saw them, and the two ESP32-S3s boot independently, so
            a host-chip <code>ts_us</code> and a device-chip one have no common epoch. The{' '}
            <code>clock</code> field is the box's own measurement of that gap, from a four-timestamp
            exchange over the inter-chip link, and it is the only thing that lets you subtract one
            domain's stamp from the other's. <code>delay_us</code> bounds how far you can trust it,{' '}
            <code>rate_ppb</code> corrects it for the drift between two crystals as it ages, and{' '}
            <code>age_ms</code> of <code>None</code> means there is no estimate yet, which is not the
            same as an offset that happens to be zero. Applying it is optional: each event's{' '}
            <A href="/library/types/enums#clock-domain"><code>clk</code></A> stays authoritative, so a
            caller who does not want an approximated timeline can simply never compare across domains.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchFilter, Device};

let device = Device::find()?;
// Bind the stream: dropping it unsubscribes, and the query below would then find an empty table.
let _events = device.catch_events([
    CatchFilter::class(CatchClass::Key),
    CatchFilter::addr(CatchClass::VendBulk, 0x02).snaplen(16),
])?;

let c = device.query_catch()?;
if c.table_full {
    eprintln!("the 32-entry table is full: some filters were refused");
}
for e in &c.entries {
    println!("{:?} 0x{:04X} snap={} dropped={}", e.class, e.id, e.snaplen, e.dropped);
}
println!("{} dropped box-wide", c.dropped);
if let Some(age) = c.clock.age_ms {
    println!("clocks differ by {} us (+/- {}, {age} ms old)", c.clock.offset_us, c.clock.delay_us / 2);
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
            <code>state</code>, ring <code>free</code>, retained <code>played</code>/<code>total</code>, the
            drain counters, and the <code>held</code> usages. Pace clip top-ups off <code>free</code>, and
            watch <code>state</code> for a{' '}
            <A href="/library/types/enums#clip-state"><code>Faulted</code></A> re-sync or for playback
            reaching <code>Idle</code>. Backs{' '}
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
            loop, retain, finalized flag, and <A href="/library/clip#triggers">triggers</A> you set; nothing
            is write-only, every setting round-trips.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
let cfg = device.clip().query_config()?;
println!("{} triggers, loop={}", cfg.triggers.len(), cfg.loop_);`}</code></pre>
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
