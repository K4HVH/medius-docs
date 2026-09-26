import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transfer: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Control transfers" subtitle="Control requests to the real device" />
        <p>
          <code>transfer</code> runs one USB control transfer on the real device behind the host chip
          and returns the reply as a{' '}
          <A href="/library/types/structs#transfer-outcome"><code>TransferOutcome</code></A>.
        </p>
        <p>
          It crosses the inter-chip link on its own messages, one at a time, past every{' '}
          <A href="/library/advanced/rewrite">rewrite rule</A>, and waits in the host chip's{' '}
          <A href="/native/commands/transfer#proxy">control queue</A> beside the game PC's requests.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN---->  reads report
  relayed     <--OUT---  [ HID_OUT ]<-- relay <--------------- interrupt-OUT <--  writes report

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  class, vendor requests
                  ^
                  +-- transfer(ep, setup)   <== own messages, past every rule`}</pre>
        <div class="callout callout--warning">
          <p>
            The advanced control layer needs{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>;
            with it off, the box replies <code>Refused</code> without reaching the device.
          </p>
        </div>
      </Card>

      <div id="transfer" data-search-target>
        <Card>
          <CardHeader title="transfer" subtitle="One control transfer, blocking on the reply" />
          <pre class="api-signature">fn transfer(&self, ep: u8, setup: Setup, out: &[u8]) -&gt; Result&lt;TransferOutcome&gt;</pre>
          <pre class="api-signature">fn transfer_timeout(&self, ep: u8, setup: Setup, out: &[u8], timeout: Duration) -&gt; Result&lt;TransferOutcome&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <table class="api-params">
            <thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>ep</code></td><td><code>u8</code></td><td><code>0</code> for EP0, or a control endpoint number the device declares.</td></tr>
              <tr><td><code>setup</code></td><td><A href="/library/types/structs#setup"><code>Setup</code></A></td><td>Eight-byte setup packet.</td></tr>
              <tr><td><code>out</code></td><td><code>&amp;[u8]</code></td><td>OUT data stage, sent after the setup packet. Empty for an IN transfer.</td></tr>
            </tbody>
          </table>
          <p>
            <code>Ok(_)</code> means the box replied; a{' '}
            <A href="/library/types/enums#transfer-status"><code>TransferStatus</code></A> other than{' '}
            <code>Ok</code> comes back inside the{' '}
            <A href="/library/types/structs#transfer-outcome"><code>TransferOutcome</code></A>, not as
            an error.
          </p>
          <div class="callout callout--info">
            <p>
              <code>transfer</code> uses <code>DEFAULT_TRANSFER_TIMEOUT</code> (1.5&nbsp;s). The box gives
              up after its ~800&nbsp;ms window; keep <code>transfer_timeout</code> at or above that.
            </p>
          </div>
          <div class="callout callout--warning">
            <p>
              A <code>SET_CONFIGURATION</code> or <code>SET_INTERFACE</code> sent here changes only the
              real device. The clone and the endpoints the host chip polls stay where the game PC set
              them.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Setup, TransferStatus};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

let reply = device.transfer(0, Setup::new(0x80, 0x06, 0x0100, 0x0000, 18), &[])?;
if reply.status == TransferStatus::Ok {
    println!("device descriptor: {:02x?}", reply.data());
}`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="transfer awaits the device's reply" />
          <p>
            On <A href="/library/features/async"><code>AsyncDevice</code></A>, <code>transfer</code>{' '}
            and <code>transfer_timeout</code> are futures, awaited like any query.
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
        </Card>
      </div>
    </>
  );
};

export default Transfer;
