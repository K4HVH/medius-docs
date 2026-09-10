import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Raw: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Raw injection" subtitle="Put a report byte-for-byte on a cloned endpoint" />
        <p>
          <code>raw</code> puts <code>bytes</code> verbatim on one cloned endpoint: an IN endpoint
          (<code>ep &amp; 0x80</code>) emits toward the game PC, an OUT endpoint relays to the real
          device. It carries no semantic model and no merge with native motion.
        </p>
        <p>
          The write is stateless: the next native report overwrites it, and <code>raw</code> bypasses
          the <A href="/library/developer/rewrite">rewrite rules</A>.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
                                                                    ^
                                                                    +-- raw(ep | 0x80)   <== a report toward the PC

  relayed     <--OUT---  [ HID_OUT ]<-- relay <---------------- interrupt-OUT <--  writes report
                         (VEND_INTR / VEND_BULK)                 ^
                                                                 +-- raw(ep)        <== a report toward the device

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*
  enumerate   descriptor patches overwrite what the clone presents`}</pre>
        <div class="callout callout--warning">
          <p>
            The whole developer layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>raw</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A> rather
            than sending a frame the box would drop.
          </p>
        </div>
      </Card>

      <div id="raw" data-search-target>
        <Card>
          <CardHeader title="raw" subtitle="One report on one endpoint, fire-and-forget" />
          <pre class="api-signature">fn raw(&self, ep: u8, bytes: &[u8]) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>ep</code></td><td><code>u8</code></td><td>The cloned endpoint address. Bit 7 is the direction: <code>ep &amp; 0x80</code> is an IN endpoint (toward the game PC), a clear bit 7 is an OUT endpoint (toward the real device). The low nibble is the endpoint number.</td></tr>
              <tr><td><code>bytes</code></td><td><code>&amp;[u8]</code></td><td>The report, on the wire as given. At most one interrupt endpoint's <code>wMaxPacketSize</code>; a bulk endpoint takes up to the developer-frame limit of 512 bytes.</td></tr>
            </tbody>
          </table>
          <p>
            The direction bit decides which way the report goes, so the same call reaches the game PC or
            the device from the address alone.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Address</th><th>Direction</th><th>The bytes land on</th></tr></thead>
              <tbody>
                <tr><td><code>ep &amp; 0x80</code> set (e.g. <code>0x81</code>)</td><td>IN</td><td>The outgoing wire, toward the game PC, as one report from the clone.</td></tr>
                <tr><td><code>ep &amp; 0x80</code> clear (e.g. <code>0x01</code>)</td><td>OUT</td><td>The relay to the real device, as one report the device receives.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::Device;

let device = Device::find()?;
device.allow_imperfect_clones(true)?;
device.raw(0x81, &[0x00, 0x01, 0x00, 0x00])?;  // one report on interrupt-IN endpoint 1`}</code></pre>
        </Card>
      </div>

      <div id="size" data-search-target>
        <Card>
          <CardHeader title="Packet size" subtitle="What the endpoint carries decides what fits" />
          <p>
            The report is bounded by the endpoint it goes on, and the two transfer types the box relays
            treat an over-long payload differently.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Endpoint type</th><th>A payload over the limit</th></tr></thead>
              <tbody>
                <tr><td>Interrupt</td><td>Past the endpoint's <code>wMaxPacketSize</code> the report is dropped box-side. Keep a report within one packet.</td></tr>
                <tr><td>Bulk</td><td>Split at the packet size and terminated with a short packet, or a zero-length packet when the payload is an exact multiple, the way a bulk transfer ends on the wire.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              A single developer frame carries up to 512 payload bytes (the{' '}
              <A href="/native/frame#layout">frame limit</A>), the bound the C and Python buffers
              (<code>MEDIUS_MAX_DEV_PAYLOAD</code>) are sized to.
            </p>
          </div>
        </Card>
      </div>

      <div id="vs-inject" data-search-target>
        <Card>
          <CardHeader title="Raw against injection" subtitle="When the bytes are the point" />
          <p>
            A standard input in the device's own report belongs in{' '}
            <A href="/library/inject"><code>inject</code></A> and{' '}
            <A href="/library/move"><code>move_rel</code></A>, not here. Those describe an input and let
            the box render it into a native-faithful report; <code>raw</code> describes bytes and leaves
            them untouched.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th></th><th><A href="/library/inject"><code>inject</code></A> / <A href="/library/move"><code>move_rel</code></A></th><th><code>raw</code></th></tr></thead>
              <tbody>
                <tr><td>Addresses</td><td>An axis or usage, by <A href="/library/types/enums#axis">semantic</A> id</td><td>An endpoint, by address</td></tr>
                <tr><td>On the wire</td><td>Merged into the native report, clamped to the field width, paced to the native rate</td><td>The bytes as given, one report</td></tr>
                <tr><td>State</td><td>Held until cleared; rides the native stream</td><td>Stateless; the next native report overwrites it</td></tr>
                <tr><td>Rewrite rules</td><td>Apply</td><td>Bypassed</td></tr>
                <tr><td>Gate</td><td>Always available</td><td>Imperfect-clone opt-in</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Reach for <code>raw</code> when the report itself is the point: a vendor packet no HID field
            describes, a byte sequence a device expects on an OUT endpoint, a report shape the semantic
            core does not model.
          </p>
        </Card>
      </div>

      <div id="gate" data-search-target>
        <Card>
          <CardHeader title="The imperfect-clone gate" subtitle="One opt-in admits the whole layer" />
          <p>
            The box admits the developer layer under the imperfect-clone opt-in and nothing else. The
            crate reads that state before it sends, so an off opt-in is a real error rather than a frame
            the box silently drops.
          </p>
          <table class="api-params">
            <thead><tr><th>Error</th><th>When</th></tr></thead>
            <tbody>
              <tr><td><A href="/library/types/errors#errors"><code>ImperfectRequired</code></A></td><td>The box reports the opt-in off. Turn it on with <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones(true)</code></A>.</td></tr>
            </tbody>
          </table>
          <p>
            The opt-in is a persistent <A href="/library/options">box option</A>, read back with{' '}
            <A href="/library/options#query-imperfect"><code>query_imperfect</code></A>. It is the same
            gate the native <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>{' '}
            sets.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="raw awaits the opt-in gate" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> makes <code>raw</code> a
            future: it awaits the imperfect-clone opt-in check, then the send itself is fire-and-forget.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::AsyncDevice;

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.allow_imperfect_clones(true)?;
block_on(device.raw(0x81, &[0x00, 0x01, 0x00, 0x00]))?;  // awaits the opt-in gate`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Raw;
