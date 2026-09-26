import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Admin: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Admin" subtitle="Reset, reboot, and logs" />
        <p>
          Three box-management <A href="/native/frame">frames</A>:{' '}
          <A href="/native/commands/admin#reset"><code>RESET</code></A>,{' '}
          <A href="/native/commands/admin#reboot"><code>REBOOT</code></A>, and{' '}
          <A href="/native/commands/admin#log"><code>LOG</code></A>.
        </p>
      </Card>

      <div id="reset" data-search-target>
        <Card>
          <CardHeader title="RESET" subtitle="Back to pure passthrough" />
          <p>
            <code>RESET</code> drops all injection and returns the box to plain passthrough.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x04</code>.
          </p>
          <pre class="api-signature">RESET  0x04  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <p>
            A flags byte; <code>0x00</code> is the plain release below.
          </p>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Name</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0x01</code></td><td><code>NVS</code></td><td>Also erases the persistent store and reboots, returning at defaults under the MAC-derived name.</td></tr>
            </tbody>
          </table>
          <p>
            Any other bit refuses the whole frame, release included. A frame with no payload does
            nothing: the byte is required, like every command's payload.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            Releases all PC-owned state in one frame: both{' '}
            <A href="/native/injection#state">accumulators</A>, every{' '}
            <A href="/native/commands/inject"><code>INJECT</code></A> override, every{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A> scale and the{' '}
            <A href="/native/commands/lock#bearing">bearing</A>, the{' '}
            <A href="/native/commands/catch"><code>CATCH</code></A> subscription table, the{' '}
            <A href="/native/commands/rewrite#lifecycle">rewrite rules</A>, the{' '}
            <A href="/native/commands/transform#clearing">transforms</A>, the loaded{' '}
            <A href="/native/commands/clip"><code>clip</code></A>, and any{' '}
            <A href="/native/commands/led"><code>LED</code></A> override.
          </p>
          <p>
            The report is then byte-identical to passthrough; a second <code>RESET</code> is a no-op.
            The <A href="/native/injection#safety">safety auto-clear</A> performs the same release.
            Library binding:{' '}
            <A href="/library/admin#reset"><code>reset</code></A>.
          </p>
          <div class="api-response-label">NVS FLAG</div>
          <p>
            The release runs first, then the box erases the <code>nvs</code>{' '}
            <A href="/native/commands/update">partition</A> and reboots, losing the box name, every{' '}
            <A href="/library/options">option</A>, and everything learned about devices seen,
            including any <A href="/native/commands/patch">descriptor patch set</A>. Settings load
            into RAM at boot, so the reboot restores the defaults.
          </p>
          <p>
            The clone re-enumerates on the game PC. The control port stays enumerated, so queries time
            out until the box replies again. Library binding: <A href="/library/admin#factory-reset"><code>factory_reset</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Plain release, then with the flag:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 04     | 00     | 01 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 04     | 00     | 01 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="reboot" data-search-target>
        <Card>
          <CardHeader title="REBOOT" subtitle="Restart a chip" />
          <p>
            <code>REBOOT</code> restarts one of the two chips, mainly into ROM download mode (the
            built-in bootloader that accepts new firmware) for flashing.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x07</code>.
          </p>
          <pre class="api-signature">REBOOT  0x07  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>target</code></td><td><code>u8</code></td><td>which chip and mode (see below)</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>device download</td><td><code>0</code></td><td>Device chip enters ROM download, then flash over the <A href="/native/transport">CH343 link</A>.</td></tr>
              <tr><td>host download</td><td><code>1</code></td><td>Device relays a download reboot to the host chip; the host flashes over its own USB.</td></tr>
              <tr><td>device run</td><td><code>2</code></td><td>Device chip reboots to run firmware.</td></tr>
              <tr><td>host run</td><td><code>3</code></td><td>Device relays a run reboot to the host chip.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Reboot-to-run (<code>2</code> or <code>3</code>) is the board's only software cold-reboot;
            DTR/RTS auto-reset isn't wired. No reply. See{' '}
            <A href="/native/flashing">Flashing</A>. Library binding:{' '}
            <A href="/library/admin#reboot"><code>reboot</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>target = 2</code> (device chip to run):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 07     | 00     | 01 00  | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | target | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="log" data-search-target>
        <Card>
          <CardHeader title="LOG" subtitle="Device diagnostics" />
          <p>
            <code>LOG</code> is unsolicited diagnostic text, in place of an ASCII console.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x08</code>.
          </p>
          <pre class="api-signature">LOG  0x08  ·  box → PC</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>level</code></td><td><code>u8</code></td><td>severity (see below)</td></tr>
              <tr><td>1..</td><td><code>text</code></td><td><code>UTF-8</code></td><td>log line, not NUL-terminated, length = <code>LEN - 1</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LEVELS</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Level</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>error</td></tr>
              <tr><td><code>1</code></td><td>warn</td></tr>
              <tr><td><code>2</code></td><td>info</td></tr>
              <tr><td><code>3</code></td><td>debug</td></tr>
              <tr><td><code>4</code></td><td>verbose</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Emitted only while a control PC is attached; logging before first contact is dropped. The
            box's other outbound frames are{' '}
            <A href="/native/commands/requests#resp"><code>RESP</code></A>,{' '}
            <A href="/native/commands/transfer#transfer-resp"><code>TRANSFER_RESP</code></A>,{' '}
            <A href="/native/commands/update#resp"><code>UPDATE_RESP</code></A>, and the catch events{' '}
            <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A>,{' '}
            <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> and{' '}
            <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A>. Library
            binding: <A href="/library/diagnostics#logs"><code>logs</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>level = 2</code> (info), text <code>hi</code> (<code>68 69</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 08     | 00     | 03 00  | 02     | 68 69  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | level  | text   | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Admin;
