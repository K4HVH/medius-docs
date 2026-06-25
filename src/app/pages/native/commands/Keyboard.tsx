import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Keyboard: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Keyboard" subtitle="Inject keys and media keys" />
        <p>
          <A href="/native/commands/keyboard#key"><code>KEY</code></A> presses or releases a key or
          modifier by HID keycode, and{' '}
          <A href="/native/commands/keyboard#consumer"><code>CONSUMER</code></A> does the same for a
          media key, both merged with the user's real typing on the cloned keyboard.
        </p>
      </Card>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="KEY" subtitle="Key and modifier injection" />
          <p>
            <code>KEY</code> sets a per-key{' '}
            <A href="/native/injection#state">override</A> by HID keycode, layered over the physical
            keyboard. <A href="/native/frame#opcodes">Opcode</A> <code>0x0D</code>.
          </p>
          <pre class="api-signature">KEY  0x0D  ·  payload 2 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>usage</code></td><td><code>u8</code></td><td>HID keycode; <code>0xE0</code>-<code>0xE7</code> is a modifier (folded into the modifier byte)</td></tr>
              <tr><td>1</td><td><code>action</code></td><td><code>u8</code></td><td>0=soft-release 1=press 2=force-release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ACTIONS</div>
          <p>
            The <code>action</code> byte is the same tri-state as{' '}
            <A href="/native/commands/buttons#button"><code>BUTTON</code></A>: <code>press</code>{' '}
            forces the key down, <code>soft-release</code> clears your press while a physical hold
            stays down, and <code>force-release</code> forces the key up over a physical press.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            A key fills a keycode slot (or sets its NKRO bit) in the report the PC sees; physical keys
            keep their slots, so injection never evicts the user's typing. Past the board's rollover
            limit it emits the board's own <code>ErrorRollOver</code>. A keycode the cloned board can't
            report is a no-op. <A href="/native/commands/admin#reset"><code>RESET</code></A> releases
            every override. Library bindings:{' '}
            <A href="/library/keyboard#key"><code>key</code> / <code>key_down</code> / <code>key_up</code> / <code>key_force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press <code>A</code>, <code>usage</code> <code>0x04</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0D     | 00     | 02 00  | 04     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | usage  | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="consumer" data-search-target>
        <Card>
          <CardHeader title="CONSUMER" subtitle="Media key injection" />
          <p>
            <code>CONSUMER</code> presses or releases a media key by 16-bit{' '}
            <a href="https://www.usb.org/sites/default/files/hut1_5.pdf" target="_blank" rel="noreferrer">Consumer usage</a>,
            merged onto the cloned keyboard's Consumer report.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0E</code>.
          </p>
          <pre class="api-signature">CONSUMER  0x0E  ·  payload 3 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>usage</code></td><td><code>u16</code></td><td>the 16-bit Consumer usage, little-endian (e.g. 0xCD Play/Pause, 0xE9 Volume Up)</td></tr>
              <tr><td>2</td><td><code>action</code></td><td><code>u8</code></td><td>0=soft-release 1=press 2=force-release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ACTIONS</div>
          <p>
            The <code>action</code> byte is the same tri-state as{' '}
            <A href="/native/commands/buttons#button"><code>BUTTON</code></A>.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            Present-gated to a board that declares a Consumer collection, read from the{' '}
            <A href="/native/commands/requests#kbd-caps"><code>KBD_CAPS</code></A>{' '}
            <code>CONSUMER</code> flag; otherwise a no-op.{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> releases it. Library bindings:{' '}
            <A href="/library/keyboard#media"><code>media</code> / <code>media_down</code> / <code>media_up</code> / <code>media_force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press Volume Up, <code>usage</code> <code>0x00E9</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0E     | 00     | 03 00  | E9 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | usage  | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Keyboard;
