import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Patch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Patch" subtitle="Overwrite bytes in the clone's descriptors" />
        <p>
          <A href="/native/commands/patch#patch"><code>PATCH</code></A> stores byte overwrites for the
          descriptors the clone serves at enumeration. The set persists in NVS under the device's
          VID:PID, and the clone serves the copy taken at its last{' '}
          <A href="/native/commands/patch#presentation">presentation</A>.
        </p>
        <pre class="diagram">{`  real device --USB3--> HOST chip
                            |
                            |  snapshot of every descriptor
                            v
  NVS, per VID:PID ---> DEVICE chip    copy the stored set, overwrite in place
  [ stored set ]            |
                            |  clone checks, consistency checks
                            v
  game PC <---USB1----- the clone      patched, or unpatched when a check fails`}</pre>
        <table class="api-params">
          <thead>
            <tr><th>Action</th><th>Value</th><th>Effect</th></tr>
          </thead>
          <tbody>
            <tr><td><A href="/native/commands/patch#patch">store</A></td><td><code>0</code> to <code>4</code></td><td>add, overwrite or remove one patch in the stored set</td></tr>
            <tr><td><A href="/native/commands/patch#apply">APPLY</A></td><td><code>0xFE</code></td><td>present the clone again with the stored set</td></tr>
            <tr><td><A href="/native/commands/patch#clear">CLEAR</A></td><td><code>0xFF</code></td><td>erase the set; a clone serving patches is presented again without them</td></tr>
          </tbody>
        </table>
        <p>
          The value is the first payload byte. Read the set back with{' '}
          <A href="/native/commands/requests#patches"><code>QUERY(PATCHES)</code></A> and one patch in
          full with <A href="/native/commands/requests#patch-entry"><code>QUERY(PATCH_ENTRY)</code></A>.
        </p>
        <div class="callout callout--warning">
          <p>
            A stored set reaches the game PC only under{' '}
            <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A>; see{' '}
            <A href="/native/commands/patch#gate">the gate</A>.
          </p>
        </div>
      </Card>

      <div id="patch" data-search-target>
        <Card>
          <CardHeader title="PATCH" subtitle="Store, overwrite, or remove one patch" />
          <p>
            A patch names a descriptor, an offset into it, and the bytes to write there.{' '}
            <A href="/native/frame#opcodes">Opcode</A> <code>0x1D</code>.
          </p>
          <pre class="api-signature">PATCH  0x1D  ·  payload 5 + n bytes</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>section</code></td><td><code>u8</code></td><td>descriptor (table below)</td></tr>
              <tr><td>1</td><td><code>cfg</code></td><td><code>u8</code></td><td>configuration's position in capture order, <code>0</code> first</td></tr>
              <tr><td>2</td><td><code>index</code></td><td><code>u8</code></td><td>interface number for REPORT, string index for STRING</td></tr>
              <tr><td>3</td><td><code>offset</code></td><td><code>u16</code></td><td>first byte overwritten, counted from the descriptor's first byte; little-endian</td></tr>
              <tr><td>5</td><td><code>bytes</code></td><td><code>u8[]</code></td><td>overwrite, 0 to 505 bytes, delimited by the frame <A href="/native/frame#layout"><code>LEN</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SECTION</div>
          <table class="api-params">
            <thead>
              <tr><th>Value</th><th>Name</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>0</code></td><td>DEVICE</td><td>the 18-byte device descriptor; <code>cfg</code> and <code>index</code> ignored</td></tr>
              <tr><td><code>1</code></td><td>CONFIG</td><td>configuration <code>cfg</code>, every byte of its <code>wTotalLength</code>; <code>index</code> ignored</td></tr>
              <tr><td><code>2</code></td><td>REPORT</td><td>the HID report descriptor of interface <code>index</code> in configuration <code>cfg</code></td></tr>
              <tr><td><code>3</code></td><td>STRING</td><td>string <code>index</code>, replaced whole; <code>cfg</code> and <code>offset</code> ignored</td></tr>
              <tr><td><code>4</code></td><td>BOS</td><td>the BOS descriptor; <code>cfg</code> and <code>index</code> ignored</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">KEY</div>
          <p>
            A patch is stored under <code>(section, cfg, index, offset)</code> exactly as sent, ignored
            fields included, so send <code>0</code> in those.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Sent</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>bytes at a new key</td><td>appended to the set</td></tr>
              <tr><td>other bytes at a stored key</td><td>replaced and moved to the end of the set</td></tr>
              <tr><td>the bytes already stored at that key</td><td>no change: the patch keeps its place and NVS is untouched</td></tr>
              <tr><td>zero bytes at a stored key</td><td>removed</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>no device attached</td><td>the set is keyed on the attached device; a device the box refuses to clone still counts as attached</td></tr>
              <tr><td>store payload under 5 bytes</td><td>the first five are the address</td></tr>
              <tr><td><code>section</code> is <code>5</code> to <code>0xFD</code></td><td>five descriptor kinds, then APPLY and CLEAR</td></tr>
              <tr><td><code>bytes</code> longer than 505</td><td>the patch must fit its <A href="/native/commands/requests#patch-entry"><code>RESP(PATCH_ENTRY)</code></A> read-back in one frame</td></tr>
              <tr><td>a 17th key</td><td>16 patches per device; <A href="/native/commands/requests#patches"><code>RESP(PATCHES)</code></A> sets <code>FULL</code></td></tr>
              <tr><td>the set's bytes would pass 1024</td><td>one pool holds every patch's bytes; <code>FULL</code> is set, and an overwrite that does not fit leaves the old patch in place</td></tr>
              <tr><td>zero <code>bytes</code> at an unstored key</td><td>nothing to remove</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            A change is written to NVS at once and reaches the game PC at the clone's next{' '}
            <A href="/native/commands/patch#presentation">presentation</A>. A refused frame has no
            reply: read <A href="/native/commands/requests#patches"><code>RESP(PATCHES)</code></A> for
            the patch, or for <code>FULL</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>
            Set <code>bcdDevice</code> to <code>0x0200</code>: section DEVICE, <code>offset = 12</code>,
            bytes <code>00 02</code>:
          </p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1D     | 00     | 07 00  | 00     | 00     |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | section| cfg    |
+--------+--------+--------+--------+--------+--------+

+--------+--------+--------+--------+
| 00     | 0C 00  | 00 02  | lo hi  |
+--------+--------+--------+--------+
| index  | offset | bytes  | CRC16  |
+--------+--------+--------+--------+`}</pre>
          <p>
            Library binding:{' '}
            <A href="/library/advanced/patch#set-patch"><code>set_patch</code></A>.
          </p>
        </Card>
      </div>

      <div id="apply" data-search-target>
        <Card>
          <CardHeader title="APPLY" subtitle="Present the clone again with the stored set" />
          <p>
            APPLY is a <code>PATCH</code> frame with <code>section</code> <code>0xFE</code>; the rest
            of the payload is ignored.
          </p>
          <pre class="api-signature">PATCH  0x1D  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>section</code></td><td><code>u8</code></td><td><code>0xFE</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <p>
            When the stored set differs from the one the clone serves, the box{' '}
            <A href="/native/commands/patch#presentation">presents</A> the clone again with a copy of
            the stored set and runs the <A href="/native/commands/patch#ladder">checks</A>. An emptied
            set presents it unpatched.
          </p>
          <div class="api-response-label">REFUSALS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>the stored set is the one the clone serves</td><td>it would change nothing and cost the game PC a re-enumeration</td></tr>
              <tr><td>the stored set failed a check at its last presentation and is unchanged since</td><td>it would fail the same way; <A href="/native/commands/requests#patches"><code>PATCHES</code></A> b2 is set</td></tr>
              <tr><td><A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A> off</td><td>the clone serves no patches without the opt-in</td></tr>
              <tr><td>no device attached</td><td>the box rebuilds the clone from the snapshot taken at attach</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <p>Present the stored set:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1D     | 01     | 01 00  | FE     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | section| CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library binding:{' '}
            <A href="/library/advanced/patch#apply-patch"><code>apply_patch</code></A>.
          </p>
        </Card>
      </div>

      <div id="clear" data-search-target>
        <Card>
          <CardHeader title="CLEAR" subtitle="Erase the set and present the clone without it" />
          <p>
            CLEAR is a <code>PATCH</code> frame with <code>section</code> <code>0xFF</code>.
            It runs with the opt-in off and with the device unplugged.
          </p>
          <pre class="api-signature">PATCH  0x1D  ·  payload 1 byte</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <div class="api-response-label">PAYLOAD</div>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>section</code></td><td><code>u8</code></td><td><code>0xFF</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EFFECT</div>
          <table class="api-params">
            <thead>
              <tr><th>State</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>the clone serves patches</td><td>the set and its NVS key are erased, and the clone is <A href="/native/commands/patch#presentation">presented</A> again unpatched, as APPLY presents it</td></tr>
              <tr><td>the clone serves none</td><td>the set and its NVS key are erased; the clone is unchanged</td></tr>
            </tbody>
          </table>
          <p>
            Either way <A href="/native/commands/requests#patches"><code>RESP(PATCHES)</code></A> then
            reads with <code>REFUSED</code> and <code>FULL</code> clear. With the device unplugged,
            CLEAR erases the key of the last device attached since boot, or nothing after a boot with
            none attached.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <p>Erase the set:</p>
          <pre class="diagram">{`+--------+--------+--------+--------+--------+--------+
| A5     | 1D     | 02     | 01 00  | FF     | lo hi  |
+--------+--------+--------+--------+--------+--------+
| SOF    | TYPE   | SEQ    | LEN    | section| CRC16  |
+--------+--------+--------+--------+--------+--------+`}</pre>
          <p>
            Library binding:{' '}
            <A href="/library/advanced/patch#clear-patch"><code>clear_patch</code></A>.
          </p>
        </Card>
      </div>

      <div id="presentation" data-search-target>
        <Card>
          <CardHeader title="Presentation" subtitle="When the stored set reaches the game PC" />
          <p>
            The clone serves the set it was last presented with, every section included. A
            presentation copies the stored set, runs the <A href="/native/commands/patch#ladder">checks</A>{' '}
            and re-enumerates the clone on the game PC.
          </p>
          <pre class="diagram">{`  PATCH   --> stored set        NVS, read back by QUERY(PATCHES)
                  |
                  |  presentation: attach, APPLY, CLEAR, opt-in toggle
                  v
              served set        what the game PC reads at enumeration`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Presents when</th><th>Serves</th></tr>
            </thead>
            <tbody>
              <tr><td>the device attaches</td><td>always</td><td>the stored set, under the opt-in</td></tr>
              <tr><td><A href="/native/commands/patch#apply">APPLY</A></td><td>the stored set differs from the served one</td><td>the stored set, or none when it is empty</td></tr>
              <tr><td><A href="/native/commands/patch#clear">CLEAR</A></td><td>the clone serves patches</td><td>none</td></tr>
              <tr><td>the <A href="/native/commands/patch#gate">opt-in</A> turned on</td><td>the stored set differs from the served one and is not <A href="/native/commands/patch#ladder">refused</A></td><td>the stored set</td></tr>
              <tr><td>the opt-in turned off</td><td>the clone serves patches</td><td>none</td></tr>
            </tbody>
          </table>
          <p>
            <A href="/native/commands/requests#patches"><code>RESP(PATCHES)</code></A> lists the stored
            set; its flags say whether the clone serves it.
          </p>
          <div class="callout callout--info">
            <p>
              A presentation re-clones the device, as a replug does. It releases{' '}
              <A href="/native/injection#state">injection</A>,{' '}
              <A href="/native/commands/lock">locks</A>,{' '}
              <A href="/native/commands/transform">transforms</A>,{' '}
              <A href="/native/commands/rewrite#lifecycle">rewrite rules</A>, the loaded{' '}
              <A href="/native/commands/clip">clip</A> and its triggers, and the{' '}
              <A href="/native/commands/catch"><code>CATCH</code></A> table.
              The release moves the{' '}
              <A href="/native/commands/requests#stats"><code>session</code></A> count.
            </p>
          </div>
        </Card>
      </div>

      <div id="sections" data-search-target>
        <Card>
          <CardHeader title="Sections" subtitle="Per-section behaviour" />
          <p>
            A patch writes over bytes the descriptor already has, except STRING, which replaces the
            string. One that would run past the descriptor's end is skipped whole, never truncated.
          </p>
          <pre class="diagram">{`  device descriptor   00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 11
  offset 12, 2 bytes                                      xx xx                  lands
  offset 17, 2 bytes                                                     xx xx   past the end: skipped`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Name</th><th>Behaviour</th></tr>
            </thead>
            <tbody>
              <tr><td>DEVICE</td><td>Writes the served identity, which <A href="/native/commands/requests#device-info"><code>QUERY(DEVICE_INFO)</code></A> then reports. The set and every learned setting stay keyed on the real VID:PID. Byte 17, <code>bNumConfigurations</code>, is set to the captured configuration count after the patch lands.</td></tr>
              <tr><td>CONFIG</td><td>Writes the served configuration, which the box then parses for its interfaces and endpoints, so a patched endpoint faces the same clone checks a native one does.</td></tr>
              <tr><td>REPORT</td><td>Writes the report descriptor before the box parses it, so <A href="/native/commands/inject"><code>INJECT</code></A>, <A href="/native/commands/lock"><code>LOCK</code></A> and the emitted report follow the patched layout.</td></tr>
              <tr><td>STRING</td><td>Serves the bytes as the whole string, any length up to 127, one UTF-16 code unit per byte; a <code>0x00</code> byte ends it. Index <code>0</code>, the language list, is not patched.</td></tr>
              <tr><td>BOS</td><td>Writes the BOS descriptor, on a device that has one.</td></tr>
            </tbody>
          </table>
          <p>
            With two STRING patches on one index, the one listed first in{' '}
            <A href="/native/commands/requests#patches"><code>RESP(PATCHES)</code></A> is served. An
            overwrite moves a patch to the end of that list.
          </p>
          <div class="callout callout--info">
            <p>
              A CONFIG patch to <code>bInterval</code> is served as written, while the box keeps
              polling the device at the rate{' '}
              <A href="/native/commands/option#emit"><code>OPTION(EMIT)</code></A> forces.
            </p>
          </div>
        </Card>
      </div>

      <div id="ladder" data-search-target>
        <Card>
          <CardHeader title="Checks" subtitle="What a patched clone must pass" />
          <p>
            A set that fails a check the device passes without it is refused: the clone is presented
            unpatched and one <A href="/native/commands/admin#log"><code>LOG</code></A> line names the
            check. A device that fails without the set is refused as any device is.
          </p>
          <pre class="diagram">{`  patched descriptors
        |
        +-- the clone checks every device faces
        +-- framing: length and type fields
        +-- bcdUSB against BOS
        +-- wDescriptorLength against the report descriptor, every configuration
        +-- wMaxPacketSize against the report, the configuration in force
        |
        +-- all hold   -->  clone served patched, PATCHES b0, HEALTH PATCH_ON
        +-- one fails  -->  clone served unpatched, PATCHES b1 + b2, one LOG line`}</pre>
          <div class="api-response-label">CHECKS</div>
          <table class="api-params">
            <thead>
              <tr><th>Refused when</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>a clone check fails, such as an endpoint <code>wMaxPacketSize</code> above 64</td><td>the patched descriptors face the checks every device does</td></tr>
              <tr><td>a patch changes the device descriptor's <code>bLength</code> or <code>bDescriptorType</code>, or a configuration's or the BOS's <code>bLength</code>, <code>bDescriptorType</code> or <code>wTotalLength</code></td><td>the box serves these as written: a larger length reads the host past the descriptor, a smaller one hides its tail</td></tr>
              <tr><td><code>bcdUSB</code> <code>0x0201</code> or above with no BOS</td><td>a host requests the BOS of any 2.01 device</td></tr>
              <tr><td>a HID descriptor's <code>wDescriptorLength</code> differs from its served report descriptor, in any configuration</td><td>the game PC would ask for one length and get another</td></tr>
              <tr><td>an interrupt-IN endpoint of a HID interface, in the configuration in force, has a <code>wMaxPacketSize</code> below that interface's report</td><td>the report would not fit the packet the endpoint advertises</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">REFUSED SET</div>
          <p>
            The set stays stored with{' '}
            <A href="/native/commands/requests#patches"><code>PATCHES</code></A> b2 set until it
            changes, and <A href="/native/commands/patch#apply">APPLY</A> skips it until then. Change
            or remove the failing patch and APPLY, or{' '}
            <A href="/native/commands/patch#clear">CLEAR</A> the set.
          </p>
        </Card>
      </div>

      <div id="gate" data-search-target>
        <Card>
          <CardHeader title="Opt-in gate" subtitle="Stored always, presented under the opt-in" />
          <p>
            <A href="/native/commands/option#imperfect"><code>OPTION(IMPERFECT)</code></A> gates
            whether the stored set reaches the clone.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Item</th><th>Opt-in off</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/native/commands/patch#patch"><code>PATCH</code></A></td><td>stored and written to NVS</td></tr>
              <tr><td><A href="/native/commands/patch#apply">APPLY</A></td><td>ignored</td></tr>
              <tr><td><A href="/native/commands/patch#clear">CLEAR</A></td><td>runs</td></tr>
              <tr><td>a clone of the device</td><td>presented unpatched, with <A href="/native/commands/requests#patches"><code>PATCHES</code></A> b1 set while a set is stored</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">TOGGLE</div>
          <p>
            A toggle <A href="/native/commands/patch#presentation">presents</A> the clone again when
            that changes the set it serves. When the clone needs the opt-in for anything else, the
            device chip reboots and re-clones, as the{' '}
            <A href="/native/commands/option#imperfect">option</A> describes.
          </p>
          <div class="api-response-label">WHILE APPLIED</div>
          <p>
            While the clone serves a patched set,{' '}
            <A href="/native/commands/requests#health"><code>HEALTH</code></A> sets{' '}
            <code>PATCH_ON</code> (<code>0x0200</code>) and{' '}
            <A href="/native/commands/requests#options"><code>QUERY(OPTIONS, 0)</code></A> reports{' '}
            <code>clone_imperfect = 1</code>. A refused set sets neither.
          </p>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="Stored configuration" />
          <p>
            A set is stored per device, loaded when that device attaches, and kept until a removal,
            a CLEAR, or a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> with the NVS flag erases it.
          </p>
          <div class="api-response-label">ERASED BY</div>
          <pre class="diagram">{`remove      a PATCH with zero bytes at the patch's key
CLEAR       a PATCH with section 0xFF: the whole set
RESET       a RESET carrying the NVS flag: the whole store`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Event</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td>the device detaches</td><td>the clone, <code>PATCH_ON</code> and <code>REFUSED</code> go; the set stays stored and readable until another device attaches</td></tr>
              <tr><td>another device attaches</td><td>that device's set loads in its place, cloned or refused</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Patch;
