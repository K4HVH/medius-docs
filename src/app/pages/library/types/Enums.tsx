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
            The button an <A href="/native/commands/inject#button"><code>INJECT</code></A> command acts
            on, and the payload of <A href="/library/types/enums#input"><code>Input::Button</code></A>.
            Convert with <code>as_id() -&gt; u8</code> and{' '}
            <code>from_id(u8) -&gt; Option&lt;Button&gt;</code>.
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
            <A href="/library/inject#inject"><code>inject</code></A> call, whether a{' '}
            <A href="/library/inject#button"><code>button</code></A>,{' '}
            <A href="/library/inject#key"><code>key</code></A>, or{' '}
            <A href="/library/inject#media"><code>media</code></A>. The discriminant is the wire byte.
            Convert with <code>as_u8()</code> and{' '}
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
      <div id="input" data-search-target>
        <Card>
          <CardHeader title="Input" subtitle="A momentary usage for inject" />
          <pre class="api-signature">enum Input {'{'} Button(Button), Key(Key), Media(MediaKey) {'}'}</pre>
          <p>
            What <A href="/library/inject#inject"><code>inject</code></A> drives: a mouse{' '}
            <A href="/library/types/enums#button"><code>Button</code></A>, a keyboard{' '}
            <A href="/library/types/structs#key"><code>Key</code></A>, or a{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A>. Each has a{' '}
            <code>From</code> impl, so you pass one directly wherever an{' '}
            <code>impl Into&lt;Input&gt;</code> is wanted.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Class</th></tr></thead>
            <tbody>
              <tr><td><code>Button</code></td><td><A href="/library/types/enums#button"><code>Button</code></A></td><td>Mouse button.</td></tr>
              <tr><td><code>Key</code></td><td><A href="/library/types/structs#key"><code>Key</code></A></td><td>Keyboard key or modifier.</td></tr>
              <tr><td><code>Media</code></td><td><A href="/library/types/structs#media-key"><code>MediaKey</code></A></td><td>Consumer media usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="motion" data-search-target>
        <Card>
          <CardHeader title="Motion" subtitle="A relative axis for move_axis" />
          <pre class="api-signature">enum Motion {'{'} Cursor {'{'} dx: i16, dy: i16 {'}'}, Wheel(i16) {'}'}</pre>
          <p>
            What <A href="/library/move#move"><code>move_axis</code></A> drives: the cursor (carrying{' '}
            <code>dx</code> and <code>dy</code>) or the wheel (a single delta). Both span the full{' '}
            <code>i16</code> range.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Axis</th></tr></thead>
            <tbody>
              <tr><td><code>Cursor</code></td><td><code>{'{'} dx: i16, dy: i16 {'}'}</code></td><td>Relative pointer movement.</td></tr>
              <tr><td><code>Wheel</code></td><td><code>i16</code></td><td>Relative scroll.</td></tr>
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
          <CardHeader title="LockTarget" subtitle="Which input a lock acts on" />
          <pre class="api-signature">enum LockTarget {'{'} X, Y, Wheel, Button(Button) {'}'}</pre>
          <p>
            Which physical input a <A href="/native/commands/lock"><code>LOCK</code></A> command
            blocks. A button variant carries a{' '}
            <A href="/library/types/enums#button"><code>Button</code></A>, so the eight wire targets
            are <code>X</code>, <code>Y</code>, <code>Wheel</code>, then one per button. Convert with{' '}
            <code>as_u8()</code> and <code>from_u8(u8) -&gt; Option&lt;LockTarget&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>X</code></td><td><code>0</code></td><td>Horizontal movement.</td></tr>
              <tr><td><code>Y</code></td><td><code>1</code></td><td>Vertical movement.</td></tr>
              <tr><td><code>Wheel</code></td><td><code>2</code></td><td>Scroll wheel.</td></tr>
              <tr><td><code>Button(Left)</code></td><td><code>3</code></td><td>Left button.</td></tr>
              <tr><td><code>Button(Right)</code></td><td><code>4</code></td><td>Right button.</td></tr>
              <tr><td><code>Button(Middle)</code></td><td><code>5</code></td><td>Middle button.</td></tr>
              <tr><td><code>Button(Side1)</code></td><td><code>6</code></td><td>First thumb button.</td></tr>
              <tr><td><code>Button(Side2)</code></td><td><code>7</code></td><td>Second thumb button.</td></tr>
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
            an axis or the wheel it's a sign; for a button it's an edge. The discriminant is the wire{' '}
            <code>direction</code> byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;LockDirection&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Both</code></td><td><code>0</code></td><td>Both signs, or press and release.</td></tr>
              <tr><td><code>Positive</code></td><td><code>1</code></td><td>Axis positive (<code>+</code>), or button press.</td></tr>
              <tr><td><code>Negative</code></td><td><code>2</code></td><td>Axis negative (<code>−</code>), or button release.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <div id="lock-class" data-search-target>
        <Card>
          <CardHeader title="LockClass" subtitle="Which class a lock addresses" />
          <pre class="api-signature">enum LockClass {'{'} Mouse, Key, Media, AllKeys, AllMedia, AllButtons {'}'}</pre>
          <p>
            The input class a <A href="/native/commands/lock#lock"><code>LOCK</code></A> targets on the
            wire. The library picks it for you: <A href="/library/lock#lock"><code>lock</code></A> uses{' '}
            <code>Mouse</code>, <A href="/library/lock#lock-key"><code>lock_key</code></A> uses{' '}
            <code>Key</code>, and <A href="/library/lock#lock-all"><code>lock_all</code></A> uses the
            blanket classes. The discriminant is the wire <code>class</code> byte.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Mouse</code></td><td><code>0</code></td><td>A mouse axis, wheel, or button.</td></tr>
              <tr><td><code>Key</code></td><td><code>1</code></td><td>One keyboard key.</td></tr>
              <tr><td><code>Media</code></td><td><code>2</code></td><td>One media usage.</td></tr>
              <tr><td><code>AllKeys</code></td><td><code>3</code></td><td>Every key (blanket).</td></tr>
              <tr><td><code>AllMedia</code></td><td><code>4</code></td><td>Every media usage (blanket).</td></tr>
              <tr><td><code>AllButtons</code></td><td><code>5</code></td><td>Every mouse button (blanket).</td></tr>
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
            clip's <A href="/library/types/structs#clip-config"><code>ClipConfig</code></A> auto-lock.
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
          <CardHeader title="CatchEvent" subtitle="One physical-input snapshot off the stream" />
          <pre class="api-signature">enum CatchEvent {'{'} Mouse(MouseEvent), Keyboard(KeyboardEvent), Media(MediaEvent) {'}'}</pre>
          <p>
            What an <A href="/library/catch#event-stream"><code>EventStream</code></A> yields. Each
            variant carries the full snapshot for its class, captured before lock suppression or
            injection. Match on the variant to handle mouse, keyboard, and media input.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Payload</th><th>Raised by</th></tr></thead>
            <tbody>
              <tr><td><code>Mouse</code></td><td><A href="/library/types/structs#mouse-event"><code>MouseEvent</code></A></td><td>A motion, wheel, or button change.</td></tr>
              <tr><td><code>Keyboard</code></td><td><A href="/library/types/structs#keyboard-event"><code>KeyboardEvent</code></A></td><td>A key change (the <code>KEYS</code> class).</td></tr>
              <tr><td><code>Media</code></td><td><A href="/library/types/structs#media-event"><code>MediaEvent</code></A></td><td>A media-key change (the <code>KEYS</code> class).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="clip-state" data-search-target>
        <Card>
          <CardHeader title="ClipState" subtitle="The buffered-clip lifecycle state" />
          <pre class="api-signature">enum ClipState {'{'} Idle, Armed, Playing, Faulted {'}'}</pre>
          <p>
            The device-side clip state on{' '}
            <A href="/library/types/structs#clip-status"><code>ClipStatus::state</code></A>, from{' '}
            <A href="/library/clip#status"><code>ClipHandle::status()</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>Idle</code></td><td>No clip active.</td></tr>
              <tr><td><code>Armed</code></td><td>A catch-trigger is armed; playback starts on the physical button edge.</td></tr>
              <tr><td><code>Playing</code></td><td>Draining the ring, one entry per native frame.</td></tr>
              <tr><td><code>Faulted</code></td><td>An append was dropped or the ring overflowed; stop and re-preload.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Enums;
