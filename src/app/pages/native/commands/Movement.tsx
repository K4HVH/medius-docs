import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Movement: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Movement" subtitle="Cursor motion and scroll" />
        <p>
          <A href="/native/commands/movement#move"><code>MOVE</code></A> moves the cursor and{' '}
          <A href="/native/commands/movement#wheel"><code>WHEEL</code></A> scrolls. Both inject input
          on top of the real mouse, so the PC sees the two combined, and both are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="MOVE" subtitle="Relative cursor movement" />
          <p>
            <code>MOVE</code> shifts the cursor by a relative amount, not a screen position.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x01</code>.
          </p>
          <pre class="api-signature">MOVE  0x01  ·  payload 4 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>dx</code></td><td><code>i16</code></td><td>horizontal step; +x = right, little-endian</td></tr>
              <tr><td>2</td><td><code>dy</code></td><td><code>i16</code></td><td>vertical step; +y = down, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box adds <code>dx</code> and <code>dy</code> into its{' '}
            <A href="/native/injection#state">accumulator</A> and drains it onto the real mouse's
            reports across <A href="/native/frame">frames</A>, carrying any remainder, so the cursor
            moves by exactly the sum of the deltas. Full <code>i16</code> range, no clamp.{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> zeroes the accumulator.
            Library binding: <A href="/library/movement#move-rel"><code>move_rel</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>dx = 100</code>, <code>dy = 0</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 01     | 00     | 04 00  | 64 00  | 00 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | dx     | dy     | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="wheel" data-search-target>
        <Card>
          <CardHeader title="WHEEL" subtitle="Vertical scroll" />
          <p>
            <code>WHEEL</code> scrolls the wheel by a relative amount.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x02</code>.
          </p>
          <pre class="api-signature">WHEEL  0x02  ·  payload 2 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>delta</code></td><td><code>i16</code></td><td>scroll steps; + = up, - = down, little-endian</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box adds <code>delta</code> into its{' '}
            <A href="/native/injection#state">accumulator</A> and drains it across{' '}
            <A href="/native/frame">frames</A> with carry, no clamp.{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> clears it. Library binding:{' '}
            <A href="/library/movement#wheel"><code>wheel</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>delta = 1</code> (one step up):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 02     | 00     | 02 00  | 01 00  | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | delta  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Movement;
