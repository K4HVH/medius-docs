import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Update: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Update" subtitle="Replace either chip's firmware over the open connection" />
        <p>
          Write a new image with{' '}
          <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> and commit it with{' '}
          <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>;{' '}
          <A href="/library/update#update-firmware"><code>update_firmware</code></A> does both for one
          chip, and <A href="/library/update#abort-update"><code>abort_update</code></A> throws a
          transfer away. Nothing reboots
          into ROM download and no second port is involved; the wire is{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A>.
        </p>
        <table class="api-params">
          <thead>
            <tr><th>Update a...</th><th>Write it</th><th>Write and commit it</th></tr>
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
          <CardHeader title="stage_firmware" subtitle="Write an image into a chip's spare slot, without booting it" />
          <pre class="api-signature">fn stage_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Blocks for the whole transfer, a few seconds per chip; the clone disconnects from the
            game PC for the duration. A chip on probation refuses to open another update, so
            this waits for both to confirm the image they booted and otherwise returns{' '}
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
            Returns the number of bytes the box wrote. A box on the single-app layout answers{' '}
            <code>NO_SLOT</code> and needs one flash over{' '}
            <A href="/native/flashing">ROM download</A> first.
          </p>
          <div class="callout callout--info">
            <p>
              A staged image is inert. Nothing boots it until{' '}
              <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>, so a
              power cut in between brings the running firmware back.
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
            Commits every staged image and reboots into it, host chip first, then reconnects. Takes
            tens of seconds if the host chip is involved. With nothing staged it returns{' '}
            <A href="/library/types/errors"><code>Error::Update</code></A> with{' '}
            <code>NOTHING_STAGED</code>.
          </p>
          <p>
            The bootloader reverts a chip that boots an image which cannot run, so a bad image costs
            a reboot. See{' '}
            <A href="/native/commands/update#rollback">rollback</A>.
          </p>
          <div class="callout callout--warning">
            <p>
              A refusal stops at the host chip and leaves the device image staged and armed, so the
              next call would commit it alone and put the two chips on different versions. Either
              retry the whole update or{' '}
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
          <CardHeader title="abort_update" subtitle="Throw a staged or in-flight transfer away" />
          <pre class="api-signature">fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Drops whatever is staged or in flight for one target. The clone comes back without a
            reboot, and the running slot is untouched. A session left alone times out on the box after
            ten seconds, so this is a courtesy rather than a requirement.
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
          <CardHeader title="update_firmware" subtitle="Stage one image and activate it in a single call" />
          <pre class="api-signature">fn update_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> followed by{' '}
            <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>, for the
            one-chip case. Use the two calls separately to update both chips together. If the activate
            refuses, the staged image is cleared before the error is returned.
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
            Each one runs the synchronous transfer on its own thread and resolves when it finishes, so
            the crate stays runtime-agnostic. They are not cancellable: dropping the future does not
            stop a transfer the box has already begun.
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
