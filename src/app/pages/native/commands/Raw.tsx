import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Raw: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Raw" subtitle="Verbatim bytes on a cloned endpoint" />
        <p>
          <A href="/native/commands/raw#raw"><code>RAW</code></A> places one packet or bulk transfer,
          byte for byte, on an endpoint named by number and direction: IN to the game PC, OUT to the
          real device. It enters the path after every stage that reads or rewrites a packet.
        </p>
        <pre class="diagram">{`  IN    native report --> rewrite --> lock, render, inject --> rewrite ---+
                          HID_IN                               EMIT       |
                                                                          v
                                             RAW(ep, 1) ------> [ IN queue ] --> game PC

  OUT   game PC --------> rewrite ----------------------------------------+
                          HID_OUT, VEND_INTR, VEND_BULK                   |
                                                                          v
                                             RAW(ep, 2) ------> [ OUT relay ] --> real device

  rewrite = the rewrite rules and the clip packet triggers on that surface`}</pre>
        <p>
          Standard inputs belong in{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/move#move"><code>MOVE</code></A>, which the box renders into a
          faithful report; <code>RAW</code> is for bytes no semantic field describes.
        </p>
        <div class="callout callout--warning">
          <p>
            <code>RAW</code> runs only under{' '}
            <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>. Otherwise
            the box discards the frame with no reply, and discards a{' '}
            <A href="/native/commands/clip#items">clip raw item</A>, counted in{' '}
            <A href="/native/commands/requests#clip"><code>gated</code></A>.
          </p>
        </div>
      </Card>

      <div id="raw" data-search-target>
        <Card>
          <CardHeader title="RAW" subtitle="One packet or bulk transfer on one endpoint" />
          <p>
            <code>RAW</code> carries an endpoint address and the bytes to put there.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x19</code>.
          </p>
          <pre class="api-signature">RAW  0x19  ·  payload 2 + n bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>ep_num</code></td><td><code>u8</code></td><td>endpoint number; low four bits used</td></tr>
              <tr><td>1</td><td><code>dir</code></td><td><code>u8</code></td><td><code>1</code> IN, <code>2</code> OUT (the <A href="/native/commands/lock"><code>LOCK</code></A> direction byte)</td></tr>
              <tr><td>2</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>packet, verbatim; delimited by the frame <A href="/native/frame#layout"><code>LEN</code></A>, so at most 510 bytes</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">DIRECTION</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Name</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>1</code></td><td>IN</td><td>queued on the clone's IN endpoint <code>ep_num</code> (HID interrupt, vendor interrupt or bulk) for the game PC to read</td></tr>
              <tr><td><code>2</code></td><td>OUT</td><td>relayed through the host chip to OUT endpoint <code>ep_num</code> (HID interrupt, vendor interrupt or bulk) on the real device</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>payload under 2 bytes</td><td>no endpoint address</td></tr>
              <tr><td>clone not yet configured by the game PC</td><td>clone endpoints are unarmed until the PC's <code>SET_CONFIGURATION</code></td></tr>
              <tr><td><code>dir</code> is not <code>1</code> or <code>2</code></td><td>only <code>1</code> (IN) and <code>2</code> (OUT) name an address</td></tr>
              <tr><td>IN: no cloned HID or vendor IN endpoint <code>ep_num</code></td><td>the box writes only IN endpoints it cloned</td></tr>
              <tr><td>OUT: no real-device OUT endpoint <code>ep_num</code></td><td>the host chip drops it, with no endpoint to submit to</td></tr>
              <tr><td>an interrupt packet past its <A href="/native/commands/raw#packets">limit</A></td><td>an interrupt transfer is one packet, so a split would reach the PC as two reports</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            The bytes reach the endpoint as given. <code>RAW</code> has no reply; an{' '}
            <A href="/native/commands/raw#catch"><code>EMIT</code></A> subscription shows an IN packet
            as the game PC reads it.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Left button down on HID interrupt IN endpoint 1: <code>ep_num = 1</code>,{' '}
            <code>dir = 1</code>, a 4-byte report:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+-------------+--------+
| A5     | 19     | 00     | 06 00  | 01     | 01     | 01 00 00 00 | lo hi  |
+--------+--------+--------+--------+--------+--------+-------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep_num | dir    | bytes       | CRC16  |
+--------+--------+--------+--------+--------+--------+-------------+--------+`}</pre>
          <p>The release, button bit clear:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+-------------+--------+
| A5     | 19     | 01     | 06 00  | 01     | 01     | 00 00 00 00 | lo hi  |
+--------+--------+--------+--------+--------+--------+-------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep_num | dir    | bytes       | CRC16  |
+--------+--------+--------+--------+--------+--------+-------------+--------+`}</pre>
          <p>
            A keyboard LED report, Caps Lock on, to interrupt OUT endpoint 2: <code>ep_num = 2</code>,{' '}
            <code>dir = 2</code>, one byte:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 19     | 02     | 03 00  | 02     | 02     | 02     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | ep_num | dir    | bytes  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library bindings:{' '}
            <A href="/library/advanced/raw#raw"><code>raw</code></A>, and{' '}
            <A href="/library/advanced/raw#async"><code>raw</code></A> on <code>AsyncDevice</code>.
          </p>
        </Card>
      </div>

      <div id="packets" data-search-target>
        <Card>
          <CardHeader title="Packet size" subtitle="Per transfer type" />
          <p>
            An OUT packet is the endpoint's <code>wMaxPacketSize</code> on the wire, as IN; the
            inter-chip relay carries a bulk payload in pieces of at most 64 bytes.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Aspect</th><th><code>dir = 1</code>, IN</th><th><code>dir = 2</code>, OUT</th></tr>
            </thead>
            <tbody>
              <tr><td>Interrupt</td><td>one packet, at most the endpoint's <code>wMaxPacketSize</code> and at most 64 bytes</td><td>one packet, at most the endpoint's <code>wMaxPacketSize</code></td></tr>
              <tr><td>Bulk</td><td colspan="2">split at <code>wMaxPacketSize</code></td></tr>
              <tr><td>Bulk end</td><td colspan="2">a short packet, or a zero-length packet (ZLP) when the payload is an exact multiple of <code>wMaxPacketSize</code>; an empty <code>bytes</code> sends one ZLP</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SPLIT</div>
          <pre class="diagram">{`  bulk, wMaxPacketSize = 64

  bytes = 130   -->   [ 64 ] [ 64 ] [ 2 ]      the 2-byte packet ends the transfer
  bytes = 128   -->   [ 64 ] [ 64 ] [ ZLP ]    an exact multiple ends on a ZLP
  bytes = 0     -->   [ ZLP ]`}</pre>
          <div class="api-response-label">QUEUES</div>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Behaviour</th></tr>
            </thead>
            <tbody>
              <tr><td>HID IN, 8 reports</td><td>drops the oldest native report when full, else the oldest <code>RAW</code> one, counted in <A href="/native/commands/requests#stats"><code>tx_drops</code></A></td></tr>
              <tr><td>vendor interrupt IN, 8 packets</td><td>drops the oldest packet when full, counted in <A href="/native/commands/requests#stats"><code>relay_drops</code></A></td></tr>
              <tr><td>vendor bulk IN, 8 packets</td><td>drops the new packet when full, counted in <code>relay_drops</code>; at 6 queued it pauses the native bulk stream until the queue drains to 2</td></tr>
              <tr><td>OUT relay, 8 packets</td><td>drops the new packet when full, counted in <code>relay_drops</code></td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>
              A bulk IN transfer longer than the queue's free slots reaches the game PC truncated. At{' '}
              <code>wMaxPacketSize = 64</code>, 510 bytes is 8 packets, the whole queue.
            </p>
          </div>
        </Card>
      </div>

      <div id="state" data-search-target>
        <Card>
          <CardHeader title="Lifetime" subtitle="Held until the next native report" />
          <p>
            A <code>RAW</code> IN report is the last state the game PC read on that endpoint until
            the next native report replaces it.
          </p>
          <p>
            A <code>RAW</code> report takes a poll of its own; no native report carries it. On an
            endpoint the device reports on every poll, it goes after at most two native reports.
          </p>
          <pre class="diagram">{`  native report   [ btn 0 ]                            [ btn 0 ]
  RAW, dir = 1                  [ btn 1 ]
  on the wire     [ btn 0 ]     [ btn 1 ]              [ btn 0 ]
                                |<- last report read ->|`}</pre>
          <div class="api-response-label">PIPELINE</div>
          <p>
            A <code>RAW</code> packet goes straight to the endpoint, past every{' '}
            <A href="/native/commands/rewrite">rewrite rule</A>,{' '}
            <A href="/native/commands/clip#packet-triggers">clip packet trigger</A>,{' '}
            <A href="/native/commands/lock"><code>LOCK</code></A>,{' '}
            <A href="/native/commands/transform"><code>TRANSFORM</code></A>,{' '}
            <A href="/native/commands/option#render">rendering</A> and{' '}
            <A href="/native/injection">injection</A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Mechanism</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>report merging</td><td>sums motion between other queued reports and keeps each <code>RAW</code> report whole, byte for byte</td></tr>
              <tr><td>change suppression</td><td>records a <code>RAW</code> report shaped like the mouse, keyboard or media report the box injects into as the last report emitted, the baseline for injected frames</td></tr>
            </tbody>
          </table>
          <p>
            A <A href="/native/commands/clip#items">clip raw item</A> is the same packet on a
            clip tick, with its own release rule.
          </p>
        </Card>
      </div>

      <div id="catch" data-search-target>
        <Card>
          <CardHeader title="Catch taps" subtitle="Traffic classes a RAW packet raises" />
          <p>
            A <code>RAW</code> IN packet raises{' '}
            <A href="/native/commands/catch#traffic-event"><code>TRAFFIC_EVENT</code></A>s on the taps it
            passes. The <A href="/native/commands/catch#catch"><code>HID_IN</code></A> and OUT taps sit
            upstream of <code>RAW</code>'s entry point.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>When</th><th>Raises</th></tr>
            </thead>
            <tbody>
              <tr><td>the game PC reads a non-empty <code>RAW</code> report off a HID IN endpoint</td><td><A href="/native/commands/catch#catch"><code>EMIT</code></A> (<code>9</code>), <code>dir = 1</code></td></tr>
              <tr><td>a <code>RAW</code> packet enters a vendor IN queue</td><td><A href="/native/commands/catch#catch"><code>VEND_INTR</code></A> (<code>6</code>) or <A href="/native/commands/catch#catch"><code>VEND_BULK</code></A> (<code>7</code>), <code>dir = 1</code>, stamped <A href="/native/commands/catch#clocks"><code>clk = 1</code></A> by the device chip; bulk carries the end-of-transfer and ZLP <A href="/native/commands/catch#traffic-event">flags</A></td></tr>
              <tr><td>the game PC reads a non-empty <code>RAW</code> packet off a vendor IN endpoint</td><td><code>EMIT</code> (<code>9</code>), <code>dir = 1</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Raw;
