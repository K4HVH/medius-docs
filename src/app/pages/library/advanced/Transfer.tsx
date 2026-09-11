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
          <A href="/library/advanced/transfer#outcome"><code>TransferOutcome</code></A>.
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

      <div id="setup" data-search-target>
        <Card>
          <CardHeader title="Setup" subtitle="The eight-byte USB setup packet" />
          <p>
            A <code>Setup</code> is the <a href="https://www.usb.org/document-library/usb-20-specification" target="_blank" rel="noreferrer">USB §9.3</a>{' '}
            setup packet: <code>bmRequestType</code>, <code>bRequest</code>, <code>wValue</code>,{' '}
            <code>wIndex</code>, <code>wLength</code>, little-endian on the wire.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>request_type</code></td><td><code>u8</code></td><td><code>bmRequestType</code>: direction in bit 7 (set is device-to-host / IN), then type and recipient.</td></tr>
              <tr><td><code>request</code></td><td><code>u8</code></td><td><code>bRequest</code>: the request code.</td></tr>
              <tr><td><code>value</code></td><td><code>u16</code></td><td><code>wValue</code>: request-specific.</td></tr>
              <tr><td><code>index</code></td><td><code>u16</code></td><td><code>wIndex</code>: request-specific, often an interface or endpoint.</td></tr>
              <tr><td><code>length</code></td><td><code>u16</code></td><td><code>wLength</code>: the data-stage length. For an IN request, how many bytes to read back (the device may return fewer); for an OUT request, the length of the data you pass.</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`  byte   0            1          2   3         4   5         6   7
        +------------+----------+---------+---------+---------+
        |request_type| request  |  value  |  index  | length  |
        | bmRequest  | bRequest  | wValue  | wIndex  | wLength |
        +------------+----------+---------+---------+---------+
                                  <-- LE -> <-- LE -> <-- LE ->`}</pre>
          <p>
            <code>Setup::new</code> builds one from its five fields; <code>is_in</code> reads the
            direction bit; <code>to_bytes</code> gives the eight wire bytes (<code>&lt;BBHHH&gt;</code>,
            little-endian).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Setup;

// GET_DESCRIPTOR(Device): standard device-to-host request for the 18-byte device descriptor.
let setup = Setup::new(0x80, 0x06, 0x0100, 0x0000, 18);
assert!(setup.is_in());
assert_eq!(setup.to_bytes(), [0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);`}</code></pre>
        </Card>
      </div>

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
              <tr><td><code>setup</code></td><td><A href="/library/advanced/transfer#setup"><code>Setup</code></A></td><td>The eight-byte setup packet.</td></tr>
              <tr><td><code>out</code></td><td><code>&amp;[u8]</code></td><td>The OUT data stage: the bytes carried after the setup packet. Empty for an IN transfer.</td></tr>
            </tbody>
          </table>
          <p>
            <code>Ok(_)</code> means the box answered at all; a status other than{' '}
            <A href="/library/advanced/transfer#status"><code>Ok</code></A> comes back in the outcome,
            not as an error.
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

      <div id="outcome" data-search-target>
        <Card>
          <CardHeader title="TransferOutcome" subtitle="The device's answer: status and any IN data" />
          <p>
            What the device answered. A non-<code>Ok</code>{' '}
            <A href="/library/advanced/transfer#status"><code>status</code></A> carries no data.
          </p>
          <table class="api-params">
            <thead><tr><th>Member</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>status</code></td><td><A href="/library/advanced/transfer#status"><code>TransferStatus</code></A></td><td>How the transfer ended.</td></tr>
              <tr><td><code>data</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The IN data the device returned. Empty for an OUT transfer, a STALL, or no data.</td></tr>
              <tr><td><code>is_ok()</code></td><td><code>bool</code></td><td>Whether the transfer completed.</td></tr>
              <tr><td><code>data()</code></td><td><code>&amp;[u8]</code></td><td>The returned data.</td></tr>
              <tr><td><code>ok_data()</code></td><td><code>Option&lt;Vec&lt;u8&gt;&gt;</code></td><td>The data if the transfer completed, else <code>None</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="status" data-search-target>
        <Card>
          <CardHeader title="TransferStatus" subtitle="How a transfer ended" />
          <p>
            The <code>status</code> byte. The codes sit at the top of the byte range so they never
            collide with a length; an unknown byte is carried through as <code>Other(u8)</code>.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Status</th><th>Byte</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>Ok</code></td><td><code>0x00</code></td><td>The transfer completed; any IN data is in <code>data</code>.</td></tr>
                <tr><td><code>Refused</code></td><td><code>0xFC</code></td><td>The box refused before reaching the device: the opt-in is off, the request was malformed, or the data stage was larger than one control frame carries.</td></tr>
                <tr><td><code>Stall</code></td><td><code>0xFD</code></td><td>The device STALLed the request.</td></tr>
                <tr><td><code>Nak</code></td><td><code>0xFE</code></td><td>The device NAKed to a timeout, or never answered.</td></tr>
                <tr><td><code>NoDevice</code></td><td><code>0xFF</code></td><td>No device is attached on the host chip.</td></tr>
                <tr><td><code>Other(u8)</code></td><td>any other</td><td>A status byte this build does not name.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              <code>Refused</code> is the box turning the request away; <code>Stall</code> and{' '}
              <code>Nak</code> are the device answering. The difference says whether the request reached
              the device.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::TransferStatus;

match reply.status {
    TransferStatus::Ok => println!("{} bytes", reply.data().len()),
    TransferStatus::Stall => println!("device rejected the request"),
    TransferStatus::NoDevice => println!("nothing attached on the host chip"),
    TransferStatus::Refused => println!("box refused it: opt-in off, malformed, or too large"),
    other => println!("other status: {other:?}"),
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
