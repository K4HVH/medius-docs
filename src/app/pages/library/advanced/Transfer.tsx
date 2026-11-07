import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../../shell/PageHeader';
import { DocSection } from '../../../shell/DocSection';

const Transfer: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          <code>transfer</code> runs one USB control transfer on the real device and returns a{' '}
          <A href="/library/types/structs#transfer-outcome"><code>TransferOutcome</code></A>: how it
          ended, the stage it ended in, and the native reply at any length.
        </p>
        <p>
          It bypasses every <A href="/library/advanced/rewrite">rewrite rule</A>, and the game PC's
          requests on the same endpoint <A href="/native/commands/transfer#proxy">come first</A>.
        </p>
        <pre class="diagram">{`  real device            the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN---->  reads report
  relayed     <--OUT---  [ HID_OUT ]<-- relay <--------------- interrupt-OUT <--  writes report

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  class, vendor requests
                  ^
                  +-- transfer(ep, setup, out)   <== TRANSFER, outside every rule`}</pre>
        <div class="callout callout--warning">
          <p>
            The advanced control layer needs{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>.
            With it off, the box replies <code>Refused</code> and never reaches the real device.
          </p>
        </div>
      </PageHeader>

      <DocSection id="transfer" title="transfer" caption="One control transfer, blocking on the reply">
        <pre class="api-signature">fn transfer(&self, ep: u8, setup: Setup, out: &[u8]) -&gt; Result&lt;TransferOutcome&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <pre class="api-signature">fn transfer_timeout(&self, ep: u8, setup: Setup, out: &[u8], timeout: Duration) -&gt; Result&lt;TransferOutcome&gt;</pre>
        <p><span class="api-badge api-badge--responded">Blocks</span></p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>ep</code></td><td><code>u8</code></td><td><code>0</code> for EP0, or a control endpoint number the real device declares.</td></tr>
              <tr><td><code>setup</code></td><td><A href="/library/types/structs#setup"><code>Setup</code></A></td><td>Eight-byte setup packet.</td></tr>
              <tr><td><code>out</code></td><td><code>&amp;[u8]</code></td><td>OUT data stage: <code>setup.length</code> bytes for an OUT request, empty for an IN one. ≤501 bytes (<code>TRANSFER_OUT_MAX</code>).</td></tr>
              <tr><td><code>timeout</code></td><td><code>Duration</code></td><td><code>transfer_timeout</code> only. How long the box waits on the real device, the time the game PC holds the pipe included: 1 ms to 65535 ms, in whole milliseconds. <code>transfer</code> passes <code>DEFAULT_TRANSFER_TIMEOUT</code> (1 s).</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <code>Ok(_)</code> means the box replied. A{' '}
          <A href="/library/types/enums#transfer-status"><code>TransferStatus</code></A> other than{' '}
          <code>Ok</code> comes back inside the <code>TransferOutcome</code>, not as an error.
        </p>
        <div class="api-response-label">ERRORS</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>When</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>out</code> isn't <code>setup.length</code> bytes for an OUT request, or isn't empty for an IN one</td><td><A href="/library/types/errors#errors"><code>Error::TransferData</code></A>, nothing sent</td></tr>
              <tr><td><code>out</code> is over 501 bytes</td><td><code>Error::FrameTooLong</code>, nothing sent</td></tr>
              <tr><td><code>timeout</code> is under 1 ms or over 65535 ms</td><td><code>Error::TransferTimeoutRange</code>, nothing sent</td></tr>
              <tr><td>no last chunk within <code>timeout</code> + 2 s</td><td><code>Error::QueryTimeout</code></td></tr>
              <tr><td>a chunk lost between the box's chips or on the control link</td><td><code>Error::TransferReplyIncomplete</code></td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--warning">
          <p>
            A <code>SET_CONFIGURATION</code> or <code>SET_INTERFACE</code> sent here changes only the
            real device. The clone and the endpoints the host chip polls stay where the game PC set
            them.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use std::time::Duration;
use medius::{Device, Setup, TransferStatus};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

// GET_DESCRIPTOR(Device): the 18-byte device descriptor.
let get_device = Setup::new(0x80, 0x06, 0x0100, 0x0000, 18);
let reply = device.transfer(0, get_device, &[])?;
if reply.status == TransferStatus::Ok {
    println!("device descriptor: {:02x?}", reply.data());
}

// The same request, with 10 s for a slow real device to answer.
let reply = device.transfer_timeout(0, get_device, &[], Duration::from_secs(10))?;`}</code></pre>
      </DocSection>

      <DocSection id="reply" title="Reply" caption="Chunks, waits, and the outcome">
        <p>
          The box sends the reply a <A href="/native/commands/transfer#transfer-resp">chunk</A> a
          frame, ≤448 bytes each, and the call returns on the last, whose status and{' '}
          <A href="/library/types/enums#transfer-stage">stage</A> are the outcome. A <A href="/library/features/mock#transfer"><code>MockBox</code></A> sends a
          scripted reply the same way.
        </p>
        <pre class="diagram">{`  transfer(0, Setup::new(0x80, 0x06, 0x0200, 0, 0xFFFF), &[])    a 1000-byte reply

  TRANSFER_RESP     offset   data
  chunk 1                0   448 bytes  --+
  chunk 2              448   448 bytes  --+-->  TransferOutcome { status: Ok, stage: Status,
  chunk 3, LAST        896   104 bytes  --+                       data: 1000 bytes }`}</pre>
        <div class="api-response-label">TIMING</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Item</th><th>Detail</th></tr></thead>
            <tbody>
              <tr><td>The box's wait on the real device</td><td><code>timeout</code>, the time the game PC holds the pipe included. The time a long reply waits for its next chunk to be passed on to the control port is not counted, up to 1 s a chunk.</td></tr>
              <tr><td>The box's last chunk</td><td>Within <code>timeout</code> + 0.5 s of the box taking the transfer, plus any time its chunks waited for the control port. A reply whose next chunk waits 1 s to be passed on ends <code>NoAnswer</code> in its data stage, with the data passed on so far.</td></tr>
              <tr><td>The call's wait</td><td><code>timeout</code> + 2 s for the last chunk, then <code>Error::QueryTimeout</code>. Meanwhile the keepalive stops the box's 1 s silence clear from dropping held state.</td></tr>
              <tr><td>Transfers outstanding</td><td>One. Another sent while one waits is <code>Refused</code>, and so is one sent while the real device still runs a transfer whose reply ended at a 1 s chunk wait.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Setup, TransferStage, TransferStatus};

// GET_DESCRIPTOR(Configuration) with wLength 0xFFFF: the whole descriptor, however long.
let reply = device.transfer(0, Setup::new(0x80, 0x06, 0x0200, 0x0000, 0xFFFF), &[])?;
match (reply.status, reply.stage) {
    (TransferStatus::Ok, _) => println!("{} bytes", reply.data().len()),
    (TransferStatus::Stall, TransferStage::Data) => println!("STALL after {} bytes", reply.data().len()),
    (TransferStatus::Busy, _) => println!("the game PC had the pipe"),
    (status, stage) => println!("{status:?} in {stage:?}"),
}`}</code></pre>
      </DocSection>

      <DocSection id="async" title="On AsyncDevice" caption="transfer awaits the last chunk">
        <p>
          On <A href="/library/features/async"><code>AsyncDevice</code></A>, <code>transfer</code>{' '}
          and <code>transfer_timeout</code> are futures, awaited like any query. Dropping one stops the
          wait, not the transfer, and the box refuses another until that one ends.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Setup, TransferStatus};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.allow_imperfect_clones(true)?;
let reply = block_on(device.transfer(0, Setup::new(0x80, 0x06, 0x0100, 0x0000, 18), &[]))?;
if reply.status == TransferStatus::Ok {
    println!("device descriptor: {:02x?}", reply.data());
}`}</code></pre>
      </DocSection>
    </>
  );
};

export default Transfer;
