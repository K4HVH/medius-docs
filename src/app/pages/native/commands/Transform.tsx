import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transform: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transform" subtitle="Negate, scale, swap, or remap a field on the wire" />
        <p>
          <A href="/native/commands/transform#transform"><code>TRANSFORM</code></A> rewrites a field the
          clone's descriptor declares, clamped to that field's declared range so every emitted report is
          one <A href="/native/injection">native</A> could produce. It carries no{' '}
          <A href="/native/commands/option#imperfect">imperfect-clone opt-in</A>, unlike the
          rewrite/raw/patch layer.
        </p>
        <pre class="diagram">{`  parsed report  -->  [ TRANSFORM ]  -->  LOCK  -->  render  -->  emit
                        invert  scale
                        swap  (two axes, read both then write both)
                        remap (source -> dest, source cleared)
                                 |
                                 +-- button -> key / media  emits on that interface, on the edge`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>Op</th><th>Value</th><th>Does</th></tr>
          </thead>
          <tbody>
            <tr><td>remap</td><td><code>0</code></td><td>Move the source field into the destination, clearing the source.</td></tr>
            <tr><td>swap</td><td><code>1</code></td><td>Exchange two axes: read both, then write both.</td></tr>
            <tr><td>invert</td><td><code>2</code></td><td>Negate one axis. The scale is ignored.</td></tr>
            <tr><td>scale</td><td><code>3</code></td><td>Weigh one axis by the signed scale.</td></tr>
          </tbody>
        </table>
        <p>
          A field is a <code>(class, id)</code> in the same space{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/lock"><code>LOCK</code></A> use: <code>0</code> button, <code>1</code>{' '}
          key, <code>2</code> media, <code>3</code> axis (id <code>0</code>=X, <code>1</code>=Y,{' '}
          <code>2</code>=wheel, <code>3</code>=pan).
        </p>
      </Card>

      <div id="transform" data-search-target>
        <Card>
          <CardHeader title="TRANSFORM" subtitle="Install, overwrite, or remove one entry" />
          <p>
            An entry is keyed by its <code>(source, dest)</code>; setting one whose key exists overwrites
            its op and scale. <A href="/native/frame#opcodes">Opcode</A> <code>0x1E</code>.
          </p>
          <pre class="api-signature">TRANSFORM  0x1E  ·  payload 10 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>op</code></td><td><code>u8</code></td><td>the operation, as the <A href="/native/commands/transform">table above</A></td></tr>
              <tr><td>1</td><td><code>sclass</code></td><td><code>u8</code></td><td>source class: <code>0</code> button, <code>1</code> key, <code>2</code> media, <code>3</code> axis</td></tr>
              <tr><td>2</td><td><code>sid</code></td><td><code>u16</code></td><td>source id within the class, little-endian</td></tr>
              <tr><td>4</td><td><code>dclass</code></td><td><code>u8</code></td><td>destination class</td></tr>
              <tr><td>5</td><td><code>did</code></td><td><code>u16</code></td><td>destination id, little-endian</td></tr>
              <tr><td>7</td><td><code>scale</code></td><td><code>i16</code></td><td>signed percent, little-endian, <A href="/native/commands/transform#scale">see below</A></td></tr>
              <tr><td>9</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> set (add or overwrite), <code>0</code> remove the keyed entry</td></tr>
            </tbody>
          </table>

          <div id="scale" data-search-target>
            <div class="api-response-label">SCALE</div>
            <table class="api-params">
              <thead>
                <tr><th>Value</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr><td><code>-100</code></td><td>Inverts (same as an <code>invert</code> op).</td></tr>
                <tr><td><code>0</code></td><td>Blocks the source. Refused on an <code>invert</code>, which ignores the scale.</td></tr>
                <tr><td><code>100</code></td><td>Identity.</td></tr>
                <tr><td><code>200</code></td><td>Doubles. <code>-50</code> halves and flips.</td></tr>
              </tbody>
            </table>
            <p>
              The transformed value is clamped to the destination field's declared logical range, so a
              scale can never put a value on the wire the field could not carry. That clamp is what keeps
              the feature faithful.
            </p>
          </div>

          <div id="pairs" data-search-target>
            <div class="api-response-label">FIELD PAIRS</div>
            <p>Each op admits only certain source and destination classes; anything else is refused.</p>
            <div class="table-scroll">
              <table class="api-params">
                <thead>
                  <tr><th>Op</th><th>Source → destination</th></tr>
                </thead>
                <tbody>
                  <tr><td>invert, scale</td><td>One axis: source and destination are the same axis.</td></tr>
                  <tr><td>swap</td><td>Two axes. Read both, then write both, so it is not two remaps.</td></tr>
                  <tr><td>remap</td><td>axis→axis or button→button, in the same report; or button→key / button→media, emitted through the destination's own interface on the button's edge.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="clearing" data-search-target>
            <div class="api-response-label">CLEARS ON</div>
            <pre class="diagram">{`remove      a TRANSFORM with state = 0 and the entry's (source, dest)
clear       state 0 with both classes 0xFF and both ids 0xFFFF, a blanket
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away`}</pre>
            <p>
              A transform is session state, re-asserted on reconnect and held alive by the keepalive,
              exactly like a <A href="/native/commands/lock"><code>LOCK</code></A>.
            </p>
          </div>

          <div class="api-response-label">EXAMPLE</div>
          <p>Invert Y: <code>op = 2</code>, source and dest <code>(axis 3, id 1)</code>, a placeholder scale of <code>100</code>, <code>state = 1</code>:</p>
          <pre class="diagram">{`+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+
| A5  | 1E  | 00  | 0A 00 | 02  | 03  | 01 00 | 03  | 01 00 | 64 00 | 01  | lo hi |
+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+
| SOF | TYP | SEQ | LEN   | op  |scls | sid   |dcls | did   | scale |stat | CRC16 |
+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+`}</pre>
          <p>Double the wheel: <code>op = 3</code> (scale), source and dest <code>(axis 3, id 2)</code>, <code>scale = 200</code> (<code>0x00C8</code>):</p>
          <pre class="diagram">{`+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+
| A5  | 1E  | 01  | 0A 00 | 03  | 03  | 02 00 | 03  | 02 00 | C8 00 | 01  | lo hi |
+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+
| SOF | TYP | SEQ | LEN   | op  |scls | sid   |dcls | did   | scale |stat | CRC16 |
+-----+-----+-----+-------+-----+-----+-------+-----+-------+-------+-----+-------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/transform#transform"><code>transform</code></A>,{' '}
            <A href="/library/transform#helpers"><code>invert</code></A>,{' '}
            <A href="/library/transform#helpers"><code>scale_transform</code></A>,{' '}
            <A href="/library/transform#helpers"><code>swap</code></A>, and{' '}
            <A href="/library/transform#helpers"><code>remap</code></A>.
          </p>
        </Card>
      </div>

      <div id="query" data-search-target>
        <Card>
          <CardHeader title="QUERY(TRANSFORMS)" subtitle="Read the active table" />
          <p>
            <A href="/native/commands/requests"><code>QUERY</code></A> with <code>what = 16</code>{' '}
            answers <code>RESP(TRANSFORMS)</code>. An entry has no <code>state</code> byte, and a refused
            entry is absent.
          </p>
          <div class="api-response-label">RESP(TRANSFORMS)</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td><code>16</code></td></tr>
              <tr><td>1</td><td><code>flags</code></td><td><code>u8</code></td><td>bit 0 = table full: a further entry was, or would be, refused</td></tr>
              <tr><td>2</td><td><code>n</code></td><td><code>u8</code></td><td>entry count, up to 8</td></tr>
              <tr><td>3 + 9k</td><td><code>entry</code></td><td>9 bytes</td><td><code>op</code>, <code>sclass</code>, <code>sid</code> (u16), <code>dclass</code>, <code>did</code> (u16), <code>scale</code> (i16)</td></tr>
            </tbody>
          </table>
          <p>
            The box holds up to eight entries. <A href="/native/commands/requests#health"><code>HEALTH</code></A>{' '}
            sets its <code>TRANSFORM_ON</code> bit (<code>0x0400</code>) while the table is non-empty.
            Bindings: <A href="/library/transform#query-transforms"><code>query_transforms</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Transform;
