import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Admin: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Admin" subtitle="Reboot a chip and return to passthrough" />
        <p>
          Box-maintenance calls: <A href="/library/admin#reboot"><code>reboot</code></A> restarts one
          of the two chips, <A href="/library/admin#reset"><code>reset</code></A> drops the box back to{' '}
          <A href="/native/injection">passthrough</A>. Both are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: send one frame, no reply.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code>{`use medius::Device;

let device = Device::find()?;   // first box on the system, handshake done
device.reset()?;                // back to passthrough`}</code></pre>
        <p>
          <A href="/library/connection#open"><code>find</code></A> opens the first box; related calls{' '}
          <A href="/library/lifecycle#reapply"><code>reapply</code></A> and{' '}
          <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> are on the{' '}
          <A href="/library/lifecycle">Lifecycle</A> page.
        </p>
        <p>See also: the <A href="/library/examples#admin">worked example</A>.</p>
      </Card>

      <div id="reset" data-search-target>
        <Card>
          <CardHeader title="reset" subtitle="Clear all injection, return to passthrough" />
          <pre class="api-signature">fn reset(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>

          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>What reset does</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Box accumulator</td>
                <td>Zeroed. This is the box's running total of injected motion and scroll not yet emitted to the PC.</td>
              </tr>
              <tr>
                <td>Box overrides</td>
                <td>All released. An <A href="/library/buttons">override</A> is a per-button decision to hold a button down or up.</td>
              </tr>
              <tr>
                <td>Library held-state</td>
                <td>Cleared. The library forgets which overrides it was holding, so a later <A href="/library/lifecycle#reapply"><code>reapply</code></A> or <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> re-asserts nothing.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame and clears
            the library's held state. Afterward the box behaves as if nothing was injected.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

device.move_rel(40, 0)?;        // nudge the cursor 40 right
device.press(Button::Left)?;    // hold left down
device.soft_release(Button::Left)?;

device.reset()?;                // drop all of the above, back to passthrough`}</code></pre>
        </Card>
      </div>

      <div id="reboot" data-search-target>
        <Card>
          <CardHeader title="reboot" subtitle="Restart or download-mode one of the two chips" />
          <pre class="api-signature">fn reboot(&self, target: RebootTarget) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/enums#reboot-target"><code>RebootTarget</code></A> picks the chip and whether it
            comes back running its firmware or in download mode; the four variants and their bytes are
            on <A href="/library/types/enums">Types</A>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::RebootTarget;

device.reboot(RebootTarget::DeviceRun)?;   // restart the chip you're talking to`}</code></pre>

          <div class="callout callout--warning">
            <p>
              A <code>Download</code> variant leaves the chip in ROM download mode: it stops acting
              as a mouse and stops answering until reflashed or power-cycled. Don't send one unless
              you're about to flash.
            </p>
          </div>

          <div class="callout callout--info">
            <p>
              Rebooting the device chip drops the serial link, so the call can return <code>Ok</code>{' '}
              as the connection goes away. The reader thread auto-reconnects, or force it with{' '}
              <A href="/library/lifecycle#reconnect"><code>reconnect</code></A>.
            </p>
          </div>
        <p>The <A href="/library/features/flash">flash</A> feature issues the download reboot for you, so you rarely send a <code>Download</code> variant by hand.</p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Still fire-and-forget, no await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> re-exposes{' '}
            <code>reset</code> and <code>reboot</code> unchanged: they expect no reply, so no{' '}
            <code>.await</code> and no{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>.
            Only the queries are async.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{AsyncDevice, RebootTarget};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.reset()?;                          // sync, no await
device.reboot(RebootTarget::HostRun)?;    // sync, no await`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Admin;
