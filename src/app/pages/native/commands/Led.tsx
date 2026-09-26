import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Led: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="LED" subtitle="Drive a status LED" />
        <p>
          <A href="/native/commands/led#led"><code>LED</code></A> overrides a status LED or returns
          it to the box's status display. Each chip has one green LED.{' '}
          <A href="/native/injection#fire-and-forget">Fire-and-forget</A>.
        </p>
      </Card>

      <div id="led" data-search-target>
        <Card>
          <CardHeader title="LED" subtitle="Override or restore a status LED" />
          <p>
            <code>LED</code> forces a chip's green LED to a pattern or returns it to auto status
            display. <A href="/native/frame#opcodes">Opcode</A> <code>0x09</code>.
          </p>
          <pre class="api-signature">LED  0x09  ·  payload 3 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>target</code></td><td><code>u8</code></td><td>which chip's LED (see below)</td></tr>
              <tr><td>1</td><td><code>mode</code></td><td><code>u8</code></td><td>drive mode (see below)</td></tr>
              <tr><td>2</td><td><code>level</code></td><td><code>u8</code></td><td>brightness 0-255; used by solid and blink, ignored for off and auto</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th>Value</th><th>LED</th></tr>
            </thead>
            <tbody>
              <tr><td>device</td><td><code>0</code></td><td>Device chip LED.</td></tr>
              <tr><td>host</td><td><code>1</code></td><td>Host chip LED, relayed over the <A href="/native/architecture#data-flow">inter-chip link</A>.</td></tr>
              <tr><td>both</td><td><code>2</code></td><td>Both LEDs.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Mode</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>auto</td><td><code>0</code></td><td>Box status display (see below).</td></tr>
              <tr><td>off</td><td><code>1</code></td><td>LED dark.</td></tr>
              <tr><td>solid</td><td><code>2</code></td><td>Lit steadily at <code>level</code> brightness.</td></tr>
              <tr><td>blink</td><td><code>3</code></td><td>Blinks at <code>level</code> brightness.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">STATUS DISPLAY</div>
          <p>
            In <code>auto</code> (the default), each chip drives its own LED from its state.
          </p>
          <p>
            Device chip: solid with link, mouse, and clone all up; slow blink with the link up but the
            mouse or clone missing; off with no link.
          </p>
          <p>
            Host chip: solid while the mouse streams, off otherwise.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            An override holds until <code>auto</code>, control-PC silence (the same ~1 s timeout that
            clears <A href="/native/injection#safety">injection</A>),{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, or inter-chip link loss.
          </p>
          <p>
            Invisible to the game PC: a host or both override travels only the inter-chip link.
            Library binding:{' '}
            <A href="/library/led#led"><code>led</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Both LEDs to blink at <code>level = 200</code> (<code>0xC8</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 09     | 00     | 03 00  | 02     | 03     | C8     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | target | mode   | level  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Led;
