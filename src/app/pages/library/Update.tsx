import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Update: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Firmware update" subtitle="Replace either chip's firmware over the open connection" />
        <p>
          Four calls write new firmware to a box that is already running Medius. Nothing reboots into
          ROM download and no second port is involved. The wire is{' '}
          <A href="/native/commands/update"><code>UPDATE</code></A>.
        </p>
        <pre class="diagram">{`  stage_firmware(Host, ..)   --> host image into the host chip's spare slot
  stage_firmware(Device, ..) --> device image into the device chip's spare slot
  activate_firmware()        --> commit both, host chip reboots first`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>Call</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><A href="/library/update#firmware_info"><code>firmware_info</code></A></td><td>Read both chips' versions and slots</td></tr>
            <tr><td><A href="/library/update#stage_firmware"><code>stage_firmware</code></A></td><td>Write one image into a chip's spare slot</td></tr>
            <tr><td><A href="/library/update#activate_firmware"><code>activate_firmware</code></A></td><td>Commit everything staged and boot it</td></tr>
            <tr><td><A href="/library/update#abort_update"><code>abort_update</code></A></td><td>Throw a transfer away</td></tr>
          </tbody>
        </table>
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

      <div id="firmware_info" data-search-target>
        <Card>
          <CardHeader title="firmware_info" subtitle="What each chip is running" />
          <pre class="api-signature">fn firmware_info(&self) -&gt; Result&lt;FirmwareInfo&gt;</pre>
          <div class="api-response-label">RETURNS</div>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>device</code></td><td><code>ChipFirmware</code></td><td>version, slot, and image state</td></tr>
              <tr><td><code>host</code></td><td><code>Option&lt;ChipFirmware&gt;</code></td><td><code>None</code> when the host chip has not answered over the inter-chip link</td></tr>
              <tr><td><code>slot_size</code></td><td><code>u32</code></td><td>usable bytes in a spare slot, the same on both chips</td></tr>
              <tr><td><code>device_staged</code></td><td><code>bool</code></td><td>an image is written and waiting to be activated</td></tr>
              <tr><td><code>host_staged</code></td><td><code>bool</code></td><td>the same, for the host chip</td></tr>
            </tbody>
          </table>
          <p>
            This is the only call that reports the host chip's version.{' '}
            <A href="/library/requests#query_version"><code>query_version</code></A> reports the device
            chip alone.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let fw = device.firmware_info()?;
println!("device {}", fw.device);
match fw.host {
    Some(h) => println!("host {h}"),
    None => println!("host chip not answering"),
}`}</code></pre>
        </Card>
      </div>

      <div id="stage_firmware" data-search-target>
        <Card>
          <CardHeader title="stage_firmware" subtitle="Write an image, without booting it" />
          <pre class="api-signature">fn stage_firmware(&self, target: UpdateTarget, image: &[u8], progress: &mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;u32&gt;</pre>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><code>UpdateTarget</code></td><td><code>Device</code> or <code>Host</code></td></tr>
              <tr><td><code>image</code></td><td><code>&amp;[u8]</code></td><td>the whole <code>.bin</code>; larger than <code>slot_size</code> is refused before a byte is sent</td></tr>
              <tr><td><code>progress</code></td><td><code>&amp;mut dyn FnMut</code></td><td>called once per acknowledged window</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Blocks for the transfer, a few seconds per chip. The clone disconnects from the game PC for
            the duration and comes back afterwards.
          </p>
          <div class="callout callout--info">
            A staged image is inert. Nothing boots it until{' '}
            <A href="/library/update#activate_firmware"><code>activate_firmware</code></A>, so a power
            cut in between brings the running firmware back.
          </div>
          <p>
            Waits for both chips to confirm the image they booted before it starts, because a chip on
            probation refuses to open another update.
          </p>
        </Card>
      </div>

      <div id="activate_firmware" data-search-target>
        <Card>
          <CardHeader title="activate_firmware" subtitle="Commit and boot" />
          <pre class="api-signature">fn activate_firmware(&self) -&gt; Result&lt;()&gt;</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            Commits every staged image and reboots into it, host chip first, then reconnects. Takes
            tens of seconds if the host chip is involved.
          </p>
          <p>
            A chip that boots an image which cannot run is reverted by the bootloader without anyone
            asking, so a bad image costs a reboot rather than a box. See{' '}
            <A href="/native/commands/update#rollback">rollback</A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.activate_firmware()?;
let fw = device.firmware_info()?;
println!("now on ota_{} ({})", fw.device.slot, fw.device.state);`}</code></pre>
        </Card>
      </div>

      <div id="abort_update" data-search-target>
        <Card>
          <CardHeader title="abort_update" subtitle="Throw the transfer away" />
          <pre class="api-signature">fn abort_update(&self, target: UpdateTarget) -&gt; Result&lt;()&gt;</pre>
          <p>
            Drops whatever is staged or in flight for one target. The clone comes back without a
            reboot, and the running slot is untouched.
          </p>
          <p>
            A session left alone times out on the box after ten seconds, so this is a courtesy rather
            than a requirement.
          </p>
        </Card>
      </div>

      <div id="update_firmware" data-search-target>
        <Card>
          <CardHeader title="update_firmware" subtitle="Stage one image and activate it" />
          <pre class="api-signature">fn update_firmware(&self, target: UpdateTarget, image: &[u8], progress: &mut dyn FnMut(UpdateProgress)) -&gt; Result&lt;()&gt;</pre>
          <p>
            <A href="/library/update#stage_firmware"><code>stage_firmware</code></A> followed by{' '}
            <A href="/library/update#activate_firmware"><code>activate_firmware</code></A>, for the
            one-chip case. Use the two calls separately to update both chips together.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, UpdateTarget};

let device = Device::find()?;
let image = std::fs::read("medius_device.bin")?;
device.update_firmware(UpdateTarget::Device, &image, &mut |p| {
    print!("\\r{}%", p.percent());
})?;`}</code></pre>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Failures" subtitle="What a refusal means" />
          <p>
            Every refusal arrives as <code>Error::Update</code> carrying the op, the status, and that
            status's argument. The full status list is on the{' '}
            <A href="/native/commands/update#resp">native page</A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Status</th><th>What to do</th></tr>
            </thead>
            <tbody>
              <tr><td><code>NO_SLOT</code></td><td>The box is on the single-app layout; it needs one flash over ROM download first</td></tr>
              <tr><td><code>TOO_BIG</code></td><td>The image does not fit; <code>arg</code> is the slot size</td></tr>
              <tr><td><code>ON_PROBATION</code></td><td>A chip has not confirmed its image yet; wait a few seconds</td></tr>
              <tr><td><code>UNTOUCHED</code></td><td>Refused before the slot was touched, so an image already staged survives</td></tr>
              <tr><td><code>LINK_DOWN</code></td><td>The host chip was addressed and the inter-chip link is down</td></tr>
              <tr><td><code>BAD_SHA</code></td><td>The image arrived corrupted; retry</td></tr>
              <tr><td><code>NOTHING_STAGED</code></td><td><code>activate_firmware</code> with nothing to commit</td></tr>
            </tbody>
          </table>
          <p>
            Nothing here leaves the box worse off: a failure before activation leaves both chips on the
            firmware they were running.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Update;
