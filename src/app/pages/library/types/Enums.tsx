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
      <div id="usage" data-search-target>
        <Card>
          <CardHeader title="Usage" subtitle="A momentary input: (class, id)" />
          <pre class="api-signature">struct Usage {'{'} class: Class, id: u16 {'}'}</pre>
          <p>
            What <A href="/library/inject#inject"><code>inject</code></A> drives and{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A> locks: a mouse button,
            a keyboard key, or a media usage in one shape. A{' '}
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
            What <A href="/library/move#move"><code>move_axis</code></A> drives: the cursor (carrying{' '}
            <code>dx</code> and <code>dy</code>) or the wheel (a single delta). Both span the full{' '}
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
      <div id="axis" data-search-target>
        <Card>
          <CardHeader title="Axis" subtitle="A single relative axis" />
          <pre class="api-signature">enum Axis {'{'} X, Y, Wheel {'}'}</pre>
          <p>
            One relative axis, the input kind that is genuinely mouse-hardware-specific. A{' '}
            <A href="/library/lock#lock-axis"><code>lock_axis</code></A> or a{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget::Axis</code></A> names one, with
            the sign given by a <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A>.
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
            What a <A href="/native/commands/lock"><code>LOCK</code></A> command blocks: a relative{' '}
            <A href="/library/types/enums#axis"><code>Axis</code></A> or a momentary{' '}
            <A href="/library/types/enums#usage"><code>Usage</code></A> (a button, key, or media usage). An{' '}
            <code>Axis</code> and any <code>impl Into&lt;Usage&gt;</code> each convert{' '}
            <code>Into&lt;LockTarget&gt;</code>, so you pass one straight to{' '}
            <A href="/library/lock#lock"><code>lock</code></A>. A button locks exactly like a key.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Locked by</th></tr></thead>
            <tbody>
              <tr><td><code>Axis</code></td><td><A href="/library/types/enums#axis"><code>Axis</code></A></td><td>The sign, a <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A> of positive, negative, or both.</td></tr>
              <tr><td><code>Usage</code></td><td><A href="/library/types/enums#usage"><code>Usage</code></A></td><td>The press or release edge, a <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A>.</td></tr>
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
            <A href="/library/requests#query-locks"><code>query_locks</code></A> reply covers: one specific{' '}
            <A href="/library/types/enums#lock-target"><code>LockTarget</code></A>, or a whole-class blanket
            that locks every usage of a <A href="/library/types/enums#class"><code>Class</code></A> at once.
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
      <div id="lock-direction" data-search-target>
        <Card>
          <CardHeader title="LockDirection" subtitle="Which way or which edge to block" />
          <pre class="api-signature">enum LockDirection {'{'} Both, Positive, Negative {'}'}</pre>
          <p>
            Which side of an input a <A href="/native/commands/lock"><code>LOCK</code></A> blocks. For
            an axis or the wheel it's a sign; for a usage (button, key, or media) it's an edge. The discriminant is the wire{' '}
            <code>direction</code> byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;LockDirection&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Both</code></td><td><code>0</code></td><td>Both signs, or press and release.</td></tr>
              <tr><td><code>Positive</code></td><td><code>1</code></td><td>Axis positive (<code>+</code>), or usage press.</td></tr>
              <tr><td><code>Negative</code></td><td><code>2</code></td><td>Axis negative (<code>-</code>), or usage release.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="blanket" data-search-target>
        <Card>
          <CardHeader title="Blanket" subtitle="A whole-group lock selector" />
          <pre class="api-signature">enum Blanket {'{'} Aim, Wheel, Buttons, Keys, Media {'}'}</pre>
          <p>
            A whole input group: which one <A href="/library/lock#lock-all"><code>lock_all</code></A> /{' '}
            <A href="/library/lock#lock-all"><code>unlock_all</code></A> block in one call, and the members of a
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
          <CardHeader title="CatchEvent" subtitle="One physical-input event off the stream" />
          <pre class="api-signature">enum CatchEvent {'{'} Motion(MotionEvent), Usages(UsageSnapshot) {'}'}</pre>
          <p>
            What an <A href="/library/catch#event-stream"><code>EventStream</code></A> yields, captured
            before lock suppression or injection. A relative axis is <code>Motion</code>; a held-usage
            snapshot (buttons, keys, or media, all one shape) is <code>Usages</code>. Match on the
            variant.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Raised by</th></tr></thead>
            <tbody>
              <tr><td><code>Motion</code></td><td><A href="/library/types/structs#motion-event"><code>MotionEvent</code></A></td><td>A cursor or wheel change (the <code>MOTION</code> / <code>WHEEL</code> classes).</td></tr>
              <tr><td><code>Usages</code></td><td><A href="/library/types/structs#usage-snapshot"><code>UsageSnapshot</code></A></td><td>A button, key, or media change (the <code>BUTTONS</code> / <code>KEYS</code> / <code>MEDIA</code> classes).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-state" data-search-target>
        <Card>
          <CardHeader title="ClipState" subtitle="The buffered-clip lifecycle state" />
          <pre class="api-signature">enum ClipState {'{'} Idle, Playing, Paused, Faulted {'}'}</pre>
          <p>
            The device-side clip state on{' '}
            <A href="/library/types/structs#clip-status"><code>ClipStatus::state</code></A>, from{' '}
            <A href="/library/clip#status"><code>ClipHandle::query_status()</code></A>.
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
            <A href="/library/types/enums#lock-direction"><code>LockDirection</code></A>.
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
