import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Enums: Component = () => {
  return (
    <>
      <div id="enums" data-search-target>
        <Card>
          <CardHeader title="Enums" subtitle="Command and status enumerations" />
          <p>
            Command and status enums, each tied to a wire byte. Conversion helpers are listed with each.
          </p>
        </Card>
      </div>
      <div id="device-kind" data-search-target>
        <Card>
          <CardHeader title="DeviceKind" subtitle="The cloned device's primary kind" />
          <pre class="api-signature">enum DeviceKind {'{'} Unknown, Keyboard, Mouse {'}'}</pre>
          <p>
            The <code>kind</code> field of a{' '}
            <A href="/library/types/structs#device-info"><code>DeviceInfo</code></A>, read from the
            cloned device's USB Boot-interface <code>bInterfaceProtocol</code>. It also drives{' '}
            <A href="/library/discovery#find-mouse-box"><code>find_mouse_box</code></A> and{' '}
            <A href="/library/discovery#find-keyboard-box"><code>find_keyboard_box</code></A>.{' '}
            <code>Display</code> prints the lowercase name.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Unknown</code></td><td><code>0</code></td><td>Neither a Boot keyboard nor a Boot mouse.</td></tr>
              <tr><td><code>Keyboard</code></td><td><code>1</code></td><td>The device is a keyboard.</td></tr>
              <tr><td><code>Mouse</code></td><td><code>2</code></td><td>The device is a mouse.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="button" data-search-target>
        <Card>
          <CardHeader title="Button" subtitle="The button a command acts on" />
          <pre class="api-signature">enum Button {'{'} Left, Right, Middle, Side1, Side2 {'}'}</pre>
          <p>
            The button an <A href="/native/commands/inject#inject"><code>INJECT</code></A> command acts
            on. A <code>Button</code> converts{' '}
            <code>Into&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code> as class button, so you
            pass one straight to <A href="/library/inject#inject"><code>inject</code></A>. Convert with{' '}
            <code>as_id() -&gt; u8</code> and <code>from_id(u8) -&gt; Option&lt;Button&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>id</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Left</code></td><td><code>0</code></td><td>Left button.</td></tr>
              <tr><td><code>Right</code></td><td><code>1</code></td><td>Right button.</td></tr>
              <tr><td><code>Middle</code></td><td><code>2</code></td><td>Middle button.</td></tr>
              <tr><td><code>Side1</code></td><td><code>3</code></td><td>First thumb button.</td></tr>
              <tr><td><code>Side2</code></td><td><code>4</code></td><td>Second thumb button.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="action" data-search-target>
        <Card>
          <CardHeader title="Action" subtitle="The shared press / release tri-state" />
          <pre class="api-signature">enum Action {'{'} SoftRelease, Press, ForceRelease {'}'}</pre>
          <p>
            The shared override action for an{' '}
            <A href="/library/inject#inject"><code>inject</code></A> call, on any{' '}
            <A href="/library/types/enums#usage"><code>Usage</code></A> class (button, key, or media). The
            discriminant is the wire byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;Action&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>SoftRelease</code></td><td><code>0</code></td><td>Drop the box's override, press or force; a physical hold stays down.</td></tr>
              <tr><td><code>Press</code></td><td><code>1</code></td><td>Force the input down.</td></tr>
              <tr><td><code>ForceRelease</code></td><td><code>2</code></td><td>Force the input up, masking a physical hold.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">RESULT THE PC SEES</div>
          <p>The two releases differ only when the user physically holds the same input:</p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>User holds nothing</th><th>User is holding it</th></tr></thead>
            <tbody>
              <tr><td><code>Press</code></td><td>down</td><td>down</td></tr>
              <tr><td><code>SoftRelease</code></td><td>up</td><td>down (physical wins)</td></tr>
              <tr><td><code>ForceRelease</code></td><td>up</td><td>up (masks physical)</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="class" data-search-target>
        <Card>
          <CardHeader title="Class" subtitle="The class of a momentary usage" />
          <pre class="api-signature">enum Class {'{'} Button, Key, Media {'}'}</pre>
          <p>
            The class byte of a <A href="/library/types/enums#usage"><code>Usage</code></A>, shared by{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>,{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>, and{' '}
            <A href="/native/commands/catch"><code>CATCH</code></A>. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;Class&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Button</code></td><td><code>0</code></td><td>A mouse button; id is a <A href="/library/types/enums#button"><code>Button</code></A> id (0=Left .. 4=Side2).</td></tr>
              <tr><td><code>Key</code></td><td><code>1</code></td><td>A keyboard key; id is a HID keycode (0xE0 .. 0xE7 is a modifier).</td></tr>
              <tr><td><code>Media</code></td><td><code>2</code></td><td>A media usage; id is a 16-bit Consumer usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="catch-class" data-search-target>
        <Card>
          <CardHeader title="CatchClass" subtitle="What a catch subscription addresses" />
          <pre class="api-signature">enum CatchClass {'{'} Button, Key, Media, Axis, HidIn, HidOut, VendorInterrupt, VendorBulk, Control, Emit, Bus {'}'}</pre>
          <p>
            The address space a{' '}
            <A href="/library/types/structs#catch-filter"><code>CatchFilter</code></A> picks from, and
            the <code>class</code> of a{' '}
            <A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A>. Convert with{' '}
            <code>as_u8()</code> and <code>from_u8(u8) -&gt; Option&lt;CatchClass&gt;</code>; split it
            with <code>is_input()</code> and <code>is_traffic()</code>.
          </p>
          <p>
            The first four are <A href="/native/commands/lock"><code>LOCK</code></A>'s own classes at
            the same byte values. The other seven address USB traffic and have no lock counterpart;{' '}
            <A href="/library/types/enums#traffic-class"><code>TrafficClass</code></A> is that half on
            its own.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>id is</th><th>Blanket covers</th></tr></thead>
            <tbody>
              <tr><td><code>Button</code></td><td><code>0</code></td><td>a <A href="/library/types/enums#button"><code>Button</code></A> id (0 = Left .. 4 = Side2).</td><td>every mouse button.</td></tr>
              <tr><td><code>Key</code></td><td><code>1</code></td><td>a HID keycode (<code>0xE0 .. 0xE7</code> is a modifier).</td><td>every key and modifier.</td></tr>
              <tr><td><code>Media</code></td><td><code>2</code></td><td>a 16-bit Consumer usage.</td><td>every media usage.</td></tr>
              <tr><td><code>Axis</code></td><td><code>3</code></td><td>an <A href="/library/types/enums#axis"><code>Axis</code></A>: X, Y, or the wheel.</td><td>every axis.</td></tr>
              <tr><td><code>HidIn</code></td><td><code>4</code></td><td>an interface number on the real device.</td><td>every HID interface.</td></tr>
              <tr><td><code>HidOut</code></td><td><code>5</code></td><td>an endpoint address.</td><td>every interrupt-OUT endpoint.</td></tr>
              <tr><td><code>VendorInterrupt</code></td><td><code>6</code></td><td>an endpoint address.</td><td>every vendor interrupt endpoint.</td></tr>
              <tr><td><code>VendorBulk</code></td><td><code>7</code></td><td>an endpoint address.</td><td>every vendor bulk endpoint.</td></tr>
              <tr><td><code>Control</code></td><td><code>8</code></td><td>an endpoint number (<code>0</code> = EP0).</td><td>every control endpoint.</td></tr>
              <tr><td><code>Emit</code></td><td><code>9</code></td><td>an endpoint address on the clone.</td><td>every emitting endpoint.</td></tr>
              <tr><td><code>Bus</code></td><td><code>10</code></td><td>unused; a bus event has no id.</td><td>every bus event.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">BLANKETS AND THE WILDCARD</div>
          <p>
            A blanket is one table entry, not an expansion into one per id. The wire sentinels never
            appear in Rust: <code>CatchFilter::watch_class(c)</code> and <code>traffic_class(c)</code>{' '}
            are the per-class blankets, and <code>CatchFilter::everything()</code> is the wildcard
            over all eleven, not a <code>CatchClass</code> variant.
          </p>
          <div class="api-response-label">BEFORE AND AFTER</div>
          <p>
            The input classes are captured at the emission merge point, <em>before</em>{' '}
            <A href="/library/lock#lock">lock</A> suppression and{' '}
            <A href="/library/inject#inject">injection</A>, so a locked input still reports.{' '}
            <code>Emit</code> is the far end of the same path: what the clone actually put on the wire.
          </p>
          <pre class="diagram">{`real device --> [ merge point ] --> locks --> injection --> [ clone emits ] --> game PC
                       |                                           |
          Button / Key / Media / Axis                            Emit`}</pre>
          <p>
            The traffic classes tap the pipes themselves, each on whichever chip owns that pipe.
            That split is what each event's{' '}
            <A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A> records.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Capture, CatchFilter, Direction, TrafficClass};

// The same target, once as a lock and once as a catch.
device.lock(Button::Side1, Direction::Both)?;                    // hide it from the game
let stream = device.catch_events([
    CatchFilter::watch(Button::Side1).on_press(),                // still see the press
])?;

// A byte-oriented class instead: one vendor interrupt endpoint, IN only, 16 bytes a packet.
let trace = device.catch_events([
    CatchFilter::traffic(TrafficClass::VendorInterrupt, 0x83)
        .inbound()
        .with_capture(Capture::First(16)),
])?;`}</code></pre>
        </Card>
      </div>

      <div id="traffic-class" data-search-target>
        <Card>
          <CardHeader title="TrafficClass" subtitle="The byte-oriented half of the address space" />
          <pre class="api-signature">enum TrafficClass {'{'} HidIn, HidOut, VendorInterrupt, VendorBulk, Control, Emit, Bus {'}'}</pre>
          <p>
            The seven classes that carry packets, at the same byte values as their{' '}
            <A href="/library/types/enums#catch-class"><code>CatchClass</code></A> counterparts. A
            separate enum so <code>CatchFilter::traffic</code> cannot be handed an input class.{' '}
            <code>TrafficClass::ALL</code> lists them; <code>From</code> and <code>TryFrom</code>{' '}
            convert both ways.
          </p>
        </Card>
      </div>

      <div id="capture" data-search-target>
        <Card>
          <CardHeader title="Capture" subtitle="How much of each packet to keep" />
          <pre class="api-signature">enum Capture {'{'} Whole, First(u8) {'}'}</pre>
          <p>
            Traffic classes only. An input class carries no packet, so naming one together with a
            capture is refused rather than ignored.
          </p>
          <p>
            A ceiling request, not a guarantee: the box holds one entry per address and cuts once, so
            another subscriber naming the same address more widely raises yours too.{' '}
            <code>First(0)</code> is <code>Whole</code>; <code>bytes()</code> returns{' '}
            <code>Option&lt;u8&gt;</code> and <code>widest()</code> resolves two.
          </p>
        </Card>
      </div>

      <div id="input" data-search-target>
        <Card>
          <CardHeader title="Input" subtitle="One decoded input edge" />
          <pre class="api-signature">enum Input {'{'} Press(Usage), Release(Usage), Motion {'{'} dx: i16, dy: i16, dz: i16 {'}'} {'}'}</pre>
          <p>
            What <A href="/library/catch#input-events"><code>input_events</code></A> yields, wrapped in
            an <A href="/library/types/structs#input-event"><code>InputEvent</code></A> with its
            timestamp. <code>usage()</code>, <code>is_press()</code>, <code>is_release()</code>,{' '}
            <code>direction()</code> and <code>axes()</code> read it without a match.
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
            <A href="/library/types/enums#button"><code>Button</code></A>,{' '}
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

let from_button: Usage = Button::Left.into();      // Class::Button, id 0
let from_key: Usage = Key::A.into();               // Class::Key, id 0x04
let by_hand = Usage::new(Class::Media, 0x00E9);    // volume up
device.press(from_button)?;                         // press takes any impl Into<Usage>`}</code></pre>
        </Card>
      </div>
      <div id="motion" data-search-target>
        <Card>
          <CardHeader title="Motion" subtitle="A relative axis for move_axis" />
          <pre class="api-signature">enum Motion {'{'} Cursor {'{'} dx: i16, dy: i16 {'}'}, Wheel(i16) {'}'}</pre>
          <p>
            What <A href="/library/move#move"><code>move_axis</code></A> drives. Both span the full{' '}
            <code>i16</code> range. A lock names a single{' '}
            <A href="/library/types/enums#axis"><code>Axis</code></A> instead.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Cursor</code></td><td><code>{'{'} dx: i16, dy: i16 {'}'}</code></td><td>Relative pointer movement.</td></tr>
              <tr><td><code>Wheel</code></td><td><code>i16</code></td><td>Relative scroll.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="move-timing" data-search-target>
        <Card>
          <CardHeader title="MoveTiming" subtitle="When a delta reaches the game PC" />
          <pre class="api-signature">enum MoveTiming {'{'} Ride, Now {'}'}</pre>
          <p>
            The <A href="/library/move#move"><code>move_axis</code></A> timing argument, against{' '}
            <A href="/library/options#set-movement-riding">movement riding</A>. Defaults to{' '}
            <code>Ride</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Ride</code></td><td><code>0x00</code></td><td>Wait for a real cursor move to carry this delta, as movement riding asks.</td></tr>
              <tr><td><code>Now</code></td><td><code>0x01</code></td><td>Emit on the box's own clock, whatever movement riding is set to.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="pending-motion" data-search-target>
        <Card>
          <CardHeader title="PendingMotion" subtitle="What a move does to held motion" />
          <pre class="api-signature">enum PendingMotion {'{'} Keep, Flush, Discard {'}'}</pre>
          <p>
            The <A href="/library/move#move"><code>move_axis</code></A> pending argument: what happens to
            motion the box is already holding for a real move. Defaults to <code>Keep</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Keep</code></td><td><code>0x00</code></td><td>Leave it held.</td></tr>
              <tr><td><code>Flush</code></td><td><code>0x02</code></td><td>Emit it now, ignoring the ride window (<A href="/library/move#flush-motion"><code>flush_motion</code></A>).</td></tr>
              <tr><td><code>Discard</code></td><td><code>0x04</code></td><td>Drop it (<A href="/library/move#discard-motion"><code>discard_motion</code></A>).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="axis" data-search-target>
        <Card>
          <CardHeader title="Axis" subtitle="A single relative axis" />
          <pre class="api-signature">enum Axis {'{'} X, Y, Wheel {'}'}</pre>
          <p>
            One relative axis. A{' '}
            <A href="/library/lock#lock-axis"><code>lock_axis</code></A> or a{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget::Axis</code></A> names one, with
            the sign given by a <A href="/library/types/enums#direction"><code>Direction</code></A>.
            Convert with <code>as_u16()</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>id</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>X</code></td><td><code>0</code></td><td>The X cursor axis.</td></tr>
              <tr><td><code>Y</code></td><td><code>1</code></td><td>The Y cursor axis.</td></tr>
              <tr><td><code>Wheel</code></td><td><code>2</code></td><td>The wheel.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="reboot-target" data-search-target>
        <Card>
          <CardHeader title="RebootTarget" subtitle="Which chip to restart, and how" />
          <pre class="api-signature">enum RebootTarget {'{'} DeviceDownload, HostDownload, DeviceRun, HostRun {'}'}</pre>
          <p>
            Which chip a <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> restarts, and
            into what mode. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;RebootTarget&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>DeviceDownload</code></td><td><code>0</code></td><td>Device chip into ROM download mode, ready to flash over the serial link.</td></tr>
              <tr><td><code>HostDownload</code></td><td><code>1</code></td><td>Host chip into ROM download mode, ready to flash over its own USB.</td></tr>
              <tr><td><code>DeviceRun</code></td><td><code>2</code></td><td>Restart the device chip and run its firmware.</td></tr>
              <tr><td><code>HostRun</code></td><td><code>3</code></td><td>Restart the host chip and run its firmware.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="emit-pace" data-search-target>
        <Card>
          <CardHeader title="EmitPace" subtitle="What paces injected motion" />
          <pre class="api-signature">enum EmitPace {'{'} Learned, Interval, Fixed(u16) {'}'}</pre>
          <p>
            What sets the emit-rate ceiling for injected motion, passed to{' '}
            <A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A> and returned in{' '}
            <A href="/library/types/structs#emit-pace-status"><code>EmitPaceStatus</code></A>. It raises
            the ceiling only, so idle stays idle.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Learned</code></td><td>Pace to the mouse's learnt native report rate (the default).</td></tr>
              <tr><td><code>Interval</code></td><td>Pace to the cloned mouse's declared poll rate (its <code>bInterval</code>).</td></tr>
              <tr><td><code>Fixed(u16)</code></td><td>Pace to a fixed rate in Hz; snaps to <code>1000/n</code> and caps at 1 kHz.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="led-target" data-search-target>
        <Card>
          <CardHeader title="LedTarget" subtitle="Which chip's status LED to drive" />
          <pre class="api-signature">enum LedTarget {'{'} Device, Host, Both {'}'}</pre>
          <p>
            Which chip's LED a <A href="/native/commands/led"><code>LED</code></A> command drives. The
            discriminant is the wire <code>target</code> byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;LedTarget&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Device</code></td><td><code>0</code></td><td>The device chip's own LED.</td></tr>
              <tr><td><code>Host</code></td><td><code>1</code></td><td>The host chip's LED, relayed over the inter-chip link.</td></tr>
              <tr><td><code>Both</code></td><td><code>2</code></td><td>Both LEDs at once.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="led-mode" data-search-target>
        <Card>
          <CardHeader title="LedMode" subtitle="What to drive the LED to" />
          <pre class="api-signature">enum LedMode {'{'} Auto, Off, Solid, Blink {'}'}</pre>
          <p>
            What a <A href="/native/commands/led"><code>LED</code></A> command drives the LED to;{' '}
            <code>Auto</code> hands it back to the box's status display. The discriminant is the wire{' '}
            <code>mode</code> byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;LedMode&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Auto</code></td><td><code>0</code></td><td>Restore the chip's own status display.</td></tr>
              <tr><td><code>Off</code></td><td><code>1</code></td><td>LED dark.</td></tr>
              <tr><td><code>Solid</code></td><td><code>2</code></td><td>Lit steadily at the command's <code>level</code>.</td></tr>
              <tr><td><code>Blink</code></td><td><code>3</code></td><td>Blinks at the command's <code>level</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="lock-target" data-search-target>
        <Card>
          <CardHeader title="LockTarget" subtitle="What a lock acts on" />
          <pre class="api-signature">enum LockTarget {'{'} Axis(Axis), Usage(Usage) {'}'}</pre>
          <p>
            What a <A href="/native/commands/lock"><code>LOCK</code></A> command blocks. An{' '}
            <code>Axis</code> and any <code>impl Into&lt;Usage&gt;</code> each convert{' '}
            <code>Into&lt;LockTarget&gt;</code>, so you pass one straight to{' '}
            <A href="/library/lock#lock"><code>lock</code></A>. A button locks exactly like a key.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Locked by</th></tr></thead>
            <tbody>
              <tr><td><code>Axis</code></td><td><A href="/library/types/enums#axis"><code>Axis</code></A></td><td>The sign, a <A href="/library/types/enums#direction"><code>Direction</code></A> of positive, negative, or both.</td></tr>
              <tr><td><code>Usage</code></td><td><A href="/library/types/enums#usage"><code>Usage</code></A></td><td>The press or release edge, a <A href="/library/types/enums#direction"><code>Direction</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="lock-scope" data-search-target>
        <Card>
          <CardHeader title="LockScope" subtitle="What a reported lock covers" />
          <pre class="api-signature">enum LockScope {'{'} Target(LockTarget), Blanket(Class) {'}'}</pre>
          <p>
            What a <A href="/library/types/structs#lock-entry"><code>LockEntry</code></A> in a{' '}
            <A href="/library/requests#query-locks"><code>query_locks</code></A> reply covers.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Covers</th></tr></thead>
            <tbody>
              <tr><td><code>Target</code></td><td><A href="/library/types/enums#lock-target"><code>LockTarget</code></A></td><td>A specific axis or usage.</td></tr>
              <tr><td><code>Blanket</code></td><td><A href="/library/types/enums#class"><code>Class</code></A></td><td>Every button, key, or media usage of the class.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="direction" data-search-target>
        <Card>
          <CardHeader title="Direction" subtitle="Which way, which edge, or which transfer direction" />
          <pre class="api-signature">enum Direction {'{'} Both, Positive, Negative, With, Against {'}'}</pre>
          <p>
            The one byte <A href="/native/commands/lock"><code>LOCK</code></A>,{' '}
            <A href="/native/commands/clip"><code>CLIP</code></A> and{' '}
            <A href="/native/commands/catch"><code>CATCH</code></A> all carry. The variants are named
            for the axis reading; which of the three applies is decided by the class, and no class
            carries two. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;Direction&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>On an axis</th><th>On a usage</th><th>On a traffic class</th></tr></thead>
            <tbody>
              <tr><td><code>Both</code></td><td><code>0</code></td><td>every direction</td><td>press and release</td><td>IN and OUT</td></tr>
              <tr><td><code>Positive</code></td><td><code>1</code></td><td><code>+</code></td><td>press</td><td>IN: device to PC</td></tr>
              <tr><td><code>Negative</code></td><td><code>2</code></td><td><code>-</code></td><td>release</td><td>OUT: PC to device</td></tr>
              <tr><td><code>With</code></td><td><code>3</code></td><td>the sign the box is injecting</td><td>no meaning</td><td>no meaning</td></tr>
              <tr><td><code>Against</code></td><td><code>4</code></td><td>the sign opposing it</td><td>no meaning</td><td>no meaning</td></tr>
            </tbody>
          </table>
          <p>
            <code>With</code> and <code>Against</code> are measured against the bearing rather than a
            fixed sign, so they follow the aim; <code>is_relative()</code> tells them apart, and a{' '}
            <A href="/library/catch#catch-events">catch subscription</A> refuses one with{' '}
            <A href="/library/types/errors#errors"><code>Error::RelativeDirection</code></A>. See{' '}
            <A href="/library/options#set-bearing"><code>set_bearing</code></A>.
          </p>
          <p>
            The other two readings get their own names:{' '}
            <code>Direction::PRESS</code> and <code>RELEASE</code> for a usage,{' '}
            <code>Direction::IN</code> and <code>OUT</code> for traffic.{' '}
            <code>admits()</code> tests one against another, and <code>of_delta()</code> reads the
            sign of a movement.
          </p>
        </Card>
      </div>
      <div id="blanket" data-search-target>
        <Card>
          <CardHeader title="Blanket" subtitle="A whole-group lock selector" />
          <pre class="api-signature">enum Blanket {'{'} Aim, Wheel, Buttons, Keys, Media {'}'}</pre>
          <p>
            A whole input group: which one <A href="/library/lock#lock-all"><code>scale_all</code></A> /{' '}
            <A href="/library/lock#lock-all"><code>lock_all</code></A> weigh in one call, and the members of a
            clip's <A href="/library/types/structs#clip-settings"><code>ClipSettings</code></A> auto-lock.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Aim</code></td><td>The X and Y cursor axes.</td></tr>
              <tr><td><code>Wheel</code></td><td>The wheel.</td></tr>
              <tr><td><code>Buttons</code></td><td>Every mouse button.</td></tr>
              <tr><td><code>Keys</code></td><td>Every keyboard key and modifier.</td></tr>
              <tr><td><code>Media</code></td><td>Every media (Consumer) usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="log-level" data-search-target>
        <Card>
          <CardHeader title="LogLevel" subtitle="Severity tag on a log line" />
          <pre class="api-signature">enum LogLevel {'{'} Error, Warn, Info, Debug, Verbose {'}'}</pre>
          <p>
            The severity tag on a <A href="/library/types/structs#log-line"><code>LogLine</code></A>.{' '}
            <code>from_u8(u8)</code> is infallible: an unknown byte falls back to <code>Info</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Error</code></td><td><code>0</code></td><td>A failure the box could not recover from.</td></tr>
              <tr><td><code>Warn</code></td><td><code>1</code></td><td>Something off that the box handled.</td></tr>
              <tr><td><code>Info</code></td><td><code>2</code></td><td>Normal operational notices.</td></tr>
              <tr><td><code>Debug</code></td><td><code>3</code></td><td>Detail for diagnosing a problem.</td></tr>
              <tr><td><code>Verbose</code></td><td><code>4</code></td><td>The finest-grained trace output.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="catch-event" data-search-target>
        <Card>
          <CardHeader title="CatchEvent" subtitle="One caught event off the stream" />
          <pre class="api-signature">enum CatchEvent {'{'} Motion(MotionEvent), Usages(UsageSnapshot), Traffic(TrafficEvent) {'}'}</pre>
          <p>
            What an <A href="/library/catch#event-stream"><code>EventStream</code></A> yields, one
            variant per event frame the box pushes.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Raised by</th></tr></thead>
            <tbody>
              <tr><td><code>Motion</code></td><td><A href="/library/types/structs#motion-event"><code>MotionEvent</code></A></td><td>A cursor or wheel change, from a <A href="/library/types/enums#catch-class"><code>CatchClass::Axis</code></A> filter.</td></tr>
              <tr><td><code>Usages</code></td><td><A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A></td><td>A button, key, or media change, from a <code>Button / Key / Media</code> filter.</td></tr>
              <tr><td><code>Traffic</code></td><td><A href="/library/types/structs#traffic-event"><code>TrafficEvent</code></A></td><td>Bytes off a pipe, from any <A href="/library/types/enums#traffic-class"><code>TrafficClass</code></A> filter.</td></tr>
            </tbody>
          </table>
          <p>
            All three carry <code>ts_us</code> and a{' '}
            <A href="/library/types/enums#clock-domain"><code>ClockDomain</code></A>: a stamp compares
            only to another from the same domain, until you apply the{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A>.
          </p>
          <p>
            One rolling <code>seq</code> counter covers all three frame types. It counts what the box{' '}
            <em>sent</em>, not what it saw, so a gap is not how you detect loss.{' '}
            <A href="/library/types/structs#catch-state"><code>CatchState</code></A> is.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{CatchEvent, CatchFilter};

let stream = device.catch_events([CatchFilter::everything()])?;
match stream.recv()? {
    CatchEvent::Motion(m)  => println!("{} {} {}", m.dx, m.dy, m.dz),
    CatchEvent::Usages(s)  => println!("{} held", s.usages.len()),
    CatchEvent::Traffic(t) => println!("{:?} 0x{:04X}: {} bytes", t.class, t.id, t.true_len),
}`}</code></pre>
        </Card>
      </div>

      <div id="clock-domain" data-search-target>
        <Card>
          <CardHeader title="ClockDomain" subtitle="Which chip stamped the event" />
          <pre class="api-signature">enum ClockDomain {'{'} HostChip, DeviceChip {'}'}</pre>
          <p>
            The <code>clock</code> field beside every event's <code>ts_us</code>. The box runs two
            microsecond timers and nothing relates them; stamping happens on whichever chip saw the
            event. Convert with{' '}
            <code>as_u8()</code> and <code>from_u8(u8) -&gt; Option&lt;ClockDomain&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Stamped</th></tr></thead>
            <tbody>
              <tr><td><code>HostChip</code></td><td><code>0</code></td><td>On the host chip, in USB interrupt context, when the real device's transfer completed.</td></tr>
              <tr><td><code>DeviceChip</code></td><td><code>1</code></td><td>On the device chip, at the tap, when the clone's own traffic passed it.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHICH CLASS LANDS WHERE</div>
          <table class="api-params">
            <thead><tr><th>Domain</th><th>Classes stamped there</th></tr></thead>
            <tbody>
              <tr><td><code>HostChip</code></td><td>the input classes (raising <code>Motion</code> and <code>Usages</code>), <code>HidIn</code>, and the IN direction of the vendor classes.</td></tr>
              <tr><td><code>DeviceChip</code></td><td><code>HidOut</code>, the OUT direction of both vendor classes, and <code>Control / Emit / Bus</code>.</td></tr>
            </tbody>
          </table>
          <p>
            Both timers are box-local, unrelated to any clock on this machine. They wrap every ~71.6
            minutes (a <code>u32</code> of microseconds) and restart at zero when their chip reboots.
          </p>
          <p>
            A stamp below the one before it is a wrap, a reboot, or a domain change, and only the
            third is visible in the value itself. To put both domains on one timeline, apply the{' '}
            <A href="/library/types/structs#clock-estimate"><code>ClockEstimate</code></A> from{' '}
            <A href="/library/requests#query-catch"><code>query_catch</code></A>.
          </p>
        </Card>
      </div>

      <div id="control-status" data-search-target>
        <Card>
          <CardHeader title="ControlStatus" subtitle="What the device answered a proxied control transfer with" />
          <pre class="api-signature">enum ControlStatus {'{'} Ok, Stalled, Naked, Other(u8) {'}'}</pre>
          <p>
            Read it with <code>TrafficEvent::control_status()</code>, which returns{' '}
            <code>None</code> for any class other than{' '}
            <A href="/library/types/enums#catch-class"><code>Control</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>flags</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Ok</code></td><td><code>0x00</code></td><td>The device answered.</td></tr>
              <tr><td><code>Stalled</code></td><td><code>0xFD</code></td><td>The device STALLed the request.</td></tr>
              <tr><td><code>Naked</code></td><td><code>0xFE</code></td><td>The device NAKed to timeout, or never answered.</td></tr>
              <tr><td><code>Other(u8)</code></td><td>anything else</td><td>A status this build does not know, carried verbatim.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="bus-event" data-search-target>
        <Card>
          <CardHeader title="BusEvent" subtitle="What happened on the USB bus" />
          <pre class="api-signature">{`enum BusEvent { Reset, Suspend, Resume, Configured(u8), Deconfigured,
                SetInterface { interface: u8, alt: u8 },
                DeviceAttached, DeviceDetached, CloneUp, CloneDown }`}</pre>
          <p>
            The kind of a <A href="/library/types/enums#catch-class"><code>CatchClass::Bus</code></A>{' '}
            event. Read it with <code>TrafficEvent::bus_event()</code>, which returns{' '}
            <code>Option&lt;BusEvent&gt;</code>, which is <code>None</code> for a kind this build does not
            know. The two kinds that carry operands parse them into their own fields.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>bytes</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Reset</code></td><td><code>0</code></td><td>-</td><td>The game PC reset the clone's bus.</td></tr>
              <tr><td><code>Suspend</code></td><td><code>1</code></td><td>-</td><td>The bus went idle and the PC suspended the clone.</td></tr>
              <tr><td><code>Resume</code></td><td><code>2</code></td><td>-</td><td>The bus came back.</td></tr>
              <tr><td><code>Configured</code></td><td><code>3</code></td><td><code>a</code> = configuration index</td><td>The PC selected a configuration; the clone is live.</td></tr>
              <tr><td><code>Deconfigured</code></td><td><code>4</code></td><td>-</td><td>The PC dropped the clone back to configuration 0.</td></tr>
              <tr><td><code>SetInterface</code></td><td><code>5</code></td><td><code>a</code> = interface, <code>b</code> = alternate setting</td><td>The PC switched an interface's alternate setting.</td></tr>
              <tr><td><code>DeviceAttached</code></td><td><code>6</code></td><td>-</td><td>The real device appeared on the host chip.</td></tr>
              <tr><td><code>DeviceDetached</code></td><td><code>7</code></td><td>-</td><td>The real device went away.</td></tr>
              <tr><td><code>CloneUp</code></td><td><code>8</code></td><td>-</td><td>The box started presenting the clone to the game PC.</td></tr>
              <tr><td><code>CloneDown</code></td><td><code>9</code></td><td>-</td><td>The box stopped presenting it.</td></tr>
            </tbody>
          </table>
          <p>
            <code>DeviceAttached</code> and <code>DeviceDetached</code> are the real device on USB3;
            the other eight are the clone's own life on USB1, which the control PC cannot see.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{BusEvent, CatchEvent, CatchFilter, TrafficClass};

let stream = device.catch_events([CatchFilter::traffic_class(TrafficClass::Bus)])?;
if let CatchEvent::Traffic(t) = stream.recv()? {
    match t.bus_event() {
        Some(BusEvent::Configured(n))              => println!("configuration {n}"),
        Some(BusEvent::SetInterface { interface, alt }) => println!("iface {interface} alt {alt}"),
        Some(kind)                                 => println!("{kind:?}"),
        None                                       => {}
    }
}`}</code></pre>
        </Card>
      </div>

      <div id="clip-state" data-search-target>
        <Card>
          <CardHeader title="ClipState" subtitle="The buffered-clip lifecycle state" />
          <pre class="api-signature">enum ClipState {'{'} Idle, Playing, Paused, Faulted {'}'}</pre>
          <p>
            The device-side clip state on{' '}
            <A href="/library/types/structs#clip-status"><code>ClipStatus::state</code></A>, from{' '}
            <A href="/library/requests#clip-status"><code>ClipHandle::query_status()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Idle</code></td><td><code>0</code></td><td>No clip playing (empty, or a loaded clip parked at its start).</td></tr>
              <tr><td><code>Playing</code></td><td><code>1</code></td><td>Draining the ring, one entry per native frame.</td></tr>
              <tr><td><code>Paused</code></td><td><code>2</code></td><td>Held mid-clip, keeping the cursor and any held input; resumes from the same spot.</td></tr>
              <tr><td><code>Faulted</code></td><td><code>3</code></td><td>An append was dropped or the ring overflowed; recover with <code>clear</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="edge" data-search-target>
        <Card>
          <CardHeader title="Edge" subtitle="Which edge fires a clip trigger" />
          <pre class="api-signature">enum Edge {'{'} Both, Press, Release {'}'}</pre>
          <p>
            Which edge of a bound usage fires a{' '}
            <A href="/library/types/structs#clip-trigger"><code>ClipTrigger</code></A>: its press, its
            release, or either. It shares wire values with{' '}
            <A href="/library/types/enums#direction"><code>Direction</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Both</code></td><td><code>0</code></td><td>Fire on either edge.</td></tr>
              <tr><td><code>Press</code></td><td><code>1</code></td><td>Fire on the press edge.</td></tr>
              <tr><td><code>Release</code></td><td><code>2</code></td><td>Fire on the release edge.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="clip-action" data-search-target>
        <Card>
          <CardHeader title="ClipAction" subtitle="What a fired clip trigger does" />
          <pre class="api-signature">enum ClipAction {'{'} Start, Stop, Pause, Resume, Restart, Toggle {'}'}</pre>
          <p>
            What a bound{' '}
            <A href="/library/types/structs#clip-trigger"><code>ClipTrigger</code></A> does to the clip
            when its edge fires. The discriminant doubles as the{' '}
            <A href="/native/commands/clip#ctrl"><code>CLIP_CTRL</code></A> op byte for the same
            action.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Start</code></td><td><code>0</code></td><td>Start playback from the ring's head.</td></tr>
              <tr><td><code>Stop</code></td><td><code>1</code></td><td>Stop playback and rewind to the head.</td></tr>
              <tr><td><code>Pause</code></td><td><code>2</code></td><td>Hold playback mid-clip.</td></tr>
              <tr><td><code>Resume</code></td><td><code>3</code></td><td>Continue a paused clip from where it stopped.</td></tr>
              <tr><td><code>Restart</code></td><td><code>4</code></td><td>Rewind to the head and play from the start.</td></tr>
              <tr><td><code>Toggle</code></td><td><code>5</code></td><td>Start if idle, stop if playing.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Enums;
