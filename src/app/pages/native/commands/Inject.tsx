import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Inject: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Inject" subtitle="Press and release any input" />
        <p>
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> sets a momentary input on
          top of physical input: a mouse <A href="/native/commands/inject#button">button</A>, a
          keyboard <A href="/native/commands/inject#key">key</A> or modifier, or a{' '}
          <A href="/native/commands/inject#media">media</A> key, tagged by a <code>class</code> byte.
        </p>
        <p>
          The continuous axes (cursor and wheel) use{' '}
          <A href="/native/commands/move#move"><code>MOVE</code></A>.
        </p>
      </Card>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="INJECT" subtitle="Momentary-usage override" />
          <p>
            <code>INJECT</code> sets a per-usage <A href="/native/injection#state">override</A>, a held
            level layered over physical input.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x03</code>.
          </p>
          <pre class="api-signature">INJECT  0x03  ·  payload 4 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>class</code></td><td><code>u8</code></td><td>0=button 1=key 2=media (the input kind)</td></tr>
              <tr><td>1</td><td><code>id</code></td><td><code>u16</code></td><td>usage within the class, little-endian (see below)</td></tr>
              <tr><td>3</td><td><code>action</code></td><td><code>u8</code></td><td>0=soft-release 1=press 2=force-release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CLASSES</div>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Value</th><th><code>id</code> is</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/commands/inject#button">button</A></td><td><code>0</code></td><td>a semantic <A href="/native/commands/usage#buttons">button id</A> (0=Left .. 4=Side2, then numeric to the declared count)</td></tr>
              <tr><td><A href="/native/commands/inject#key">key</A></td><td><code>1</code></td><td>a <A href="/native/commands/usage#keycodes">HID keyboard usage</A> (0xE0-0xE7 = modifier)</td></tr>
              <tr><td><A href="/native/commands/inject#media">media</A></td><td><code>2</code></td><td>a 16-bit <A href="/native/commands/usage#consumer">Consumer usage</A></td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr><th>Action</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>press</td><td><code>1</code></td><td>Force the usage active regardless of physical state.</td></tr>
              <tr><td>soft-release</td><td><code>0</code></td><td>Drop the override (press or force-release); a physical hold stays active.</td></tr>
              <tr><td>force-release</td><td><code>2</code></td><td>Force the usage inactive, masking a physical hold too; used by the <A href="/native/injection#safety">safety auto-clear</A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EMITTED STATE</div>
          <p>The releases differ only while the same input is physically held:</p>
          <table class="api-params">
            <thead>
              <tr><th>Action</th><th>Not held</th><th>Held</th></tr>
            </thead>
            <tbody>
              <tr><td><code>press</code></td><td>active</td><td>active</td></tr>
              <tr><td><code>soft-release</code></td><td>inactive</td><td>active (physical bit passes)</td></tr>
              <tr><td><code>force-release</code></td><td>inactive</td><td>inactive (masks physical)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">RULES</div>
          <pre class="diagram">{`additive   layers over physical input at the same merge point as
           MOVE; never evicts native input
no click   no firmware click or chord; send a press, then a
           client-timed soft-release
RESET      releases every override at once`}</pre>
          <div class="callout callout--warning">
            <p>
              A usage the cloned device can't report reaches no report field; check{' '}
              <A href="/native/commands/requests#caps"><code>CAPS</code></A> first.
            </p>
          </div>
          <p>Library binding: <A href="/library/inject#inject"><code>inject</code></A>.</p>
        </Card>
      </div>

      <div id="button" data-search-target>
        <Card>
          <CardHeader title="class = button" subtitle="Mouse button override" />
          <p>
            With <code>class = 0</code>, <code>id</code> is a semantic{' '}
            <A href="/native/commands/usage#buttons">button id</A>: 0=Left, 1=Right, 2=Middle,
            3=Side1, 4=Side2, then numeric ids up to the{' '}
            <A href="/native/commands/requests#caps"><code>CAPS</code></A> count. The five named are
            bound at clone time to the mouse's buttons; the override sets that button's bit in the
            emitted report.
          </p>
          <p>
            Injecting a declared but unwired button is descriptor-faithful: the box drives the full
            declared button count. An id past that count reaches no report field, like an unmapped
            key.
          </p>
          <p>
            Library bindings:{' '}
            <A href="/library/inject#inject"><code>inject</code> / <code>press</code> / <code>release</code> / <code>force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press Left: <code>class</code> <code>0x00</code>, <code>id</code> <code>0x0000</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 03     | 00     | 04 00  | 00     | 00 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="class = key" subtitle="Keyboard key and modifier override" />
          <p>
            With <code>class = 1</code>, <code>id</code> is a{' '}
            <A href="/native/commands/usage#keycodes">HID keyboard usage</A>.{' '}
            <code>0xE0</code>-<code>0xE7</code> fold into the modifier byte; anything else fills a
            keycode slot (or sets its NKRO bit) in the emitted report.
          </p>
          <p>
            Physical keys keep their slots, so injection never evicts native typing; past the
            board's rollover limit it emits <code>ErrorRollOver</code>, as the board does. A keycode
            the cloned board can't report is a no-op. Library bindings:{' '}
            <A href="/library/inject#inject"><code>inject</code> / <code>press</code> / <code>release</code> / <code>force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press <code>A</code>: <code>class</code> <code>0x01</code>, <code>id</code> <code>0x0004</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 03     | 00     | 04 00  | 01     | 04 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="media" data-search-target>
        <Card>
          <CardHeader title="class = media" subtitle="Media key override" />
          <p>
            With <code>class = 2</code>, <code>id</code> is a 16-bit{' '}
            <A href="/native/commands/usage#consumer">Consumer usage</A> (e.g. 0xCD Play/Pause, 0xE9
            Volume Up), merged onto the cloned keyboard's Consumer report.
          </p>
          <p>
            A no-op unless the board declares a Consumer collection (the{' '}
            <A href="/native/commands/requests#caps"><code>CAPS</code></A> <code>CONSUMER</code>{' '}
            flag). Library bindings:{' '}
            <A href="/library/inject#inject"><code>inject</code> / <code>press</code> / <code>release</code> / <code>force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press Volume Up: <code>class</code> <code>0x02</code>, <code>id</code> <code>0x00E9</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 03     | 00     | 04 00  | 02     | E9 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | class  | id     | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Inject;
