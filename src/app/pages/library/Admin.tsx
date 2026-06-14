import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Admin: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Admin" subtitle="Reset injection, reboot a chip" />
        <p>
          <A href="/library/admin#reset"><code>reset</code></A> wipes everything your program has
          injected. <A href="/library/admin#reboot"><code>reboot</code></A> restarts one of the box's
          two chips. Both are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: the call
          sends one frame and returns; the box sends nothing back.
        </p>
      </Card>

      <div id="reset" data-search-target>
        <Card>
          <CardHeader title="reset" subtitle="Clear all injection" />
          <pre class="api-signature">fn reset(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>What reset does</th></tr>
            </thead>
            <tbody>
              <tr><td>Accumulator</td><td>Zeroed. This is the box's running total of injected motion and scroll not yet emitted to the PC.</td></tr>
              <tr><td>Overrides</td><td>All released. An override is a per-button decision to hold a button down or up.</td></tr>
            </tbody>
          </table>
          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame, returning the
            box to pure <A href="/native/injection">passthrough</A> (the real mouse flowing to the PC
            untouched, with nothing of yours added). Afterward the box behaves as if your program had
            injected nothing.
          </p>
          <pre><code>{`device.reset()?;`}</code></pre>
        </Card>
      </div>

      <div id="reboot" data-search-target>
        <Card>
          <CardHeader title="reboot" subtitle="Restart or flash-mode a chip" />
          <pre class="api-signature">fn reboot(&self, target: RebootTarget) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Sends one <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> frame. The box has
            two chips: the device chip (the one your program talks to over serial) and the host chip
            (the one facing the PC as the cloned mouse).{' '}
            <A href="/library/types#enums"><code>RebootTarget</code></A> picks which chip restarts and
            whether it runs firmware or enters flashing mode:
          </p>
          <div class="api-response-label">TARGETS</div>
          <table class="api-params">
            <thead>
              <tr><th>Variant</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>DeviceDownload</code></td><td>Restart the device chip into flashing mode, ready to take new firmware over the serial link.</td></tr>
              <tr><td><code>HostDownload</code></td><td>Restart the host chip into flashing mode, ready to take new firmware over its own USB.</td></tr>
              <tr><td><code>DeviceRun</code></td><td>Restart the device chip and run its firmware normally.</td></tr>
              <tr><td><code>HostRun</code></td><td>Restart the host chip and run its firmware normally.</td></tr>
            </tbody>
          </table>
          <p>
            The <code>Download</code> variants only enter flashing mode; they don't move any bytes. To
            write firmware, use the <A href="/library/features/flash"><code>flash</code></A> feature,
            which hands off to <code>esptool</code>. See also <A href="/native/flashing">Flashing</A>.
          </p>
          <pre><code>{`device.reboot(RebootTarget::DeviceRun)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Admin;
