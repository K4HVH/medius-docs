import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Admin: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Admin" subtitle="Reset, erase the store, and reboot a chip" />
        <p>
          Box-maintenance calls: <A href="/library/admin#reboot"><code>reboot</code></A> restarts one
          of the two chips, <A href="/library/admin#factory-reset"><code>factory_reset</code></A> erases
          what the box keeps across a reboot, and{' '}
          <A href="/library/admin#reset"><code>reset</code></A> drops the box back to{' '}
          <A href="/native/injection">passthrough</A>. All three are{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: send one frame, no reply.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;   // first box on the system, handshake done
device.reset()?;                // back to passthrough`}</code></pre>
        <p>
          Related calls{' '}
          <A href="/library/lifecycle#reapply"><code>reapply</code></A> and{' '}
          <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> are on the{' '}
          <A href="/library/lifecycle">Lifecycle</A> page.
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
                <td>Zeroed. This is the box's running total of injected motion and scroll not yet emitted to the PC.</td>
              </tr>
              <tr>
                <td>Box overrides</td>
                <td>All released. An <A href="/library/inject">override</A> is a per-usage decision to hold an input down or up.</td>
              </tr>
              <tr>
                <td>Library held-state</td>
                <td>Cleared. The library forgets which overrides it was holding, so a later <A href="/library/lifecycle#reapply"><code>reapply</code></A> or <A href="/library/lifecycle#reconnect"><code>reconnect</code></A> re-asserts nothing.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame and clears
            the library's held state.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Button;

device.move_rel(40, 0)?;        // nudge the cursor 40 right
device.press(Button::LEFT)?;    // hold left down
device.release(Button::LEFT)?;  // let it back up

device.reset()?;                // drop all of the above, back to passthrough`}</code></pre>
        </Card>
      </div>

      <div id="factory-reset" data-search-target>
        <Card>
          <CardHeader title="factory_reset" subtitle="Clear all injection, then erase the box's store and reboot" />
          <pre class="api-signature">fn factory_reset(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Everything <A href="/library/admin#reset"><code>reset</code></A> releases, and then the
            box erases what it keeps across a reboot and restarts.
          </p>

          <div class="api-response-label">WHAT IT ERASES</div>
          <table class="api-params">
            <thead>
              <tr><th>Stored</th><th>After</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Box name</td>
                <td>The MAC-derived default, as <A href="/library/options#set-name"><code>set_name</code></A> found it on a new box.</td>
              </tr>
              <tr>
                <td><A href="/library/options">Options</A></td>
                <td>All seven back at their defaults, the imperfect-clone opt-in included.</td>
              </tr>
              <tr>
                <td>Learned per-device data</td>
                <td>Gone for every device the box has seen, including any <A href="/library/advanced/patch"><code>patch</code></A> set.</td>
              </tr>
            </tbody>
          </table>

          <p>
            Sends one <A href="/native/commands/admin#reset"><code>RESET</code></A> frame carrying its
            NVS flag. The clone re-enumerates on the game PC. The control port stays enumerated
            while the box reboots, so queries time out until it answers again rather than the link
            dropping; poll one to know it is back.
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
            <A href="/library/types/enums#reboot-target"><code>RebootTarget</code></A> picks the chip and whether it
            comes back running its firmware or in download mode; the four variants and their bytes are
            on <A href="/library/types/enums">Types</A>. See the native{' '}
            <A href="/native/commands/admin#reboot"><code>REBOOT</code></A> command for the wire layout.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::RebootTarget;

device.reboot(RebootTarget::DeviceRun)?;   // restart the chip you're talking to`}</code></pre>

          <div class="callout callout--warning">
            <p>
              A <code>Download</code> variant leaves the chip in ROM download mode: it stops presenting the clone and stops replying on the control link until reflashed or power-cycled. Don't send one unless
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
          <p>
            A box that already runs Medius takes firmware over the open connection with the{' '}
            <A href="/library/update">update</A> calls, so a <code>Download</code> reboot is only for
            a first install or a chip whose app will not boot.
          </p>
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
