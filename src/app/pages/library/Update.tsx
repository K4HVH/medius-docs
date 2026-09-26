import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Update: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Update" subtitle="Either chip's firmware, over the open connection" />
        <p>
          <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> writes an image and{' '}
          <A href="/library/update#activate-firmware"><code>activate_firmware</code></A> commits it;{' '}
          <A href="/library/update#update-firmware"><code>update_firmware</code></A> does both for one
          chip, and <A href="/library/update#abort-update"><code>abort_update</code></A> discards a
          transfer. No ROM download reboot, no second port; the wire is{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A>.
        </p>
        <div class="callout callout--info">
          <p>
            These calls need a box the library can open. A box it refuses, such as a 3.4.1 box on
            protocol 8 (<A href="/library/types/errors"><code>Error::BadProtoVer</code></A>), is updated
            from the dashboard's <A href="/dashboard/update">Update page</A>.
          </p>
        </div>
        <table class="api-params">
          <thead>
            <tr><th>Update a...</th><th>Write</th><th>Write and commit</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>single chip</td>
              <td><A href="/library/update#stage-firmware"><code>stage_firmware</code></A></td>
              <td><A href="/library/update#update-firmware"><code>update_firmware</code></A></td>
            </tr>
            <tr>
              <td>both chips</td>
              <td><A href="/library/update#stage-firmware"><code>stage_firmware</code></A> twice</td>
              <td>then <A href="/library/update#activate-firmware"><code>activate_firmware</code></A> once</td>
            </tr>
          </tbody>
        </table>
        <pre class="diagram">{`  stage_firmware(Host, ..)   --> host image into the host chip's spare slot
  stage_firmware(Device, ..) --> device image into the device chip's spare slot
  activate_firmware()        --> commit both, host chip reboots first`}</pre>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, UpdateTarget};

let device = Device::find()?;
let host = std::fs::read("medius_host.bin")?;
let dev = std::fs::read("medius_device.bin")?;

// The host chip first: its image travels through the device chip.
device.stage_firmware(UpdateTarget::Host, &host, &mut |p| {
    println!("host {}%", p.percent());
})?;
device.stage_firmware(UpdateTarget::Device, &dev, &mut |p| {
    println!("device {}%", p.percent());
})?;
device.activate_firmware()?;`}</code></pre>
      </Card>

      <div id="stage-firmware" data-search-target>
        <Card>
          <CardHeader title="stage_firmware" subtitle="Write an image to a chip's spare slot" />
          <pre class="api-signature">fn stage_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Blocks for the whole transfer, a few seconds per chip, while the clone is disconnected from
            the game PC. A chip on probation refuses another update, so this waits for both to confirm
            their booted image, else returns{' '}
            <A href="/library/types/errors"><code>Error::Update</code></A> with{' '}
            <code>ON_PROBATION</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>Which chip to write: <code>Device</code> or <code>Host</code>.</td></tr>
              <tr><td><code>image</code></td><td><code>&amp;[u8]</code></td><td>The whole <code>.bin</code>. Larger than <code>slot_size</code> is refused with <code>TOO_BIG</code> before a byte is sent.</td></tr>
              <tr><td><code>progress</code></td><td><code>&amp;mut dyn FnMut(</code><A href="/library/types/structs#update-progress"><code>UpdateProgress</code></A><code>)</code></td><td>Called once per acknowledged window, not once per chunk.</td></tr>
            </tbody>
          </table>
          <p>
            Returns the bytes the box wrote. A box on the single-app layout replies{' '}
            <code>NO_SLOT</code> and needs one <A href="/native/flashing">ROM download</A> flash first.
          </p>
          <div class="callout callout--info">
            <p>
              A staged image is inert until{' '}
              <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>; a power cut
              in between boots the running firmware.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, UpdateTarget};

let device = Device::find()?;
let image = std::fs::read("medius_device.bin")?;

let written = device.stage_firmware(UpdateTarget::Device, &image, &mut |p| {
    print!("\\r{}%", p.percent());          // one call per acknowledged window
})?;
println!("\\nstaged {written} bytes, not yet booted");`}</code></pre>
        </Card>
      </div>

      <div id="activate-firmware" data-search-target>
        <Card>
          <CardHeader title="activate_firmware" subtitle="Commit every staged image and boot into it" />
          <pre class="api-signature">fn activate_firmware(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Commits every staged image and reboots into it, host chip first, then reconnects: tens of
            seconds when the host chip is involved. With nothing staged, returns{' '}
            <A href="/library/types/errors"><code>Error::Update</code></A> with{' '}
            <code>NOTHING_STAGED</code>.
          </p>
          <p>
            The bootloader reverts a chip whose image cannot run, so a bad image costs a reboot (
            <A href="/native/commands/update#rollback">rollback</A>).
          </p>
          <div class="callout callout--warning">
            <p>
              A refusal at the host chip leaves the device image staged and armed; the next call would
              commit it alone, putting the chips on different versions. Retry the whole update, or{' '}
              <A href="/library/update#abort-update"><code>abort_update</code></A> each staged target
              first.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.activate_firmware()?;
let fw = device.firmware_info()?;
println!("now on ota_{} ({})", fw.device.slot, fw.device.state);`}</code></pre>
        </Card>
      </div>

      <div id="abort-update" data-search-target>
        <Card>
          <CardHeader title="abort_update" subtitle="Discard a staged or in-flight transfer" />
          <pre class="api-signature">fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Drops what is staged or in flight for one target. The clone returns without a reboot; the
            running slot is untouched. An abandoned session times out on the box after ten seconds.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>Which chip to clear: <code>Device</code> or <code>Host</code>.</td></tr>
            </tbody>
          </table>
          <p>
            Sent while an <A href="/native/commands/update#activate">activate</A> is waiting on the
            host chip, it abandons that wait and disarms both chips whichever target it names.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::UpdateTarget;

if let Err(e) = device.activate_firmware() {
    device.abort_update(UpdateTarget::Host)?;    // disarm what the refusal left behind
    device.abort_update(UpdateTarget::Device)?;
    return Err(e);
}`}</code></pre>
        </Card>
      </div>

      <div id="update-firmware" data-search-target>
        <Card>
          <CardHeader title="update_firmware" subtitle="Stage and activate one image" />
          <pre class="api-signature">fn update_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> then{' '}
            <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>, for one chip;
            both chips together need the two calls separately. If the activate refuses, the staged image
            is cleared before the error returns.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>Which chip to write: <code>Device</code> or <code>Host</code>.</td></tr>
              <tr><td><code>image</code></td><td><code>&amp;[u8]</code></td><td>The whole <code>.bin</code>.</td></tr>
              <tr><td><code>progress</code></td><td><code>&amp;mut dyn FnMut(</code><A href="/library/types/structs#update-progress"><code>UpdateProgress</code></A><code>)</code></td><td>Called once per acknowledged window.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, UpdateTarget};

let device = Device::find()?;
let image = std::fs::read("medius_device.bin")?;
device.update_firmware(UpdateTarget::Device, &image, &mut |p| {
    print!("\\r{}%", p.percent());
})?;`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="The same calls, awaitable" />
          <pre class="api-signature">async fn stage_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
          <pre class="api-signature">async fn activate_firmware(&self) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">async fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">async fn update_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <pre><code class="language-bash">cargo add medius --features async</code></pre>
          <p>
            Each runs the synchronous transfer on its own thread and resolves when it finishes, keeping
            the crate runtime-agnostic. Dropping the future does not stop a transfer the box has begun.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{Device, UpdateTarget};

let device = Device::find()?.into_async();
let image = std::fs::read("medius_device.bin")?;
block_on(device.update_firmware(UpdateTarget::Device, &image, &mut |_| {}))?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Update;
