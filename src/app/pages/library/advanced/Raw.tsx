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
          <code>raw</code> puts <code>bytes</code> verbatim on one cloned endpoint, named by number and
          direction: <code>IN</code> emits toward the game PC, <code>OUT</code> relays to the real
          device. It carries no semantic model and no merge with native motion.
        </p>
        <p>
          The write is stateless: the next native report overwrites it, and <code>raw</code> bypasses
          the <A href="/library/advanced/rewrite">rewrite rules</A> and the clip's{' '}
          <A href="/library/clip#packet-triggers">packet triggers</A>. No native report can carry a
          raw <code>IN</code> report, so on an endpoint the device reports on at every poll it takes a
          poll of its own, within two of the device's reports.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  HID report  ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN---->  reads report
                                                                    ^
                                                                    +-- raw(n, IN)   <== a report toward the PC

  relayed     <--OUT---  [ HID_OUT ]<-- relay <--------------- interrupt-OUT <--  writes report
                         (VEND_INTR / VEND_BULK)                ^
                                                                +-- raw(n, OUT)  <== a report toward the device

  control     <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  class, vendor requests
  enumerate   descriptor patches overwrite what the clone presents`}</pre>
        <div class="callout callout--warning">
          <p>
            The whole advanced control layer is gated on the imperfect-clone opt-in. With{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, the box drops a <code>raw</code> frame and says nothing, so the call still returns{' '}
            <code>Ok</code>.
          </p>
        </div>
      </Card>

      <div id="raw" data-search-target>
        <Card>
          <CardHeader title="raw" subtitle="One report on one endpoint, fire-and-forget" />
          <pre class="api-signature">fn raw(&self, ep: u8, direction: Direction, bytes: &[u8]) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>ep</code></td><td><code>u8</code></td><td>The cloned endpoint number, 0 to 15.</td></tr>
              <tr><td><code>direction</code></td><td><A href="/library/types/enums#direction"><code>Direction</code></A></td><td><code>IN</code> emits toward the game PC, <code>OUT</code> relays to the real device. Any other is <A href="/library/types/errors#errors"><code>Error::RawDirection</code></A>.</td></tr>
              <tr><td><code>bytes</code></td><td><code>&amp;[u8]</code></td><td>The report, on the wire as given, at most 510 bytes. An interrupt report fits one packet; a bulk payload is split, per <A href="/library/advanced/raw#size">packet size</A>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Direction};

let device = Device::find()?;
device.allow_imperfect_clones(true)?;
device.raw(1, Direction::IN, &[0x00, 0x01, 0x00, 0x00])?;  // one report on interrupt-IN endpoint 1`}</code></pre>
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
                <tr><td>Interrupt</td><td>Past one packet the report is dropped box-side: the endpoint's <code>wMaxPacketSize</code>, <code>IN</code> or <code>OUT</code>. Keep a report within one packet.</td></tr>
                <tr><td>Bulk</td><td>Split at <code>wMaxPacketSize</code> in either direction, and terminated with a short packet, or a zero-length packet when the payload is an exact multiple of it, the way a bulk transfer ends on the wire.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="callout callout--info">
            <p>
              A single advanced control layer frame carries up to 512 payload bytes (the{' '}
              <A href="/native/frame#layout">frame limit</A>), the bound the C and Python buffers
              (<code>MEDIUS_MAX_DEV_PAYLOAD</code>) are sized to. <code>raw</code> spends two on the
              endpoint and direction, leaving 510. See the native{' '}
              <A href="/native/commands/raw#packets"><code>RAW</code></A> command for the wire layout.
            </p>
          </div>
        </Card>
      </div>

      <div id="vs-inject" data-search-target>
        <Card>
          <CardHeader title="Raw against injection" subtitle="When the bytes are the point" />
          <p>
            A standard input in the native report belongs in{' '}
            <A href="/library/inject"><code>inject</code></A> and{' '}
            <A href="/library/move"><code>move_rel</code></A>, not here. Those describe an input and let
            the box render it into a native-faithful report; <code>raw</code> describes bytes and leaves
            them untouched.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Aspect</th><th><A href="/library/inject"><code>inject</code></A> / <A href="/library/move"><code>move_rel</code></A></th><th><code>raw</code></th></tr></thead>
              <tbody>
                <tr><td>Addresses</td><td>An axis or usage, by <A href="/library/types/enums#axis">semantic</A> id</td><td>An endpoint, by number and direction</td></tr>
                <tr><td>On the wire</td><td>Merged into the native report, clamped to the field width, paced to the native rate</td><td>The bytes as given, one report</td></tr>
                <tr><td>State</td><td>Held until cleared; rides the native stream</td><td>Stateless; the next native report overwrites it</td></tr>
                <tr><td>Rewrite rules, packet triggers</td><td>Apply</td><td>Bypassed</td></tr>
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
            The box admits the advanced control layer under the imperfect-clone opt-in and nothing else.
            <A href="/library/advanced/rewrite#set-rewrite"><code>set_rewrite</code></A> and{' '}
            <A href="/library/advanced/patch#apply-patch"><code>apply_patch</code></A> read that state before
            they send. <code>raw</code> runs per report, so it sends without asking.
          </p>
          <table class="api-params">
            <thead><tr><th>Error</th><th>Returned on</th></tr></thead>
            <tbody>
              <tr><td><A href="/library/types/errors#errors"><code>ImperfectRequired</code></A></td><td><code>set_rewrite</code> or <code>apply_patch</code>, when the box reports the opt-in off. Turn it on with <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones(true)</code></A>.</td></tr>
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
          <CardHeader title="On AsyncDevice" subtitle="raw is a future over the same send" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> makes <code>raw</code> a
            future. The send is fire-and-forget, the same as the sync call.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Direction};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.allow_imperfect_clones(true)?;
block_on(device.raw(1, Direction::IN, &[0x00, 0x01, 0x00, 0x00]))?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Raw;
