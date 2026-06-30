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
        <table class="api-params">
          <thead>
            <tr><th>Option</th><th><code>id</code></th><th>Value</th><th>Does</th><th>Default</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A></td>
              <td><code>0</code></td>
              <td><code>[allow u8]</code></td>
              <td>Clone an over-capacity device anyway</td>
              <td>off</td>
            </tr>
            <tr>
              <td><A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A></td>
              <td><code>1</code></td>
              <td><code>[timeout u16 LE]</code></td>
              <td>Inject motion only on a real move</td>
              <td>off</td>
            </tr>
            <tr>
              <td><A href="/native/commands/option#emit"><code>EMIT</code></A></td>
              <td><code>2</code></td>
              <td><code>[mode u8][rate_hz u16 LE]</code></td>
              <td>Pick what paces injected motion</td>
              <td>learnt</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div id="option" data-search-target>
        <Card>
          <CardHeader title="OPTION" subtitle="One generic, persistent option" />
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
              analog stream wants a sixth, past the ESP32-S3's five). Changing this for an{' '}
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
              While on, pure idle injection (moving the cursor while the hand is still) stops working —
              motion waits for a native move and is dropped if none comes. Button, key, and media
              injection are unaffected.
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
          <CardHeader title="EMIT" subtitle="Pick what paces injected motion" />
          <pre class="api-signature">id 2  ·  [mode u8][rate_hz u16 LE]</pre>
          <div class="api-response-label">MODE</div>
          <table class="api-params">
            <thead><tr><th><code>mode</code></th><th>Name</th><th><code>rate_hz</code></th><th>Emit paced to</th></tr></thead>
            <tbody>
              <tr><td><code>0</code></td><td>Learnt <em>(default)</em></td><td>—</td><td>The rate the real mouse actually reports at</td></tr>
              <tr><td><code>1</code></td><td>Interval</td><td>—</td><td>The cloned mouse's declared poll rate (its <code>bInterval</code>)</td></tr>
              <tr><td><code>2</code></td><td>Fixed</td><td>target Hz</td><td><code>rate_hz</code>, snapped to <code>1000/n</code></td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Fixed snaps to <code>1000/n</code> Hz on the 1 ms frame clock and caps at 1 kHz, so 1000,
              500, 333, 250… are exact and 750 lands on 1000 (<code>0</code> means 1000). Every mode
              raises the ceiling only: the box still emits a frame solely when injection is pending, so
              idle stays idle. Learnt keeps injection matched to the real mouse; the other modes are for
              a host that shapes its own report density and wants the box to stop re-pacing it.
            </p>
          </div>
          <p>
            Read{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 2)</code></A> (mode plus the
            rate in effect) · Library{' '}
            <A href="/library/options#set-emit-pace"><code>set_emit_pace</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Fixed 1 kHz (<code>mode = 2</code>, <code>rate_hz = 0x03E8</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 04 00  | 02     | 02     | E8 03  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | mode   | rate_hz| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Option;
