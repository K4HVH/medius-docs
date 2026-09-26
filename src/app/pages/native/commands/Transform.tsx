import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transform: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transform" subtitle="Swap or remap a field on the wire" />
        <p>
          <A href="/native/commands/transform#transform"><code>TRANSFORM</code></A> moves one
          declared field into another, clamped to the destination's declared range, so the clone
          emits only values the real device could. It needs no{' '}
          <A href="/native/commands/option#imperfect">imperfect-clone opt-in</A>, unlike the
          rewrite/raw/patch layer.
        </p>
        <pre class="diagram">{`  parsed report --> LOCK --> [ TRANSFORM ] --> render --> inject --> emit
                                   |
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
          </tbody>
        </table>
        <p>
          To weigh a field, or reverse it, use{' '}
          <A href="/native/commands/lock#scale"><code>LOCK</code></A>, whose percent is signed. An{' '}
          <code>op</code> above <code>1</code> is refused.
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
            overwrites its op. <A href="/native/frame#opcodes">Opcode</A> <code>0x1E</code>.
          </p>
          <pre class="api-signature">TRANSFORM  0x1E  ·  payload 8 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>op</code></td><td><code>u8</code></td><td>operation (<A href="/native/commands/transform">table above</A>)</td></tr>
              <tr><td>1</td><td><code>sclass</code></td><td><code>u8</code></td><td>source class: <code>0</code> button, <code>1</code> key, <code>2</code> media, <code>3</code> axis</td></tr>
              <tr><td>2</td><td><code>sid</code></td><td><code>u16</code></td><td>source id within the class, little-endian</td></tr>
              <tr><td>4</td><td><code>dclass</code></td><td><code>u8</code></td><td>destination class</td></tr>
              <tr><td>5</td><td><code>did</code></td><td><code>u16</code></td><td>destination id, little-endian</td></tr>
              <tr><td>7</td><td><code>state</code></td><td><code>u8</code></td><td><code>1</code> set (add or overwrite), <code>0</code> remove the keyed entry</td></tr>
            </tbody>
          </table>

          <div id="weighing" data-search-target>
            <div class="api-response-label">WITH A SCALE</div>
            <p>
              The <A href="/native/commands/lock#scale">weigh</A> runs first and the transform moves
              what it kept. The rounding remainder is banked once, per axis and sign, by the lock.
            </p>
            <pre class="diagram">{`  LOCK(X, both, -50)      keep half of X, reversed
  TRANSFORM(swap, X, Y)   and put what is left on Y

  physical X = +10  ->  weighed -5  ->  emitted on Y`}</pre>
          </div>

          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td><code>op</code> above <code>1</code></td><td>only remap and swap exist</td></tr>
              <tr><td>a <A href="/native/commands/transform#pairs">class pair</A> the op doesn't admit</td><td>each op names the shapes it can read and write</td></tr>
              <tr><td>source and destination are the same field</td><td>a move needs two; to weigh a field in place, use the <A href="/native/commands/lock#scale">lock</A></td></tr>
              <tr><td>a field the clone doesn't declare</td><td>the box stores no unreachable address; re-send after a re-clone</td></tr>
              <tr><td>table already at 32 entries</td><td>nothing is evicted; the readback's full flag marks the refusal</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            An entry applies from the device's next report. The box walks the table in install order,
            so a swap installed after a remap exchanges what the remap wrote.
          </p>
          <p>
            No reply: a refused entry is absent from{' '}
            <A href="/native/commands/requests#transforms"><code>RESP(TRANSFORMS)</code></A>, which
            also carries the full flag. The <code>TRANSFORM_ON</code>{' '}
            <A href="/native/commands/requests#health">health</A> bit follows the table.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Swap X and Y: <code>op = 1</code>, source <code>(axis 3, id 0)</code>, dest{' '}
            <code>(axis 3, id 1)</code>, <code>state = 1</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 00     | 08 00  | 01     | 03     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+
| 00 00  | 03     | 01 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+
| sid    | dclass | did    | state  | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
          <p>
            The wheel drives vertical motion: <code>op = 0</code> (remap), source{' '}
            <code>(axis 3, id 2)</code>, dest <code>(axis 3, id 1)</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 01     | 08 00  | 00     | 03     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+
| 02 00  | 03     | 01 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+
| sid    | dclass | did    | state  | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/transform#transform"><code>transform</code></A>,{' '}
            <A href="/library/transform#helpers"><code>transform_swap</code></A>, and{' '}
            <A href="/library/transform#helpers"><code>transform_remap</code></A>.
          </p>
        </Card>
      </div>

      <div id="pairs" data-search-target>
        <Card>
          <CardHeader title="Field pairs" subtitle="Source and destination per op" />
          <p>Each op admits a fixed set of shapes; anything else is refused.</p>
          <pre class="diagram">{`  swap    axis a    <--------->  axis b      two axes
  remap   axis a    ---------->  axis b      one report, source zeroed
          button i  ---------->  button j    one report, source bit cleared
          button i  ---------->  key         the keyboard collection
          button i  ---------->  media       the consumer collection

  every pair is two different fields`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Behaviour</th></tr>
            </thead>
            <tbody>
              <tr><td><code>swap</code></td><td>Reads both axes, then writes both; two remaps would leave the pair equal.</td></tr>
              <tr><td><code>remap</code></td><td>Adds the source to the destination's value, then zeroes the source. A button destination is OR'd the press instead, and the source bit cleared.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="cross" data-search-target>
        <Card>
          <CardHeader title="Button to key or media" subtitle="The one remap that crosses collections" />
          <p>
            A button source can drive a keyboard or Consumer destination, emitted through that
            collection's interface as <A href="/native/commands/inject#key"><code>INJECT</code></A>{' '}
            emits one.
          </p>
          <div class="api-response-label">HELD, NOT LATCHED</div>
          <pre class="diagram">{`  physical button    ____----------________-----____
  key on the clone   ____----------________-----____

  driven from the button mask the device just reported,
  re-read every report, with no edge latch to strand`}</pre>
          <p>
            Following the level, a configuration switch, missed release, or briefly unbound
            destination resolves on the next report, never leaving a key held with nothing pressed.
          </p>
          <div class="api-response-label">EVERY MOUSE COLLECTION</div>
          <p>
            Buttons may span two mouse collections. The destination is held while any collection the
            box reports on has that button down; a collection not declaring the id holds nothing.
          </p>
          <div class="api-response-label">INERT WHEN UNBOUND</div>
          <p>
            An entry naming an unbound destination collection is refused. One whose collection goes
            away with a configuration switch turns inert and leaves its source uncleared, so the
            button keeps reaching the game PC until that collection binds again.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Side button 3 drives the <code>a</code> key: <code>op = 0</code> (remap), source{' '}
            <code>(button 0, id 3)</code>, dest <code>(key 1, id 0x04)</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1E     | 02     | 08 00  | 00     | 00     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | sclass |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+--------+
| 03 00  | 01     | 04 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+
| sid    | dclass | did    | state  | CRC16  |
+--------+--------+--------+--------+--------+`}</pre>
          <p>
            The keycode is a <A href="/native/commands/usage#keycodes">HID keyboard usage</A>; a
            media destination takes a 16-bit{' '}
            <A href="/native/commands/usage#consumer">Consumer usage</A>.
          </p>
        </Card>
      </div>

      <div id="order" data-search-target>
        <Card>
          <CardHeader title="Pipeline order" subtitle="Locks, rendering, injection" />
          <p>
            The weigh runs first and the field pass moves what it left; everything downstream reads
            the field where the table put it.
          </p>
          <pre class="diagram">{`  physical report
       |
       +-- 1  LOCK        weighs each field on its own sign and bearing
       |
       +-- 2  TRANSFORM   moves the weighed fields, in table order
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
              <tr><td><A href="/native/commands/lock"><code>LOCK</code></A></td><td>the physical field</td><td>a lock applies on the sign the device reported, not where the value ends up, so a swap never moves a lock with it</td></tr>
              <tr><td><A href="/native/commands/option#render">rendering</A></td><td>the transformed, weighed cursor delta</td><td>the model gets the numbers the wire would have carried, so a scale changes what it renders, not what it corrects</td></tr>
              <tr><td><A href="/native/injection">injection</A></td><td>nothing the table wrote</td><td>injected motion drains into the axis after the pass, so a remap that zeroed that axis doesn't remove it</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CATCH</div>
          <p>
            <A href="/native/commands/catch#catch"><code>CATCH</code></A> input classes tap the
            physical report before either pass, so they report the value the device sent;{' '}
            <code>EMIT</code> carries what the clone put on the wire.
          </p>
        </Card>
      </div>

      <div id="clearing" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="PC-owned session state" />
          <div class="api-response-label">CLEARS ON</div>
          <pre class="diagram">{`remove      a TRANSFORM with state = 0 and the entry's (source, dest)
clear       state 0 with both classes 0xFF and both ids 0xFFFF, a blanket
silence     ~1 s with no control-PC frame
RESET       a RESET command
link loss   the inter-chip link drops
detach      the real device goes away
re-clone    the box binds a device again`}</pre>
          <p>
            Any valid frame resets the silence timer, so a keepalive keeps the table. The library
            re-asserts the whole table after a device-side blip and across a control-link reconnect,
            as for <A href="/native/commands/lock"><code>LOCK</code></A>.
          </p>
          <p>Every clear here but remove and clear moves the <A href="/native/commands/requests#stats"><code>session</code></A> count.</p>
          <div class="api-response-label">RELEASE</div>
          <p>
            <A href="/native/commands/transform#cross">Cross-class holds</A> release before their
            entries go, so no key or media usage stays down after its entry. Removing one entry
            releases only its own holds.
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
