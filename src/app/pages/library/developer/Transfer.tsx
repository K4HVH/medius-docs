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
          and returns the device's actual answer. You give it the endpoint, the eight-byte{' '}
          <A href="/library/developer/transfer#setup"><code>Setup</code></A> packet, and any OUT data;
          you get back a <A href="/library/developer/transfer#outcome"><code>TransferOutcome</code></A>{' '}
          carrying the status and any IN data the device returned.
        </p>
        <p>
          It rides its own inter-chip link pair, never the game PC's EP0 proxy, so a request here never
          disturbs what the PC sees on the clone. It is single-outstanding: issue one and wait for the
          reply. This is how you read a descriptor, string, or vendor value straight from the device
          the box is cloning.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
  relayed     <--OUT---  [ HID_OUT ]<-- relay <---------------- interrupt-OUT <--  writes report

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*
                             ^
                             +-- transfer(ep, setup)   <== your own control request, its own link pair`}</pre>
        <div class="callout callout--warning">
          <p>
            The developer layer is gated on the imperfect-clone opt-in. With{' '}
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
          <div class="api-response-label">RUST</div>
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
              <tr><td><code>setup</code></td><td><A href="/library/developer/transfer#setup"><code>Setup</code></A></td><td>The eight-byte setup packet.</td></tr>
              <tr><td><code>out</code></td><td><code>&amp;[u8]</code></td><td>The OUT data stage: the bytes carried after the setup packet. Empty for an IN transfer.</td></tr>
            </tbody>
          </table>
          <p>
            The <code>Ok(_)</code> of the returned <code>Result</code> means the box answered at all. A
            status other than <A href="/library/developer/transfer#status"><code>Ok</code></A> is a real
            protocol result, so it comes back in the outcome rather than as an error.
          </p>
          <div class="callout callout--info">
            <p>
              <code>transfer</code> uses <code>DEFAULT_TRANSFER_TIMEOUT</code> (1.5&nbsp;s), longer than a
              box-local query because a control transfer to a real device can be slower. The box gives up
              after its own ~800&nbsp;ms window; keep <code>transfer_timeout</code> at or above that so a
              short deadline never abandons the wait before a slow device answers.
            </p>
          </div>
          <div class="api-response-label">RUST</div>
          <pre><code class="language-rust">{`use medius::{Device, Setup, TransferStatus};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;

let reply = device.transfer(0, Setup::new(0x80, 0x06, 0x0100, 0x0000, 18), &[])?;
if reply.status == TransferStatus::Ok {
    println!("device descriptor: {:02x?}", reply.data());
}`}</code></pre>
          <div class="api-response-label">C</div>
          <pre><code class="language-c">{`MediusDevice *dev = medius_device_find();
medius_device_allow_imperfect_clones(dev, true);

MediusSetup setup = { 0x80, 0x06, 0x0100, 0x0000, 18 };  // GET_DESCRIPTOR(Device)
MediusTransferOutcome reply;
medius_device_transfer(dev, 0, setup, NULL, 0, &reply);
if (reply.status == MEDIUS_TRANSFER_STATUS_OK) {
    // reply.data[0 .. reply.len] holds the 18 descriptor bytes
}`}</code></pre>
          <div class="api-response-label">PYTHON</div>
          <pre><code class="language-python">{`import medius
from medius import Setup, TransferStatus

device = medius.Device.find()
device.allow_imperfect_clones(True)

reply = device.transfer(0, Setup(0x80, 0x06, 0x0100, 0x0000, 18))  # GET_DESCRIPTOR(Device)
if reply.status == TransferStatus.OK:
    print("device descriptor:", reply.data.hex())`}</code></pre>
        </Card>
      </div>

      <div id="outcome" data-search-target>
        <Card>
          <CardHeader title="TransferOutcome" subtitle="The device's answer: status and any IN data" />
          <p>
            A <code>TransferOutcome</code> is what the device answered. A{' '}
            <A href="/library/developer/transfer#status"><code>TransferStatus</code></A> other than{' '}
            <code>Ok</code> is a real protocol outcome, not a link error, so it is returned rather than
            raised. A non-<code>Ok</code> answer carries no data.
          </p>
          <table class="api-params">
            <thead><tr><th>Member</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>status</code></td><td><A href="/library/developer/transfer#status"><code>TransferStatus</code></A></td><td>How the transfer ended.</td></tr>
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
            The <code>status</code> byte of the answer. The codes sit at the top of the byte range so
            they never collide with a real length; a byte no variant names is carried through as{' '}
            <code>Other(u8)</code>, so a newer box's value is not lost.
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
                <tr><td><code>Other(u8)</code></td><td>&mdash;</td><td>A status byte this build does not name.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              <code>Refused</code> is the box turning the request away; <code>Stall</code> and{' '}
              <code>Nak</code> are the device's own answers. The difference tells you whether the request
              reached the device at all.
            </p>
          </div>
          <div class="api-response-label">RUST</div>
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
    </>
  );
};

export default Transfer;
