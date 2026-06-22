import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Lock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="LOCK" subtitle="Block one input from the physical mouse" />
        <p>
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> stops the real mouse from moving
          one axis, scrolling the wheel, or working one button, while leaving everything else alone.
          Host <A href="/native/injection">injection</A> still drives a locked target, so you can take
          an input over without the user fighting you for it. It's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="LOCK" subtitle="Lock or unlock a physical input" />
          <p>
            <code>LOCK</code> picks one input and one direction, and either blocks it or clears the
            block. <A href="/native/frame#opcodes">Opcode</A> <code>0x0A</code>.
          </p>
          <pre class="api-signature">LOCK  0x0A  ·  payload 3 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>target</code></td><td><code>u8</code></td><td>which input to lock (see below)</td></tr>
              <tr><td>1</td><td><code>direction</code></td><td><code>u8</code></td><td>which way or which edge (see below)</td></tr>
              <tr><td>2</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> = lock, <code>0</code> = unlock</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TARGETS</div>
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th>Value</th><th>Input</th></tr>
            </thead>
            <tbody>
              <tr><td>X</td><td><code>0</code></td><td>Horizontal movement.</td></tr>
              <tr><td>Y</td><td><code>1</code></td><td>Vertical movement.</td></tr>
              <tr><td>Wheel</td><td><code>2</code></td><td>Scroll wheel.</td></tr>
              <tr><td>Left</td><td><code>3</code></td><td>Left button.</td></tr>
              <tr><td>Right</td><td><code>4</code></td><td>Right button.</td></tr>
              <tr><td>Middle</td><td><code>5</code></td><td>Middle button.</td></tr>
              <tr><td>Side1</td><td><code>6</code></td><td>First thumb button.</td></tr>
              <tr><td>Side2</td><td><code>7</code></td><td>Second thumb button.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <p>
            What <code>direction</code> means depends on the target. For an axis or the wheel it's a
            sign, so you can block scrolling up but not down. For a button it's an edge, so you can
            block the press but not the release.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Direction</th><th>Value</th><th>Axis / wheel</th><th>Button</th></tr>
            </thead>
            <tbody>
              <tr><td>both</td><td><code>0</code></td><td>Both signs.</td><td>Press and release.</td></tr>
              <tr><td>positive</td><td><code>1</code></td><td>Positive sign only (<code>+</code>).</td><td>Press only (<code>0 → 1</code>).</td></tr>
              <tr><td>negative</td><td><code>2</code></td><td>Negative sign only (<code>−</code>).</td><td>Release only (<code>1 → 0</code>).</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">PHYSICAL ONLY</div>
          <p>
            A lock blocks the physical mouse and nothing else. Host{' '}
            <A href="/native/injection">injection</A> still reaches a locked target, so a{' '}
            <A href="/native/commands/movement#move"><code>MOVE</code></A> moves a locked axis and a{' '}
            <A href="/native/commands/buttons"><code>BUTTON</code></A> presses a locked button. Lock
            an input the user shouldn't touch, then drive it yourself.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            A lock holds until you unlock it, and the box also clears every lock on control-PC silence
            (the same ~1 s timeout that clears injection), on{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, or on inter-chip link loss.
            Locks are PC-owned state, released like injection, and never visible to the game PC.{' '}
            <A href="/native/commands/requests#locks"><code>QUERY(LOCKS)</code></A> reads the current
            set; the HEALTH <A href="/native/commands/requests#health"><code>LOCK_ON</code></A> bit
            is set while any lock is active. Library bindings:{' '}
            <A href="/library/lock#lock"><code>lock</code></A> /{' '}
            <A href="/library/lock#unlock"><code>unlock</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Lock the wheel's negative (scroll-down) direction (<code>target = 2</code>, <code>direction = 2</code>, <code>state = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 0A     | 00     | 03 00  | 02     | 02     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | target | direc  | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Lock;
