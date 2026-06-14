import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Buttons: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Buttons" subtitle="Press and release" />
        <p>
          <A href="/native/commands/buttons#button"><code>BUTTON</code></A> presses or releases a
          mouse button without touching the real mouse, on top of whatever the user is physically
          doing.
        </p>
      </Card>

      <div id="button" data-search-target>
        <Card>
          <CardHeader title="BUTTON" subtitle="Button overrides" />
          <p>
            <code>BUTTON</code> sets a per-button <A href="/native/injection#state">override</A>, the
            box's own held decision layered over the physical mouse.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x03</code>.
          </p>
          <pre class="api-signature">BUTTON  0x03  ·  payload 2 bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>id</code></td><td><code>u8</code></td><td>0=Left 1=Right 2=Middle 3=Side1 4=Side2</td></tr>
              <tr><td>1</td><td><code>action</code></td><td><code>u8</code></td><td>0=soft-release 1=press 2=force-release</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ACTIONS</div>
          <table class="api-params">
            <thead>
              <tr><th>Action</th><th>Value</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>press</td><td><code>1</code></td><td>Force the button down regardless of physical state.</td></tr>
              <tr><td>soft-release</td><td><code>0</code></td><td>Clear our injected press only; a physical hold stays pressed.</td></tr>
              <tr><td>force-release</td><td><code>2</code></td><td>Force the button up, masking a physical press too. The release the <A href="/native/injection#safety">safety auto-clear</A> uses.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The override sets the button's bit in the report the PC sees, merged at the same point as{' '}
            <A href="/native/commands/movement#move"><code>MOVE</code></A>. <code>id</code> is bound at
            clone time to the real mouse's buttons, so a command for a button it lacks is a no-op.
            There is no firmware click: compose a <code>press</code> then a client-timed{' '}
            <code>soft-release</code>. <A href="/native/commands/admin#reset"><code>RESET</code></A>{' '}
            releases every override. Library bindings:{' '}
            <A href="/library/buttons#methods"><code>press</code> / <code>soft_release</code> / <code>force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Press Left — <code>id</code> <code>0x00</code>, <code>action</code> <code>0x01</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 03     | 00     | 02 00  | 00     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | id     | action | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Buttons;
