import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Imperfect: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Imperfect" subtitle="Clone a device the box can't fully fit" />
        <p>
          Some devices need more interrupt-IN endpoints than the box has. The box can't clone every
          interface, so by default it <em>refuses</em> the device rather than present a clone with a
          dead interface. <A href="/native/commands/imperfect#imperfect"><code>IMPERFECT</code></A>{' '}
          opts into cloning it anyway: the rest stays byte-faithful, the over-capacity interface goes
          silently dead. It's <A href="/native/injection#fire-and-forget">fire-and-forget</A>.
        </p>
      </Card>

      <div id="imperfect" data-search-target>
        <Card>
          <CardHeader title="IMPERFECT" subtitle="Opt into an imperfect clone" />
          <p>
            <code>IMPERFECT</code> sends one byte: <code>1</code> opts in, <code>0</code> is
            faithful-only (the default). <A href="/native/frame#opcodes">Opcode</A> <code>0x11</code>.
          </p>
          <pre class="api-signature">IMPERFECT  0x11  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>allow</code></td><td><code>u8</code></td><td><code>1</code> = clone an over-capacity device anyway, <code>0</code> = faithful-only (default)</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">OVER-CAPACITY</div>
          <p>
            A device is over-capacity when one interface needs an interrupt-IN endpoint the box can't
            service. The box can clone the rest, but not that interface. Faithful-only refuses the whole
            device, so the game PC never sees a detectably-broken clone. The opt-in clones it anyway,
            with that one interface dead.
          </p>
          <div class="api-response-label">EFFECT</div>
          <p>
            The setting is persisted on the box and takes effect on the next clone, so re-plug the
            device or reboot the box for a change to apply.{' '}
            <A href="/native/commands/requests#imperfect"><code>QUERY(IMPERFECT)</code></A> reads the
            opt-in plus whether the attached device is over-capacity and whether the live clone is
            imperfect. Library binding:{' '}
            <A href="/library/imperfect#set-imperfect-allowed"><code>set_imperfect_allowed</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Opt in (<code>allow = 1</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 11     | 00     | 01 00  | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | allow  | CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>
    </>
  );
};

export default Imperfect;
