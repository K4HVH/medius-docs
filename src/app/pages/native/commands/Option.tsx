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
              <tr><th>Option</th><th><code>id</code></th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/commands/option#imperfect"><code>IMPERFECT</code></A></td><td><code>0</code></td><td><code>[allow u8]</code></td></tr>
              <tr><td><A href="/native/commands/option#move-ride"><code>MOVE_RIDE</code></A></td><td><code>1</code></td><td><code>[timeout u16 LE]</code> ms</td></tr>
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
          <CardHeader title="IMPERFECT" subtitle="Clone an over-capacity device anyway" />
          <p>
            With <code>id = 0</code> the value is <code>[allow u8]</code>: <code>1</code> clones an
            over-capacity device anyway (every other interface byte-faithful, the over-capacity one
            dead), <code>0</code> is faithful-only and refuses it (the default). Some devices need more
            interrupt-IN endpoints than the box can serve (the Wooting Two HE's analog stream wants a
            sixth, past the ESP32-S3's five), so the box refuses them by default rather than present a
            detectably-broken clone. When it changes for an attached over-capacity device the box reboots
            itself to re-clone; a normal device is unaffected.{' '}
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
          <CardHeader title="MOVE_RIDE" subtitle="Inject motion only on a real move" />
          <p>
            With <code>id = 1</code> the value is <code>[timeout u16 LE]</code> in milliseconds
            (<code>0</code> = off, the default). When on, injected cursor and wheel motion only rides a
            native cursor-motion report seen within the window; the box emits no synthetic motion frame
            for injection, and motion left unridden is dropped, never dumped on the next move. That keeps
            injected motion's report density and idle fraction identical to the real mouse's (a human
            aims at ~270-360 Hz, idle 60-70% of the time, while gap-filling injection runs gapless near
            990 Hz), erasing the report-density tell. Pure idle injection (moving the cursor while the
            hand is still) stops working while it's on; button, key, and media injection are unaffected.
            Library binding:{' '}
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
