import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Catch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="CATCH" subtitle="Stream the physical mouse and keyboard input to the PC" />
        <p>
          <A href="/native/commands/catch#catch"><code>CATCH</code></A> subscribes to the user's real
          input. While subscribed, the box pushes a{' '}
          <A href="/native/commands/catch#mouse-event"><code>MOUSE_EVENT</code></A> for every button,
          wheel, and movement, and a{' '}
          <A href="/native/commands/catch#kb-event"><code>KB_EVENT</code></A> or{' '}
          <A href="/native/commands/catch#cons-event"><code>CONS_EVENT</code></A> for keys and media,
          captured at the merge point <em>before</em> any{' '}
          <A href="/native/commands/lock"><code>LOCK</code></A> suppression or{' '}
          <A href="/native/injection">injection</A>, so you can lock an input and still see it to
          rebind it. Subscribing is{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>; the box streams until you
          unsubscribe.
        </p>
      </Card>

      <div id="catch" data-search-target>
        <Card>
          <CardHeader title="CATCH" subtitle="Subscribe to the physical-input event stream" />
          <p>
            <code>CATCH</code> sends a one-byte class mask. A non-zero mask subscribes; <code>0</code>{' '}
            unsubscribes. <A href="/native/frame#opcodes">Opcode</A> <code>0x0B</code>.
          </p>
          <pre class="api-signature">CATCH  0x0B  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>mask</code></td><td><code>u8</code></td><td>which classes to stream (see below); <code>0</code> = unsubscribe</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MASK</div>
          <p>
            Each bit turns on one class of change. The mask only chooses which reports{' '}
            <em>trigger</em> an event (every event still carries the full snapshot), so a buttons-only
            subscription stays sparse even though the mouse reports at ~1&nbsp;kHz. Combine bits with OR.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Bit</th><th>Triggers on</th></tr>
            </thead>
            <tbody>
              <tr><td>Motion</td><td><code>0x01</code></td><td>a non-zero X or Y delta.</td></tr>
              <tr><td>Wheel</td><td><code>0x02</code></td><td>a non-zero wheel delta.</td></tr>
              <tr><td>Buttons</td><td><code>0x04</code></td><td>a button edge (press or release).</td></tr>
              <tr><td>Keys</td><td><code>0x08</code></td><td>a keyboard or media key change (a <A href="/native/commands/catch#kb-event"><code>KB_EVENT</code></A> or <A href="/native/commands/catch#cons-event"><code>CONS_EVENT</code></A>).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            The stream reports the user's <em>physical</em> input, never your injected overrides, and
            it reads the report before <A href="/native/commands/lock"><code>LOCK</code></A> clamps it,
            so a locked axis or blocked button is still reported here. That's the intercept-and-rebind
            loop: lock an input to hide it from the game, catch it to act on it.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box streams from the moment a non-zero mask arrives until you send <code>0</code>. The
            subscription is PC-owned and clears on the same triggers as injection: control-PC silence
            (the ~1&nbsp;s timeout), a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a mouse detach, or inter-chip
            link loss, plus an explicit unsubscribe. The host library holds an open subscription alive
            with its keepalive (re-asserting it after a device-side blip) and across a reconnect.{' '}
            <A href="/native/commands/requests#catch"><code>QUERY(CATCH)</code></A> reads
            the active mask and a dropped-event count; the HEALTH{' '}
            <A href="/native/commands/requests#health"><code>CATCH_ON</code></A> bit is set while
            subscribed. Library binding:{' '}
            <A href="/library/catch#catch-events"><code>catch_events</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Subscribe to every class (<code>mask = 0x0F</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 0B     | 00     | 01 00  | 0F     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | mask   | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="mouse-event" data-search-target>
        <Card>
          <CardHeader title="MOUSE_EVENT" subtitle="One physical mouse snapshot, box → PC" />
          <p>
            While a subscription is active the box pushes a <code>MOUSE_EVENT</code> for each physical
            mouse report whose change matches the mask. It's unsolicited (there's no <code>QUERY</code>{' '}
            to correlate), so <code>SEQ</code> is a rolling per-event counter, shared across{' '}
            <code>MOUSE_EVENT</code> / <A href="/native/commands/catch#kb-event"><code>KB_EVENT</code></A>{' '}
            / <A href="/native/commands/catch#cons-event"><code>CONS_EVENT</code></A>: a host detects
            dropped events as <code>SEQ</code> gaps. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x0C</code>.
          </p>
          <pre class="api-signature">MOUSE_EVENT  0x0C  ·  payload 7 bytes</pre>
          <p><span class="api-badge api-badge--executed">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>buttons</code></td><td><code>u8</code></td><td>pressed-button bitmask: bit <code>b</code> = button id <code>b</code> (0 = Left … 4 = Side2)</td></tr>
              <tr><td>1</td><td><code>dx</code></td><td><code>i16</code></td><td>physical X this report (+ = right)</td></tr>
              <tr><td>3</td><td><code>dy</code></td><td><code>i16</code></td><td>physical Y this report (+ = down)</td></tr>
              <tr><td>5</td><td><code>wheel</code></td><td><code>i16</code></td><td>physical wheel delta (+ = up)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">FULL SNAPSHOT</div>
          <p>
            The payload is always the full snapshot regardless of which class triggered it, so diff{' '}
            <code>buttons</code> across events to recover press / release edges. Delivery is best-effort:
            under back-pressure the box drops events (counted in{' '}
            <A href="/native/commands/requests#catch"><code>QUERY(CATCH)</code></A>) rather than stalling
            the report path, so the stream never delays the game-PC-facing reports.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>The user moves +10 right while holding Side1 (<code>buttons = 0x08</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0C     | 2A     | 07 00  | 08     | 0A 00  | 00 00  | 00 00  | ... CRC16
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | btns   | dx     | dy     | wheel  |`}</pre>
        </Card>
      </div>

      <div id="kb-event" data-search-target>
        <Card>
          <CardHeader title="KB_EVENT" subtitle="One physical keyboard snapshot, box → PC" />
          <p>
            While a subscription with the <code>KEYS</code> class is active the box pushes a{' '}
            <code>KB_EVENT</code> on each keyboard change. It's a full snapshot, not edge deltas, so a
            dropped frame self-corrects on the next one; diff successive snapshots for down / up edges.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0F</code>.
          </p>
          <pre class="api-signature">KB_EVENT  0x0F  ·  payload 2 + n bytes</pre>
          <p><span class="api-badge api-badge--executed">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>modifiers</code></td><td><code>u8</code></td><td>modifier bitmap: bit <code>m</code> = the modifier at usage <code>0xE0 + m</code></td></tr>
              <tr><td>1</td><td><code>n</code></td><td><code>u8</code></td><td>number of pressed keycodes that follow</td></tr>
              <tr><td>2</td><td><code>keycodes</code></td><td><code>u8 × n</code></td><td>the currently-pressed keycodes, ascending</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>Left Shift held while pressing <code>A</code> (<code>modifiers = 0x02</code>, one keycode <code>0x04</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0F     | 2B     | 03 00  | 02     | 01     | 04     | ... CRC16
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | mods   | n      | keys   |`}</pre>
        </Card>
      </div>

      <div id="cons-event" data-search-target>
        <Card>
          <CardHeader title="CONS_EVENT" subtitle="One physical media snapshot, box → PC" />
          <p>
            While a subscription with the <code>KEYS</code> class is active the box pushes a{' '}
            <code>CONS_EVENT</code> on each media-key change: the active Consumer usages, self-correcting
            like <A href="/native/commands/catch#kb-event"><code>KB_EVENT</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x10</code>.
          </p>
          <pre class="api-signature">CONS_EVENT  0x10  ·  payload 1 + 2n bytes</pre>
          <p><span class="api-badge api-badge--executed">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>n</code></td><td><code>u8</code></td><td>number of active media usages that follow</td></tr>
              <tr><td>1</td><td><code>usages</code></td><td><code>u16 × n</code></td><td>the active Consumer usages, little-endian (typically one at a time)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>Volume Up active (one usage <code>0x00E9</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 10     | 2C     | 03 00  | 01     | E9 00  | ... CRC16
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | n      | usages |`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Catch;
