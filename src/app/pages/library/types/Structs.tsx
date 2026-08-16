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
            Plain value types you get back from queries and discovery. Their fields are public.
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
              <tr><td><code>proto_ver</code></td><td><code>u8</code></td><td>Wire-protocol version the firmware speaks (<code>4</code> here).</td></tr>
              <tr><td><code>fw_major</code></td><td><code>u8</code></td><td>Firmware major version.</td></tr>
              <tr><td><code>fw_minor</code></td><td><code>u8</code></td><td>Firmware minor version.</td></tr>
              <tr><td><code>fw_patch</code></td><td><code>u8</code></td><td>Firmware patch version.</td></tr>
              <tr><td><code>mac</code></td><td><code>[u8; 6]</code></td><td>The device chip's base MAC, a stable per-box id.</td></tr>
              <tr><td><code>name</code></td><td><code>String</code></td><td>The box's human-readable name (a synthesized default when unset), set via <A href="/library/options#set-name"><code>set_name</code></A>.</td></tr>
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

let v = Version { proto_ver: 4, fw_major: 3, fw_minor: 0, fw_patch: 0, mac: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc], name: "Loki".into() };
assert_eq!(v.to_string(), "fw 3.1.0"); // Display omits proto_ver
assert_eq!(v.mac_hex(), "123456789abc");
println!("{v} (protocol {}, box {}, name {})", v.proto_ver, v.mac_hex(), v.name);`}</code></pre>
        </Card>
      </div>
      <div id="health" data-search-target>
        <Card>
          <CardHeader title="Health" subtitle="Box readiness flags" />
          <p>
            Box readiness from <A href="/library/requests#health"><code>query_health()</code></A>, one
            bool per bit. <code>from_flags(u8)</code> and <code>to_flags()</code> convert the byte.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>True when</th></tr></thead>
            <tbody>
              <tr><td><code>link_up</code></td><td><code>bool</code></td><td>The link to the host chip is up.</td></tr>
              <tr><td><code>mouse_attached</code></td><td><code>bool</code></td><td>A real mouse is plugged in.</td></tr>
              <tr><td><code>clone_configured</code></td><td><code>bool</code></td><td>The PC has set up the cloned mouse.</td></tr>
              <tr><td><code>injection_active</code></td><td><code>bool</code></td><td>The box is holding at least one injected button or move.</td></tr>
              <tr><td><code>rate_confident</code></td><td><code>bool</code></td><td>The native-rate estimator window is full, so <A href="/library/types/structs#rate"><code>Rate</code></A> is trustworthy.</td></tr>
              <tr><td><code>lock_on</code></td><td><code>bool</code></td><td>At least one input <A href="/library/lock#lock"><code>lock</code></A> is active.</td></tr>
              <tr><td><code>catch_on</code></td><td><code>bool</code></td><td>The <A href="/library/catch#catch-events"><code>catch</code></A> table holds at least one <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A>, whatever class it addresses.</td></tr>
              <tr><td><code>kbd_attached</code></td><td><code>bool</code></td><td>A keyboard is attached on the host chip, cloned and injectable.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Health;

let h = Health::from_flags(0b0000_0011); // link_up | mouse_attached
assert!(h.link_up && h.mouse_attached);
assert!(!h.clone_configured);
assert_eq!(h.to_flags(), 0b0000_0011); // round-trips to the same byte`}</code></pre>
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
            One <A href="/library/requests#caps"><code>caps()</code></A> query, returned as one struct:
            a <A href="/library/types/structs#mouse-caps"><code>MouseCaps</code></A> half and a{' '}
            <A href="/library/types/structs#kbd-caps"><code>KbdCaps</code></A> half, plus the per-class
            change-driven flags. <code>has_mouse()</code> / <code>has_keyboard()</code> tell you which
            are bound; <code>is_composite()</code> is true when the device has more than one HID
            interface.
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
              <tr><td><code>has_report_id</code></td><td><code>bool</code></td><td>The mouse report sits behind a HID report ID.</td></tr>
              <tr><td><code>n_hid</code></td><td><code>u8</code></td><td>Cloned HID interfaces; <code>&gt;1</code> = composite.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::MouseCaps;

let c = MouseCaps { n_buttons: 5, has_x: true, has_y: true, has_wheel: true, has_report_id: false, n_hid: 1 };
assert!(!c.is_composite()); // single HID interface`}</code></pre>
        </Card>
      </div>
      <div id="rate" data-search-target>
        <Card>
          <CardHeader title="Rate" subtitle="The native report rate the box tracks" />
          <p>
            Live rate from <A href="/library/requests#query-rate"><code>query_rate()</code></A>.{' '}
            <code>native_hz()</code> converts the period to a frequency, returning <code>None</code>{' '}
            while <code>native_period_us</code> is still <code>0</code>. The rate is class-aware: a
            change-driven input (a keyboard or media device) has no continuous cadence, so it sets{' '}
            <code>change_driven</code> and leaves <code>native_period_us</code> at <code>0</code>, with{' '}
            <code>poll_period_us</code> the honest figure.
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
              <tr><td><code>tx_drops</code></td><td><code>u16</code></td><td>Reports dropped on TX-queue overflow (should stay 0).</td></tr>
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
          <CardHeader title="Locks" subtitle="The active input locks" />
          <p>
            Active locks from <A href="/library/requests#query-locks"><code>query_locks()</code></A>, a
            list of <A href="/library/types/structs#lock-entry"><code>LockEntry</code></A> across every
            class, so mouse, key, and media locks read the same way.{' '}
            <code>is_locked(target, dir)</code> tests one lock; <code>entries()</code> is the whole list.
            See the native <A href="/native/commands/requests#locks"><code>LOCKS</code></A> reply for the
            wire format.
          </p>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>entries()</code></td><td><code>&amp;[<A href="/library/types/structs#lock-entry">LockEntry</A>]</code></td><td>Every active lock, one entry per locked target or whole-class blanket.</td></tr>
              <tr><td><code>is_locked(target, dir)</code></td><td><code>bool</code></td><td>Whether that target and direction is locked, by a specific entry or a covering whole-class blanket; <code>target</code> is any <code>impl Into&lt;LockTarget&gt;</code>.</td></tr>
              <tr><td><code>from_entries(Vec&lt;LockEntry&gt;)</code></td><td><code>Locks</code></td><td>Build one from entries, for tests and the <A href="/library/features/mock"><code>MockBox</code></A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Axis, Button, LockDirection};

let locks = device.query_locks()?;
if locks.is_locked(Axis::X, LockDirection::Positive) {
    // the real mouse can't move right
}
if locks.is_locked(Button::Left, LockDirection::Negative) {
    // a left-click is latched down: the hand can't release it
}
println!("{} locks active", locks.entries().len());`}</code></pre>
        </Card>
      </div>
      <div id="lock-entry" data-search-target>
        <Card>
          <CardHeader title="LockEntry" subtitle="One entry in a Locks list" />
          <pre class="api-signature">struct LockEntry {'{'} scope: LockScope, positive: bool, negative: bool {'}'}</pre>
          <p>
            One active lock in a <A href="/library/types/structs#locks"><code>Locks</code></A> list: what is
            locked (its <A href="/library/types/enums#lock-scope"><code>LockScope</code></A>) and which edges.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>scope</code></td><td><A href="/library/types/enums#lock-scope"><code>LockScope</code></A></td><td>A specific axis or usage, or a whole-class blanket.</td></tr>
              <tr><td><code>positive</code></td><td><code>bool</code></td><td>The positive/press edge is locked.</td></tr>
              <tr><td><code>negative</code></td><td><code>bool</code></td><td>The negative/release edge is locked.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="catch-filter" data-search-target>
        <Card>
          <CardHeader title="CatchFilter" subtitle="One subscription entry: what to catch, and how much of it" />
          <pre class="api-signature">struct CatchFilter {'{'} class: CatchClass, id: u16, direction: LockDirection, snaplen: u8 {'}'}</pre>
          <p>
            One entry in the subscription table you hand to{' '}
            <A href="/library/catch#catch-events"><code>catch_events()</code></A>, built with the
            constructors below. A filter is an <em>address</em>: a{' '}
            <A href="/library/types/enums#catch-class"><code>CatchClass</code></A> and an id inside it,
            the same vocabulary a <A href="/library/lock#lock"><code>lock</code></A> uses, plus a{' '}
            <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A> and how many
            bytes to capture per event.
          </p>
          <div class="api-response-label">WHY THE ADDRESS IS THE FILTER</div>
          <p>
            The control link runs at 4 Mbaud, which is 400 KB/s of raw payload before framing, and a
            single vendor bulk pipe measures 250 KiB/s through the box on its own. Everything at once
            cannot physically be delivered, so a subscription has to be able to name{' '}
            <em>which endpoint</em> it means rather than only which kind of thing. That is why the old
            five-bit class mask was replaced rather than extended: no number of extra bits in a mask
            distinguishes endpoint <code>0x83</code> from endpoint <code>0x84</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Constructor</th><th>Returns</th><th>Addresses</th></tr></thead>
            <tbody>
              <tr><td><code>CatchFilter::all()</code></td><td><code>CatchFilter</code></td><td>Class <code>Any</code>, every id, both directions: the whole firehose.</td></tr>
              <tr><td><code>CatchFilter::class(class)</code></td><td><code>CatchFilter</code></td><td>Every id in one <A href="/library/types/enums#catch-class"><code>CatchClass</code></A>, a blanket.</td></tr>
              <tr><td><code>CatchFilter::addr(class, id)</code></td><td><code>CatchFilter</code></td><td>One id inside one class: a button, a keycode, an axis, an endpoint, an interface.</td></tr>
              <tr><td><code>.direction(dir)</code></td><td><code>CatchFilter</code></td><td>Narrow to one edge or one transfer direction; defaults to <code>Both</code>.</td></tr>
              <tr><td><code>.snaplen(n)</code></td><td><code>CatchFilter</code></td><td>Capture at most <code>n</code> bytes per event; defaults to <code>0</code>, the whole packet.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#catch-class"><code>CatchClass</code></A></td><td>Which address space: an input class, a traffic class, or <code>Any</code>.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The class-specific id, or the blanket that <code>class()</code> and <code>all()</code> set for you.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#lock-direction"><code>LockDirection</code></A></td><td>The press/release edge for an input class, the transfer direction for a traffic class (<code>Positive</code> = IN, <code>Negative</code> = OUT).</td></tr>
              <tr><td><code>snaplen</code></td><td><code>u8</code></td><td>Bytes captured per event; <code>0</code> = the whole packet. Ignored by the input classes, which have no bytes to cut.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SNAPLEN IS PER ENTRY</div>
          <p>
            The useful capture length differs by orders of magnitude between classes, which is why it
            sits on the entry rather than on the subscription as a whole. A 64-byte vendor interrupt
            report is worth having in full, because the interesting field could be anywhere in it. A
            bulk pipe traced only for its framing wants 16 bytes and would drown the link at any larger
            value. One number for both would have to be wrong for one of them.
          </p>
          <div class="api-response-label">MATCHING IS MOST-SPECIFIC-FIRST</div>
          <p>
            An event is matched against the whole table and the most specific entry wins: an exact{' '}
            <code>(class, id)</code> beats a class blanket, which beats <code>Any</code>. Ties between
            equally specific entries go to the one added first. The winning entry is what supplies{' '}
            <code>snaplen</code>, so a broad cheap trace with one deep exception is two entries, not two
            subscriptions:
          </p>
          <pre class="diagram">{`catch_events([
    CatchFilter::all().snaplen(16),                        // everything, 16 bytes
    CatchFilter::addr(CatchClass::VendIntr, 0x83),         // except 0x83, in full
])

  packet on 0x83  ->  addr(VendIntr, 0x83)  wins  ->  snaplen 0  (whole packet)
  packet on 0x84  ->  all()                 wins  ->  snaplen 16`}</pre>
          <div class="api-response-label">CAPACITY AND REFUSALS</div>
          <p>
            The table holds 32 entries. Subscribing is fire-and-forget with no reply, so a refused entry
            is not an error you can catch at the call: it shows up as an entry missing from{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A> and, when the refusal
            was capacity, as <code>table_full</code> in that same reply. The box refuses an unknown
            class, a direction outside the three values, and a wildcard class carrying a specific id.
            Each filter is sent as its own frame, so an empty iterator sends none and subscribes to
            nothing; dropping the returned stream is what clears the table.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchFilter, LockDirection};

// Press edges of every key, plus one control endpoint, plus bus context.
let stream = device.catch_events([
    CatchFilter::class(CatchClass::Key).direction(LockDirection::Positive),
    CatchFilter::addr(CatchClass::Control, 0),
    CatchFilter::class(CatchClass::Bus),
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
              <tr><td><code>clk</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip's timer <code>ts_us</code> came from. Always <code>Host</code> here: physical motion is stamped on the host chip as the real device's transfer completes.</td></tr>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>X movement this report (right positive).</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Y movement this report (down positive).</td></tr>
              <tr><td><code>dz</code></td><td><code>i16</code></td><td>Wheel movement this report (up positive).</td></tr>
            </tbody>
          </table>
          <p>
            <code>clk</code> is fixed for this event and still carried on the wire, because a stream can
            mix it with <A href="/library/types/structs#traffic-event">traffic events</A> stamped on the
            device chip. Reading the field rather than assuming the domain means the same comparison
            code works whichever variant it is handed.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchEvent, CatchFilter};

let stream = device.catch_events([CatchFilter::class(CatchClass::Axis)])?;
if let CatchEvent::Motion(m) = stream.recv()? {
    println!("at {} us ({:?}): moved {} {}, wheel {}", m.ts_us, m.clk, m.dx, m.dy, m.dz);
}`}</code></pre>
        </Card>
      </div>

      <div id="usage-snapshot" data-search-target>
        <Card>
          <CardHeader title="UsageSnapshot" subtitle="One physical held-usage snapshot" />
          <p>
            The payload of a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent::Usages</code></A>: every held{' '}
            <A href="/library/types/enums#usage"><code>Usage</code></A> of one class (buttons, keys, or
            media, all one shape), captured before injection. Diff successive snapshots for press/release
            edges, or test one with <code>is_held</code>; a dropped frame self-corrects on the next.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>When the device's report arrived, in box microseconds. See <A href="/library/catch#timestamps">Catch timestamps</A> for what the clock means.</td></tr>
              <tr><td><code>clk</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip's timer <code>ts_us</code> came from. Always <code>Host</code>: a held-usage snapshot is taken where the real device's report lands.</td></tr>
              <tr><td><code>usages</code></td><td><code>Vec&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code></td><td>The currently-held usages, all of one class per event.</td></tr>
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
          <pre><code class="language-rust">{`use medius::{Button, CatchClass, CatchEvent, CatchFilter};

let stream = device.catch_events([CatchFilter::class(CatchClass::Button)])?;
if let CatchEvent::Usages(s) = stream.recv()? {
    if s.is_held(Button::Left) {
        println!("left button held");
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
            one completed control transaction, or one bus event, from whichever of the byte-oriented{' '}
            <A href="/library/types/enums#catch-class"><code>CatchClass</code></A>es you subscribed to.
            The <code>class</code> and <code>id</code> are the address the winning{' '}
            <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> matched, so a
            broad subscription still tells you exactly which endpoint each event came off.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>ts_us</code></td><td><code>u32</code></td><td>When the transfer completed, in the microseconds of the chip named by <code>clk</code>.</td></tr>
              <tr><td><code>clk</code></td><td><A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A></td><td>Which chip stamped it. Varies by class and direction here, unlike the two input events.</td></tr>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#catch-class"><code>CatchClass</code></A></td><td>Which address space the event came from.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The endpoint address, endpoint number, or interface number inside that class.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#lock-direction"><code>LockDirection</code></A></td><td><code>Positive</code> = IN (device to PC), <code>Negative</code> = OUT (PC to device).</td></tr>
              <tr><td><code>flags</code></td><td><code>u8</code></td><td>Class-specific, see below; <code>0</code> for the classes that define none.</td></tr>
              <tr><td><code>true_len</code></td><td><code>u16</code></td><td>The packet's length <em>before</em> <code>snaplen</code> truncation.</td></tr>
              <tr><td><code>bytes</code></td><td><code>Vec&lt;u8&gt;</code></td><td>What was actually captured, at most <code>snaplen</code> of it.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>truncated()</code></td><td><code>bool</code></td><td>Whether <code>snaplen</code> or the frame ceiling cut this packet: <code>bytes.len() &lt; true_len</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHY TRUE_LEN EXISTS</div>
          <p>
            Without it, a packet cut short by <code>snaplen</code> and a genuinely short packet are the
            same 16 bytes on the wire and there is nothing in the frame to tell them apart. Carrying the
            pre-truncation length makes every capture self-describing, so a trace can be read correctly
            without also knowing which <code>snaplen</code> was in force for that entry at that moment,
            and <code>truncated()</code> is the two-value comparison that answers it. The ceiling
            applies even at <code>snaplen = 0</code>: one event frame carries at most 500 bytes, the
            512-byte payload limit minus the 12-byte traffic header, so a longer packet is still cut and
            still says so.
          </p>
          <div class="api-response-label">FLAGS BY CLASS</div>
          <table class="api-params">
            <thead><tr><th>Class</th><th>flags</th></tr></thead>
            <tbody>
              <tr><td><code>VendBulk</code></td><td>b0 = end of transfer, b1 = zero-length packet.</td></tr>
              <tr><td><code>Control</code></td><td>The real device's answer: <code>0</code> it answered, <code>0xFD</code> it STALLed, <code>0xFE</code> it NAKed until the transfer timed out.</td></tr>
              <tr><td><code>Bus</code></td><td>The <A href="/library/types/enums#bus-event"><code>BusEvent</code></A> kind.</td></tr>
              <tr><td>everything else</td><td><code>0</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CONTROL IS PER TRANSACTION</div>
          <p>
            A <code>Control</code> event is one completed transaction, not one per stage:{' '}
            <code>bytes</code> is the 8-byte SETUP packet followed by the data stage, and{' '}
            <code>direction</code> says which way that data went. A request the box answered from its
            own descriptor cache still raises an event, because a trace that silently omitted those
            would show a device that had stopped being asked, which is a different and much more
            alarming thing than a device being asked and answered quickly.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchClass, CatchEvent, CatchFilter};

let stream = device.catch_events([CatchFilter::addr(CatchClass::VendIntr, 0x83).snaplen(16)])?;
if let CatchEvent::Traffic(t) = stream.recv()? {
    println!("ep 0x{:02X} {:?}: {:02X?}", t.id, t.direction, t.bytes);
    if t.truncated() {
        println!("  cut: {} of {} bytes", t.bytes.len(), t.true_len);
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="Key" subtitle="A HID keyboard keycode" />
          <p>
            A newtype over a HID keyboard/keypad usage. It converts{' '}
            <code>Into&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code>, so you pass one
            straight to <A href="/library/inject#inject"><code>inject</code></A> or{' '}
            <A href="/library/inject#inject"><code>press</code></A>. Named consts cover the common keys
            (<code>Key::A</code>, <code>Key::ENTER</code>, <code>Key::LEFT_SHIFT</code>); build any
            other with <code>Key::new(u8)</code>. Modifiers are the usages <code>0xE0</code>-<code>0xE7</code>.
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
            <code>Into&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code>, so you pass one
            straight to <A href="/library/inject#inject"><code>inject</code></A> or{' '}
            <A href="/library/inject#inject"><code>press</code></A>. Named consts cover the common
            media keys (<code>MediaKey::VOLUME_UP</code>, <code>MediaKey::PLAY_PAUSE</code>,{' '}
            <code>MediaKey::MUTE</code>); build any other with <code>MediaKey::new(u16)</code>.
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
            The whole catch state from{' '}
            <A href="/library/requests#query-catch"><code>query_catch()</code></A>: which entries the
            box is actually holding, what each of them has had to drop, and the relationship between the
            two chips' clocks. Subscribing has no reply of its own, so this is where you find out what
            the box accepted.
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
            <code>table_full</code> and a missing entry answer different questions. An entry absent
            from <code>entries</code> was refused for some reason; <code>table_full</code> says the
            reason was capacity rather than a malformed filter, which is the difference between "send
            fewer entries" and "fix this one".
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
    println!("{:?} 0x{:04X} {:?} snap={} dropped={}", e.class, e.id, e.direction, e.snaplen, e.dropped);
}
println!("{} dropped box-wide", c.dropped);`}</code></pre>
        </Card>
      </div>

      <div id="catch-entry" data-search-target>
        <Card>
          <CardHeader title="CatchEntry" subtitle="One accepted subscription, and what it lost" />
          <pre class="api-signature">struct CatchEntry {'{'} class: CatchClass, id: u16, direction: LockDirection, snaplen: u8, dropped: u16 {'}'}</pre>
          <p>
            One row of the box's subscription table in a{' '}
            <A href="/library/types/structs#catch-state"><code>CatchState</code></A>. The first four
            fields are the <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A>{' '}
            the box accepted, echoed back, so comparing what you sent against what came back is how you
            confirm a subscription landed. A blanket comes back as a single entry with the blanket id,
            not expanded into one row per id.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>class</code></td><td><A href="/library/types/enums#catch-class"><code>CatchClass</code></A></td><td>The address space this entry covers.</td></tr>
              <tr><td><code>id</code></td><td><code>u16</code></td><td>The id inside it, or the blanket.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#lock-direction"><code>LockDirection</code></A></td><td>The edge or transfer direction it covers.</td></tr>
              <tr><td><code>snaplen</code></td><td><code>u8</code></td><td>Bytes captured per event when this entry is the one that matched; <code>0</code> = whole packet.</td></tr>
              <tr><td><code>dropped</code></td><td><code>u16</code></td><td>Events <em>this entry</em> could not queue.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHY THE DROP COUNT IS PER ENTRY</div>
          <p>
            Delivery runs as four strict-priority queues: input and bus events first, then the
            byte-oriented traffic classes, then control, then vendor bulk. Under a busy mouse, bulk can starve
            completely. That is deliberate, because a half-delivered bulk trace is worse than a visibly
            absent one: it looks like data, and nothing in it says which packets are missing.
          </p>
          <p>
            A box-wide counter tells you that you are losing events but not which ones, and those are
            two different problems with two different fixes. A per-entry count separates them: bulk
            starving while the key-press entry is clean means the trace is fine and the bulk capture
            needs a smaller <code>snaplen</code> or a narrower address, whereas drops on the entry you
            care about mean the subscription itself is too broad for the link.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let c = device.query_catch()?;
for e in c.entries.iter().filter(|e| e.dropped > 0) {
    eprintln!("{:?} 0x{:04X} lost {} events, try a smaller snaplen", e.class, e.id, e.dropped);
}`}</code></pre>
        </Card>
      </div>

      <div id="clock-estimate" data-search-target>
        <Card>
          <CardHeader title="ClockEstimate" subtitle="How the two chips' timers relate" />
          <pre class="api-signature">struct ClockEstimate {'{'} offset_us: i32, rate_ppb: i32, delay_us: u16, age_ms: Option&lt;u16&gt; {'}'}</pre>
          <p>
            The <code>clock</code> field of a{' '}
            <A href="/library/types/structs#catch-state"><code>CatchState</code></A>, and the only thing
            that puts stamps from both{' '}
            <A href="/library/types/enums#clock-domain">clock domains</A> on one timeline. The box measures the difference with a four-timestamp exchange across the
            inter-chip link, stamping each frame as it reaches the wire rather than when it is queued:
            queueing is the largest and most variable delay on that link, and stamping late removes it
            from the measurement instead of leaving it to be filtered out afterwards.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>offset_us</code></td><td><code>i32</code></td><td>The host chip's clock minus the device chip's, in microseconds. Add it to a device-domain stamp to read it on the host's timeline, subtract it to go the other way.</td></tr>
              <tr><td><code>rate_ppb</code></td><td><code>i32</code></td><td>How fast the two are drifting apart, in parts per billion.</td></tr>
              <tr><td><code>delay_us</code></td><td><code>u16</code></td><td>The best round trip measured in the window; the offset is good to about half of it.</td></tr>
              <tr><td><code>age_ms</code></td><td><code>Option&lt;u16&gt;</code></td><td>How long ago the exchange ran. <code>None</code> = no estimate yet.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHY EACH FIELD IS THERE</div>
          <p>
            <code>delay_us</code> is the error bar. A round-trip measurement cannot place the offset
            more precisely than the asymmetry of the trip it was measured over, so half of the best
            observed round trip is the honest bound, and quoting the offset without it invites a caller
            to trust digits that were never measured.
          </p>
          <p>
            <code>rate_ppb</code> exists because the two ESP32-S3s run off separate crystals, which
            drift against each other by up to 20 µs per second. An offset taken five seconds ago can
            therefore already be 100 µs stale, which is larger than most of what a trace is trying to
            resolve. Extrapolating with the rate is what keeps an estimate usable between exchanges
            instead of forcing a fresh query for every comparison: correct by{' '}
            <code>rate_ppb × age_ms / 1_000_000</code> µs.
          </p>
          <p>
            <code>age_ms</code> is an <code>Option</code> because "no estimate yet" and "the offset
            happens to be zero" both report an offset of zero, and only one of them is a number you may
            use. The wire distinguishes them with a sentinel age; the crate turns that into{' '}
            <code>None</code> so the two cannot be confused by accident.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let clock = device.query_catch()?.clock;
match clock.age_ms {
    None => println!("no cross-chip estimate yet: compare stamps within one domain only"),
    Some(age) => {
        let drift_us = clock.rate_ppb as i64 * age as i64 / 1_000_000;
        let offset_now = clock.offset_us as i64 + drift_us;
        println!("offset {offset_now} us, +/- {} us", clock.delay_us / 2);
    }
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
          <CardHeader title="EmitPaceStatus" subtitle="The emit-rate pacing state" />
          <p>
            The emit-rate pacing state from{' '}
            <A href="/library/options#query-emit-pace"><code>query_emit_pace()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#emit-pace"><code>EmitPace</code></A></td><td>The selected mode; <code>Fixed</code> carries the requested rate.</td></tr>
              <tr><td><code>resolved_hz</code></td><td><code>u16</code></td><td>The ceiling in effect (Hz); 0 = learnt/adaptive, or no device yet in <code>Interval</code>.</td></tr>
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
            <A href="/library/guides/connection#choosing-a-port"><code>find_medius()</code></A>.{' '}
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
            <A href="/library/diagnostics#logs"><code>device.logs()</code></A>. Pull lines with{' '}
            <code>recv</code> / <code>try_recv</code> / <code>recv_timeout</code> / <code>try_iter</code> /{' '}
            <code>recv_async</code> (or <code>for line in stream</code>); none touch the wire, so cloning
            shares the queue. The methods and an example are on{' '}
            <A href="/library/diagnostics#logs">Logs &amp; counters</A>.
          </p>
        </Card>
      </div>

      <div id="clip-settings" data-search-target>
        <Card>
          <CardHeader title="ClipSettings" subtitle="A clip's persistent config, read back" />
          <p>
            A clip's configuration from{' '}
            <A href="/library/requests#clip-config"><code>ClipHandle::query_config()</code></A>: the
            auto-lock set, the loop and retain flags, whether it's finalized, and the bound{' '}
            <A href="/library/types/structs#clip-trigger"><code>ClipTrigger</code></A> list. You set
            these with the handle setters (<code>set_autolock</code>, <code>set_loop</code>,{' '}
            <code>set_retain</code>, <code>finalize</code>, <code>bind</code>); this is the readback.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>autolock</code></td><td><code>Vec&lt;<A href="/library/types/enums#blanket">Blanket</A>&gt;</code></td><td>The <A href="/library/types/enums#blanket"><code>Blanket</code></A> groups auto-locked while playing (clip-owned, released on stop); empty = no auto-lock.</td></tr>
              <tr><td><code>loop_</code></td><td><code>bool</code></td><td>Playback restarts from the top instead of stopping at the end.</td></tr>
              <tr><td><code>retain</code></td><td><code>bool</code></td><td>The buffered content survives a stop, so a restart replays it instead of needing a fresh append.</td></tr>
              <tr><td><code>finalized</code></td><td><code>bool</code></td><td>The clip is sealed: no more appends, ready to replay as a fixed sequence.</td></tr>
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
            One physical-input binding for a clip: on a given <A href="/library/types/enums#usage"><code>Usage</code></A>{' '}
            and <A href="/library/types/enums#edge"><code>Edge</code></A>, run a{' '}
            <A href="/library/types/enums#clip-action"><code>ClipAction</code></A>. You hand these to{' '}
            <A href="/library/clip#triggers"><code>ClipHandle::bind</code></A>; the box keeps up to 8, keyed
            by usage and edge. <code>consume</code> hides the triggering input from the PC.
          </p>
          <p>
            Build one with <code>ClipTrigger::new(usage, edge, action)</code> (consume defaults false),
            then chain <code>.consume()</code> to swallow the input:
          </p>
          <pre class="api-signature">fn new(on: impl Into&lt;Usage&gt;, edge: Edge, action: ClipAction) -&gt; ClipTrigger</pre>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>on</code></td><td><A href="/library/types/enums#usage"><code>Usage</code></A></td><td>The button, key, or media usage that fires the trigger.</td></tr>
              <tr><td><code>edge</code></td><td><A href="/library/types/enums#edge"><code>Edge</code></A></td><td>Which edge fires it: <code>Press</code>, <code>Release</code>, or <code>Both</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#clip-action"><code>ClipAction</code></A></td><td>The playback action to run (<code>Start</code>, <code>Stop</code>, <code>Toggle</code>, ...).</td></tr>
              <tr><td><code>consume</code></td><td><code>bool</code></td><td>Swallow the triggering input so the PC never sees it; the <code>.consume()</code> builder sets it true.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, ClipAction, ClipTrigger, Edge};

// Toggle the clip on a Side1 press, and hide that press from the PC.
let trig = ClipTrigger::new(Button::Side1, Edge::Press, ClipAction::Toggle).consume();
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
              <tr><td><code>held</code></td><td><code>Vec&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code></td><td>The usages the clip is holding down, buttons, keys, and media in one list like a <A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A>; test one with <code>is_held(usage)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

    </>
  );
};

export default Structs;
