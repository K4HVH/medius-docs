import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Structs: Component = () => {
  return (
    <>
      <div id="structs" data-search-target>
        <Card>
          <CardHeader title="Structs" subtitle="Values the box reports back" />
          <p>
            Fields are public; you get these back from queries and discovery.
          </p>
        </Card>
      </div>
      <div id="version" data-search-target>
        <Card>
          <CardHeader title="Version" subtitle="Firmware identity and box id" />
          <p>
            Firmware identity from{' '}
            <A href="/library/requests#version"><code>query_version()</code></A>. <code>Display</code>{' '}
            prints <code>fw M.m.p</code> and omits <code>proto_ver</code>; read it from the field.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>proto_ver</code></td><td><code>u8</code></td><td>Wire-protocol version the firmware speaks (<code>7</code> here).</td></tr>
              <tr><td><code>fw_major</code></td><td><code>u8</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td><code>u8</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td><code>u8</code></td><td>Firmware patch version.</td></tr>
              <tr><td><code>mac</code></td><td><code>[u8; 6]</code></td><td>The device chip's base MAC, a stable per-box id.</td></tr>
              <tr><td><code>name</code></td><td><code>String</code></td><td>The box's human-readable name (a synthesised default when unset), set via <A href="/library/options#set-name"><code>set_name</code></A>.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mac_hex()</code></td><td><code>String</code></td><td>The MAC as 12 lowercase hex digits, the id used by <A href="/library/discovery#open-by-id"><code>open_by_id</code></A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Version;

let v = Version { proto_ver: 7, fw_major: 3, fw_minor: 4, fw_patch: 0, mac: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc], name: "Loki".into() };
assert_eq!(v.to_string(), "fw 3.4.0"); // Display omits proto_ver
assert_eq!(v.mac_hex(), "123456789abc");
println!("{v} (protocol {}, box {}, name {})", v.proto_ver, v.mac_hex(), v.name);`}</code></pre>
        </Card>
      </div>
      <div id="health" data-search-target>
        <Card>
          <CardHeader title="Health" subtitle="Box readiness flags" />
          <p>
            Box readiness from <A href="/library/requests#health"><code>query_health()</code></A>, one
            bool per bit of a <code>u16</code> flags word. <code>from_flags(u16)</code> and{' '}
            <code>to_flags()</code> convert it: bits 0 to 7 are the original byte, and the{' '}
            <A href="/library/advanced/rewrite">advanced control layer</A> opened three more in the high byte.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>True when</th></tr></thead>
            <tbody>
              <tr><td><code>link_up</code></td><td><code>bool</code></td><td>The link to the host chip is up.</td></tr>
              <tr><td><code>mouse_attached</code></td><td><code>bool</code></td><td>A real mouse is plugged in.</td></tr>
              <tr><td><code>clone_configured</code></td><td><code>bool</code></td><td>The PC has set up the cloned mouse.</td></tr>
              <tr><td><code>injection_active</code></td><td><code>bool</code></td><td>The box is holding at least one injected button or move.</td></tr>
              <tr><td><code>rate_confident</code></td><td><code>bool</code></td><td>The native-rate estimator window is full, so <A href="/library/types/structs#rate"><code>Rate</code></A> is trustworthy.</td></tr>
              <tr><td><code>lock_on</code></td><td><code>bool</code></td><td>At least one input is off a full pass, whether <A href="/library/lock#lock"><code>lock</code></A>ed or merely <A href="/library/lock#scale"><code>scale</code></A>d.</td></tr>
              <tr><td><code>catch_on</code></td><td><code>bool</code></td><td>The <A href="/library/catch#catch-events"><code>catch</code></A> table holds at least one <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A>, whatever class it addresses.</td></tr>
              <tr><td><code>kbd_attached</code></td><td><code>bool</code></td><td>A keyboard is attached on the host chip, cloned and injectable.</td></tr>
              <tr><td><code>rewrite_on</code></td><td><code>bool</code></td><td>The <A href="/library/advanced/rewrite">rewrite-rule table</A> is non-empty (v3.4.0).</td></tr>
              <tr><td><code>patch_on</code></td><td><code>bool</code></td><td>A <A href="/library/advanced/patch">descriptor-patch set</A> is applied to the clone (v3.4.0).</td></tr>
              <tr><td><code>transform_on</code></td><td><code>bool</code></td><td>A <A href="/library/transform">field transform</A> is active (v3.4.0).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Health;

let h = Health::from_flags(0b0000_0011); // link_up | mouse_attached
assert!(h.link_up && h.mouse_attached);
assert!(!h.clone_configured && !h.rewrite_on);
assert_eq!(h.to_flags(), 0b0000_0011); // round-trips to the same word`}</code></pre>
        </Card>
      </div>
      <div id="device-info" data-search-target>
        <Card>
          <CardHeader title="DeviceInfo" subtitle="The cloned device's USB identity, kind, and product" />
          <p>
            USB identity from{' '}
            <A href="/library/requests#device-info"><code>device_info()</code></A>. Every field is
            zero/empty when nothing is cloned. <code>Display</code> prints{' '}
            <code>VVVV:PPPP product</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>vid</code></td><td><code>u16</code></td><td>USB vendor id (idVendor).</td></tr>
              <tr><td><code>pid</code></td><td><code>u16</code></td><td>USB product id (idProduct).</td></tr>
              <tr><td><code>bcd_device</code></td><td><code>u16</code></td><td>Device release (bcdDevice).</td></tr>
              <tr><td><code>bcd_usb</code></td><td><code>u16</code></td><td>USB version (bcdUSB), e.g. <code>0x0200</code>.</td></tr>
              <tr><td><code>has_serial</code></td><td><code>bool</code></td><td>The clone serves a serial string.</td></tr>
              <tr><td><code>has_bos</code></td><td><code>bool</code></td><td>The clone serves a BOS descriptor.</td></tr>
              <tr><td><code>kind</code></td><td><A href="/library/types/enums#device-kind"><code>DeviceKind</code></A></td><td>The device's primary kind, from its Boot-interface protocol.</td></tr>
              <tr><td><code>product</code></td><td><code>String</code></td><td>The product string the device serves (empty when it serves none).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{DeviceInfo, DeviceKind};

let d = DeviceInfo {
    vid: 0x046D, pid: 0xC08B, bcd_device: 0, bcd_usb: 0x0201,
    has_serial: true, has_bos: true, kind: DeviceKind::Mouse, product: "G502".into(),
};
assert_eq!(d.to_string(), "046D:C08B G502"); // Display is VVVV:PPPP product`}</code></pre>
        </Card>
      </div>
      <div id="caps" data-search-target>
        <Card>
          <CardHeader title="Caps" subtitle="The whole device, mouse and keyboard" />
          <p>
            Everything one <A href="/library/requests#caps"><code>caps()</code></A> query returns.{' '}
            <code>has_mouse()</code> / <code>has_keyboard()</code> tell you which are bound;{' '}
            <code>is_composite()</code> is true when the device has more than one HID interface.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mouse</code></td><td><A href="/library/types/structs#mouse-caps"><code>MouseCaps</code></A></td><td>The mouse half (all-zero when no mouse is bound).</td></tr>
              <tr><td><code>keyboard</code></td><td><A href="/library/types/structs#kbd-caps"><code>KbdCaps</code></A></td><td>The keyboard half (all-zero when no keyboard is bound).</td></tr>
              <tr><td><code>mouse_change_driven</code></td><td><code>bool</code></td><td>Always false: mouse motion is continuous, so its <A href="/library/types/structs#rate"><code>Rate</code></A> has a learned cadence.</td></tr>
              <tr><td><code>kbd_change_driven</code></td><td><code>bool</code></td><td>True when a keyboard is bound: it reports only on a key change, so its rate has no continuous cadence.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let caps = device.caps()?;
if caps.has_keyboard() && caps.keyboard.has_consumer {
    // media injection is real on this board
}
println!("{} mouse buttons", caps.mouse.n_buttons);`}</code></pre>
        </Card>
      </div>
      <div id="mouse-caps" data-search-target>
        <Card>
          <CardHeader title="MouseCaps" subtitle="What the cloned mouse can do" />
          <p>
            Semantic capabilities from{' '}
            <A href="/library/requests#caps"><code>caps()</code></A>. Every
            field is zero when no relative-axis mouse interface is bound.{' '}
            <code>is_composite()</code> is true when <code>n_hid &gt; 1</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_buttons</code></td><td><code>u8</code></td><td>Buttons the mouse report carries.</td></tr>
              <tr><td><code>has_x</code></td><td><code>bool</code></td><td>The report carries an X axis.</td></tr>
              <tr><td><code>has_y</code></td><td><code>bool</code></td><td>The report carries a Y axis.</td></tr>
              <tr><td><code>has_wheel</code></td><td><code>bool</code></td><td>The report carries a wheel.</td></tr>
              <tr><td><code>has_pan</code></td><td><code>bool</code></td><td>The report carries an AC Pan (horizontal scroll) axis.</td></tr>
              <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>The mouse report sits behind a HID report ID.</td></tr>
              <tr><td><code>n_hid</code></td><td><code>u8</code></td><td>Cloned HID interfaces; <code>&gt;1</code> = composite.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::MouseCaps;

let c = MouseCaps { n_buttons: 5, has_x: true, has_y: true, has_wheel: true, has_pan: false, has_report_id: false, n_hid: 1 };
assert!(!c.is_composite()); // single HID interface`}</code></pre>
        </Card>
      </div>
      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="Rate" subtitle="The native report rate the box tracks" />
          <p>
            Live rate from <A href="/library/requests#query-rate"><code>query_rate()</code></A>.{' '}
            <code>native_hz()</code> converts the period to a frequency, returning <code>None</code>{' '}
            while <code>native_period_us</code> is still <code>0</code>. On a change-driven input,{' '}
            <code>poll_period_us</code> is the only rate there is.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>native_period_us</code></td><td><code>u16</code></td><td>Realised native report period in µs; <code>0</code> = not learned, or change-driven.</td></tr>
              <tr><td><code>poll_period_us</code></td><td><code>u16</code></td><td>Cloned inject-endpoint poll period in µs.</td></tr>
              <tr><td><code>confident</code></td><td><code>bool</code></td><td>The estimator window is full and the value is trustworthy.</td></tr>
              <tr><td><code>change_driven</code></td><td><code>bool</code></td><td>The active input is event-driven (keyboard / media), so there is no continuous cadence.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Rate;

let r = Rate { native_period_us: 1000, poll_period_us: 1000, confident: true, change_driven: false };
assert_eq!(r.native_hz(), Some(1000.0));`}</code></pre>
        </Card>
      </div>
      <div id="stats" data-search-target>
        <Card>
          <CardHeader title="Stats" subtitle="Delivery and telemetry counters" />
          <p>
            Delivery counters from <A href="/library/requests#query-stats"><code>query_stats()</code></A>.
            A nonzero <code>tx_drops</code> or <code>tx_wedges</code> means delivery degraded under
            load. The narrowed fields saturate instead of wrapping.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>inject_emits</code></td><td><code>u32</code></td><td>Pure-injection reports emitted.</td></tr>
              <tr><td><code>tx_drops</code></td><td><code>u16</code></td><td>Packets dropped on a full queue, in either direction (should stay 0).</td></tr>
              <tr><td><code>tx_merges</code></td><td><code>u16</code></td><td>Backed-up reports merged instead of queued.</td></tr>
              <tr><td><code>tx_maxdepth</code></td><td><code>u8</code></td><td>Deepest the TX queue has reached.</td></tr>
              <tr><td><code>tx_wedges</code></td><td><code>u8</code></td><td>Wedged-endpoint recoveries.</td></tr>
              <tr><td><code>wakeups</code></td><td><code>u16</code></td><td>Remote-wakeups issued.</td></tr>
              <tr><td><code>reset_count</code></td><td><code>u16</code></td><td>USB bus resets seen.</td></tr>
              <tr><td><code>config_count</code></td><td><code>u16</code></td><td>SET_CONFIGURATION events (re-enumerations).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="locks" data-search-target>
        <Card>
          <CardHeader title="Locks" subtitle="The active input scales" />
          <p>
            The active set from <A href="/library/requests#query-locks"><code>query_locks()</code></A>,
            a list of <A href="/library/types/structs#lock-entry"><code>LockEntry</code></A> across
            every class, one per direction that is not passing untouched.
            See the native <A href="/native/commands/requests#locks"><code>LOCKS</code></A> reply for the
            wire format.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>entries()</code></td><td><code>&amp;[<A href="/library/types/structs#lock-entry">LockEntry</A>]</code></td><td>Every weighed direction, one entry each, across specific targets and whole-class blankets.</td></tr>
              <tr><td><code>scale_of(target, dir)</code></td><td><code>u8</code></td><td>Percent of the physical value kept there; 100 when nothing weighs it, and where entries overlap it reports the lowest. <code>Both</code> reports the lowest across every direction, which is not the figure a delta meets: it picks up one from each pair, multiplied.</td></tr>
              <tr><td><code>is_locked(target, dir)</code></td><td><code>bool</code></td><td>Whether it is blocked outright. A direction merely weighed is not locked. <code>Both</code> asks about the two fixed signs; ask for a relative one by name.</td></tr>
              <tr><td><code>from_entries(Vec&lt;LockEntry&gt;)</code></td><td><code>Locks</code></td><td>Build one from entries, for tests and the <A href="/library/features/mock"><code>MockBox</code></A>.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Case</th><th>What the list holds</th></tr></thead>
            <tbody>
              <tr><td>A blanket key lock</td><td>One entry per blocked edge, never <code>Both</code>.</td></tr>
              <tr><td>A media lock, blanket or specific</td><td>Direction <code>Both</code>, always. Media has no edges.</td></tr>
              <tr><td>A relative direction under <A href="/library/types/enums#bearing-mode"><code>BearingMode::Vector</code></A></td><td>The effective scale, the lower of X's and Y's, on both axes.</td></tr>
              <tr><td>96 entries reached</td><td>The rest is absent, with nothing marking it. See the native <A href="/native/commands/requests#locks"><code>LOCKS</code></A> budget.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Axis, Button, Direction};

let locks = device.query_locks()?;
if locks.is_locked(Axis::X, Direction::Positive) {
    // physical +X is zeroed
}
if locks.is_locked(Button::LEFT, Direction::Negative) {
    // a left-click is latched down: the release edge is blocked
}
// how much of a delta opposing the injection survives
println!("{}%", locks.scale_of(Axis::X, Direction::Against));`}</code></pre>
        </Card>
      </div>
      <div id="lock-entry" data-search-target>
        <Card>
          <CardHeader title="LockEntry" subtitle="One entry in a Locks list" />
          <pre class="api-signature">struct LockEntry {'{'} scope: LockScope, direction: Direction, scale: u8 {'}'}</pre>
          <p>
            One weighed direction in a <A href="/library/types/structs#locks"><code>Locks</code></A>{' '}
            list. Entries mirror the <A href="/native/commands/lock"><code>LOCK</code></A> frame field
            for field, so what comes back is what you would send to reproduce it.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>scope</code></td><td><A href="/library/types/enums#lock-scope"><code>LockScope</code></A></td><td>A specific axis or usage, or a whole-class blanket.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>Which direction of it this entry weighs.</td></tr>
              <tr><td><code>scale</code></td><td><code>u8</code></td><td>Percent of the physical value kept. A momentary usage carries one bit, so the box stores the block or pass it renders and this never reads between them.</td></tr>
            </tbody>
          </table>
          <p><code>is_block()</code> is <code>scale == 0</code>: blocked outright rather than weighed.</p>
        </Card>
      </div>
      <div id="bearing" data-search-target>
        <Card>
          <CardHeader title="Bearing" subtitle="What With and Against are measured against" />
          <pre class="api-signature">struct Bearing {'{'} window: Option&lt;Duration&gt;, mode: BearingMode {'}'}</pre>
          <p>
            The configured bearing from{' '}
            <A href="/library/options#query-bearing"><code>query_bearing()</code></A>. See the native{' '}
            <A href="/native/commands/lock#bearing">bearing</A> for what it does.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>window</code></td><td><code>Option&lt;Duration&gt;</code></td><td>How long an axis holds the direction of its last injected delta. <code>None</code> is off, so <code>With</code> and <code>Against</code> are inert whatever their scale.</td></tr>
              <tr><td><code>mode</code></td><td><code>BearingMode</code></td><td><code>PerAxis</code>: each axis reads its own sign. <code>Vector</code>: the physical delta is projected onto the injected direction, and the relative scale weighs only the part along it.</td></tr>
            </tbody>
          </table>
          <p><code>is_live()</code> is whether a bearing is held at all.</p>
        </Card>
      </div>
      <div id="catch-filter" data-search-target>
        <Card>
          <CardHeader title="CatchFilter" subtitle="One subscription entry: what to catch, and how much of it" />
          <pre class="api-signature">struct CatchFilter {'{'} /* private */ {'}'}</pre>
          <p>
            One entry in the table you hand to{' '}
            <A href="/library/catch#catch-events"><code>catch_events</code></A> or{' '}
            <A href="/library/catch#input-events"><code>input_events</code></A>. Built with a
            constructor rather than by hand.
          </p>
          <table class="api-params">
            <thead><tr><th>Constructor</th><th>Addresses</th></tr></thead>
            <tbody>
              <tr><td><code>CatchFilter::watch(usage)</code></td><td>One <A href="/library/types/structs#usage"><code>Usage</code></A>: a button, a key, or a media usage, the same argument <A href="/library/lock#lock"><code>lock</code></A> takes.</td></tr>
              <tr><td><code>CatchFilter::watch_axis(axis)</code></td><td>One <A href="/library/types/enums#axis"><code>Axis</code></A>.</td></tr>
              <tr><td><code>CatchFilter::watch_class(class)</code></td><td>Every usage in one <A href="/library/types/enums#class"><code>Class</code></A>.</td></tr>
              <tr><td><code>CatchFilter::watch_axes()</code></td><td>Every axis.</td></tr>
              <tr><td><code>CatchFilter::all_input()</code></td><td>All four input classes, as a <code>[CatchFilter; 4]</code>.</td></tr>
              <tr><td><code>CatchFilter::traffic(class, id)</code></td><td>One id in a <A href="/library/types/enums#traffic-class"><code>TrafficClass</code></A>: an endpoint, an interface, an endpoint number.</td></tr>
              <tr><td><code>CatchFilter::traffic_class(class)</code></td><td>Every id in one traffic class, a blanket.</td></tr>
              <tr><td><code>CatchFilter::everything()</code></td><td>Every class, every id, both directions.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>.on_press() / .on_release()</code></td><td><code>CatchFilter</code></td><td>One edge, on the momentary classes.</td></tr>
              <tr><td><code>.inbound() / .outbound()</code></td><td><code>CatchFilter</code></td><td>One flow, on the traffic classes: IN is device to PC.</td></tr>
              <tr><td><code>.with_direction(dir)</code></td><td><code>CatchFilter</code></td><td>The <A href="/library/types/enums#direction"><code>Direction</code></A> directly; defaults to <code>Both</code>.</td></tr>
              <tr><td><code>.with_capture(cap)</code></td><td><code>CatchFilter</code></td><td>A <A href="/library/types/enums#capture"><code>Capture</code></A>; defaults to <code>Whole</code>. Traffic classes only.</td></tr>
              <tr><td><code>.class()</code></td><td><code>Option&lt;CatchClass&gt;</code></td><td>The class, or <code>None</code> for the wildcard.</td></tr>
              <tr><td><code>.id()</code></td><td><code>Option&lt;u16&gt;</code></td><td>The class-specific id, or <code>None</code> for a blanket.</td></tr>
              <tr><td><code>.direction() / .capture()</code></td><td><code>Direction / Capture</code></td><td>What the filter was narrowed to.</td></tr>
              <tr><td><code>.same_address(other)</code></td><td><code>bool</code></td><td>Whether both name the same box table entry, whatever their captures.</td></tr>
            </tbody>
          </table>
          <p>
            An exact <code>(class, id)</code> is matched before a class blanket, that before the wildcard, and a named direction before <code>Both</code>. That entry supplies the capture:
          </p>
          <pre class="diagram">{`catch_events([
    CatchFilter::everything().with_capture(Capture::First(16)),   // everything, 16 bytes
    CatchFilter::traffic(TrafficClass::VendorInterrupt, 0x83),    // except 0x83, in full
])

  packet on 0x83  ->  traffic(VendorInterrupt, 0x83)  resolves  ->  whole packet
  packet on 0x84  ->  everything()                    resolves  ->  First(16)`}</pre>
          <p>
            Capture is not part of a filter's address, so two filters naming one entry at different
            lengths are one box entry at the wider of the two. <code>same_address</code> is that
            comparison; <code>==</code> compares everything.
          </p>
          <p>
            The table holds 32 entries, and a subscription that would exceed it is refused before
            anything is sent. See <A href="/library/types/errors"><code>Error</code></A>. So is an
            empty subscription, and a capture on an input class.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchFilter, Class, TrafficClass};

// Press edges of every key, plus one control endpoint, plus bus context.
let stream = device.catch_events([
    CatchFilter::watch_class(Class::Key).on_press(),
    CatchFilter::traffic(TrafficClass::Control, 0),
    CatchFilter::traffic_class(TrafficClass::Bus),
])?;

// Dropping the stream clears the whole table.
drop(stream);`}</code></pre>
        </Card>
      </div>
      <div id="motion-event" data-search-target>
        <Card>
          <CardHeader title="MotionEvent" subtitle="One physical relative-axis event" />
          <p>
            The payload of a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent::Motion</code></A>, read off an{' '}
            <A href="/library/catch#event-stream"><code>EventStream</code></A>. The real hand motion at
            the merge point, <em>before</em> lock suppression or injection, so a locked or injected axis
            still reports the true delta.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>When the device's report arrived, in box microseconds. See <A href="/library/catch#timestamps">Catch timestamps</A> for what the clock means.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip's timer <code>ts_us</code> came from. Always <code>HostChip</code> here: physical motion is stamped on the host chip as the real device's transfer completes.</td></tr>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>X movement this report (right positive).</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Y movement this report (down positive).</td></tr>
              <tr><td><code>dz</code></td><td><code>i16</code></td><td>Wheel movement this report (up positive).</td></tr>
              <tr><td><code>dpan</code></td><td><code>i16</code></td><td>AC Pan (horizontal scroll) this report (right positive).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchEvent, CatchFilter};

let stream = device.catch_events([CatchFilter::watch_axes()])?;
if let CatchEvent::Motion(m) = stream.recv()? {
    println!("at {} us ({:?}): moved {} {}, wheel {}, pan {}", m.ts_us, m.clock, m.dx, m.dy, m.dz, m.dpan);
}`}</code></pre>
        </Card>
      </div>

      <div id="usage-snapshot" data-search-target>
        <Card>
          <CardHeader title="UsageSnapshot" subtitle="One physical held-usage snapshot" />
          <p>
            The payload of a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent::Usages</code></A>: every held{' '}
            <A href="/library/types/structs#usage"><code>Usage</code></A> of one class (buttons, keys, or
            media, all one shape), captured before injection. Diff successive snapshots for press/release
            edges, or test one with <code>is_held</code>; a dropped frame self-corrects on the next.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>When the device's report arrived, in box microseconds. See <A href="/library/catch#timestamps">Catch timestamps</A> for what the clock means.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip's timer <code>ts_us</code> came from. Always <code>HostChip</code>: a held-usage snapshot is taken where the real device's report lands.</td></tr>
              <tr><td><code>usages</code></td><td><code>Vec&lt;<A href="/library/types/structs#usage">Usage</A>&gt;</code></td><td>The currently-held usages, all of one class per event.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>is_held(usage)</code></td><td><code>bool</code></td><td>Whether <code>usage</code> is held; takes any <code>impl Into&lt;Usage&gt;</code>.</td></tr>
              <tr><td><code>class()</code></td><td><code>Option&lt;<A href="/library/types/enums#class">Class</A>&gt;</code></td><td>The class of this snapshot, from its first usage, or <code>None</code> when empty.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, CatchEvent, CatchFilter, Class};

let stream = device.catch_events([CatchFilter::watch_class(Class::Button)])?;
if let CatchEvent::Usages(s) = stream.recv()? {
    if s.is_held(Button::LEFT) {
        println!("left button held");
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="input-event" data-search-target>
        <Card>
          <CardHeader title="InputEvent" subtitle="One decoded input edge, and when it happened" />
          <pre class="api-signature">struct InputEvent {'{'} ts_us: u32, clock: ClockDomain, input: Input {'}'}</pre>
          <p>
            What <A href="/library/catch#input-events"><code>input_events</code></A> yields. The{' '}
            <A href="/library/types/enums#input"><code>Input</code></A> is the edge, decoded from the
            held-usage snapshots the box sends.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>The report's arrival stamp, in the stamping chip's microseconds.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Always <code>HostChip</code> for physical input.</td></tr>
              <tr><td><code>input</code></td><td><A href="/library/types/enums#input"><code>Input</code></A></td><td>What happened.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchFilter, Input};

for ev in device.input_events(CatchFilter::all_input())? {
    if let Input::Press(u) = ev.input {
        println!("{u:?} down at {}", ev.ts_us);
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="traffic-event" data-search-target>
        <Card>
          <CardHeader title="TrafficEvent" subtitle="Bytes off one pipe, with what was cut" />
          <p>
            The payload of a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent::Traffic</code></A>: one packet,
            one completed control transaction, or one bus event.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>When the transfer completed, in the microseconds of the chip named by <code>clock</code>.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip stamped it. Varies by class and direction here, unlike the two input events.</td></tr>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#catch-class"><code>CatchClass</code></A></td><td>Which address space the event came from.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The endpoint number or interface number inside that class.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td><code>Positive</code> = IN (device to PC), <code>Negative</code> = OUT (PC to device).</td></tr>
              <tr><td><code>flags</code></td><td><code>u8</code></td><td>Class-specific, see below; <code>0</code> for the classes that define none.</td></tr>
              <tr><td><code>true_len</code></td><td><code>u16</code></td><td>The packet's length <em>before</em> the <A href="/library/types/enums#capture"><code>Capture</code></A> cut it.</td></tr>
              <tr><td><code>bytes</code></td><td><code>Vec&lt;u8&gt;</code></td><td>What was actually captured, at most the entry's capture length.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>truncated()</code></td><td><code>bool</code></td><td>Whether the capture or the frame ceiling cut this packet: <code>bytes.len() &lt; true_len</code>.</td></tr>
            </tbody>
          </table>
          <p>
            One event frame carries at most 180 bytes, so <code>Capture::Whole</code> still truncates
            a longer packet, and still says so.
          </p>
          <table class="api-params">
            <thead><tr><th>Class</th><th>flags</th></tr></thead>
            <tbody>
              <tr><td><code>VendorBulk</code></td><td>b0 = end of transfer, b1 = zero-length packet.</td></tr>
              <tr><td><code>Control</code></td><td>How the proxied transfer ended; read it with <code>control_status()</code>, see <A href="/library/types/enums#control-status"><code>ControlStatus</code></A>.</td></tr>
              <tr><td><code>Bus</code></td><td>The <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> kind.</td></tr>
              <tr><td>everything else</td><td><code>0</code>.</td></tr>
            </tbody>
          </table>
          <p>
            A <code>Control</code> event is one completed transaction: <code>bytes</code> is the
            8-byte SETUP packet then the data stage, and <code>direction</code> says which way that
            data went. Requests answered from the box's descriptor cache still raise events.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Capture, CatchEvent, CatchFilter, TrafficClass};

let stream = device.catch_events([CatchFilter::traffic(TrafficClass::VendorInterrupt, 0x83)
    .with_capture(Capture::First(16))])?;
if let CatchEvent::Traffic(t) = stream.recv()? {
    println!("ep 0x{:02X} {:?}: {:02X?}", t.id, t.direction, t.bytes);
    if t.truncated() {
        println!("  cut: {} of {} bytes", t.bytes.len(), t.true_len);
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="button" data-search-target>
        <Card>
          <CardHeader title="Button" subtitle="The button a command acts on" />
          <pre class="api-signature">struct Button(pub u8)</pre>
          <p>
            The button an <A href="/native/commands/inject#inject"><code>INJECT</code></A> or{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A> command acts on: an open numeric
            id, the five standard buttons as named constants and any further id the mouse declares
            (<A href="/library/requests#caps"><code>caps</code></A> <code>n_buttons</code>). A{' '}
            <code>Button</code> converts{' '}
            <code>Into&lt;<A href="/library/types/structs#usage">Usage</A>&gt;</code> as class button,
            so <A href="/library/inject#inject"><code>inject</code></A> takes one directly.
          </p>
          <table class="api-params">
            <thead><tr><th>Constant</th><th>id</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Button::LEFT</code></td><td><code>0</code></td><td>Left button.</td></tr>
              <tr><td><code>Button::RIGHT</code></td><td><code>1</code></td><td>Right button.</td></tr>
              <tr><td><code>Button::MIDDLE</code></td><td><code>2</code></td><td>Middle button.</td></tr>
              <tr><td><code>Button::SIDE1</code></td><td><code>3</code></td><td>First thumb button.</td></tr>
              <tr><td><code>Button::SIDE2</code></td><td><code>4</code></td><td>Second thumb button.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Button::new(id)</code></td><td><code>Button</code></td><td>Any 0-based id, named or not: <code>Button::new(5)</code> is the sixth button.</td></tr>
              <tr><td><code>Button::from_id(id)</code></td><td><code>Button</code></td><td>The same from a wire id byte. Total: every byte is a valid button.</td></tr>
              <tr><td><code>.as_id()</code></td><td><code>u8</code></td><td>The wire id byte.</td></tr>
              <tr><td><code>.0</code></td><td><code>u8</code></td><td>The id itself; the field is public.</td></tr>
            </tbody>
          </table>
          <p>
            Injecting a button the device declares but never itself wires is descriptor-faithful: the
            box drives the full declared count, and one past it is a no-op.
          </p>
        </Card>
      </div>
      <div id="usage" data-search-target>
        <Card>
          <CardHeader title="Usage" subtitle="A momentary input: (class, id)" />
          <pre class="api-signature">struct Usage {'{'} class: Class, id: u16 {'}'}</pre>
          <p>
            What <A href="/library/inject#inject"><code>inject</code></A> drives and{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> locks. A{' '}
            <A href="/library/types/structs#button"><code>Button</code></A>,{' '}
            <A href="/library/types/structs#key"><code>Key</code></A>, and{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> each{' '}
            <code>impl Into&lt;Usage&gt;</code>, so you pass one straight to any verb; build one by hand
            with <code>Usage::new(class, id)</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#class"><code>Class</code></A></td><td>The input class (button, key, or media).</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The class-specific id: a button id, a HID keycode, or a Consumer usage.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Class, Key, Usage};

let from_button: Usage = Button::LEFT.into();      // Class::Button, id 0
let from_key: Usage = Key::A.into();               // Class::Key, id 0x04
let by_hand = Usage::new(Class::Media, 0x00E9);    // volume up
device.press(from_button)?;                         // press takes any impl Into<Usage>`}</code></pre>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="Key" subtitle="A HID keyboard keycode" />
          <p>
            A newtype over a HID keyboard/keypad usage. It converts{' '}
            <code>Into&lt;<A href="/library/types/structs#usage">Usage</A>&gt;</code>, so you pass one
            straight to <A href="/library/inject#inject"><code>inject</code></A> or{' '}
            <A href="/library/inject#inject"><code>press</code></A>. Modifiers are the usages{' '}
            <code>0xE0</code>-<code>0xE7</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Item</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Key::A</code> .. <code>Key::LEFT_SHIFT</code></td><td><code>Key</code></td><td>Named consts for common keycodes and modifiers.</td></tr>
              <tr><td><code>new(u8)</code></td><td><code>Key</code></td><td>Wrap any raw HID keycode.</td></tr>
              <tr><td><code>usage()</code></td><td><code>u8</code></td><td>The raw keycode byte.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Key;

let a = Key::A;            // 0x04
let custom = Key::new(0x04);
assert_eq!(a.usage(), custom.usage());`}</code></pre>
        </Card>
      </div>

      <div id="media-key" data-search-target>
        <Card>
          <CardHeader title="MediaKey" subtitle="A 16-bit Consumer usage" />
          <p>
            A newtype over a 16-bit Consumer usage. It converts{' '}
            <code>Into&lt;<A href="/library/types/structs#usage">Usage</A>&gt;</code>, so you pass one
            straight to <A href="/library/inject#inject"><code>inject</code></A> or{' '}
            <A href="/library/inject#inject"><code>press</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Item</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>MediaKey::VOLUME_UP</code> .. <code>MediaKey::MUTE</code></td><td><code>MediaKey</code></td><td>Named consts for common media usages.</td></tr>
              <tr><td><code>new(u16)</code></td><td><code>MediaKey</code></td><td>Wrap any raw Consumer usage.</td></tr>
              <tr><td><code>usage()</code></td><td><code>u16</code></td><td>The raw Consumer usage.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::MediaKey;

let vol_up = MediaKey::VOLUME_UP;   // 0x00E9
let custom = MediaKey::new(0xE9);
assert_eq!(vol_up.usage(), custom.usage());`}</code></pre>
        </Card>
      </div>

      <div id="kbd-caps" data-search-target>
        <Card>
          <CardHeader title="KbdCaps" subtitle="What the cloned keyboard can do" />
          <p>
            Semantic capabilities from{' '}
            <A href="/library/requests#caps"><code>caps()</code></A>. Every field is
            zero when no keyboard is bound. <code>has_consumer</code> gates{' '}
            <A href="/library/inject#inject">media injection</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>n_keys</code></td><td><code>u8</code></td><td>Keycode-array slots, or <code>0xFF</code> for an NKRO bitmap.</td></tr>
              <tr><td><code>nkro</code></td><td><code>bool</code></td><td>The keyboard reports an NKRO bitmap.</td></tr>
              <tr><td><code>has_consumer</code></td><td><code>bool</code></td><td>A Consumer collection is present (media keys injectable).</td></tr>
              <tr><td><code>has_system</code></td><td><code>bool</code></td><td>A system-control collection is present (passthrough-only).</td></tr>
              <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>The keyboard report sits behind a HID report ID.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="catch-state" data-search-target>
        <Card>
          <CardHeader title="CatchState" subtitle="The live subscription table, read back" />
          <pre class="api-signature">struct CatchState {'{'} table_full: bool, dropped: u32, clock: ClockEstimate, entries: Vec&lt;CatchEntry&gt; {'}'}</pre>
          <p>
            What <A href="/library/requests#query-catch"><code>query_catch()</code></A> returns.
            Subscribing has no reply of its own, so this is the only view of what the box accepted.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>At least one entry was refused because the 32-slot table was full.</td></tr>
              <tr><td><code>dropped</code></td><td><code>u32</code></td><td>Box-wide events shed under back-pressure, across every entry.</td></tr>
              <tr><td><code>clock</code></td><td><A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A></td><td>The measured relationship between the host chip's and device chip's timers.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;<A href="/library/types/structs#catch-entry">CatchEntry</A>&gt;</code></td><td>The live subscription table, one entry per accepted <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A>. Empty = catching nothing.</td></tr>
            </tbody>
          </table>
          <p>
            An entry absent from <code>entries</code> was refused; <code>table_full</code> says the
            reason was capacity rather than a malformed filter.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let c = device.query_catch()?;
if c.entries.is_empty() {
    println!("catching nothing");
}
if c.table_full {
    eprintln!("some filters were refused: the 32-entry table is full");
}
for e in &c.entries {
    println!("{:?} {:?} {:?} {:?} dropped={}",
             e.filter.class(), e.filter.id(), e.filter.direction(), e.filter.capture(), e.dropped);
}
println!("{} dropped box-wide", c.dropped);`}</code></pre>
        </Card>
      </div>

      <div id="catch-entry" data-search-target>
        <Card>
          <CardHeader title="CatchEntry" subtitle="One accepted subscription, and what it lost" />
          <pre class="api-signature">struct CatchEntry {'{'} filter: CatchFilter, dropped: u16 {'}'}</pre>
          <p>
            One row of the box's subscription table in a{' '}
            <A href="/library/types/structs#catch-state"><code>CatchState</code></A>: the{' '}
            <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> the box
            accepted, echoed back. A blanket comes back as one entry, not one row per id.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>filter</code></td><td><A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A></td><td>The subscription as the box holds it; read it with <code>class()</code>, <code>id()</code>, <code>direction()</code>, <code>capture()</code>.</td></tr>
              <tr><td><code>dropped</code></td><td><code>u16</code></td><td>Events <em>this entry</em> could not queue.</td></tr>
            </tbody>
          </table>
          <p>
            The box-wide count on <A href="/library/types/structs#catch-state"><code>CatchState</code></A>{' '}
            says you are losing events; this one says which. Vendor bulk drops first, by{' '}
            <A href="/library/catch#event-stream">design</A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let c = device.query_catch()?;
for e in c.entries.iter().filter(|e| e.dropped > 0) {
    eprintln!("{:?} {:?} lost {} events", e.filter.class(), e.filter.id(), e.dropped);
}`}</code></pre>
        </Card>
      </div>

      <div id="clock-estimate" data-search-target>
        <Card>
          <CardHeader title="ClockEstimate" subtitle="How the two chips' timers relate" />
          <pre class="api-signature">struct ClockEstimate {'{'} offset_us: i32, rate_ppb: Option&lt;i32&gt;, delay_us: u16, age: Option&lt;Duration&gt; {'}'}</pre>
          <p>
            The <code>clock</code> field of a{' '}
            <A href="/library/types/structs#catch-state"><code>CatchState</code></A>, and the only
            thing that puts stamps from both{' '}
            <A href="/library/types/enums#clock-domain">clock domains</A> on one timeline.
          </p>
          <p>
            The box measures the difference with a four-timestamp exchange across the inter-chip link,
            stamping each frame as it reaches the wire rather than when it is queued. The two crystals drift by up to 20 µs per second.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>offset_us</code></td><td><code>i32</code></td><td>The host chip's clock minus the device chip's, in microseconds. Add it to a device-domain stamp to read it on the host's timeline, subtract it to go the other way.</td></tr>
              <tr><td><code>rate_ppb</code></td><td><code>Option&lt;i32&gt;</code></td><td>How fast the two are drifting apart, in parts per billion, or <code>None</code> when the box has fitted no rate. Not the same as a fitted <code>0</code>: on a link too busy for enough clean exchanges no fit is made at all, which is when assuming no drift costs the most.</td></tr>
              <tr><td><code>delay_us</code></td><td><code>u16</code></td><td>The best round trip measured in the window; the offset is good to about half of it.</td></tr>
              <tr><td><code>age</code></td><td><code>Option&lt;Duration&gt;</code></td><td>How long ago the exchange ran. <code>None</code> = no estimate yet.</td></tr>
            </tbody>
          </table>
          <p>
            <code>error_bound_us()</code> halves <code>delay_us</code> for you;{' '}
            <code>drift_us_over(age)</code> extrapolates <code>rate_ppb</code>, returning 0 for a{' '}
            <code>None</code> rate.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let clock = device.query_catch()?.clock;
match clock.age {
    None => println!("no cross-chip estimate yet: compare stamps within one domain only"),
    Some(age) => {
        let offset_now = clock.offset_us as i64 + clock.drift_us_over(age);
        println!("offset {offset_now} us, +/- {} us", clock.error_bound_us());
    }
}`}</code></pre>
        </Card>
      </div>
      <div id="timeline" data-search-target>
        <Card>
          <CardHeader title="Timeline" subtitle="Box stamps on this machine's clock" />
          <pre class="api-signature">struct Timeline {'{'} /* private */ {'}'}</pre>
          <p>
            A catch stamp is microseconds on a chip that booted before this process did: it{' '}
            <A href="/library/types/enums#clock-domain">wraps, restarts at zero on reboot</A>, and
            has no relation to any clock here. Feed every event in as it arrives, in order.
          </p>
          <p>
            <code>&amp;event</code> is anything implementing <code>Timestamped</code>: an{' '}
            <A href="/library/types/structs#input-event"><code>InputEvent</code></A>, a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A>, or one of the
            three frame structs. The decoded and raw paths share one timeline.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>observe(&amp;event)</code></td><td><A href="/library/types/structs#stamped"><code>Stamped</code></A></td><td>Place an event on this machine's clock, taking the arrival as now.</td></tr>
              <tr><td><code>observe_at(&amp;event, now)</code></td><td><code>Stamped</code></td><td>The same with the arrival supplied, for replaying a capture.</td></tr>
              <tr><td><code>observe_stamp(ts_us, domain, now)</code></td><td><code>Stamped</code></td><td>The same from a stamp and domain held on their own.</td></tr>
              <tr><td><code>box_us(&amp;event)</code></td><td><code>u64</code></td><td>The stamp unwrapped past the rollover, monotonic within its domain.</td></tr>
              <tr><td><code>reset(domain)</code></td><td><code>()</code></td><td>Forget one domain's rollover count and floor, for a chip that rebooted.</td></tr>
              <tr><td><code>samples(domain)</code></td><td><code>u64</code></td><td>Events observed for a domain; the floor is a minimum over these.</td></tr>
            </tbody>
          </table>
          <p>
            Each domain is tracked separately, so both chips' stamps land on one comparable timeline.
          </p>
          <p>
            The mapping keeps a per-domain minimum of (elapsed here minus elapsed on the box), not
            an average, because the error is one-sided: an event can arrive late but never early. It
            improves as it runs and never steps backwards.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchFilter, Timeline};

let mut input = device.input_events(CatchFilter::all_input())?;
let mut time = Timeline::new();
for ev in input.by_ref().take(20) {
    println!("{:?} at {:?}", ev.input, time.observe(&ev).host);
}`}</code></pre>
        </Card>
      </div>

      <div id="stamped" data-search-target>
        <Card>
          <CardHeader title="Stamped" subtitle="One event placed on this machine's clock" />
          <pre class="api-signature">struct Stamped {'{'} host: Instant, box_us: u64, excess: Duration {'}'}</pre>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>host</code></td><td><code>Instant</code></td><td>When the event happened, on this machine's monotonic clock.</td></tr>
              <tr><td><code>box_us</code></td><td><code>u64</code></td><td>The event's own stamp, unwrapped past the 32-bit rollover.</td></tr>
              <tr><td><code>excess</code></td><td><code>Duration</code></td><td>How much later than the measured floor this event reached you. Jitter, not latency: the constant part of the delay is unknowable from here.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="transform" data-search-target>
        <Card>
          <CardHeader title="Transform" subtitle="One field operation and its signed scale" />
          <pre class="api-signature">struct Transform {'{'} op: TransformOp, source: LockTarget, dest: LockTarget, scale: i16 {'}'}</pre>
          <p>
            One entry in the table you hand to{' '}
            <A href="/library/transform#transform"><code>transform</code></A>. The named constructors
            cover the common cases; <code>new</code> is the general form.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Transform::new(op, source, dest, scale)</code></td><td><code>Transform</code></td><td>Any <A href="/library/types/enums#transform-op"><code>TransformOp</code></A>, from an explicit source, destination and signed scale.</td></tr>
              <tr><td><code>Transform::invert(axis)</code></td><td><code>Transform</code></td><td>A <code>Scale</code> of <code>-100</code>: see <A href="/library/types/enums#transform-op"><code>TransformOp</code></A>.</td></tr>
              <tr><td><code>Transform::scale_axis(axis, percent)</code></td><td><code>Transform</code></td><td>A <code>Scale</code> on one axis.</td></tr>
              <tr><td><code>Transform::swap(a, b)</code></td><td><code>Transform</code></td><td>A <code>Swap</code> of two axes, at a full pass.</td></tr>
              <tr><td><code>Transform::remap(source, dest)</code></td><td><code>Transform</code></td><td>A <code>Remap</code>, at a full pass. Any <A href="/library/types/enums#axis"><code>Axis</code></A>, <code>Button</code>, <code>Key</code>, <code>MediaKey</code> or <A href="/library/types/structs#usage"><code>Usage</code></A> converts into the <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> it takes.</td></tr>
              <tr><td><code>.with_scale(scale)</code></td><td><code>Transform</code></td><td>The same transform at another signed scale: a weighed swap or axis remap.</td></tr>
              <tr><td><code>.key()</code></td><td><A href="/library/types/structs#transform-key"><code>TransformKey</code></A></td><td>The <code>(source, dest)</code> this entry is filed under.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>op</code></td><td><A href="/library/types/enums#transform-op"><code>TransformOp</code></A></td><td>What the transform does. An op that cannot address this source and destination pair is <A href="/library/types/errors#errors"><code>Error::TransformOpFields</code></A>.</td></tr>
              <tr><td><code>source</code></td><td><A href="/library/types/enums#lock-target"><code>LockTarget</code></A></td><td>The field the transform reads: an axis, or a button. A key or media field can only be a destination, so naming one here is <A href="/library/types/errors#errors"><code>Error::TransformOpFields</code></A>. One the clone's descriptor does not declare is refused box-side, and absent from the readback.</td></tr>
              <tr><td><code>dest</code></td><td><A href="/library/types/enums#lock-target"><code>LockTarget</code></A></td><td>The field the transform writes; the same as <code>source</code> for a scale. A cross-class remap with no destination collection is refused box-side.</td></tr>
              <tr><td><code>scale</code></td><td><code>i16</code></td><td>A percent carrying a sign: <code>-100</code> negates, <code>100</code> is identity, <code>200</code> doubles, <code>-50</code> halves and flips, <code>0</code> blocks the source. A <code>0</code> on an axis remap still zeroes the source and leaves the destination as the device sent it. A magnitude past <code>LOCK_SCALE_MAX</code> (255) is <A href="/library/types/errors#errors"><code>Error::TransformScaleRange</code></A>. A button source carries one bit rather than a magnitude, so it takes only the full pass of <code>100</code>; anything else is <A href="/library/types/errors#errors"><code>Error::TransformUsageScale</code></A>.</td></tr>
            </tbody>
          </table>
          <p>
            The written value is clamped to the destination field's declared range.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Axis, Button, Key, Transform, TransformOp};

let flip = Transform::invert(Axis::Y);
assert_eq!((flip.op, flip.scale), (TransformOp::Scale, -100));

let fast_wheel = Transform::scale_axis(Axis::Wheel, 200);         // double the detents
let half_swap = Transform::swap(Axis::X, Axis::Y).with_scale(50); // exchanged, and halved
let side_key = Transform::remap(Button::new(4), Key::A);          // the fifth button types 'A'`}</code></pre>
        </Card>
      </div>
      <div id="transform-key" data-search-target>
        <Card>
          <CardHeader title="TransformKey" subtitle="The (source, dest) pair an entry is filed under" />
          <pre class="api-signature">struct TransformKey {'{'} source: LockTarget, dest: LockTarget {'}'}</pre>
          <p>
            What <A href="/library/types/structs#transform"><code>Transform::key</code></A> returns, and
            what <A href="/library/transform#untransform"><code>untransform</code></A> drops by. Two
            transforms sharing a key are one entry: setting the second overwrites the first's op and
            scale in place, keeping its position in the table.
          </p>
        </Card>
      </div>
      <div id="transforms" data-search-target>
        <Card>
          <CardHeader title="Transforms" subtitle="The transform table, read back" />
          <pre class="api-signature">struct Transforms {'{'} table_full: bool, entries: Vec&lt;Transform&gt; {'}'}</pre>
          <p>
            What <A href="/library/transform#query-transforms"><code>query_transforms</code></A>{' '}
            returns: the held entries, as the commands that rebuild them. There is no generation
            counter and no per-entry state, because the table is re-asserted wholesale on reconnect and
            every entry read back is a live one.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>A further entry was, or would be, refused past <code>Transforms::CAPACITY</code>, the 32 the box holds.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;<A href="/library/types/structs#transform">Transform</A>&gt;</code></td><td>One per installed transform, in installation order, which is the order the box applies them. Two that write the same field do not commute, so that order is part of the state.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Transforms;

let table = device.query_transforms()?;
println!("{}/{} transforms", table.entries.len(), Transforms::CAPACITY);
for t in &table.entries {
    println!("  {:?} {:?} -> {:?} x{}", t.op, t.source, t.dest, t.scale);
}`}</code></pre>
        </Card>
      </div>
      <div id="imperfect-status" data-search-target>
        <Card>
          <CardHeader title="ImperfectStatus" subtitle="The imperfect-clone state" />
          <p>
            The imperfect-clone state from{' '}
            <A href="/library/options#query-imperfect"><code>query_imperfect()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>allowed</code></td><td><code>bool</code></td><td>The opt-in toggle; cloning an over-capacity device is allowed.</td></tr>
              <tr><td><code>over_capacity</code></td><td><code>bool</code></td><td>The attached device needs an interrupt-IN endpoint the box can't service.</td></tr>
              <tr><td><code>clone_imperfect</code></td><td><code>bool</code></td><td>The live clone is over-capacity and was cloned anyway, so one interface is dead.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="emit-pace-status" data-search-target>
        <Card>
          <CardHeader title="EmitPaceStatus" subtitle="The emit-rate pacing state and the rate the clone runs at" />
          <p>
            The emit-rate pacing state from{' '}
            <A href="/library/options#query-emit-pace"><code>query_emit_pace()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#emit-pace"><code>EmitPace</code></A></td><td>The pace; <code>Fixed</code> carries the requested rate.</td></tr>
              <tr><td><code>resolved_hz</code></td><td><code>u16</code></td><td>The ceiling in effect (Hz); 0 = learnt/adaptive, or no device yet in <code>Interval</code>; 1000 once the renderer has a profile.</td></tr>
              <tr><td><code>force_hz</code></td><td><code>Option&lt;u16&gt;</code></td><td>The forced wire rate requested; <code>None</code> leaves the native interval.</td></tr>
              <tr><td><code>advertised_hz</code></td><td><code>u16</code></td><td>What the clone's input endpoints advertise now, forced or native; 0 = no clone.</td></tr>
              <tr><td><code>force_active</code></td><td><code>bool</code></td><td>Whether a forced interval is written into the descriptor being served.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="render-status" data-search-target>
        <Card>
          <CardHeader title="RenderStatus" subtitle="The texture motion is rendered with, and whether a profile has armed" />
          <p>
            The render state from{' '}
            <A href="/library/options#query-render"><code>query_render()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#render-mode"><code>RenderMode</code></A></td><td>The texture motion is rendered with; <code>Off</code> is the paced fill.</td></tr>
              <tr><td><code>full</code></td><td><code>bool</code></td><td>Whether native motion is rendered by the model rather than relayed.</td></tr>
              <tr><td><code>ready</code></td><td><code>bool</code></td><td>Whether a profile has armed for the attached device. Nothing is rendered until it has.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="spread-status" data-search-target>
        <Card>
          <CardHeader title="SpreadStatus" subtitle="How far an injected delta is spread, and the interval in effect" />
          <p>
            The spread state from{' '}
            <A href="/library/options#query-spread"><code>query_spread()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>percent</code></td><td><code>u16</code></td><td>Share of the command interval a delta is released across; <code>0</code> is the whole delta on the next report.</td></tr>
              <tr><td><code>span_us</code></td><td><code>u32</code></td><td>The interval in effect, in microseconds. <code>0</code> whenever nothing is being spread.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="log-line" data-search-target>
        <Card>
          <CardHeader title="LogLine" subtitle="One line from the LOG stream" />
          <p>
            One line from the box's <A href="/native/commands/admin#log"><code>LOG</code></A> stream,
            read off a <A href="/library/types/structs#logstream"><code>LogStream</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>level</code></td><td><A href="/library/types/enums#log-level"><code>LogLevel</code></A></td><td>Severity tag.</td></tr>
              <tr><td><code>text</code></td><td><code>String</code></td><td>The decoded message.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="port-info" data-search-target>
        <Card>
          <CardHeader title="PortInfo" subtitle="A discovered serial port" />
          <p>
            A serial port that looks like a Medius box, from{' '}
            <A href="/library/connection#open"><code>find_medius()</code></A>.{' '}
            <code>serial</code> is the CH343 adapter's serial string, part of the box{' '}
            <A href="/library/discovery">identity</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>path</code></td><td><code>String</code></td><td>Serial port path.</td></tr>
              <tr><td><code>vid</code></td><td><code>u16</code></td><td>USB vendor id (<code>0x1A86</code>).</td></tr>
              <tr><td><code>pid</code></td><td><code>u16</code></td><td>USB product id (<code>0x55D3</code>).</td></tr>
              <tr><td><code>serial</code></td><td><code>Option&lt;String&gt;</code></td><td>The CH343 adapter's serial string, when it serves one.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="box-info" data-search-target>
        <Card>
          <CardHeader title="BoxInfo" subtitle="One discovered box" />
          <p>
            One entry from <A href="/library/discovery#list"><code>Device::list()</code></A>, and the
            value <A href="/library/discovery#find-where"><code>find_where</code></A>'s predicate
            receives.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>port</code></td><td><A href="/library/types/structs#port-info"><code>PortInfo</code></A></td><td>The control port (path and CH343 serial).</td></tr>
              <tr><td><code>version</code></td><td><A href="/library/types/structs#version"><code>Version</code></A></td><td>The firmware version, with the box MAC and <A href="/library/options#set-name">name</A>.</td></tr>
              <tr><td><code>device</code></td><td><A href="/library/types/structs#device-info"><code>DeviceInfo</code></A></td><td>The device it clones.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>id()</code></td><td><code>String</code></td><td>The box identity: the MAC hex, as passed to <A href="/library/discovery#open-by-id"><code>open_by_id</code></A>.</td></tr>
              <tr><td><code>name()</code></td><td><code>&amp;str</code></td><td>The box's human-readable <A href="/library/options#set-name">name</A> (from <code>version.name</code>), a display label rather than an opener key.</td></tr>
              <tr><td><code>serial()</code></td><td><code>Option&lt;&amp;str&gt;</code></td><td>The CH343 adapter's serial, when it has one.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="counters-snapshot" data-search-target>
        <Card>
          <CardHeader title="CountersSnapshot" subtitle="Link statistics snapshot" />
          <p>
            Four running link totals from{' '}
            <A href="/library/diagnostics#counters"><code>counters()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>frames_tx</code></td><td><code>u64</code></td><td>Frames sent to the box.</td></tr>
              <tr><td><code>frames_rx</code></td><td><code>u64</code></td><td>Frames received from the box.</td></tr>
              <tr><td><code>crc_drops</code></td><td><code>u64</code></td><td>Inbound frames dropped on a bad <A href="/native/frame#crc">checksum</A>.</td></tr>
              <tr><td><code>reconnects</code></td><td><code>u64</code></td><td>Times the library reopened the port.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="logstream" data-search-target>
        <Card>
          <CardHeader title="LogStream" subtitle="Receiver for the device LOG stream" />
          <p>
            Receives the box's <A href="/native/commands/admin#log"><code>LOG</code></A> frames as{' '}
            <A href="/library/types/structs#log-line"><code>LogLine</code></A> values off a local channel, from{' '}
            <A href="/library/diagnostics#logs"><code>device.logs()</code></A>. No receive method touches the wire, so cloning shares the queue. The methods and an example are on{' '}
            <A href="/library/diagnostics#logs">Logs &amp; counters</A>.
          </p>
        </Card>
      </div>

      <div id="clip-settings" data-search-target>
        <Card>
          <CardHeader title="ClipSettings" subtitle="A clip's persistent config, read back" />
          <p>
            A clip's configuration from{' '}
            <A href="/library/requests#clip-config"><code>ClipHandle::query_config()</code></A>. You set
            these with the handle setters (<code>set_autolock</code>, <code>set_loop</code>,{' '}
            <code>set_retain</code>, <code>set_ride</code>, <code>finalize</code>, <code>bind</code>);
            this is the readback.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>autolock</code></td><td><code>Vec&lt;<A href="/library/types/enums#blanket">Blanket</A>&gt;</code></td><td>The <A href="/library/types/enums#blanket"><code>Blanket</code></A> groups auto-locked while playing (clip-owned, released on stop); empty = no auto-lock.</td></tr>
              <tr><td><code>loop_</code></td><td><code>bool</code></td><td>Playback restarts from the top instead of stopping at the end.</td></tr>
              <tr><td><code>retain</code></td><td><code>bool</code></td><td>The buffered content survives a stop, so a restart replays it instead of needing a fresh append.</td></tr>
              <tr><td><code>finalized</code></td><td><code>bool</code></td><td>The clip is sealed: no more appends, ready to replay as a fixed sequence.</td></tr>
              <tr><td><code>ride</code></td><td><code>bool</code></td><td>The clip's motion waits for a real move under <A href="/library/options#set-movement-riding">movement riding</A>; <code>false</code> (the default) plays it on the box's own clock.</td></tr>
              <tr><td><code>triggers</code></td><td><code>Vec&lt;<A href="/library/types/structs#clip-trigger">ClipTrigger</A>&gt;</code></td><td>The bound input triggers (up to 8), each firing a playback action on a physical edge.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let cfg = handle.query_config()?;
if cfg.loop_ && cfg.finalized {
    println!("sealed looping clip, {} triggers", cfg.triggers.len());
}`}</code></pre>
        </Card>
      </div>

      <div id="clip-trigger" data-search-target>
        <Card>
          <CardHeader title="ClipTrigger" subtitle="One input binding that drives a clip" />
          <p>
            One physical-input binding for a clip, handed to{' '}
            <A href="/library/clip#triggers"><code>ClipHandle::bind</code></A>. The box keeps up to 8,
            keyed by usage and edge.
          </p>
          <p>
            Build one with the constructor, where <code>consume</code> defaults to false:
          </p>
          <pre class="api-signature">fn new(on: impl Into&lt;Usage&gt;, edge: Edge, action: ClipAction) -&gt; ClipTrigger</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>on</code></td><td><A href="/library/types/structs#usage"><code>Usage</code></A></td><td>The button, key, or media usage that fires the trigger.</td></tr>
              <tr><td><code>edge</code></td><td><A href="/library/types/enums#edge"><code>Edge</code></A></td><td>Which edge fires it: <code>Press</code>, <code>Release</code>, or <code>Both</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#clip-action"><code>ClipAction</code></A></td><td>The playback action to run (<code>Start</code>, <code>Stop</code>, <code>Toggle</code>, ...).</td></tr>
              <tr><td><code>consume</code></td><td><code>bool</code></td><td>Lock the trigger usage while it is active, so its edge never reaches the PC; the <code>.consume()</code> builder sets it true.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, ClipAction, ClipTrigger, Edge};

// Toggle the clip on a Side1 press, and suppress that press.
let trig = ClipTrigger::new(Button::SIDE1, Edge::Press, ClipAction::Toggle).consume();
handle.bind(trig)?;`}</code></pre>
        </Card>
      </div>

      <div id="clip-status" data-search-target>
        <Card>
          <CardHeader title="ClipStatus" subtitle="The buffered-clip ring and playback state" />
          <p>
            The clip ring depth and playback counters from{' '}
            <A href="/library/requests#clip-status"><code>ClipHandle::query_status()</code></A>. Pace top-ups off{' '}
            <code>free</code>; a <A href="/library/types/enums#clip-state"><code>ClipState::Faulted</code></A>{' '}
            state means re-sync (stop, then rebuild).
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>state</code></td><td><A href="/library/types/enums#clip-state"><code>ClipState</code></A></td><td>The lifecycle state (idle / playing / paused / faulted).</td></tr>
              <tr><td><code>free</code></td><td><code>u32</code></td><td>Free bytes in the ring, the headroom for the next append.</td></tr>
              <tr><td><code>total</code></td><td><code>u32</code></td><td>The retained clip size in bytes; while streaming, the buffered-but-undrained bytes.</td></tr>
              <tr><td><code>played</code></td><td><code>u32</code></td><td>Bytes played from the clip start (retained progress; ~0 while streaming).</td></tr>
              <tr><td><code>ticks</code></td><td><code>u32</code></td><td>Content frames drained since the last start (gap runs are not counted).</td></tr>
              <tr><td><code>underruns</code></td><td><code>u16</code></td><td>Underrun episodes (the ring ran dry mid-playback).</td></tr>
              <tr><td><code>overruns</code></td><td><code>u16</code></td><td>Appends dropped because the ring was full.</td></tr>
              <tr><td><code>seq_gaps</code></td><td><code>u16</code></td><td>Append-sequence gaps seen (a dropped append frame).</td></tr>
              <tr><td><code>held</code></td><td><code>Vec&lt;<A href="/library/types/structs#usage">Usage</A>&gt;</code></td><td>The usages the clip is holding down, buttons, keys, and media in one list like a <A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A>; test one with <code>is_held(usage)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="chip-firmware" data-search-target>
        <Card>
          <CardHeader title="ChipFirmware" subtitle="What one chip is running" />
          <p>
            One chip's half of{' '}
            <A href="/library/requests#firmware-info"><code>firmware_info()</code></A>.{' '}
            <code>Display</code> renders it as <code>major.minor.patch</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>major</code>, <code>minor</code>, <code>patch</code></td><td><code>u8</code></td><td>The firmware version this chip is running.</td></tr>
              <tr><td><code>slot</code></td><td><code>u8</code></td><td>Which app slot it booted: <code>0</code> or <code>1</code>.</td></tr>
              <tr><td><code>state</code></td><td><A href="/library/types/enums#image-state"><code>ImageState</code></A></td><td>Whether that image is confirmed, on probation, or rolled back.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="firmware-info" data-search-target>
        <Card>
          <CardHeader title="FirmwareInfo" subtitle="Both chips, and what is staged" />
          <p>
            Returned by <A href="/library/requests#firmware-info"><code>firmware_info()</code></A>.{' '}
            <code>any_pending()</code> is true while either chip is still on probation, which is when{' '}
            <A href="/library/update">an update</A> is refused.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>device</code></td><td><A href="/library/types/structs#chip-firmware"><code>ChipFirmware</code></A></td><td>The PC-facing chip.</td></tr>
              <tr><td><code>host</code></td><td><code>Option&lt;<A href="/library/types/structs#chip-firmware">ChipFirmware</A>&gt;</code></td><td><code>None</code> when the host chip has not answered over the inter-chip link.</td></tr>
              <tr><td><code>slot_size</code></td><td><code>u32</code></td><td>Usable bytes in a spare slot; the same on both chips.</td></tr>
              <tr><td><code>device_staged</code></td><td><code>bool</code></td><td>An image is written and waiting to be activated.</td></tr>
              <tr><td><code>host_staged</code></td><td><code>bool</code></td><td>The same, for the host chip.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="update-progress" data-search-target>
        <Card>
          <CardHeader title="UpdateProgress" subtitle="One acknowledged window" />
          <p>
            Handed to the closure passed to{' '}
            <A href="/library/update#stage-firmware"><code>stage_firmware()</code></A>, once per
            acknowledged window rather than once per chunk.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>The chip being written.</td></tr>
              <tr><td><code>sent</code></td><td><code>usize</code></td><td>Bytes the box has acknowledged.</td></tr>
              <tr><td><code>total</code></td><td><code>usize</code></td><td>Bytes in the whole image.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>percent()</code></td><td><code>u8</code></td><td><code>sent</code> as a percentage of <code>total</code>; <code>100</code> when <code>total</code> is <code>0</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="setup" data-search-target>
        <Card>
          <CardHeader title="Setup" subtitle="The eight-byte USB setup packet" />
          <pre class="api-signature">struct Setup {'{'} request_type: u8, request: u8, value: u16, index: u16, length: u16 {'}'}</pre>
          <p>
            What a <A href="/library/advanced/transfer#transfer"><code>transfer</code></A> carries. It
            is the <a href="https://www.usb.org/document-library/usb-20-specification" target="_blank" rel="noreferrer">USB §9.3</a>{' '}
            setup packet: <code>bmRequestType</code>, <code>bRequest</code>, <code>wValue</code>,{' '}
            <code>wIndex</code>, <code>wLength</code>, little-endian on the wire.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>request_type</code></td><td><code>u8</code></td><td><code>bmRequestType</code>: direction in bit 7 (set is device-to-host / IN), then type and recipient.</td></tr>
              <tr><td><code>request</code></td><td><code>u8</code></td><td><code>bRequest</code>: the request code.</td></tr>
              <tr><td><code>value</code></td><td><code>u16</code></td><td><code>wValue</code>: request-specific.</td></tr>
              <tr><td><code>index</code></td><td><code>u16</code></td><td><code>wIndex</code>: request-specific, often an interface or endpoint.</td></tr>
              <tr><td><code>length</code></td><td><code>u16</code></td><td><code>wLength</code>: the data-stage length. For an IN request, how many bytes to read back (the device may return fewer); for an OUT request, the length of the data you pass.</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`  byte   0            1          2   3         4   5         6   7
        +------------+----------+---------+---------+---------+
        |request_type| request  |  value  |  index  | length  |
        | bmRequest  | bRequest  | wValue  | wIndex  | wLength |
        +------------+----------+---------+---------+---------+
                                  <-- LE -> <-- LE -> <-- LE ->`}</pre>
          <p>
            <code>Setup::new</code> builds one from its five fields; <code>is_in</code> reads the
            direction bit; <code>to_bytes</code> gives the eight wire bytes (<code>&lt;BBHHH&gt;</code>,
            little-endian). It is what a{' '}
            <A href="/library/advanced/transfer#transfer"><code>transfer</code></A> carries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Setup;

// GET_DESCRIPTOR(Device): standard device-to-host request for the 18-byte device descriptor.
let setup = Setup::new(0x80, 0x06, 0x0100, 0x0000, 18);
assert!(setup.is_in());
assert_eq!(setup.to_bytes(), [0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);`}</code></pre>
        </Card>
      </div>
      <div id="transfer-outcome" data-search-target>
        <Card>
          <CardHeader title="TransferOutcome" subtitle="The device's answer: status and any IN data" />
          <pre class="api-signature">struct TransferOutcome {'{'} status: TransferStatus, data: Vec&lt;u8&gt; {'}'}</pre>
          <p>
            What <A href="/library/advanced/transfer#transfer"><code>transfer</code></A> returns. A
            non-<code>Ok</code> <A href="/library/types/enums#transfer-status"><code>status</code></A>{' '}
            carries no data.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>status</code></td><td><A href="/library/types/enums#transfer-status"><code>TransferStatus</code></A></td><td>How the transfer ended.</td></tr>
              <tr><td><code>data</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The IN data the device returned. Empty for an OUT transfer, a STALL, or no data.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>.is_ok()</code></td><td><code>bool</code></td><td>Whether the transfer completed.</td></tr>
              <tr><td><code>.data()</code></td><td><code>&amp;[u8]</code></td><td>The returned data.</td></tr>
              <tr><td><code>.ok_data()</code></td><td><code>Option&lt;Vec&lt;u8&gt;&gt;</code></td><td>The data if the transfer completed, else <code>None</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="rewrite-rule" data-search-target>
        <Card>
          <CardHeader title="RewriteRule" subtitle="The rewrite rule you install" />
          <pre class="api-signature">fn new(class: RewriteClass, id: u16, direction: Direction, action: RewriteAction) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn matching(self, match_bytes: impl Into&lt;Vec&lt;u8&gt;&gt;, mask: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn at_offset(self, offset: u16) -&gt; RewriteRule</pre>
          <pre class="api-signature">fn with_payload(self, payload: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; RewriteRule</pre>
          <p>
            One entry in the table you hand to{' '}
            <A href="/library/advanced/rewrite#set-rewrite"><code>set_rewrite</code></A>, built by
            chaining onto <code>new</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#rewrite-class"><code>RewriteClass</code></A></td><td>The traffic class the rule addresses.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The address within the class: an interface number or an endpoint number.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td>The flow the rule matches: <code>Both</code>, <code>Positive</code> (IN) or <code>Negative</code> (OUT). <code>With</code> and <code>Against</code> resolve at emit time, after a rule is addressed, so either is <A href="/library/types/errors#errors"><code>Error::RelativeDirection</code></A>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#rewrite-action"><code>RewriteAction</code></A></td><td>What the rule does to a matched packet. One that does not fit the class is <A href="/library/types/errors#errors"><code>Error::RewriteActionClass</code></A>.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>Where a patching action writes; other actions ignore it.</td></tr>
              <tr><td><code>match_bytes</code>, <code>mask</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The head bytes and their mask, compared over the packet head byte for byte. They are the same length, or the rule is <A href="/library/types/errors#errors"><code>Error::RewriteMaskLength</code></A>; empty matches every packet on the address.</td></tr>
              <tr><td><code>payload</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The bytes an action that carries one supplies. Past the head the box holds for the class (64 bytes for a report class, an 8+2048-byte image for control) it is <A href="/library/types/errors#errors"><code>Error::RewritePayloadTooLarge</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="rewrite-table" data-search-target>
        <Card>
          <CardHeader title="RewriteTable" subtitle="The rewrite table, read back" />
          <pre class="api-signature">struct RewriteTable {'{'} table_full: bool, generation: u8, entries: Vec&lt;RewriteEntry&gt; {'}'}</pre>
          <p>
            What <A href="/library/advanced/rewrite#query-rewrite"><code>query_rewrite</code></A>{' '}
            returns: a summary row per rule, without its match, mask, or payload bytes. Read one rule in
            full with{' '}
            <A href="/library/advanced/rewrite#query-rewrite-entry"><code>query_rewrite_entry</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>A further rule was, or would be, refused past the 32 the box holds (<code>REWRITE_MAX_ENTRIES</code>).</td></tr>
              <tr><td><code>generation</code></td><td><code>u8</code></td><td>Bumps only on a change that alters the table, so a host holding a last-seen value re-sends only when the box's diverges. The crate does this for you.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;<A href="/library/types/structs#rewrite-entry">RewriteEntry</A>&gt;</code></td><td>One row per rule, in installation order, not the most-specific-first order the box selects a match by.</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/library/requests#health"><code>query_health</code></A> reports a non-empty table in
            its <A href="/library/types/structs#health"><code>rewrite_on</code></A> flag.
          </p>
        </Card>
      </div>
      <div id="rewrite-entry" data-search-target>
        <Card>
          <CardHeader title="RewriteEntry" subtitle="One row in a RewriteTable" />
          <pre class="api-signature">struct RewriteEntry {'{'} class: RewriteClass, id: u16, direction: Direction, action: RewriteAction, match_len: u8, offset: u16, payload_len: u16, hits: u16 {'}'}</pre>
          <p>
            One rule's summary in a{' '}
            <A href="/library/types/structs#rewrite-table"><code>RewriteTable</code></A>: its address and
            action, the lengths of what it carries, and its hit count. The bytes come from{' '}
            <A href="/library/advanced/rewrite#query-rewrite-entry"><code>query_rewrite_entry</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>class</code>, <code>id</code>, <code>direction</code>, <code>action</code></td><td>as set</td><td>The rule's address and action.</td></tr>
              <tr><td><code>match_len</code></td><td><code>u8</code></td><td>How many match and mask bytes the rule compares.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>The write offset for a patching action.</td></tr>
              <tr><td><code>payload_len</code></td><td><code>u16</code></td><td>How many payload bytes the rule carries.</td></tr>
              <tr><td><code>hits</code></td><td><code>u16</code></td><td>Packets the rule has matched since it was installed, saturating.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="patch" data-search-target>
        <Card>
          <CardHeader title="Patch" subtitle="The descriptor overwrite you store" />
          <pre class="api-signature">fn new(section: PatchSection, offset: u16, bytes: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; Patch</pre>
          <pre class="api-signature">fn in_config(cfg: u8, offset: u16, bytes: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; Patch</pre>
          <pre class="api-signature">fn in_interface(cfg: u8, interface: u8, offset: u16, bytes: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; Patch</pre>
          <pre class="api-signature">fn in_string(index: u8, bytes: impl Into&lt;Vec&lt;u8&gt;&gt;) -&gt; Patch</pre>
          <p>
            One entry in the set you hand to{' '}
            <A href="/library/advanced/patch#set-patch"><code>set_patch</code></A>, with a constructor
            per section.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>section</code></td><td><A href="/library/types/enums#patch-section"><code>PatchSection</code></A></td><td>The descriptor this patch targets.</td></tr>
              <tr><td><code>cfg</code></td><td><code>u8</code></td><td>The configuration index, for <code>Config</code> / <code>Report</code>.</td></tr>
              <tr><td><code>index</code></td><td><code>u8</code></td><td>The interface or string index, for <code>Report</code> / <code>String</code>.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>The byte offset within the descriptor the overwrite starts at.</td></tr>
              <tr><td><code>bytes</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The overwrite bytes; empty removes the patch at this key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="patch-set" data-search-target>
        <Card>
          <CardHeader title="PatchSet" subtitle="The stored patch set and its apply state" />
          <pre class="api-signature">struct PatchSet {'{'} applied: bool, pending: bool, refused: bool, table_full: bool, entries: Vec&lt;PatchEntry&gt; {'}'}</pre>
          <p>
            What <A href="/library/advanced/patch#query-patches"><code>query_patches</code></A>{' '}
            returns, as four apply-state flags over a list of{' '}
            <A href="/library/types/structs#patch-entry"><code>PatchEntry</code></A>.{' '}
            <A href="/library/requests#health"><code>query_health</code></A> reports an applied set in its{' '}
            <A href="/library/types/structs#health"><code>patch_on</code></A> flag.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Set when</th></tr></thead>
            <tbody>
              <tr><td><code>applied</code></td><td>The stored set is applied to the live clone.</td></tr>
              <tr><td><code>pending</code></td><td>A stored change has not been applied yet; an <code>apply_patch</code> would re-present with it.</td></tr>
              <tr><td><code>refused</code></td><td>The last apply was refused: a patched descriptor's advertised length no longer matched what it serves. The box logged why.</td></tr>
              <tr><td><code>table_full</code></td><td>The store is full: a further patch was, or would be, refused past the 16 it holds (<code>PATCH_MAX_ENTRIES</code>).</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`  set_patch        --> stored          (survives reconnect; NVS, per VID:PID)
     |                     |
     | apply_patch         v
     +-------------> pending -> applied  (one replug; the clone re-presents patched)
                            \\
                             +-> refused (a patched length diverged; logged)`}</pre>
        </Card>
      </div>
      <div id="patch-entry" data-search-target>
        <Card>
          <CardHeader title="PatchEntry" subtitle="One row in a PatchSet" />
          <pre class="api-signature">struct PatchEntry {'{'} section: PatchSection, cfg: u8, index: u8, offset: u16, len: u16 {'}'}</pre>
          <p>
            One patch's key and length in a{' '}
            <A href="/library/types/structs#patch-set"><code>PatchSet</code></A>, without its bytes. Read
            a full patch with{' '}
            <A href="/library/advanced/patch#query-patch-entry"><code>query_patch_entry</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>section</code>, <code>cfg</code>, <code>index</code>, <code>offset</code></td><td>as set</td><td>The patch's key.</td></tr>
              <tr><td><code>len</code></td><td><code>u16</code></td><td>How many bytes the patch overwrites.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

    </>
  );
};

export default Structs;
