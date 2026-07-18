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
          Three <A href="/native/frame">frames</A> that manage the box rather than inject input:{' '}
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
          <pre class="api-signature">RESET  0x04  ·  payload 0 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <p>No payload (<code>LEN</code> is <code>0</code>).</p>
          <div class="api-response-label">EFFECT</div>
          <p>
            Zeroes the accumulators (<code>accX</code>, <code>accY</code>, <code>accWheel</code>) and
            sets every <A href="/native/commands/inject"><code>INJECT</code></A> override back to
            none, so injected-held buttons and keys release and the real device passes through. The report is
            then byte-identical to passthrough; sending it twice is a no-op. This is what the{' '}
            <A href="/native/injection#safety">safety auto-clear</A> performs. Library binding:{' '}
            <A href="/library/admin#reset"><code>reset</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>A bare <code>RESET</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+
| A5     | 04     | 00     | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="reboot" data-search-target>
        <Card>
          <CardHeader title="REBOOT" subtitle="Restart a chip" />
          <p>
            <code>REBOOT</code> restarts one of the box's two chips, mainly to enter ROM download mode
            (the chip's built-in bootloader, which accepts new firmware) for flashing.{' '}
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
          <div class="api-response-label">TARGETS</div>
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
            Reboot-to-run (<code>2</code> or <code>3</code>) is the only software cold-reboot on this
            board; DTR/RTS auto-reset is not wired. No reply: the chip is rebooting. See{' '}
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
            <code>LOG</code> is diagnostic text the box sends on its own, in place of an ASCII console.{' '}
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
              <tr><td>1..</td><td><code>text</code></td><td><code>UTF-8</code></td><td>the log line, not NUL-terminated, length = <code>LEN - 1</code></td></tr>
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
            box's other outbound frame is <A href="/native/commands/requests#resp"><code>RESP</code></A>.
            Library binding: <A href="/library/diagnostics#logs"><code>logs</code></A>.
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
