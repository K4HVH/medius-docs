import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Option: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Option" subtitle="Set a persistent box option by id" />
        <p>
          One command (opcode <code>0x11</code>) sets every box-level toggle: an <code>id</code> byte
          picks the option, the rest is its value. All persist in NVS, restore at boot, and are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>. An unknown id is ignored.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Option</th><th><code>id</code></th><th>Does</th><th>Factory default</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A></td>
                <td><code>0</code></td>
                <td>Clone an over-capacity device anyway</td>
                <td>off</td>
              </tr>
              <tr>
                <td><A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A></td>
                <td><code>1</code></td>
                <td>Inject motion only on a real move</td>
                <td>off</td>
              </tr>
              <tr>
                <td><A href="/native/commands/option#emit"><code>EMIT</code></A></td>
                <td><code>2</code></td>
                <td>Pace and wire-rate injected motion</td>
                <td>learnt, no forced rate</td>
              </tr>
              <tr>
                <td><A href="/native/commands/option#name"><code>NAME</code></A></td>
                <td><code>3</code></td>
                <td>Give the box a human-readable name</td>
                <td>Medius-XXXX</td>
              </tr>
              <tr>
                <td><A href="/native/commands/option#bearing"><code>BEARING</code></A></td>
                <td><code>4</code></td>
                <td>What with and against are measured against</td>
                <td>20 ms, per axis</td>
              </tr>
              <tr>
                <td><A href="/native/commands/option#render"><code>RENDER</code></A></td>
                <td><code>5</code></td>
                <td>The texture the box renders motion with</td>
                <td>de-spiked, injected only</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          A box that has been set boots at its own stored value, not the factory one.
        </p>
      </Card>

      <div id="option" data-search-target>
        <Card>
          <CardHeader title="OPTION" subtitle="One generic, persistent option" />
          <p>
            <code>OPTION</code> carries an <code>id</code> byte then an id-specific value, and the box
            persists the setting across a reboot. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x11</code>.
          </p>
          <pre class="api-signature">OPTION  0x11  ·  payload 1 + value bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>id</code></td><td><code>u8</code></td><td>which option</td></tr>
              <tr><td>1..</td><td><code>value</code></td><td><code>varies</code></td><td>id-specific; the frame <code>LEN</code> delimits it, so a new option needs no new opcode</td></tr>
            </tbody>
          </table>
          <p>
            No reply. Read any value back with{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, id)</code></A>.
          </p>
        </Card>
      </div>

      <div id="imperfect" data-search-target>
        <Card>
          <CardHeader title="IMPERFECT" subtitle="Clone an over-capacity device anyway" />
          <pre class="api-signature">id 0  ·  [allow u8]</pre>
          <div class="api-response-label">ALLOW</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Faithful-only: refuse a device the box can't clone exactly <em>(default)</em></td></tr>
              <tr><td><code>1</code></td><td>Clone it anyway: every other interface byte-faithful, the over-capacity one dead</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Some devices need more interrupt-IN endpoints than the box serves (the Wooting Two HE's
              analog stream needs a sixth, past the{' '}
              <a href="https://www.espressif.com/en/products/socs" target="_blank" rel="noreferrer">ESP32</a>-S3's
              five). Changing this for an{' '}
              <em>attached</em> over-capacity device reboots the box to re-clone; a normal device is
              unaffected.
            </p>
          </div>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 0)</code></A> (opt-in plus
            the over-capacity and imperfect-clone flags) · Library{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Opt in (<code>allow = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 02 00  | 00     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | allow  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="move-ride" data-search-target>
        <Card>
          <CardHeader title="MOVE_RIDE" subtitle="Inject motion only on a real move" />
          <pre class="api-signature">id 1  ·  [timeout u16 LE] ms</pre>
          <div class="api-response-label">TIMEOUT</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Off: injection emits via the frame clock <em>(default)</em></td></tr>
              <tr><td><code>N</code> ms</td><td>Injected cursor and wheel motion only rides a native move seen within <code>N</code> ms; no synthetic motion frame, and motion left unridden is dropped (never dumped on the next move)</td></tr>
            </tbody>
          </table>
          <p>
            This keeps injected motion's report density identical to the real mouse's.
          </p>
          <div class="callout callout--warning">
            <p>
              While on, pure idle injection (moving the cursor while the real device is still) stops
              working: motion waits for a native move and is dropped if none comes.
            </p>
            <p>
              Button, key, and media injection are unaffected, and a move can opt out per command
              with the <A href="/native/commands/move#flags"><code>MOVE</code> flags</A>.
            </p>
            <p>
              Changing the value drops whatever motion was held for a ride, and clears the standing{' '}
              <A href="/native/commands/lock#bearing">bearing</A> with it, so every{' '}
              <code>with</code> / <code>against</code> scale stops applying at that instant.
            </p>
          </div>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 1)</code></A> · Library{' '}
            <A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Turn it on with a 20 ms window (<code>timeout = 0x0014</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 03 00  | 01     | 14 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | timeout| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="emit" data-search-target>
        <Card>
          <CardHeader title="EMIT" subtitle="Pace and wire-rate injected motion" />
          <pre class="api-signature">id 2  ·  [mode u8][rate_hz u16 LE][force_hz u16 LE]</pre>
          <p>
            Every <code>OPTION(EMIT)</code> writes all three fields, so send the values you want to keep
            along with the one you are changing.
          </p>
          <div class="api-response-label">MODE</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Name</th><th><code>rate_hz</code></th><th>Emit paced to</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Learnt <em>(default)</em></td><td>n/a</td><td>The rate the real mouse actually reports at</td></tr>
              <tr><td><code>1</code></td><td>Interval</td><td>n/a</td><td>The cloned mouse's declared poll rate (its <code>bInterval</code>)</td></tr>
              <tr><td><code>2</code></td><td>Fixed</td><td>target Hz</td><td><code>rate_hz</code>, snapped to <code>1000/n</code></td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Fixed snaps to <code>1000/n</code> Hz and caps at 1 kHz, so 1000, 500, 333 and 250 are exact
              (<code>0</code> means 1000).
            </p>
            <p>The pace is a ceiling. The box emits only while injection is pending, so idle stays idle.</p>
          </div>
          <div class="api-response-label">FORCE_HZ</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code> <em>(default)</em></td><td>Serves the captured descriptor and polls the device at the interval it declared</td></tr>
              <tr><td>target Hz</td><td>Writes the <code>bInterval</code> nearest that rate onto every HID interrupt-IN endpoint of the served descriptor, and polls the device at that same interval</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              A forced rate applies only with{' '}
              <A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A> on, because the
              descriptor stops matching the real device. Changing the resolved interval re-clones the
              box, which drops this port for a few seconds.
            </p>
            <p>
              Vendor interfaces, interrupt-OUT and isochronous endpoints keep the captured value. A
              low-speed clone cannot express an interval below 10 ms, so a request above 100 Hz there
              resolves to 100.
            </p>
          </div>
          <p>
            A <code>mode</code> the box does not know discards the <strong>whole</strong> command,{' '}
            <code>force_hz</code> included, and there is no reply to say so.
          </p>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 2)</code></A> (the stored
            fields, the rate in effect, and what the clone advertises) · Library{' '}
            <A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            A fixed 1 kHz ceiling with the wire forced to 1 kHz (<code>mode = 2</code>,{' '}
            <code>rate_hz = 0x03E8</code>, <code>force_hz = 0x03E8</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+---------+----------+--------+
| A5     | 11     | 00     | 06 00  | 02     | 02     | E8 03   | E8 03    | lo hi  |
+--------+--------+--------+--------+--------+--------+---------+----------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | mode   | rate_hz | force_hz | CRC16  |
+--------+--------+--------+--------+--------+--------+---------+----------+--------+`}</pre>
        </Card>
      </div>

      <div id="render" data-search-target>
        <Card>
          <CardHeader title="RENDER" subtitle="The texture the box renders motion with" />
          <pre class="api-signature">id 5  ·  [mode u8][full u8]</pre>
          <p>
            Both fields are written on every <code>OPTION(RENDER)</code>, so send the value you want to
            keep along with the one you are changing.
          </p>
          <div class="api-response-label">MODE</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Name</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Off</td><td>Renderer off. The box emits the paced fill.</td></tr>
              <tr><td><code>1</code></td><td>Stock</td><td>The model's triangular smoother, bit for bit. Its first report carries a larger delta than the ones after it.</td></tr>
              <tr><td><code>2</code></td><td>De-spiked <em>(default)</em></td><td>The same smoother with its onset ramped, which flattens that first report.</td></tr>
              <tr><td><code>3</code></td><td>Unsmoothed</td><td>No smoother. The model receives the raw injection.</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`one injected correction, drained over ~12 ms  (| = a report, . = an idle ms)

  mode = 0     | | | | | | | | | | | |      even fill at the paced rate
  mode > 0     | | . | . . | | . | . |      the live mouse's own on/off texture`}</pre>
          <table class="api-params">
            <thead><tr><th>Aspect</th><th><code>mode = 0</code></th><th><code>mode &gt; 0</code></th></tr></thead>
            <tbody>
              <tr><td>Per-report delta</td><td>The accumulator, split to fit the field</td><td>Shaped by the model, summing to the same total</td></tr>
              <tr><td>Model</td><td>None</td><td><a href="https://github.com/optima-manent/ABCurves" target="_blank" rel="noreferrer">ABCurves</a> (MIT), fit live per device</td></tr>
              <tr><td>Before a profile arms</td><td>Emits at once</td><td>Emits the paced fill, then switches over</td></tr>
            </tbody>
          </table>
          <div id="full" data-search-target class="api-response-label">FULL</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code> <em>(default)</em></td><td>Renders injected motion only. The device's own cursor delta is relayed byte for byte.</td></tr>
              <tr><td><code>1</code></td><td>Renders both. The device's cursor delta leaves the relayed report and joins injection as one stream through the model.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              <code>full</code> puts the smoother's group delay and one frame between the mouse and the
              wire, so what it costs follows the mode: about 3 ms on de-spiked, about 5 on stock, and
              about 1 on unsmoothed, which has no smoother to wait for. That is a feel change on
              physical movement, which is why it is off by default.
            </p>
            <p>
              The model emits at most 127 counts per axis per report and carries the rest as debt, so a
              flick past that rate finishes a few milliseconds later than the mouse made it, and the
              total is unchanged unless the debt outlives the 40 ms idle stop. On the learnt pace the
              ceiling is about 4 m/s at 800 DPI and about 1 at 3200; a slower fixed pace lowers it in
              proportion.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              The pace caps the rendered rate. On the learnt pace the renderer self-paces every
              millisecond; a fixed 250 Hz holds it to 250, and the model's debt carries what the cap
              coalesces.
            </p>
            <p>
              The profile is built from the live mouse and never persisted. Every boot starts without
              one: it arms off a window the mouse moved in and stays armed until the device changes.
              <code>full</code> also renders nothing while <code>mode</code> is <code>0</code>, since
              there is no model in the path to render with.
            </p>
            <p>
              Buttons, the wheel and every other field are relayed at the device's own timing in both
              modes. The model renders cursor motion only.
            </p>
          </div>
          <p>
            A <code>mode</code> above 3 or a <code>full</code> above 1 discards the{' '}
            <strong>whole</strong> command, and there is no reply to say so.
          </p>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 5)</code></A> (both stored
            fields, and whether a profile has armed) · Library{' '}
            <A href="/library/options#set-render"><code>set_render</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            De-spiked, rendering the device's own motion too (<code>mode = 2</code>,{' '}
            <code>full = 1</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 03 00  | 05     | 02     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | mode   | full   | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="name" data-search-target>
        <Card>
          <CardHeader title="NAME" subtitle="Give the box a human-readable name" />
          <pre class="api-signature">id 3  ·  [name ascii 1..32]  (0 bytes = clear)</pre>
          <div class="api-response-label">VALUE</div>
          <table class="api-params">
            <thead><tr><th>Bytes</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>1..32</code> printable ASCII</td><td>Sets the box's name to those bytes.</td></tr>
              <tr><td><code>0</code> (the <code>id</code> alone)</td><td>Clears the name, reverting to the synthesised <code>Medius-XXXX</code> default derived from the MAC.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The name is the readable partner to the box{' '}
              <A href="/native/commands/requests#version">MAC</A>, persisted in NVS with no reboot. It
              rides on <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> as the
              ASCII tail after the MAC, so it's read there, not through{' '}
              <A href="/native/commands/requests#options"><code>QUERY(OPTIONS)</code></A>.
            </p>
          </div>
          <p>
            Read it back on{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> · Library{' '}
            <A href="/library/options#set-name"><code>set_name</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Name the box "Loki" (<code>id = 3</code>, ascii <code>4C 6F 6B 69</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------------+--------+
| A5     | 11     | 00     | 05 00  | 03     | 4C 6F 6B 69  | lo hi  |
+--------+--------+--------+--------+--------+--------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | name ascii   | CRC16  |
+--------+--------+--------+--------+--------+--------------+--------+`}</pre>
        </Card>
      </div>
      <div id="bearing" data-search-target>
        <Card>
          <CardHeader title="BEARING" subtitle="What with and against are measured against" />
          <pre class="api-signature">id 4  ·  [window u16 LE] ms  [mode u8]</pre>
          <div class="api-response-label">WINDOW</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>No bearing is ever held, so <code>with</code> and <code>against</code> are inert whatever their scale</td></tr>
              <tr><td><code>N</code> ms</td><td>An axis keeps the direction of its last injected delta for <code>N</code> ms <em>(default 20)</em></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MODE</div>
          <table class="api-params">
            <thead><tr><th>Value</th><th><A href="/native/commands/lock#geometry">Geometry</A></th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Per axis <em>(default)</em></td></tr>
              <tr><td><code>1</code></td><td>Vector</td></tr>
              <tr><td><code>2</code> or above</td><td>Unknown: the whole command is dropped, window included, with no reply to say so</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              A write that changes either field drops the standing{' '}
              <A href="/native/commands/lock#bearing">bearing</A> and the banked{' '}
              <A href="/native/commands/lock#scale">carry</A> on every mouse interface. With a{' '}
              <code>with</code> / <code>against</code> scale live that is a visible step in what
              reaches the game PC, so set the geometry before the scales, not between reports.
            </p>
          </div>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 4)</code></A> · Library{' '}
            <A href="/library/options#set-bearing"><code>set_bearing</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A 20 ms window in vector mode (<code>window = 0x0014</code>, <code>mode = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 04 00  | 04     | 14 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | window | mode   | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

    </>
  );
};

export default Option;
