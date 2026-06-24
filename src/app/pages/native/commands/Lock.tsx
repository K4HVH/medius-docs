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
          driving one input, while leaving everything else alone. It's generic over the input class:
          a mouse axis, the wheel, a mouse button, a keyboard key, or a media usage, plus blanket
          locks for a whole class. Host <A href="/native/injection">injection</A> still drives a
          locked input, so you can take one over without the user fighting you for it. It's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="LOCK" subtitle="Lock or unlock a physical input" />
          <p>
            <code>LOCK</code> picks a <code>class</code>, a <code>usage</code> within it, and a{' '}
            <code>direction</code>, then either blocks it or clears the block.{' '}
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
              <tr><td>1</td><td><code>usage</code></td><td><code>u16</code></td><td>which input within the class, little-endian; ignored for a blanket class</td></tr>
              <tr><td>3</td><td><code>direction</code></td><td><code>u8</code></td><td>which way or which edge (see below)</td></tr>
              <tr><td>4</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> = lock, <code>0</code> = unlock</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLASSES</div>
          <table class="api-params">
            <thead>
              <tr><th>Class</th><th>Value</th><th><code>usage</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td>mouse</td><td><code>0</code></td><td>a mouse <A href="/native/commands/lock#targets">target</A> (0=X 1=Y 2=Wheel, 3-7=buttons)</td></tr>
              <tr><td>key</td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keyboard usage</A></td></tr>
              <tr><td>media</td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
              <tr><td>all keys</td><td><code>3</code></td><td>blanket: every key (usage ignored)</td></tr>
              <tr><td>all media</td><td><code>4</code></td><td>blanket: every media usage (usage ignored)</td></tr>
              <tr><td>all buttons</td><td><code>5</code></td><td>blanket: every mouse button (usage ignored)</td></tr>
            </tbody>
          </table>
          <div id="targets" class="api-response-label">MOUSE TARGETS</div>
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th><code>usage</code></th><th>Input</th></tr>
            </thead>
            <tbody>
              <tr><td>X</td><td><code>0</code></td><td>Horizontal movement.</td></tr>
              <tr><td>Y</td><td><code>1</code></td><td>Vertical movement.</td></tr>
              <tr><td>Wheel</td><td><code>2</code></td><td>Scroll wheel.</td></tr>
              <tr><td>Left .. Side2</td><td><code>3</code> .. <code>7</code></td><td>One mouse button, <code>3 + </code><A href="/native/commands/usage#buttons">button id</A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <p>
            What <code>direction</code> means depends on the input. For an axis or the wheel it's a
            sign, so you can block scrolling up but not down. For a button or key it's an edge, so you
            can block the press but not the release.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Direction</th><th>Value</th><th>Axis / wheel</th><th>Button / key</th></tr>
            </thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>Both signs.</td><td>Press and release.</td></tr>
              <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 → 1</code>).</td></tr>
              <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>−</code>).</td><td>Release only (<code>1 → 0</code>).</td></tr>
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
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the active
            mouse set; the HEALTH <A href="/native/commands/requests#health"><code>LOCK_ON</code></A>{' '}
            bit is set while any lock, of any class, is active. Library bindings:{' '}
            <A href="/library/lock#lock"><code>lock</code></A> /{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A>,{' '}
            <A href="/library/lock#lock-key"><code>lock_key</code></A>,{' '}
            <A href="/library/lock#lock-media"><code>lock_media</code></A>,{' '}
            <A href="/library/lock#lock-all"><code>lock_all</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Lock the wheel's negative (scroll-down) direction: <code>class = 0</code> (mouse), <code>usage = 2</code> (wheel), <code>direction = 2</code>, <code>state = 1</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 00     | 05 00  | 00     | 02 00  | 02     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | usage  | direc  | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
