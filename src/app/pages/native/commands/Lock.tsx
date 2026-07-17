import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Lock" subtitle="Block one physical input by class" />
        <p>
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> stops the physical device from
          driving one input while leaving everything else alone. It's generic over the input class: a
          relative axis, a mouse button, a keyboard key, or a media usage, plus a blanket lock for a
          whole class. Host <A href="/native/injection">injection</A> still drives a locked input, so a
          script can take one over; it's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="LOCK" subtitle="Lock or unlock a physical input" />
          <p>
            <code>LOCK</code> picks a <code>class</code>, an <code>id</code> within it, and a{' '}
            <code>direction</code>, then either blocks it or clears the block. A momentary usage shares{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>'s{' '}
            <code>(class, id)</code> space, so a button locks exactly like a key.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x0A</code>.
          </p>
          <pre class="api-signature">LOCK  0x0A  ·  payload 5 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>the input class (see below)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>which input within the class, little-endian; <code>0xFFFF</code> = the whole class</td></tr>
              <tr><td>3</td><td><code>direction</code></td><td><code>u8</code></td><td>which sign or which edge (see below)</td></tr>
              <tr><td>4</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> = lock, <code>0</code> = unlock</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLASSES</div>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Value</th><th><code>id</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td>button</td><td><code>0</code></td><td>a <A href="/native/commands/usage#buttons">button id</A> (0=Left .. 4=Side2)</td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keyboard usage</A> (0xE0-0xE7 = modifier)</td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>axis</td><td><code>3</code></td><td>0=X, 1=Y, 2=wheel (the sign is the direction)</td></tr>
            </tbody>
          </table>
          <p>
            Classes <code>0</code>-<code>2</code> mirror{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A>. An <code>id</code> of{' '}
            <code>0xFFFF</code> is a blanket: it locks every usage in that class in one command (every
            button, every key, or every media usage).
          </p>
          <div class="api-response-label">DIRECTION</div>
          <p>
            What <code>direction</code> means depends on the input. For an axis it's a sign, so you can
            block scrolling up but not down. For a button, key, or media usage it's an edge, so you can
            block the press but not the release.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Direction</th><th>Value</th><th>Axis</th><th>Button / key / media</th></tr>
            </thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>Both signs.</td><td>Press and release.</td></tr>
              <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 to 1</code>).</td></tr>
              <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>-</code>).</td><td>Release only (<code>1 to 0</code>).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A lock blocks the physical device and nothing else. Host{' '}
            <A href="/native/injection">injection</A> still reaches a locked input, so a{' '}
            <A href="/native/commands/move#move"><code>MOVE</code></A> moves a locked axis and an{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A> drives a locked button or
            key. Lock an input the user shouldn't touch, then drive it yourself.
          </p>
          <div class="api-response-label">A LOCK CLEARS ON</div>
          <pre class="diagram">{`unlock      you send the matching unlock (state = 0)
silence     ~1 s with no control-PC frame (same net as injection)
RESET       a RESET command
link loss   the inter-chip link drops`}</pre>
          <div class="callout callout--warning">
            <p>
              A lock isn't permanent. It auto-clears on the same safety net as injection, so hold it
              with a keepalive if the user has to stay locked out.
            </p>
          </div>
          <div class="api-response-label">EFFECT</div>
          <p>
            Locks are PC-owned and never visible to the game PC.{' '}
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the active set
            across every class; the HEALTH{' '}
            <A href="/native/commands/requests#health"><code>LOCK_ON</code></A> bit is set while any
            lock, of any class, is active. Library bindings:{' '}
            <A href="/library/lock#lock"><code>lock</code></A> /{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A>, and{' '}
            <A href="/library/lock#lock-all"><code>lock_all</code></A> /{' '}
            <A href="/library/lock#lock-all"><code>unlock_all</code></A> for a blanket.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Lock the wheel's negative (scroll-down) sign: <code>class = 3</code> (axis), <code>id = 2</code> (wheel), <code>direction = 2</code>, <code>state = 1</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 00     | 05 00  | 03     | 02 00  | 02     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | dir    | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
