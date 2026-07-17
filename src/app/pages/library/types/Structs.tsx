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
              <tr><td><code>proto_ver</code></td><td><code>u8</code></td><td>Wire-protocol version the firmware speaks (<code>3</code> here).</td></tr>
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

let v = Version { proto_ver: 3, fw_major: 3, fw_minor: 0, fw_patch: 0, mac: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc], name: "Loki".into() };
assert_eq!(v.to_string(), "fw 3.0.0"); // Display omits proto_ver
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
              <tr><td><code>catch_on</code></td><td><code>bool</code></td><td>A <A href="/library/catch#catch-events"><code>catch</code></A> subscription is streaming physical-input events.</td></tr>
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
      <div id="catch-mask" data-search-target>
        <Card>
          <CardHeader title="CatchMask" subtitle="Which physical reports raise an event" />
          <p>
            A bitflags newtype you hand to{' '}
            <A href="/library/catch#catch-events"><code>catch_events()</code></A>. It gates{' '}
            <em>which</em> reports raise a{' '}
            <A href="/library/types/enums#catch-event"><code>CatchEvent</code></A>; the payload is
            always the full snapshot. Combine the consts with <code>|</code> (<code>BitOr</code>), e.g.{' '}
            <code>CatchMask::MOTION | CatchMask::BUTTONS</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Const</th><th>Bit</th><th>Triggers on</th></tr></thead>
            <tbody>
              <tr><td><code>MOTION</code></td><td><code>0x01</code></td><td>The mouse moved (dx/dy).</td></tr>
              <tr><td><code>WHEEL</code></td><td><code>0x02</code></td><td>The wheel turned.</td></tr>
              <tr><td><code>BUTTONS</code></td><td><code>0x04</code></td><td>A button changed.</td></tr>
              <tr><td><code>KEYS</code></td><td><code>0x08</code></td><td>A keyboard key or modifier changed.</td></tr>
              <tr><td><code>MEDIA</code></td><td><code>0x10</code></td><td>A media (Consumer) usage changed.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Method</th><th>Returns</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>empty()</code></td><td><code>CatchMask</code></td><td>No bits set (unsubscribe).</td></tr>
              <tr><td><code>all()</code></td><td><code>CatchMask</code></td><td>Every class set (<code>0x1F</code>).</td></tr>
              <tr><td><code>bits()</code></td><td><code>u8</code></td><td>The raw mask byte.</td></tr>
              <tr><td><code>is_empty()</code></td><td><code>bool</code></td><td>No bits set.</td></tr>
              <tr><td><code>contains(other)</code></td><td><code>bool</code></td><td>Every bit in <code>other</code> is set here.</td></tr>
              <tr><td><code>union(other)</code></td><td><code>CatchMask</code></td><td>The two masks ORed together.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::CatchMask;

let mask = CatchMask::MOTION | CatchMask::BUTTONS;
assert!(mask.contains(CatchMask::BUTTONS));
assert_eq!(mask.bits(), 0x05);
let stream = device.catch_events(mask)?;`}</code></pre>
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
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>X movement this report (right positive).</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Y movement this report (down positive).</td></tr>
              <tr><td><code>dz</code></td><td><code>i16</code></td><td>Wheel movement this report (up positive).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchMask, CatchEvent};

let stream = device.catch_events(CatchMask::MOTION | CatchMask::WHEEL)?;
if let CatchEvent::Motion(m) = stream.recv()? {
    println!("moved {} {}, wheel {}", m.dx, m.dy, m.dz);
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
          <pre><code class="language-rust">{`use medius::{Button, CatchMask, CatchEvent};

let stream = device.catch_events(CatchMask::BUTTONS)?;
if let CatchEvent::Usages(s) = stream.recv()? {
    if s.is_held(Button::Left) {
        println!("left button held");
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
          <CardHeader title="CatchState" subtitle="The active catch subscription" />
          <p>
            The current subscription from{' '}
            <A href="/library/requests#query-catch"><code>query_catch()</code></A>. A nonzero{' '}
            <code>dropped</code> means the box shed events under back-pressure.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>mask</code></td><td><A href="/library/types/structs#catch-mask"><code>CatchMask</code></A></td><td>Which reports are subscribed; empty = none.</td></tr>
              <tr><td><code>dropped</code></td><td><code>u32</code></td><td>Box-side events dropped under back-pressure.</td></tr>
            </tbody>
          </table>
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
            <A href="/library/diagnostics#logs"><code>device.logs()</code></A>.
          </p>

          <p>
            Pull lines with whichever method fits your loop; none touch the wire (they read a local
            channel), so cloning shares the same queue. See{' '}
            <a
              href="https://doc.rust-lang.org/std/iter/trait.IntoIterator.html"
              target="_blank"
              rel="noreferrer"
            >
              <code>IntoIterator</code>
            </a>{' '}
            for looping the stream directly with <code>for line in stream</code> (blocks per line until
            the link closes).
          </p>
          <div class="api-response-label">METHODS</div>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Returns</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>recv()</code></td><td><code>Result&lt;LogLine&gt;</code></td><td>Block until the next line, or <code>Err(Disconnected)</code> if the link drops.</td></tr>
              <tr><td><code>try_recv()</code></td><td><code>Option&lt;LogLine&gt;</code></td><td>The next buffered line, or <code>None</code> (never blocks).</td></tr>
              <tr><td><code>recv_timeout(dur)</code></td><td><code>Option&lt;LogLine&gt;</code></td><td>Block up to <code>dur</code>; <code>None</code> on timeout.</td></tr>
              <tr><td><code>try_iter()</code></td><td><code>impl Iterator</code></td><td>Drain every buffered line without blocking.</td></tr>
              <tr><td><code>recv_async().await</code></td><td><code>Result&lt;LogLine&gt;</code></td><td>Await the next line (<code>async</code> feature), runtime-agnostic.</td></tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let stream = device.logs();

// Drain whatever has piled up so far, no blocking.
for line in stream.try_iter() {
    println!("[{:?}] {}", line.level, line.text);
}

// Then block once for the next line.
if let Ok(line) = stream.recv() {
    println!("[{:?}] {}", line.level, line.text);
}`}</code></pre>

          <div class="callout callout--info">
            <p>
              See <A href="/library/diagnostics#logs">Logs</A> for where the stream comes from and
              when the box emits <A href="/native/commands/admin#log"><code>LOG</code></A> frames.
            </p>
          </div>
        </Card>
      </div>

      <div id="clip-settings" data-search-target>
        <Card>
          <CardHeader title="ClipSettings" subtitle="A clip's persistent config, read back" />
          <p>
            A clip's configuration from{' '}
            <A href="/library/clip#query-config"><code>ClipHandle::query_config()</code></A>: the
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
            <A href="/library/clip#bind"><code>ClipHandle::bind</code></A>; the box keeps up to 8, keyed
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
            <A href="/library/clip#status"><code>ClipHandle::query_status()</code></A>. Pace top-ups off{' '}
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
