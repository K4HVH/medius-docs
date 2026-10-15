import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Update: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> writes an image and{' '}
          <A href="/library/update#activate-firmware"><code>activate_firmware</code></A> commits it.{' '}
          <A href="/library/update#update-firmware"><code>update_firmware</code></A> does both for one
          chip. <A href="/library/update#abort-update"><code>abort_update</code></A> discards a
          transfer, and{' '}
          <A href="/library/update#wait-firmware-confirmed"><code>wait_firmware_confirmed</code></A>{' '}
          waits out probation. All run over the open control link as{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A> frames, with no ROM download reboot.
        </p>
        <div class="callout callout--info">
          <p>
            These calls need a box the library can open. A box it refuses, such as a 3.4.1 box on
            protocol 8 (<A href="/library/types/errors"><code>Error::BadProtoVer</code></A>), is updated
            from the dashboard's <A href="/dashboard/update">Update page</A>.
          </p>
        </div>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Target</th><th>Write</th><th>Write and commit</th></tr>
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
        </div>
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
      </PageHeader>

      <DocSection id="stage-firmware" title="stage_firmware" caption="Write an image to a chip's spare slot">
        <pre class="api-signature">fn stage_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Blocks for the whole transfer (a few seconds per chip). The clone is disconnected from the
          game PC meanwhile. A chip on probation refuses another update, so this first waits for both
          chips to confirm their booted image. If they don't, it returns{' '}
          <A href="/library/types/errors"><code>Error::Update</code></A> with{' '}
          <code>ON_PROBATION</code>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>Which chip to write: <code>Device</code> or <code>Host</code>.</td></tr>
              <tr><td><code>image</code></td><td><code>&amp;[u8]</code></td><td>The whole <code>.bin</code>. An image larger than <code>slot_size</code> is refused with <code>TOO_BIG</code> before any byte is sent.</td></tr>
              <tr><td><code>progress</code></td><td><code>&amp;mut dyn FnMut(</code><A href="/library/types/structs#update-progress"><code>UpdateProgress</code></A><code>)</code></td><td>Called once per acknowledged window, not once per chunk.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Returns the bytes the box wrote. A box on the single-app layout replies{' '}
          <code>NO_SLOT</code> and needs one <A href="/native/flashing">ROM download</A> flash first.
        </p>
        <div class="callout callout--info">
          <p>
            A staged image is inert until{' '}
            <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>. A power cut
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
      </DocSection>

      <DocSection id="activate-firmware" title="activate_firmware" caption="Commit every staged image and boot into it">
        <pre class="api-signature">fn activate_firmware(&self) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Commits every staged image, reboots into it (host chip first), then reconnects. This takes
          tens of seconds when the host chip is involved. With nothing staged, it returns{' '}
          <A href="/library/types/errors"><code>Error::Update</code></A> with{' '}
          <code>NOTHING_STAGED</code>.
        </p>
        <p>
          The bootloader reverts a chip whose image cannot run, so a bad image costs a reboot (
          <A href="/native/commands/update#rollback">rollback</A>).
        </p>
        <div class="callout callout--warning">
          <p>
            If the host chip refuses, the device image stays staged and armed. The next call would
            commit it alone and leave the chips on different versions. Retry the whole update, or{' '}
            <A href="/library/update#abort-update"><code>abort_update</code></A> each staged target
            first.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`device.activate_firmware()?;
let fw = device.firmware_info()?;
println!("now on ota_{} ({})", fw.device.slot, fw.device.state);`}</code></pre>
      </DocSection>

      <DocSection id="abort-update" title="abort_update" caption="Discard a staged or in-flight transfer">
        <pre class="api-signature">fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          Drops what is staged or in flight for one target. The clone returns without a reboot, and
          the running slot is untouched. An abandoned session times out on the box after 10&nbsp;s.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#update-target"><code>UpdateTarget</code></A></td><td>Which chip to clear: <code>Device</code> or <code>Host</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          If an <A href="/native/commands/update#activate">activate</A> is waiting on the host chip,{' '}
          <code>abort_update</code> abandons that wait and disarms both chips, whichever target it
          names.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::UpdateTarget;

if let Err(e) = device.activate_firmware() {
    device.abort_update(UpdateTarget::Host)?;    // disarm what the refusal left behind
    device.abort_update(UpdateTarget::Device)?;
    return Err(e);
}`}</code></pre>
      </DocSection>

      <DocSection id="update-firmware" title="update_firmware" caption="Stage and activate one image">
        <pre class="api-signature">fn update_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          <A href="/library/update#stage-firmware"><code>stage_firmware</code></A> then{' '}
          <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>, for one chip.
          To update both chips together, call the two separately. If the activate refuses, the staged image
          is cleared before the error returns.
        </p>
        <div class="table-scroll">
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
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Device, UpdateTarget};

let device = Device::find()?;
let image = std::fs::read("medius_device.bin")?;
device.update_firmware(UpdateTarget::Device, &image, &mut |p| {
    print!("\\r{}%", p.percent());
})?;`}</code></pre>
      </DocSection>

      <DocSection id="wait-firmware-confirmed" title="wait_firmware_confirmed" caption="Block until neither chip is on probation">
        <pre class="api-signature">fn wait_firmware_confirmed(&self) -&gt; Result&lt;FirmwareInfo&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <p>
          A chip on <A href="/native/commands/update#rollback">probation</A> refuses another update,
          so <code>stage_firmware</code> waits on this first. The device chip confirms after 10&nbsp;s
          of running. The host chip confirms on a clock exchange over the inter-chip link. This call
          keeps asking while the box reboots after an activate.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>After 55&nbsp;s</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td>A chip still on probation</td><td><A href="/library/types/errors"><code>Error::Update</code></A>: op 0 (begin), <code>ON_PROBATION</code></td></tr>
              <tr><td>No reply from the box</td><td><A href="/library/types/errors"><code>Error::QueryTimeout</code></A></td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`device.update_firmware(UpdateTarget::Device, &image, &mut |_| {})?;
let fw = device.wait_firmware_confirmed()?;
println!("now on ota_{} ({})", fw.device.slot, fw.device.state);`}</code></pre>
      </DocSection>

      <DocSection id="async" title="On AsyncDevice" caption="Same calls, awaitable">
        <pre class="api-signature">async fn stage_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
        <pre class="api-signature">async fn activate_firmware(&self) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">async fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">async fn update_firmware(&self, target: UpdateTarget, image: &amp;[u8], progress: &amp;mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
        <pre class="api-signature">async fn wait_firmware_confirmed(&self) -&gt; Result&lt;FirmwareInfo&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <pre><code class="language-bash">cargo add medius --features async</code></pre>
        <p>
          Each runs the synchronous transfer on a separate thread and resolves when it finishes, so
          the crate stays runtime-agnostic. Dropping the future doesn't stop a transfer the box has
          begun.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{Device, UpdateTarget};

let device = Device::find()?.into_async();
let image = std::fs::read("medius_device.bin")?;
block_on(device.update_firmware(UpdateTarget::Device, &image, &mut |_| {}))?;`}</code></pre>
      </DocSection>
    </>
  );
};

export default Update;
