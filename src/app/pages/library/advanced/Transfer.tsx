import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Transfer: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Control transfers" subtitle="Run a control request against the real device, read its answer" />
        <p>
          <code>transfer</code> runs one USB control transfer against the real device on the host chip
          and returns its answer as a{' '}
          <A href="/library/types/structs#transfer-outcome"><code>TransferOutcome</code></A>.
        </p>
        <p>
          It rides its own inter-chip link pair, not the game PC's EP0 proxy, and is single-outstanding.
          Read a descriptor, string, or vendor value straight from the device.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
  relayed     <--OUT---  [ HID_OUT ]<-- relay <---------------- interrupt-OUT <--  writes report

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*
                             ^
                             +-- transfer(ep, setup)   <== your own control request, its own link pair`}</pre>
        <div class="callout callout--warning">
          <p>
            The advanced control layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, the box answers <code>Refused</code> rather than reaching the device.
          </p>
        </div>
      </Card>

      <div id="transfer" data-search-target>
        <Card>
          <CardHeader title="transfer" subtitle="One control transfer, blocking on the answer" />
          <pre class="api-signature">fn transfer(&self, ep: u8, setup: Setup, out: &[u8]) -&gt; Result&lt;TransferOutcome&gt;</pre>
          <pre class="api-signature">fn transfer_timeout(&self, ep: u8, setup: Setup, out: &[u8], timeout: Duration) -&gt; Result&lt;TransferOutcome&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <table class="api-params">
            <thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>ep</code></td><td><code>u8</code></td><td><code>0</code> for EP0, or a control endpoint number the device declares.</td></tr>
              <tr><td><code>setup</code></td><td><A href="/library/types/structs#setup"><code>Setup</code></A></td><td>The eight-byte setup packet.</td></tr>
              <tr><td><code>out</code></td><td><code>&amp;[u8]</code></td><td>The OUT data stage: the bytes carried after the setup packet. Empty for an IN transfer.</td></tr>
            </tbody>
          </table>
          <p>
            <code>Ok(_)</code> means the box answered at all: a{' '}
            <A href="/library/types/enums#transfer-status"><code>TransferStatus</code></A> other than{' '}
            <code>Ok</code> comes back inside the{' '}
            <A href="/library/types/structs#transfer-outcome"><code>TransferOutcome</code></A>, not as
            an error.
          </p>
          <div class="callout callout--info">
            <p>
              <code>transfer</code> uses <code>DEFAULT_TRANSFER_TIMEOUT</code> (1.5&nbsp;s). The box gives
              up after its own ~800&nbsp;ms window; keep <code>transfer_timeout</code> at or above that.
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
          <CardHeader title="On AsyncDevice" subtitle="transfer awaits the device's answer" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> makes <code>transfer</code>{' '}
            and <code>transfer_timeout</code> futures, awaited like any query, since each waits for the
            device's answer.
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
