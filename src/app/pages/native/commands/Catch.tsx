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
          <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A> for movement and
          the wheel, and a{' '}
          <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A> for buttons, keys,
          and media, captured at the merge point <em>before</em> any{' '}
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
            <em>trigger</em> an event (every event carries the full held-usage snapshot), so a
            buttons-only subscription stays sparse even though the mouse reports at ~1&nbsp;kHz. Combine
            bits with OR; <code>0x1F</code> subscribes to every class.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Bit</th><th>Triggers on</th></tr>
            </thead>
            <tbody>
              <tr><td>Motion</td><td><code>0x01</code></td><td>a non-zero X or Y delta (a <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A>).</td></tr>
              <tr><td>Wheel</td><td><code>0x02</code></td><td>a non-zero wheel delta (a <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A>).</td></tr>
              <tr><td>Buttons</td><td><code>0x04</code></td><td>a mouse-button edge (a <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A>).</td></tr>
              <tr><td>Keys</td><td><code>0x08</code></td><td>a keyboard key or modifier change (a <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A>).</td></tr>
              <tr><td>Media</td><td><code>0x10</code></td><td>a media (Consumer) usage change (a <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A>).</td></tr>
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
          <p>Subscribe to every class (<code>mask = 0x1F</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 0B     | 00     | 01 00  | 1F     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | mask   | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="motion-event" data-search-target>
        <Card>
          <CardHeader title="MOTION_EVENT" subtitle="One physical relative-axis snapshot, box → PC" />
          <p>
            While a subscription with <code>Motion</code> or <code>Wheel</code> is active the box pushes
            a <code>MOTION_EVENT</code> for each physical report whose motion changed. It's unsolicited
            (there's no <code>QUERY</code> to correlate), so <code>SEQ</code> is a rolling per-event
            counter shared with{' '}
            <A href="/native/commands/catch#usage-event"><code>USAGE_EVENT</code></A>: a host detects
            dropped events as <code>SEQ</code> gaps. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x0C</code>.
          </p>
          <pre class="api-signature">MOTION_EVENT  0x0C  ·  payload 6 bytes</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>dx</code></td><td><code>i16</code></td><td>physical X this report; + = right, little-endian</td></tr>
              <tr><td>2</td><td><code>dy</code></td><td><code>i16</code></td><td>physical Y this report; + = down, little-endian</td></tr>
              <tr><td>4</td><td><code>dz</code></td><td><code>i16</code></td><td>physical wheel delta this report; + = up, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">BEST-EFFORT</div>
          <p>
            Delivery is best-effort: under back-pressure the box drops events (counted in{' '}
            <A href="/native/commands/requests#catch"><code>QUERY(CATCH)</code></A>) rather than stalling
            the report path, so the stream never delays the game-PC-facing reports.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>The user moves +10 right, no vertical or wheel motion (<code>dx = 10</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0C     | 2A     | 06 00  | 0A 00  | 00 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | dx     | dy     | dz     | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="usage-event" data-search-target>
        <Card>
          <CardHeader title="USAGE_EVENT" subtitle="One physical held-usage snapshot, box → PC" />
          <p>
            While a subscription with <code>Buttons</code>, <code>Keys</code>, or <code>Media</code> is
            active the box pushes a <code>USAGE_EVENT</code> when that class changes: a class-tagged
            snapshot of the usages currently held, so a mouse-button press and a key press have the same
            shape. It's a full snapshot, not edge deltas, so a dropped frame self-corrects on the next
            one; diff successive snapshots per class for press / release edges.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0F</code>.
          </p>
          <pre class="api-signature">USAGE_EVENT  0x0F  ·  payload 1 + 3n bytes</pre>
          <p><span class="api-badge api-badge--warning">Unsolicited</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>n</code></td><td><code>u8</code></td><td>number of held usages that follow</td></tr>
              <tr><td>+</td><td><code>class</code></td><td><code>u8</code></td><td>per usage: 0=button 1=key 2=media (as <A href="/native/commands/inject#inject"><code>INJECT</code></A>)</td></tr>
              <tr><td>+</td><td><code>id</code></td><td><code>u16</code></td><td>the held usage's id (a button id, HID keycode with 0xE0-0xE7 modifiers, or Consumer usage), little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ONE CLASS PER EVENT</div>
          <p>
            Each entry is 3 bytes; the snapshot is <code>n</code> of them, all one class (one physical
            report is one class), so a <code>Keys</code> event lists every held key and a{' '}
            <code>Buttons</code> event every held button. Best-effort like{' '}
            <A href="/native/commands/catch#motion-event"><code>MOTION_EVENT</code></A>: dropped events
            are counted in <A href="/native/commands/requests#catch"><code>QUERY(CATCH)</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Left Shift held while pressing <code>A</code> (a keys snapshot, two usages both <code>class = 1</code>: Left Shift <code>id = 0xE1</code>, then A <code>id = 0x04</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+----------+----------+--------+
| A5     | 0F     | 2B     | 07 00  | 02     | 01 E1 00 | 01 04 00 | lo hi  |
+--------+--------+--------+--------+--------+----------+----------+--------+
| SOF    | TYPE   | SEQ    | LEN    | n      | usage[0] | usage[1] | CRC16  |
+--------+--------+--------+--------+--------+----------+----------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Catch;
