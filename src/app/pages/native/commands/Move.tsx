import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Move: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Move" subtitle="Cursor motion and scroll" />
        <p>
          <A href="/native/commands/move#move"><code>MOVE</code></A> drives a relative Axis: the
          cursor pair (X and Y together) or the wheel, picked by a <code>motion</code>{' '}
          byte. It injects on top of the real mouse, so the PC sees the combined result, and it's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
        <p>
          The momentary inputs (buttons, keys, media) have their own verb,{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A>.
        </p>
        <table class="api-params">
          <thead><tr><th>motion</th><th>Axis</th><th>carries</th><th>payload</th></tr></thead>
          <tbody>
            <tr><td><code>0</code></td><td><A href="/native/commands/move#move">cursor</A> (X, Y)</td><td><code>dx</code>, <code>dy</code> (i16)</td><td>6 bytes</td></tr>
            <tr><td><code>1</code></td><td><A href="/native/commands/move#wheel">wheel</A></td><td><code>dz</code> (i16)</td><td>4 bytes</td></tr>
          </tbody>
        </table>
      </Card>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="MOVE" subtitle="Relative axis injection" />
          <p>
            <code>MOVE</code> shifts an axis by a relative amount, not a screen position.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x01</code>.
          </p>
          <pre class="api-signature">MOVE  0x01  ·  cursor payload 6 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD (cursor, motion = 0)</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>motion</code></td><td><code>u8</code></td><td><code>0</code> = cursor</td></tr>
              <tr><td>1</td><td><code>dx</code></td><td><code>i16</code></td><td>horizontal step; +x = right, little-endian</td></tr>
              <tr><td>3</td><td><code>dy</code></td><td><code>i16</code></td><td>vertical step; +y = down, little-endian</td></tr>
              <tr><td>5</td><td><code>flags</code></td><td><code>u8</code></td><td>the riding override, <code>0</code> for an ordinary move</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">GUARANTEES</div>
          <pre class="diagram">{`exact   net move = the sum of every delta you send
range   full i16 per axis, no clamp
signs   +x right, +y down (screen-style), +z wheel up
paced   a large move drains across frames; nothing is dropped`}</pre>
          <p>
            The box carries any remainder in its{' '}
            <A href="/native/injection#state">accumulator</A>;{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> zeroes it. Library binding:{' '}
            <A href="/library/move#move-rel"><code>move_rel</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Cursor <code>dx = 100</code>, <code>dy = 0</code> (<code>motion = 0</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 01     | 00     | 06 00  | 00     | 64 00  | 00 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | motion | dx     | dy     | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="wheel" data-search-target>
        <Card>
          <CardHeader title="MOVE (wheel)" subtitle="Vertical scroll" />
          <p>
            With <code>motion = 1</code>, <code>MOVE</code> scrolls the wheel by a relative amount.
          </p>
          <pre class="api-signature">MOVE  0x01  ·  wheel payload 4 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD (wheel, motion = 1)</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>motion</code></td><td><code>u8</code></td><td><code>1</code> = wheel</td></tr>
              <tr><td>1</td><td><code>dz</code></td><td><code>i16</code></td><td>scroll steps; + = up, - = down, little-endian</td></tr>
              <tr><td>3</td><td><code>flags</code></td><td><code>u8</code></td><td>the riding override, <code>0</code> for an ordinary move</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The box adds <code>dz</code> into its{' '}
            <A href="/native/injection#state">accumulator</A> and drains it across{' '}
            <A href="/native/frame">frames</A> with carry, no clamp.{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> clears it. Library binding:{' '}
            <A href="/library/move#wheel"><code>wheel</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Wheel <code>dz = 1</code>, one step up (<code>motion = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 01     | 00     | 04 00  | 01     | 01 00  | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | motion | dz     | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="flags" data-search-target>
        <Card>
          <CardHeader title="MOVE flags" subtitle="Per-command movement-riding override" />
          <p>
            The <code>flags</code> byte overrides{' '}
            <A href="/native/commands/option#move-ride">movement riding</A> for this one command.
          </p>
          <pre class="api-signature">MOVE  0x01  ·  flags at offset 5 (cursor) / 3 (wheel)</pre>
          <div class="api-response-label">FLAGS</div>
          <table class="api-params">
            <thead><tr><th>Bit</th><th>Name</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>0x01</code></td><td><code>NOW</code></td><td>This delta emits on the box's own clock instead of waiting for a native cursor-motion report to carry it.</td></tr>
              <tr><td><code>0x02</code></td><td><code>FLUSH</code></td><td>Emit the motion already held for a ride, ignoring the ride window.</td></tr>
              <tr><td><code>0x04</code></td><td><code>DISCARD</code></td><td>Drop the motion already held for a ride.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Applied discard, then flush, then the delta; flush and discard together contradict each other
            and the box refuses the frame, and bits outside <code>0x07</code> are ignored. Injected motion
            lands in one of two <A href="/native/injection#state">accumulators</A>, so a bypassing delta
            never carries the held one out with it. Library bindings:{' '}
            <A href="/library/move#move-rel-now"><code>move_rel_now</code></A>,{' '}
            <A href="/library/move#flush-motion"><code>flush_motion</code></A>,{' '}
            <A href="/library/move#discard-motion"><code>discard_motion</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Send the held motion now, with no delta of its own (<code>flags = 0x02</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 01     | 00     | 06 00  | 00     | 00 00  | 00 00  | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | motion | dx     | dy     | flags  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Move;
