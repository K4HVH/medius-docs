import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transform: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transform" subtitle="Scale, swap, or remap a field on the wire" />
        <p>
          <A href="/native/commands/transform#transform"><code>TRANSFORM</code></A> rewrites a field
          the clone's descriptor declares, clamped to that field's declared range, so the clone still
          emits only values the real device could. It carries no{' '}
          <A href="/native/commands/option#imperfect">imperfect-clone opt-in</A>, unlike the
          rewrite/raw/patch layer.
        </p>
        <pre class="diagram">{`  parsed report --> [ TRANSFORM ] --> LOCK --> render --> inject --> emit
                          |
                          +-- scale   one axis, weighed by a signed percent
                          +-- swap    two axes, read both then write both
                          +-- remap   source -> destination, source cleared
                                |
                                +-- button -> key / media, held on the
                                    destination's own interface`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>op</th><th>Name</th><th>Effect</th></tr>
          </thead>
          <tbody>
            <tr><td><code>0</code></td><td><code>REMAP</code></td><td>move the source field into the destination and clear the source</td></tr>
            <tr><td><code>1</code></td><td><code>SWAP</code></td><td>exchange two axes: read both, then write both</td></tr>
            <tr><td><code>2</code></td><td><code>SCALE</code></td><td>weigh one axis by the signed scale; <code>-100</code> negates it</td></tr>
          </tbody>
        </table>
        <p>
          There is no separate invert op. Negation is a{' '}
          <A href="/native/commands/transform#scale">scale</A> of <code>-100</code>, which the box
          applies exactly. An <code>op</code> above <code>2</code> is refused.
        </p>
        <p>
          A field is a <code>(class, id)</code> in the same space{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/lock"><code>LOCK</code></A> use: <code>0</code> button,{' '}
          <code>1</code> key, <code>2</code> media, <code>3</code> axis (id <code>0</code>=X,{' '}
          <code>1</code>=Y, <code>2</code>=wheel, <code>3</code>=pan).
        </p>
        <p>
          <A href="/native/commands/requests#transforms"><code>QUERY(TRANSFORMS)</code></A> reads the
          installed table back.
        </p>
      </Card>

      <div id="transform" data-search-target>
        <Card>
          <CardHeader title="TRANSFORM" subtitle="Install, overwrite, or remove one entry" />
          <p>
            An entry is keyed by its <code>(source, dest)</code>; setting one whose key exists
            overwrites its op and scale. <A href="/native/frame#opcodes">Opcode</A>{' '}
            <code>0x1E</code>.
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
              <tr><td>7</td><td><code>scale</code></td><td><code>i16</code></td><td>signed percent, little-endian, <A href="/native/commands/transform#scale"><code>-255 to 255</code></A></td></tr>
              <tr><td>9</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> set (add or overwrite), <code>0</code> remove the keyed entry</td></tr>
            </tbody>
          </table>

          <div id="scale" data-search-target>
            <div class="api-response-label">SCALE</div>
            <pre class="diagram">{`  -255   max, negated   <==   2.55x with the sign flipped
  -100   negate         <--   all of it, sign flipped
     0   block          --X   the destination gets nothing
   100   identity       -->   all of it, byte for byte
   255   max            ==>   2.55x, clamped to the declared range`}</pre>
            <table class="api-params">
              <thead>
                <tr><th>Value</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr><td><code>-100</code></td><td>Negates. This is the whole of what an invert op would have been.</td></tr>
                <tr><td><code>0</code></td><td>Blocks the source. On a remap the destination is left as the device sent it.</td></tr>
                <tr><td><code>100</code></td><td>Identity, and the only value a button source takes.</td></tr>
                <tr><td><code>200</code></td><td>Doubles. <code>-50</code> halves and flips.</td></tr>
              </tbody>
            </table>
            <div class="api-response-label">RULES</div>
            <table class="api-params">
              <thead>
                <tr><th>Name</th><th>What the box does</th></tr>
              </thead>
              <tbody>
                <tr><td>magnitude</td><td>Weighs at <code>255</code> at most, the same ceiling <A href="/native/commands/lock#scale"><code>LOCK</code></A> has. Every shipped client refuses a wider frame before the wire.</td></tr>
                <tr><td>carry</td><td>The dropped fraction is banked per entry, as a <A href="/native/commands/lock#scale">lock</A> banks it per axis: <code>40</code> on a run of <code>-1</code> emits <code>0 0 -1 0 -1</code>.</td></tr>
                <tr><td>saturate</td><td>A result is clamped to the destination field's declared logical range, never wraps, and forfeits the fraction it could not carry.</td></tr>
                <tr><td>one bit</td><td>A button carries a single bit, so a button source takes only a full pass. Any other percentage is refused rather than rounded.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td><code>op</code> is above <code>2</code></td><td>remap, swap and scale are the whole set; there is no invert op to reach</td></tr>
              <tr><td>the op does not admit that <A href="/native/commands/transform#pairs">class pair</A></td><td>each op names the shapes it can read and write; nothing else is coherent</td></tr>
              <tr><td><code>swap</code> names one axis twice</td><td>a swap needs two different axes; an axis exchanged with itself is a no-op dressed as an entry</td></tr>
              <tr><td>a button source with a scale other than <code>100</code></td><td>a button is one bit, so a percentage of it has no value to carry</td></tr>
              <tr><td>a field this clone does not declare</td><td>the box will not store an address it cannot reach; re-send the entry after a re-clone</td></tr>
              <tr><td>the table already holds 32 entries</td><td>nothing is evicted; the readback's full flag says an entry was turned away</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            An entry takes effect on the next report the device sends. The box walks the table in the
            order entries were installed, so a swap installed after a scale exchanges the scaled
            value.
          </p>
          <p>
            <code>TRANSFORM</code> has no reply, so a refused entry shows up as its absence from{' '}
            <A href="/native/commands/requests#transforms"><code>RESP(TRANSFORMS)</code></A>. That
            reply also carries the full flag, and the <code>TRANSFORM_ON</code>{' '}
            <A href="/native/commands/requests#health">health</A> bit follows the table.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Negate Y: <code>op = 2</code> (scale), source and dest <code>(axis 3, id 1)</code>,{' '}
            <code>scale = -100</code> (<code>0xFF9C</code>), <code>state = 1</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 00     | 0A 00  | 02     | 03     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 01 00  | 03     | 01 00  | 9C FF  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| sid    | dclass | did    | scale  | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Double the wheel: <code>op = 2</code>, source and dest <code>(axis 3, id 2)</code>,{' '}
            <code>scale = 200</code> (<code>0x00C8</code>):
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 01     | 0A 00  | 02     | 03     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 02 00  | 03     | 02 00  | C8 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| sid    | dclass | did    | scale  | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/transform#transform"><code>transform</code></A>,{' '}
            <A href="/library/transform#helpers"><code>transform_invert</code></A>,{' '}
            <A href="/library/transform#helpers"><code>transform_scale</code></A>,{' '}
            <A href="/library/transform#helpers"><code>transform_swap</code></A>, and{' '}
            <A href="/library/transform#helpers"><code>transform_remap</code></A>.
          </p>
        </Card>
      </div>

      <div id="pairs" data-search-target>
        <Card>
          <CardHeader title="Field pairs" subtitle="Which source and destination each op admits" />
          <p>Each op reads and writes a fixed set of shapes. Anything else is refused.</p>
          <pre class="diagram">{`  scale   axis a    ---------->  axis a      the same axis, source and destination
  swap    axis a    <--------->  axis b      two DIFFERENT axes
  remap   axis a    ---------->  axis b      one report, source zeroed
          button i  ---------->  button j    one report, source bit cleared
          button i  ---------->  key         the keyboard collection
          button i  ---------->  media       the consumer collection`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>What the box does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>scale</code></td><td>Reads one axis, weighs it, writes it back. The source and the destination are the same axis, so the entry's key is that axis twice.</td></tr>
              <tr><td><code>swap</code></td><td>Reads both axes, then writes both. Two remaps would read the second after the first had overwritten it and leave the pair equal.</td></tr>
              <tr><td><code>remap</code></td><td>Adds the weighed source onto the destination's own value, then zeroes the source. A button destination is OR'd the press instead, and the source bit is cleared.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">A SCALED SWAP</div>
          <p>
            A swap weighs both axes by the same scale on the way across, so <code>100</code>{' '}
            exchanges them untouched and <code>-100</code> exchanges and negates both. That is one
            entry, not a swap followed by two scales.
          </p>
          <div class="api-response-label">WHAT A REMAP LEAVES</div>
          <p>
            An axis remap adds, so a destination that was already moving keeps its own motion and
            picks up the source's on top. Only the source is zeroed. The sum is clamped to the
            destination's declared range like any other result.
          </p>
        </Card>
      </div>

      <div id="cross" data-search-target>
        <Card>
          <CardHeader title="Button to key or media" subtitle="The one remap that crosses collections" />
          <p>
            A button source can drive a keyboard or Consumer destination. The key or media usage is
            emitted through that collection's own interface, exactly as{' '}
            <A href="/native/commands/inject#key"><code>INJECT</code></A> emits one.
          </p>
          <div class="api-response-label">HELD, NOT LATCHED</div>
          <pre class="diagram">{`  physical button    ____----------________-----____
  key on the clone   ____----------________-----____

  driven from the button mask the device just reported,
  re-read every report, with no edge latch to strand`}</pre>
          <p>
            Because it follows the level, a configuration switch, a missed release, or a destination
            that was briefly unbound all resolve on the next report instead of leaving a key held
            with nothing pressed.
          </p>
          <div class="api-response-label">EVERY MOUSE COLLECTION</div>
          <p>
            A device may split its buttons across two mouse collections. The destination is held
            while any collection the box reports on has that button down, and a collection that does
            not declare the id holds nothing for it.
          </p>
          <div class="api-response-label">INERT WHEN UNBOUND</div>
          <p>
            A remap whose destination this configuration does not declare does nothing, and in
            particular does not clear its source: the button keeps reaching the game PC. The entry
            starts working the moment the destination collection binds again.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Side button 3 drives the <code>a</code> key: <code>op = 0</code> (remap), source{' '}
            <code>(button 0, id 3)</code>, dest <code>(key 1, id 0x04)</code>,{' '}
            <code>scale = 100</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 02     | 0A 00  | 00     | 00     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+--------+
| 03 00  | 01     | 04 00  | 64 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| sid    | dclass | did    | scale  | state  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            The keycode is a <A href="/native/commands/usage#keycodes">HID keyboard usage</A>; a
            media destination takes a 16-bit{' '}
            <A href="/native/commands/usage#consumer">Consumer usage</A>.
          </p>
        </Card>
      </div>

      <div id="order" data-search-target>
        <Card>
          <CardHeader title="Where the pass sits" subtitle="Against locks, rendering, and injection" />
          <p>
            The field pass is the first thing to touch a parsed report, so everything downstream
            reads the transformed value rather than the physical one.
          </p>
          <pre class="diagram">{`  physical report
       |
       +-- 1  TRANSFORM   fields rewritten in place, in table order
       |
       +-- 2  LOCK        weighs the TRANSFORMED value, on its bearing
       |
       +-- 3  render      the model is handed the transformed, weighed delta
       |
       +-- 4  inject      drains onto the field a remap just cleared
       |
       v
  emitted report`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Stage</th><th>Reads</th><th>Acts on</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/commands/lock"><code>LOCK</code></A></td><td>the transformed field</td><td>a negated axis locks on its new sign, so a <code>+</code> lock now bites on physical motion the other way</td></tr>
              <tr><td><A href="/native/commands/option#render">rendering</A></td><td>the transformed, weighed cursor delta</td><td>the model is fed the same numbers the wire would have carried, so a scale changes what it renders rather than what it corrects</td></tr>
              <tr><td><A href="/native/injection">injection</A></td><td>nothing the table wrote</td><td>injected motion drains into the axis after the pass; a remap that zeroed that axis does not take it with it</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">WHAT CATCH SEES</div>
          <p>
            The input classes of{' '}
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> tap the physical report
            before the pass, so they still report the untransformed value.{' '}
            <A href="/native/commands/catch#catch"><code>EMIT</code></A> is the mirror and carries
            what the clone actually put on the wire.
          </p>
        </Card>
      </div>

      <div id="clearing" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="A transform is PC-owned session state" />
          <div class="api-response-label">CLEARS ON</div>
          <pre class="diagram">{`remove      a TRANSFORM with state = 0 and the entry's (source, dest)
clear       state 0 with both classes 0xFF and both ids 0xFFFF, a blanket
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away
re-clone    the box binds a device again`}</pre>
          <p>
            Any valid frame resets the silence timer, so a keepalive holds the table open. The host
            library re-asserts the whole table after a device-side blip and across a control-link
            reconnect, exactly as it does a{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>.
          </p>
          <div class="api-response-label">WHAT A CLEAR RELEASES</div>
          <p>
            The <A href="/native/commands/transform#cross">cross-class holds</A> go before the
            entries do, so no key or media usage is left down once the entry that drove it is gone.
            Removing one entry releases only what that entry was holding.
          </p>
          <p>
            <A href="/native/commands/admin#reset"><code>RESET</code></A>, a detach and a link drop
            take the table through the same release, alongside{' '}
            <A href="/native/injection#safety">injection and locks</A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Transform;
