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
          <A href="/native/commands/option#option"><code>OPTION</code></A> sets one persistent box
          option, named by an <code>id</code>. One command covers every box-level toggle, so a new
          option is a new id, not a new opcode. There are two today:{' '}
          <A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A> (clone an
          over-capacity device anyway) and{' '}
          <A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A> (movement riding).
          Both persist in NVS and are <A href="/native/injection#fire-and-forget">fire-and-forget</A>;
          read a value back with{' '}
          <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, id)</code></A>.
        </p>
      </Card>

      <div id="option" data-search-target>
        <Card>
          <CardHeader title="OPTION" subtitle="One generic, persistent option" />
          <p>
            <code>OPTION</code> takes an <code>id</code> byte and an id-specific value. The value is
            variable-length: the frame's <code>LEN</code> delimits it, like{' '}
            <A href="/native/commands/admin#log"><code>LOG</code></A>, so a future option with a bigger
            value needs no protocol change. <A href="/native/frame#opcodes">Opcode</A> <code>0x11</code>.
          </p>
          <pre class="api-signature">OPTION  0x11  ·  payload 1 + value bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>id</code></td><td><code>u8</code></td><td>which option (see below)</td></tr>
              <tr><td>1..</td><td><code>value</code></td><td><code>varies</code></td><td>id-specific, variable-length</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">OPTIONS</div>
          <table class="api-params">
            <thead>
              <tr><th><code>id</code></th><th>Option</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td><A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A></td><td><code>[allow u8]</code></td></tr>
              <tr><td><code>1</code></td><td><A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A></td><td><code>[timeout u16]</code> ms, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box persists the value in NVS and restores it at boot. There's no reply; read a value
            back with <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, id)</code></A>.
            An unknown id is ignored, so an old box and a new control PC never misbehave.
          </p>
        </Card>
      </div>

      <div id="imperfect" data-search-target>
        <Card>
          <CardHeader title="OPTION · IMPERFECT" subtitle="id 0 — clone an over-capacity device anyway" />
          <p>
            Some devices need more interrupt-IN endpoints than the box can serve. The ESP32-S3 has five
            device IN endpoints, so a device whose interfaces want a sixth can't be cloned faithfully:
            that one interface goes silently dead. The Wooting Two HE is the case in point, with its
            analog stream on a sixth IN endpoint. By default the box is faithful-only and{' '}
            <em>refuses</em> such a device, so it never presents a detectably-broken clone.{' '}
            <code>IMPERFECT</code> opts into cloning it anyway, every other interface byte-faithful.
          </p>
          <pre class="api-signature">OPTION  id = 0  ·  value 1 byte</pre>
          <div class="api-response-label">VALUE</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td><code>allow</code></td><td><code>u8</code></td><td><code>1</code> = clone an over-capacity device anyway, <code>0</code> = faithful-only (default)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            When it changes for an attached over-capacity device the box reboots itself and re-clones
            with the new setting, so it applies without unplugging anything. A normal device (five IN
            endpoints or fewer) is never over-capacity, so the toggle does nothing to it (no reboot).{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 0)</code></A> reads the
            opt-in plus the over-capacity and imperfect-clone flags. Library binding:{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Opt in (<code>id = 0</code>, <code>allow = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 02 00  | 00     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | allow  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="move-ride" data-search-target>
        <Card>
          <CardHeader title="OPTION · MOVE_RIDE" subtitle="id 1 — movement riding" />
          <p>
            Movement riding makes injected motion appear only when the real mouse moves. Injected
            cursor and wheel motion ride a native cursor-motion report seen within the window, and the
            box never emits a synthetic motion frame just for injection. Motion left unridden past the
            window is dropped, not saved up and dumped on the next move, so injection can't be hoarded
            during idle and released in a burst.
          </p>
          <pre class="api-signature">OPTION  id = 1  ·  value 2 bytes</pre>
          <div class="api-response-label">VALUE</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td><code>timeout</code></td><td><code>u16</code></td><td>ride window in ms, little-endian; <code>0</code> = off (default), <code>N &gt; 0</code> = on with an N ms window</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHY</div>
          <p>
            It erases the report-density tell. A human aiming reports at roughly 270 to 360 Hz with the
            mouse idle 60 to 70% of the time, but the frame-clock fill that drives injected motion is
            gapless at about 990 Hz even while the user aims. Riding native reports makes injected
            motion's density and idle fraction match the real mouse, so injection looks the same as a
            hand on the mouse.
          </p>
          <div class="api-response-label">TRADEOFF</div>
          <p>
            The tradeoff is deliberate: pure idle injection, moving the cursor while the user holds
            still, stops working while riding is on. Button, key, and media injection are unaffected.
            Off by default.{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 1)</code></A> reads the
            current window. Library binding:{' '}
            <A href="/library/options#set-movement-riding"><code>set_movement_riding</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Turn it on with a 20 ms window (<code>id = 1</code>, <code>timeout = 0x0014</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 03 00  | 01     | 14 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | timeout| CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Option;
