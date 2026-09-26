import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Admin: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Admin" subtitle="Reset, store erase, chip reboot" />
        <p>
          <A href="/library/admin#reboot"><code>reboot</code></A> restarts one of the two chips,{' '}
          <A href="/library/admin#factory-reset"><code>factory_reset</code></A> erases what the box keeps
          across a reboot, and <A href="/library/admin#reset"><code>reset</code></A> returns the box to{' '}
          <A href="/native/injection">passthrough</A>. All three are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;   // first box on the system, handshake done
device.reset()?;                // back to passthrough`}</code></pre>
        <p>
          <A href="/library/lifecycle#reapply"><code>reapply</code></A> and{' '}
          <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> are on{' '}
          <A href="/library/lifecycle">Lifecycle</A>.
        </p>
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
                <td>Zeroed: the running total of injected motion and scroll not yet emitted to the PC.</td>
              </tr>
              <tr>
                <td>Box overrides</td>
                <td>All released. An <A href="/library/inject">override</A> holds one usage down or up.</td>
              </tr>
              <tr>
                <td>Library held-state</td>
                <td>Cleared, so a later <A href="/library/lifecycle#reapply"><code>reapply</code></A> or <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> re-asserts nothing, and the <A href="/library/lifecycle#restart">session release</A> the box counts for it restores nothing.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Button;

device.move_rel(40, 0)?;        // 40 right
device.press(Button::LEFT)?;    // hold left down
device.release(Button::LEFT)?;  // release it

device.reset()?;                // drop all of the above, back to passthrough`}</code></pre>
        </Card>
      </div>

      <div id="factory-reset" data-search-target>
        <Card>
          <CardHeader title="factory_reset" subtitle="Reset, erase the store, reboot" />
          <pre class="api-signature">fn factory_reset(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Does what <A href="/library/admin#reset"><code>reset</code></A> does, then erases what the
            box keeps across a reboot and restarts it.
          </p>

          <div class="api-response-label">ERASED</div>
          <table class="api-params">
            <thead>
              <tr><th>Stored</th><th>After</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Box name</td>
                <td>The MAC-derived default, as on a new box (<A href="/library/options#set-name"><code>set_name</code></A>).</td>
              </tr>
              <tr>
                <td><A href="/library/options">Options</A></td>
                <td>All seven at their defaults, imperfect-clone opt-in included.</td>
              </tr>
              <tr>
                <td>Learned per-device data</td>
                <td>Gone for every device the box has seen, <A href="/library/advanced/patch"><code>patch</code></A> sets included.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame with its NVS
            flag. The clone re-enumerates on the game PC. The control port stays enumerated through the
            reboot, so the link stays up and queries time out until the box replies; poll one to know it
            is back.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.factory_reset()?;        // back to a box that has learned nothing`}</code></pre>
        </Card>
      </div>

      <div id="reboot" data-search-target>
        <Card>
          <CardHeader title="reboot" subtitle="Restart or download-mode one of the two chips" />
          <pre class="api-signature">fn reboot(&self, target: RebootTarget) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/enums#reboot-target"><code>RebootTarget</code></A> picks the chip and
            whether it comes back running firmware or in download mode; its four variants and bytes are on{' '}
            <A href="/library/types/enums">Types</A>, the wire layout on the native{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> command.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::RebootTarget;

device.reboot(RebootTarget::DeviceRun)?;   // restart the device chip`}</code></pre>

          <div class="callout callout--warning">
            <p>
              A <code>Download</code> variant leaves the chip in ROM download mode, presenting no clone
              and not replying on the control link until reflashed or power-cycled. Send one only to
              flash.
            </p>
          </div>

          <div class="callout callout--info">
            <p>
              A rebooted device chip sends the box's hello, and the library re-sends what it holds once
              the clone is back (<A href="/library/lifecycle#restart">session recovery</A>). A link that
              drops meanwhile returns through the reader thread's auto-reconnect, or{' '}
              <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> forces it.
            </p>
          </div>
          <p>
            A box already running Medius takes firmware over the open connection through the{' '}
            <A href="/library/update">update</A> calls; a <code>Download</code> reboot is only for a
            first install or a chip whose app will not boot.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Still fire-and-forget, no await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> re-exposes{' '}
            <code>reset</code> and <code>reboot</code> unchanged: no reply, so no <code>.await</code> and
            no{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>.
            Only queries are async.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, RebootTarget};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.reset()?;                          // sync, no await
device.reboot(RebootTarget::HostRun)?;    // sync, no await`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Admin;
