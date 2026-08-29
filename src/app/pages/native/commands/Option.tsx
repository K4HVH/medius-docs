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
                <td>Pace, render and wire-rate injected motion</td>
                <td>learnt, de-spiked</td>
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
            </tbody>
          </table>
        </div>
        <p>
          Each card carries its own value layout on its signature line. A box that has been set boots
          at its own stored value, not the factory one.
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
            This keeps injected motion's report density identical to the real mouse's, erasing the
            density tell (a human aims at ~270-360 Hz, idle 60-70% of the time; gap-filling injection
            runs gapless near 990 Hz).
          </p>
          <div class="callout callout--warning">
            <p>
              While on, pure idle injection (moving the cursor while the real device is still) stops working:
              motion waits for a native move and is dropped if none comes. Button, key, and media
              injection are unaffected, and a move can opt out per command with the{' '}
              <A href="/native/commands/move#flags"><code>MOVE</code> flags</A>.
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
          <CardHeader title="EMIT" subtitle="Pick what paces injected motion, how it is rendered, and what rate the clone runs at" />
          <pre class="api-signature">id 2  ·  [mode u8][rate_hz u16 LE][force_hz u16 LE][render u8]</pre>
          <p>
            Three settings ride one command, each in its own field: <code>mode</code> (with{' '}
            <code>rate_hz</code>) is the pace, <code>render</code> is what injected motion is emitted{' '}
            <em>as</em>, and <code>force_hz</code> is the rate the clone runs at. They are independent —
            setting one never re-encodes another — but every <code>OPTION(EMIT)</code> writes all three,
            so send the values you want to keep alongside the one you are changing.
          </p>
          <div class="api-response-label">MODE</div>
          <table class="api-params">
            <thead><tr><th><code>mode</code></th><th>Name</th><th><code>rate_hz</code></th><th>Emit paced to</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Learnt <em>(default)</em></td><td>n/a</td><td>The rate the real mouse actually reports at</td></tr>
              <tr><td><code>1</code></td><td>Interval</td><td>n/a</td><td>The cloned mouse's declared poll rate (its <code>bInterval</code>)</td></tr>
              <tr><td><code>2</code></td><td>Fixed</td><td>target Hz</td><td><code>rate_hz</code>, snapped to <code>1000/n</code></td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Fixed snaps to <code>1000/n</code> Hz on the 1 ms frame clock and caps at 1 kHz, so 1000,
              500, 333, 250… are exact (<code>0</code> means 1000).
            </p>
            <p>
              The pace raises the ceiling only: the box emits a frame solely when injection is pending,
              so idle stays idle.
            </p>
          </div>
          <div id="render" data-search-target class="api-response-label">RENDER</div>
          <table class="api-params">
            <thead><tr><th><code>render</code></th><th>Name</th><th>Injected motion reaches the wire as</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Off</td><td>An even fill at whatever the pace allows</td></tr>
              <tr><td><code>1</code></td><td>Stock</td><td>The mouse's own texture, the model's triangular smoother bit for bit</td></tr>
              <tr><td><code>2</code></td><td>De-spiked <em>(default)</em></td><td>The same, with the smoother's onset ramped rather than stepped</td></tr>
              <tr><td><code>3</code></td><td>Unsmoothed</td><td>The same, no smoother; the model renders the raw injection</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`one injected correction, drained over ~12 ms  (| = a report, . = an idle ms)

  render = 0   | | | | | | | | | | | |      even fill at the paced rate
  render > 0   | | . | . . | | . | . |      the live mouse's own on/off texture`}</pre>
          <table class="api-params">
            <thead><tr><th>Aspect</th><th><code>render = 0</code></th><th><code>render &gt; 0</code></th></tr></thead>
            <tbody>
              <tr><td>Report cadence</td><td>Even, up to the ceiling</td><td>The device's own active/idle pattern</td></tr>
              <tr><td>Per-report delta</td><td>The accumulator, split to fit the field</td><td>Shaped by the model, summing to the same total</td></tr>
              <tr><td>Model</td><td>None</td><td><a href="https://github.com/optima-manent/ABCurves" target="_blank" rel="noreferrer">ABCurves</a> (MIT), fit live per device</td></tr>
              <tr><td>Before a profile arms</td><td>Emits at once</td><td>Emits the paced fill, then switches over</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The pace caps the rendered rate, which is the one place the two fields meet: rendered on
              the learnt pace self-paces every millisecond, while rendered under a fixed 250 Hz never
              exceeds 250 Hz and the model's debt carries the motion the cap coalesces.
            </p>
            <p>
              The three rendered values differ only in the path smoother the model is fed. It expects a
              smoothed path and a stepped onset is not one, so stock's first report sits above the rest.
            </p>
            <p>
              The model's profile is built from the live mouse and never persisted, so every boot starts
              without one. It arms off a window the mouse actually moved in, and until then injection runs
              on the paced fill rather than waiting on a profile a still mouse would never produce. Once
              armed it stays armed until the device changes, so injecting while the hand is still — the
              case rendering exists for — keeps rendering.
            </p>
          </div>
          <div class="api-response-label">FORCE_HZ</div>
          <table class="api-params">
            <thead><tr><th><code>force_hz</code></th><th>What the box does</th></tr></thead>
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
            A <code>mode</code> or <code>render</code> value the box does not know discards the{' '}
            <strong>whole</strong> command, <code>force_hz</code> included, and there is no reply to say
            so.
          </p>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 2)</code></A> (all three
            fields, the rate in effect, and what the clone advertises) · Library{' '}
            <A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Rendered with the stock smoother on a fixed 1 kHz ceiling, wire forced to 1 kHz
            (<code>mode = 2</code>, <code>rate_hz = 0x03E8</code>, <code>force_hz = 0x03E8</code>,{' '}
            <code>render = 1</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+---------+----------+--------+--------+
| A5     | 11     | 00     | 07 00  | 02     | 02     | E8 03   | E8 03    | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+---------+----------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | mode   | rate_hz | force_hz | render | CRC16  |
+--------+--------+--------+--------+--------+--------+---------+----------+--------+--------+`}</pre>
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
              <tr><td><code>0</code> (the <code>id</code> alone)</td><td>Clears the name, reverting to the synthesized <code>Medius-XXXX</code> default derived from the MAC.</td></tr>
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
