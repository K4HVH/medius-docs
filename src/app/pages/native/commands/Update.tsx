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
          <code>UPDATE</code> writes new firmware to either chip while the box is running.{' '}
          <A href="/native/frame#opcodes">Opcode</A> <code>0x17</code>, answered by{' '}
          <code>UPDATE_RESP</code> (<code>0x18</code>). No ROM download mode, no BOOT button, no cable
          move.
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
        <table class="byte-table">
          <thead>
            <tr><th>Partition</th><th>Offset</th><th>Size</th><th>Holds</th></tr>
          </thead>
          <tbody>
            <tr><td><code>nvs</code></td><td><code>0x9000</code></td><td><code>0x6000</code></td><td>box name, options, learned baselines</td></tr>
            <tr><td><code>phy_init</code></td><td><code>0xF000</code></td><td><code>0x1000</code></td><td>PHY calibration</td></tr>
            <tr><td><code>ota_0</code></td><td><code>0x10000</code></td><td><code>0xF0000</code></td><td>one app slot</td></tr>
            <tr><td><code>ota_1</code></td><td><code>0x100000</code></td><td><code>0xF0000</code></td><td>the other app slot</td></tr>
            <tr><td><code>otadata</code></td><td><code>0x1F0000</code></td><td><code>0x2000</code></td><td>which slot boots, and its state</td></tr>
          </tbody>
        </table>
        <p>
          <code>otadata</code> sits above the slots so <code>nvs</code> keeps its offset: the box name,
          the options and the learned baselines survive the one flash that installs this layout.
        </p>
      </Card>

      <div id="ops" data-search-target>
        <Card>
          <CardHeader title="Sub-ops" subtitle="One opcode, five verbs" />
          <p>Every frame leads with the op and the chip it addresses.</p>
          <pre class="api-signature">UPDATE  0x17  ·  [op u8][target u8][body...]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Values</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>op</td><td>u8</td><td>0=BEGIN 1=DATA 2=END 3=ABORT 4=ACTIVATE</td></tr>
              <tr><td><code>1</code></td><td>target</td><td>u8</td><td>0=device chip, 1=host chip; ignored by ACTIVATE</td></tr>
              <tr><td><code>2..</code></td><td>body</td><td>-</td><td>per op, below</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ORDER</div>
          <pre class="diagram">{`  BEGIN --> DATA --> DATA --> ... --> END --> (staged, inert)
    |                                          |
    +-- ABORT ---------------------------------+--> ACTIVATE --> reboot`}</pre>
          <p>
            A target can be staged, left alone, and activated later. Both chips may be staged before a
            single <code>ACTIVATE</code> commits them together.
          </p>
        </Card>
      </div>

      <div id="begin" data-search-target>
        <Card>
          <CardHeader title="BEGIN" subtitle="Erase the spare slot and open a session" />
          <p>Declares the image and the digest the box will check when it is complete.</p>
          <pre class="api-signature">UPDATE  op 0  ·  [target u8][size u32 LE][sha256 u8[32]]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>2</code></td><td>size</td><td>u32 LE</td><td>total image bytes; over <code>983040</code> is refused with <code>TOOBIG</code></td></tr>
              <tr><td><code>6</code></td><td>sha256</td><td>u8[32]</td><td>digest of the whole image, checked at <code>END</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            Puts the whole box in update mode: injection and{' '}
            <A href="/native/commands/clip">clip</A> playback stop, the host chip stops polling the
            real device, and the clone disconnects from the game PC. Then it erases the entire target
            slot before answering.
          </p>
          <p>
            The erase happens here, up front, and not lazily as bytes arrive. A 64 KB block erase
            disables the cache for tens of milliseconds, which no receive buffer on either wire can
            absorb mid-stream.
          </p>
          <div class="api-response-label">REPLY</div>
          <p>
            <code>READY</code> with the credit in <code>arg</code>, or a refusal from the{' '}
            <A href="/native/commands/update#resp">status table</A>.
          </p>
        </Card>
      </div>

      <div id="data" data-search-target>
        <Card>
          <CardHeader title="DATA" subtitle="One chunk, in order" />
          <pre class="api-signature">UPDATE  op 1  ·  [target u8][seq u16 LE][bytes 1..504]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>2</code></td><td>seq</td><td>u16 LE</td><td>chunk index; the byte offset is <code>seq * 504</code></td></tr>
              <tr><td><code>4..</code></td><td>bytes</td><td>-</td><td>1 to 504 image bytes</td></tr>
            </tbody>
          </table>
          <p>
            504 is what the <A href="/native/frame">frame</A> has left: 512 less the op, the target and
            a two-byte index, rounded down to a multiple of four so every flash write is aligned.
          </p>
          <div class="api-response-label">FLOW CONTROL</div>
          <p>
            The box accepts 16 chunks before it must answer. The window is a correctness requirement,
            not a throughput knob.
          </p>
          <pre class="diagram">{`  PC   |-- 16 chunks, 8064 B --|                    |-- 16 chunks --|
  box                          |-- write, ACK 16 --|                 |-- ACK 32 --|
                               ^
                               cache is off here; nothing may be in flight`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Quantity</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Flash page write</td><td>0.3 to 0.7 ms, both cores stalled</td></tr>
              <tr><td>UART0 RX FIFO</td><td>128 bytes, which is 320 us at 4 Mbaud</td></tr>
              <tr><td>Credit window</td><td>16 chunks, 8064 bytes, about 21 ms of wire</td></tr>
            </tbody>
          </table>
          <p>
            An unthrottled sender overruns the FIFO during a write. The same arithmetic holds on the
            inter-chip link at 5 Mbaud.
          </p>
          <div class="api-response-label">RESENDS</div>
          <p>
            A chunk one behind the box's next expected <code>seq</code> is accepted and answered
            without being rewritten: that is what a lost acknowledgement looks like. Anything older is
            a <code>SEQGAP</code> and drops the session.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Chunk 3 of a device-chip image, 504 bytes of payload:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+----------+--------+
| A5     | 17     | seq    | 00 02  | 01     | 00     | 03 00    | 504 B  |
+--------+--------+--------+--------+--------+--------+----------+--------+
| SOF    | TYPE   | SEQ    | LEN    | op     | target | chunk    | bytes  |
+--------+--------+--------+--------+--------+--------+----------+--------+`}</pre>
        </Card>
      </div>

      <div id="end" data-search-target>
        <Card>
          <CardHeader title="END and ABORT" subtitle="Verify, or throw it away" />
          <pre class="api-signature">UPDATE  op 2  ·  [target u8]          (END)</pre>
          <pre class="api-signature">UPDATE  op 3  ·  [target u8]          (ABORT)</pre>
          <div class="api-response-label">EFFECT</div>
          <p>
            <code>END</code> checks the digest and the image header, and stops there. It answers{' '}
            <code>STAGED</code> with the byte count, or <code>BADSHA</code> if the image is not what
            <code>BEGIN</code> promised.
          </p>
          <div class="callout callout--info">
            A staged image is not bootable. <code>END</code> deliberately does not set the boot
            partition: that takes effect on the next boot of any kind, so an image staged and never
            activated would go live on the next power cut. Committing is <code>ACTIVATE</code>'s job.
          </div>
          <p>
            <code>ABORT</code> drops whatever is staged or in flight for that target and answers{' '}
            <code>OK</code>. Leaving update mode does not reboot: the host chip re-sends its descriptor
            snapshot and the clone is rebuilt the same way a re-attach rebuilds it.
          </p>
          <div class="api-response-label">TIMEOUT</div>
          <p>
            Ten seconds with no traffic ends update mode by itself, so a client that disappears cannot
            leave the clone down. A staged image survives that: it is inert, and discarding it would
            throw away a transfer that already completed.
          </p>
        </Card>
      </div>

      <div id="activate" data-search-target>
        <Card>
          <CardHeader title="ACTIVATE" subtitle="Commit and boot" />
          <pre class="api-signature">UPDATE  op 4  ·  target ignored</pre>
          <p>
            Points each staged chip at its new slot and reboots into it, host chip first. The device
            chip is the only transport, so it is the last one down.
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
            transfer costs a retry and nothing else.
          </p>
          <div class="api-response-label">REPLY</div>
          <p>
            <code>OK</code> once both chips are committed, <code>NOSTAGE</code> if nothing was staged,
            or <code>TIMEOUT</code> if the host chip never came back on the new slot. The reply always
            names target <code>0</code>; match it on the op alone.
          </p>
        </Card>
      </div>

      <div id="rollback" data-search-target>
        <Card>
          <CardHeader title="Rollback" subtitle="An image that will not run does not stick" />
          <p>
            A freshly booted image is on probation until it proves itself, and the bootloader reverts
            one that never does.
          </p>
          <pre class="diagram">{`  boot new slot --> pending-verify --> chip confirms itself --> valid
                          |
                          +-- panics, or never confirms --> bootloader picks the old slot`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Chip</th><th>What confirms it</th><th>Grace</th></tr>
            </thead>
            <tbody>
              <tr><td>Device</td><td>ten seconds of a running main loop</td><td>30 s</td></tr>
              <tr><td>Host</td><td>a completed clock exchange over the link</td><td>15 s</td></tr>
            </tbody>
          </table>
          <p>
            Measured on hardware: an image that panics in its entry point is back on the old slot in
            0.8 s, and one that boots but never confirms is reverted by its own grace timer.
          </p>
          <div class="callout callout--warning">
            Rollback covers an image that will not run. It does not cover one that runs and is wrong.
            While a chip is on probation the box refuses to open another update and answers{' '}
            <code>PROBATION</code>.
          </div>
        </Card>
      </div>

      <div id="resp" data-search-target>
        <Card>
          <CardHeader title="UPDATE_RESP" subtitle="The answer to one op" />
          <pre class="api-signature">UPDATE_RESP  0x18  ·  [op u8][target u8][status u8][arg u32 LE]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>op</td><td>u8</td><td>echoes the op being answered</td></tr>
              <tr><td><code>1</code></td><td>target</td><td>u8</td><td>echoes the target; <code>ACTIVATE</code> always answers <code>0</code></td></tr>
              <tr><td><code>2</code></td><td>status</td><td>u8</td><td>below</td></tr>
              <tr><td><code>3</code></td><td>arg</td><td>u32 LE</td><td>per status</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <code>SEQ</code> echoes the command frame, except for <code>DATA</code> acknowledgements,
            which carry a rolling <code>SEQ</code> because one answers a whole window. Correlate on{' '}
            <code>(op, target)</code>, not <code>SEQ</code>.
          </div>
          <table class="byte-table">
            <thead>
              <tr><th>Status</th><th>Value</th><th><code>arg</code></th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>OK</code></td><td><code>0x00</code></td><td>0</td><td>accepted, nothing else to say</td></tr>
              <tr><td><code>READY</code></td><td><code>0x01</code></td><td>credit</td><td>slot erased; this many chunks before an acknowledgement</td></tr>
              <tr><td><code>ACK</code></td><td><code>0x02</code></td><td>next <code>seq</code></td><td>the window landed; send from this index</td></tr>
              <tr><td><code>STAGED</code></td><td><code>0x03</code></td><td>bytes written</td><td>verified and inert until <code>ACTIVATE</code></td></tr>
              <tr><td><code>BUSY</code></td><td><code>0x10</code></td><td>0</td><td>a session is already open on this target</td></tr>
              <tr><td><code>NOSLOT</code></td><td><code>0x11</code></td><td>0</td><td>no second app slot; the box is on the single-app layout</td></tr>
              <tr><td><code>TOOBIG</code></td><td><code>0x12</code></td><td>slot size</td><td>the declared size does not fit, or a chunk overran it</td></tr>
              <tr><td><code>SEQGAP</code></td><td><code>0x13</code></td><td>expected <code>seq</code></td><td>a chunk out of order; the session is dropped</td></tr>
              <tr><td><code>WRITEFAIL</code></td><td><code>0x14</code></td><td>error code</td><td>the flash write failed</td></tr>
              <tr><td><code>BADSHA</code></td><td><code>0x15</code></td><td>0</td><td>the image is not what the digest promised</td></tr>
              <tr><td><code>BADIMAGE</code></td><td><code>0x16</code></td><td>error code</td><td>the bytes are not a bootable image</td></tr>
              <tr><td><code>LINKDOWN</code></td><td><code>0x17</code></td><td>0</td><td>the host chip was addressed and the inter-chip link is down</td></tr>
              <tr><td><code>TIMEOUT</code></td><td><code>0x18</code></td><td>0</td><td>the host chip did not come back on the new image</td></tr>
              <tr><td><code>NOSTAGE</code></td><td><code>0x19</code></td><td>0</td><td><code>ACTIVATE</code> with nothing staged</td></tr>
              <tr><td><code>BADSTATE</code></td><td><code>0x1A</code></td><td>expected op</td><td>an op out of order, or a malformed body</td></tr>
              <tr><td><code>PROBATION</code></td><td><code>0x1B</code></td><td>0</td><td>the running image has not confirmed itself yet; wait and retry</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="firmware" data-search-target>
        <Card>
          <CardHeader title="RESP(FIRMWARE)" subtitle="What each chip is running" />
          <p>
            Selector <code>11</code> on <A href="/native/commands/requests"><code>QUERY</code></A>.
            The only place the host chip's version appears:{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> reports the
            device chip alone, and its name tail is delimited by the frame <code>LEN</code>, so
            nothing can follow it.
          </p>
          <pre class="api-signature">QUERY  [11]  →  RESP  [11][device 5][host_present][host 5][slot_size u32][staged]</pre>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>what</td><td>u8</td><td><code>11</code></td></tr>
              <tr><td><code>1</code></td><td>dev_major</td><td>u8</td><td></td></tr>
              <tr><td><code>2</code></td><td>dev_minor</td><td>u8</td><td></td></tr>
              <tr><td><code>3</code></td><td>dev_patch</td><td>u8</td><td></td></tr>
              <tr><td><code>4</code></td><td>dev_slot</td><td>u8</td><td>0 = <code>ota_0</code>, 1 = <code>ota_1</code></td></tr>
              <tr><td><code>5</code></td><td>dev_state</td><td>u8</td><td>image state, below</td></tr>
              <tr><td><code>6</code></td><td>host_present</td><td>u8</td><td>1 when the host chip has answered over the link</td></tr>
              <tr><td><code>7</code></td><td>host_major</td><td>u8</td><td>0 when <code>host_present</code> is 0</td></tr>
              <tr><td><code>8</code></td><td>host_minor</td><td>u8</td><td></td></tr>
              <tr><td><code>9</code></td><td>host_patch</td><td>u8</td><td></td></tr>
              <tr><td><code>10</code></td><td>host_slot</td><td>u8</td><td><code>0xFF</code> when <code>host_present</code> is 0</td></tr>
              <tr><td><code>11</code></td><td>host_state</td><td>u8</td><td></td></tr>
              <tr><td><code>12</code></td><td>slot_size</td><td>u32 LE</td><td>usable bytes in a spare slot; the same on both chips</td></tr>
              <tr><td><code>16</code></td><td>staged</td><td>u8</td><td>bit 0 device staged, bit 1 host staged</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">STATE</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>State</th><th>Means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>new</td><td>selected but not yet booted</td></tr>
              <tr><td><code>1</code></td><td>pending-verify</td><td>booted, on probation; this is the window rollback lives in</td></tr>
              <tr><td><code>2</code></td><td>valid</td><td>confirmed by the image itself</td></tr>
              <tr><td><code>3</code></td><td>invalid</td><td>the image asked to be rolled back</td></tr>
              <tr><td><code>4</code></td><td>aborted</td><td>booted once and never confirmed</td></tr>
              <tr><td><code>0xFF</code></td><td>unknown</td><td>no entry for this slot</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>Both chips on 3.2.0, device on <code>ota_1</code>, host on <code>ota_0</code>, nothing staged:</p>
          <pre class="diagram">{`  0B 03 02 00 01 02   01 03 02 00 00 02   00 00 0F 00   00
  |  |        |  |    |  |        |  |    |             |
  |  device   |  state|  host     |  state slot_size    staged
  what        slot    present     slot    0x000F0000    none`}</pre>
        </Card>
      </div>

      <div id="install" data-search-target>
        <Card>
          <CardHeader title="Getting onto this layout" subtitle="One flash per box, ever" />
          <p>
            A box on the single-app layout answers <code>NOSLOT</code>. Installing the two slots is a
            partition-table change, which an update cannot perform, so it takes one flash over ROM
            download per chip.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Chip</th><th>How</th></tr>
            </thead>
            <tbody>
              <tr><td>Device</td><td><A href="/native/commands/admin#reboot"><code>REBOOT</code></A> target 0, then esptool on its own USB</td></tr>
              <tr><td>Host</td><td><A href="/native/commands/admin#reboot"><code>REBOOT</code></A> target 1, then esptool over USB3</td></tr>
            </tbody>
          </table>
          <p>
            Write bootloader, partition table, app and a blank <code>otadata</code> together, or use
            the factory image, which contains all four. After that the chip takes every later image
            over this port.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Update;
