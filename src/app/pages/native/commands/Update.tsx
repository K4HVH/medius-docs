import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Update: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Update" subtitle="Replace either chip's firmware over this port" />
        <p>
          <A href="/native/commands/update#update"><code>UPDATE</code></A> writes new firmware to
          either chip while the box is running: a{' '}
          <A href="/native/commands/update#begin">session</A> per chip, the image in{' '}
          <A href="/native/commands/update#data">chunks</A>, and one{' '}
          <A href="/native/commands/update#activate">commit</A> at the end. No ROM download mode, no
          BOOT button, no cable move.
        </p>
        <pre class="diagram">{`   PC --CH343, framed 4 Mbaud--> DEVICE chip --> its own spare slot
                                     |
                                     +--UART1, 5 Mbaud--> HOST chip --> its own spare slot`}</pre>
        <p>
          The host chip has no serial port of its own and no wire to one: only GPIO1 and GPIO2 connect
          the two chips. Its image is relayed chunk for chunk and never buffered on the way.
        </p>
        <div class="api-response-label">SLOTS</div>
        <p>Both chips carry two app slots and boot whichever the bootloader selects.</p>
        <table class="api-params">
          <thead>
            <tr><th>Partition</th><th>Offset</th><th>Size</th><th>Holds</th></tr>
          </thead>
          <tbody>
            <tr><td><code>nvs</code></td><td><code>0x9000</code></td><td><code>0x6000</code></td><td>Box name, options, and learned baselines.</td></tr>
            <tr><td><code>phy_init</code></td><td><code>0xF000</code></td><td><code>0x1000</code></td><td>PHY calibration.</td></tr>
            <tr><td><code>ota_0</code></td><td><code>0x10000</code></td><td><code>0xF0000</code></td><td>One app slot.</td></tr>
            <tr><td><code>ota_1</code></td><td><code>0x100000</code></td><td><code>0xF0000</code></td><td>The other app slot.</td></tr>
            <tr><td><code>otadata</code></td><td><code>0x1F0000</code></td><td><code>0x2000</code></td><td>Which slot boots, and its state.</td></tr>
          </tbody>
        </table>
        <p>
          <code>otadata</code> sits above the slots so <code>nvs</code> keeps its offset: the box name,
          the options and the learned baselines survive the one flash that installs this layout. A box
          that has never had it answers <code>NOSLOT</code>; see{' '}
          <A href="/native/flashing">Flashing</A>.
        </p>
      </Card>

      <div id="update" data-search-target>
        <Card>
          <CardHeader title="UPDATE" subtitle="One firmware session on one chip" />
          <p>
            <code>UPDATE</code> carries five ops against one target chip. Every frame leads with the op
            and the chip it addresses.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x17</code>.
          </p>
          <pre class="api-signature">UPDATE  0x17  ·  payload 2..508 bytes</pre>
          <p><span class="api-badge api-badge--responded">Returns UPDATE_RESP</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>op</code></td><td><code>u8</code></td><td>0=BEGIN 1=DATA 2=END 3=ABORT 4=ACTIVATE</td></tr>
              <tr><td>1</td><td><code>target</code></td><td><code>u8</code></td><td>0=device chip, 1=host chip; ignored by <code>ACTIVATE</code></td></tr>
              <tr><td>2..</td><td><code>body</code></td><td><code>varies</code></td><td>per op, below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ORDER</div>
          <pre class="diagram">{`  BEGIN --> DATA --> DATA --> ... --> END --> (staged, inert)
    |                                          |
    +-- ABORT ---------------------------------+--> ACTIVATE --> reboot`}</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            A target can be staged, left alone, and activated later, and both chips may be staged
            before a single <A href="/native/commands/update#activate"><code>ACTIVATE</code></A>{' '}
            commits them together. Read what each chip is running with{' '}
            <A href="/native/commands/requests#firmware"><code>QUERY(FIRMWARE)</code></A>. Each op
            below carries its own example. Library binding:{' '}
            <A href="/library/update#update-firmware"><code>update_firmware</code></A>.
          </p>
        </Card>
      </div>

      <div id="begin" data-search-target>
        <Card>
          <CardHeader title="BEGIN" subtitle="Erase the spare slot and open a session" />
          <pre class="api-signature">UPDATE  op 0  ·  [target u8][size u32][sha256 u8[32]]</pre>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>2</td><td><code>size</code></td><td><code>u32</code></td><td>total image bytes, little-endian; over <code>983040</code> is refused with <code>TOOBIG</code></td></tr>
              <tr><td>6</td><td><code>sha256</code></td><td><code>u8[32]</code></td><td>digest of the whole image, checked at <code>END</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Puts the whole box in update mode: injection and{' '}
            <A href="/native/commands/clip">clip</A> playback stop, the host chip stops polling the
            real device, and the clone disconnects from the game PC. Then it erases the entire target
            slot before answering <code>READY</code> with the credit in <code>arg</code>. Library
            binding: <A href="/library/update#stage-firmware"><code>stage_firmware</code></A>.
          </p>
          <p>
            The erase happens here, up front, and not lazily as bytes arrive. A 64 KB block erase
            disables the cache for tens of milliseconds, which no receive buffer on either wire can
            absorb mid-stream.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Open a 364784-byte device-chip image (<code>size</code> is <code>0x000590F0</code>):</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+-------------+----------+--------+
| A5     | 17     | 00     | 26 00  | 00     | 00     | F0 90 05 00 | 32 bytes | lo hi  |
+--------+--------+--------+--------+--------+--------+-------------+----------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | size        | sha256   | CRC16  |
+--------+--------+--------+--------+--------+--------+-------------+----------+--------+`}</pre>
        </Card>
      </div>

      <div id="data" data-search-target>
        <Card>
          <CardHeader title="DATA" subtitle="One chunk, in order" />
          <pre class="api-signature">UPDATE  op 1  ·  [target u8][seq u16][bytes 1..504]</pre>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>2</td><td><code>seq</code></td><td><code>u16</code></td><td>chunk index, little-endian; the byte offset is <code>seq * 504</code></td></tr>
              <tr><td>4..</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>1 to 504 image bytes</td></tr>
            </tbody>
          </table>
          <p>
            504 is what the <A href="/native/frame">frame</A> has left: 512 less the op, the target and
            a two-byte index, rounded down to a multiple of four so every flash write is aligned.
          </p>
          <div class="api-response-label">FLOW CONTROL</div>
          <p>
            <code>READY</code>'s <code>arg</code> says how many chunks the box will take before it
            must answer. Read it rather than assuming: the device chip asks for 16, the host chip for
            6, because a relayed chunk waits in the inter-chip link's receive ring while the chip
            behind it writes the one before to flash. The window is a correctness requirement, not a
            throughput knob.
          </p>
          <pre class="diagram">{`  PC   |-- credit chunks --|                       |-- credit chunks --|
  box                       |-- write, ACK next --|                     |-- ACK next --|
                            ^
                            cache is off here; nothing may be in flight`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Flash page write</td><td>0.3 to 0.7 ms, both cores stalled.</td></tr>
              <tr><td>UART0 RX FIFO</td><td>128 bytes, which is 320 us at 4 Mbaud.</td></tr>
              <tr><td>Credit window</td><td>16 chunks to the device chip (8064 bytes), 6 to the host chip.</td></tr>
              <tr><td>Inter-chip link ring</td><td>4096 bytes, which is what caps the relayed window.</td></tr>
            </tbody>
          </table>
          <p>
            A sender that ignores the credit it was given overruns whichever hop is smaller, and the
            lost chunk leaves the window one short: nothing acknowledges it, and the session dies on
            the idle timer with the sender still waiting. Library binding:{' '}
            <A href="/library/update#stage-firmware"><code>stage_firmware</code></A>.
          </p>
          <div class="api-response-label">RESENDS</div>
          <p>
            A chunk one behind the box's next expected <code>seq</code> is accepted and answered
            without being rewritten: that is what a lost acknowledgement looks like. Anything older is
            a <code>SEQGAP</code> and drops the session.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Chunk 3 of a device-chip image, a full 504 bytes of payload:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| A5     | 17     | 2A     | FC 01  | 01     | 00     | 03 00  | ...    | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | seq    | bytes  | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="end" data-search-target>
        <Card>
          <CardHeader title="END" subtitle="Verify the digest and stop there" />
          <pre class="api-signature">UPDATE  op 2  ·  [target u8]</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            Checks the digest and the image header, and stops. It answers <code>STAGED</code> with the
            byte count, or <code>BADSHA</code> if the image is not what <code>BEGIN</code> promised.
            Library binding:{' '}
            <A href="/library/update#stage-firmware"><code>stage_firmware</code></A>.
          </p>
          <div class="callout callout--info">
            <p>
              A staged image is not bootable. <code>END</code> deliberately does not set the boot
              partition: that takes effect on the next boot of any kind, so an image staged and never
              activated would go live on the next power cut. Committing is{' '}
              <A href="/native/commands/update#activate"><code>ACTIVATE</code></A>'s job.
            </p>
          </div>
          <div class="api-response-label">TIMEOUT</div>
          <p>
            Ten seconds with no traffic ends update mode by itself, so a client that disappears cannot
            leave the clone down. A staged image survives that: it is inert, and discarding it would
            throw away a transfer that already completed.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Close the device-chip session:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 17     | 3C     | 02 00  | 02     | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="abort" data-search-target>
        <Card>
          <CardHeader title="ABORT" subtitle="Throw the transfer away" />
          <pre class="api-signature">UPDATE  op 3  ·  [target u8]</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            Drops whatever is staged or in flight for that target and answers <code>OK</code>. Leaving
            update mode does not reboot: the host chip re-sends its descriptor snapshot and the clone
            is rebuilt the same way a re-attach rebuilds it. Library binding:{' '}
            <A href="/library/update#abort-update"><code>abort_update</code></A>.
          </p>
          <div class="api-response-label">DURING AN ACTIVATE</div>
          <p>
            Once <A href="/native/commands/update#activate"><code>ACTIVATE</code></A> is accepted the
            box answers new commands with <code>BUSY</code>, and this is the one exception: while the
            box is waiting on the host chip it abandons that wait and answers the{' '}
            <code>ACTIVATE</code> with <code>TIMEOUT</code>. Past that point the boot partition is
            already written, so there is nothing left to abort, and cancelling the reboot would leave
            the box running one image with the loader pointed at the other.
          </p>
          <div class="callout callout--warning">
            <p>
              Abandoning an activate disarms <em>both</em> chips, whichever target the frame names. One{' '}
              <code>ACTIVATE</code> commits everything staged, so abandoning it abandons everything
              staged; leaving one behind would let a later <code>ACTIVATE</code> commit that one alone
              and put the two chips on different versions. Outside an activate, <code>ABORT</code> is
              per-target as usual.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <p>Discard whatever the host chip is holding:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 17     | 41     | 02 00  | 03     | 01     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="activate" data-search-target>
        <Card>
          <CardHeader title="ACTIVATE" subtitle="Commit every staged image and boot it" />
          <pre class="api-signature">UPDATE  op 4  ·  [target u8] (ignored)</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            Points each staged chip at its new slot and reboots into it, host chip first. The device
            chip is the only transport, so it is the last one down. Library binding:{' '}
            <A href="/library/update#activate-firmware"><code>activate_firmware</code></A>.
          </p>
          <pre class="diagram">{`  ACTIVATE
     |
     +--> host commits, reboots
     |         |
     |         +--> back on the link at the new slot
     |                    |
     +--------------------+--> device commits, replies OK, reboots`}</pre>
          <p>
            If only one target is staged, only that one is committed. Anything that fails before{' '}
            <code>ACTIVATE</code> leaves both chips on their running slots untouched, so a failed
            transfer costs a retry and nothing else. The reply is <code>OK</code> once both chips are
            committed, <code>NOSTAGE</code> if nothing was staged, or <code>TIMEOUT</code> if the host
            chip never came back on the new slot; it always names target <code>0</code>, so match it on
            the op alone.
          </p>
          <div class="callout callout--warning">
            <p>
              A refused commit leaves the image staged. The host chip goes first, so if it refuses,
              the device chip never commits. Both chips are still on their running slots, but the
              device image stays staged and armed: the next <code>ACTIVATE</code> would commit it
              alone and leave the two chips on different versions. After a failed{' '}
              <code>ACTIVATE</code>, either retry the whole update or send{' '}
              <A href="/native/commands/update#abort"><code>ABORT</code></A> for each staged target
              first. The dashboard and both reference clients do the latter for you.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <p>Commit everything staged:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+
| A5     | 17     | 55     | 02 00  | 04     | 00     | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+`}</pre>
        </Card>
      </div>

      <div id="resp" data-search-target>
        <Card>
          <CardHeader title="UPDATE_RESP" subtitle="The answer to one op" />
          <p>
            One reply per <A href="/native/commands/update#update"><code>UPDATE</code></A> frame, and
            one per acknowledged window of{' '}
            <A href="/native/commands/update#data"><code>DATA</code></A>.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x18</code>.
          </p>
          <pre class="api-signature">UPDATE_RESP  0x18  ·  payload 7 bytes</pre>
          <p><span class="api-badge api-badge--responded">Reply</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>op</code></td><td><code>u8</code></td><td>echoes the op being answered</td></tr>
              <tr><td>1</td><td><code>target</code></td><td><code>u8</code></td><td>echoes the target; <code>ACTIVATE</code> always answers <code>0</code></td></tr>
              <tr><td>2</td><td><code>status</code></td><td><code>u8</code></td><td>below</td></tr>
              <tr><td>3</td><td><code>arg</code></td><td><code>u32</code></td><td>per status, little-endian</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              <code>SEQ</code> echoes the command frame, except for <code>DATA</code>{' '}
              acknowledgements, which carry a rolling <code>SEQ</code> because one answers a whole
              window. Correlate on the op alone, not on <code>SEQ</code>.
            </p>
          </div>
          <div class="api-response-label">STATUS</div>
          <div class="table-scroll">
            <table class="api-params">
              <thead>
                <tr><th>Status</th><th>Value</th><th><code>arg</code></th><th>Meaning</th></tr>
              </thead>
              <tbody>
                <tr><td><code>OK</code></td><td><code>0x00</code></td><td><code>0</code></td><td>Accepted, nothing else to say.</td></tr>
                <tr><td><code>READY</code></td><td><code>0x01</code></td><td>credit</td><td>Slot erased; this many chunks before an acknowledgement.</td></tr>
                <tr><td><code>ACK</code></td><td><code>0x02</code></td><td>next <code>seq</code></td><td>The window landed; send from this index.</td></tr>
                <tr><td><code>STAGED</code></td><td><code>0x03</code></td><td>bytes written</td><td>Verified and inert until <code>ACTIVATE</code>.</td></tr>
                <tr><td><code>BUSY</code></td><td><code>0x10</code></td><td><code>0</code></td><td>A session is already open on this target.</td></tr>
                <tr><td><code>NOSLOT</code></td><td><code>0x11</code></td><td><code>0</code></td><td>No second app slot; the box is on the single-app layout.</td></tr>
                <tr><td><code>TOOBIG</code></td><td><code>0x12</code></td><td>slot size</td><td>The declared size does not fit, or a chunk overran it.</td></tr>
                <tr><td><code>SEQGAP</code></td><td><code>0x13</code></td><td>expected <code>seq</code></td><td>A chunk out of order; the session is dropped.</td></tr>
                <tr><td><code>WRITEFAIL</code></td><td><code>0x14</code></td><td>error code</td><td>The flash write failed.</td></tr>
                <tr><td><code>BADSHA</code></td><td><code>0x15</code></td><td><code>0</code></td><td>The image is not what the digest promised.</td></tr>
                <tr><td><code>BADIMAGE</code></td><td><code>0x16</code></td><td>error code</td><td>The bytes are not a bootable image.</td></tr>
                <tr><td><code>LINKDOWN</code></td><td><code>0x17</code></td><td><code>0</code></td><td>The host chip was addressed and the inter-chip link is down.</td></tr>
                <tr><td><code>TIMEOUT</code></td><td><code>0x18</code></td><td><code>0</code></td><td>The host chip did not come back on the new image.</td></tr>
                <tr><td><code>NOSTAGE</code></td><td><code>0x19</code></td><td><code>0</code></td><td><code>ACTIVATE</code> with nothing staged.</td></tr>
                <tr><td><code>BADSTATE</code></td><td><code>0x1A</code></td><td>expected op</td><td>An op out of order, or a malformed body.</td></tr>
                <tr><td><code>PROBATION</code></td><td><code>0x1B</code></td><td><code>0</code></td><td>The running image has not confirmed itself yet; wait and retry.</td></tr>
                <tr><td><code>UNTOUCHED</code></td><td><code>0x1C</code></td><td><code>0</code></td><td>Refused before the slot was touched, so anything already staged is still staged and still bootable.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Every refusal reaches the library as{' '}
            <A href="/library/types/errors"><code>Error::Update</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p><code>READY</code> for a device-chip <code>BEGIN</code>, credit <code>16</code>:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+--------+-------------+--------+
| A5     | 18     | 00     | 07 00  | 00     | 00     | 01     | 10 00 00 00 | lo hi  |
+--------+--------+--------+--------+--------+--------+--------+-------------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | status | arg         | CRC16  |
+--------+--------+--------+--------+--------+--------+--------+-------------+--------+`}</pre>
        </Card>
      </div>

      <div id="rollback" data-search-target>
        <Card>
          <CardHeader title="Rollback" subtitle="An image that will not run does not stick" />
          <p>
            A freshly booted image is on probation until it proves itself, and the bootloader reverts
            one that never does. Which slot each chip booted, and the state of that image, is in{' '}
            <A href="/native/commands/requests#firmware"><code>QUERY(FIRMWARE)</code></A>.
          </p>
          <pre class="diagram">{`  boot new slot --> pending-verify --> chip confirms itself --> valid
                          |
                          +-- panics, or never confirms --> bootloader picks the old slot`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Chip</th><th>What confirms it</th><th>Grace</th></tr>
            </thead>
            <tbody>
              <tr><td>Device</td><td>Ten seconds of a running main loop.</td><td>30 s</td></tr>
              <tr><td>Host</td><td>A completed clock exchange over the link.</td><td>15 s</td></tr>
            </tbody>
          </table>
          <p>
            Measured on hardware: an image that panics in its entry point is back on the old slot in
            0.8 s, and one that boots but never confirms is reverted by its own grace timer.
          </p>
          <div class="callout callout--warning">
            <p>
              Rollback covers an image that will not run. It does not cover one that runs and is
              wrong. While a chip is on probation the box refuses to open another update and answers{' '}
              <code>PROBATION</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Update;
