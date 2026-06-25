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
      <div id="button" data-search-target>
        <Card>
          <CardHeader title="Button" subtitle="The button a command acts on" />
          <pre class="api-signature">enum Button {'{'} Left, Right, Middle, Side1, Side2 {'}'}</pre>
          <p>
            The button a <A href="/native/commands/buttons"><code>BUTTON</code></A> command acts on.
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
            The shared override action for a{' '}
            <A href="/library/buttons#methods"><code>button</code></A>,{' '}
            <A href="/library/keyboard#key"><code>key</code></A>, or{' '}
            <A href="/library/keyboard#media"><code>media</code></A> call. The discriminant is the wire
            byte. Convert with <code>as_u8()</code> and{' '}
            <code>from_u8(u8) -&gt; Option&lt;Action&gt;</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Byte</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>SoftRelease</code></td><td><code>0</code></td><td>Clear the box's own press; a physical hold stays down.</td></tr>
              <tr><td><code>Press</code></td><td><code>1</code></td><td>Force the input down.</td></tr>
              <tr><td><code>ForceRelease</code></td><td><code>2</code></td><td>Force the input up, masking a physical hold.</td></tr>
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
      <div id="log-level" data-search-target>
        <Card>
          <CardHeader title="LogLevel" subtitle="Severity tag on a log line" />
          <pre class="api-signature">enum LogLevel {'{'} Error, Warn, Info, Debug, Verbose {'}'}</pre>
          <p>
            The severity tag on a <A href="/library/types/structs#logstream"><code>LogLine</code></A>.{' '}
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
    </>
  );
};

export default Enums;
