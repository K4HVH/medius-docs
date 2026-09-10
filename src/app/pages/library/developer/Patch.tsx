import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Patch: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Descriptor patches" subtitle="Overwrite the bytes the clone presents" />
        <p>
          A descriptor patch overwrites bytes in what the clone presents at enumeration &mdash; its
          device descriptor, a configuration, an interface's report descriptor, a string, or the BOS. A
          patch is keyed by <code>(section, cfg, index, offset)</code>, persisted per device (VID:PID)
          in the box's NVS, and takes effect when the clone next re-presents to the game PC.
        </p>
        <p>
          Unlike a <A href="/library/developer/rewrite">rewrite rule</A>, a patch is configuration, not
          session state: it survives a reconnect and clears only on{' '}
          <code>clear_patch</code>. The box always stores a patch, whatever the opt-in, and applies the
          stored set only under the imperfect-clone opt-in; storing is where you build the set, applying
          is where the clone re-presents with it.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  descriptors  ------------------->  [ descriptor patches ]  ---enumerate--->  device descriptor
                                       overwrite what the                      configuration
                                       clone presents                          report / string / BOS

  HID report   ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
  control      <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*`}</pre>
        <div class="callout callout--warning">
          <p>
            A patch never changes a descriptor's byte count. The box refuses (and logs) an apply whose
            patched descriptors would advertise one length and serve another. Applying is gated on the
            imperfect-clone opt-in; with{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>apply_patch</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>.
          </p>
        </div>
      </Card>

      <div id="section" data-search-target>
        <Card>
          <CardHeader title="The section" subtitle="Which descriptor a patch overwrites" />
          <p>
            The section names the descriptor, and <code>cfg</code> and <code>index</code> address within
            it. The key is <code>(section, cfg, index, offset)</code>: setting a patch whose key exists
            overwrites it, and a patch with empty <code>bytes</code> removes the patch at that key.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Section</th><th>Value</th><th>Overwrites</th><th><code>cfg</code> / <code>index</code></th></tr></thead>
              <tbody>
                <tr><td><code>Device</code></td><td><code>0</code></td><td>The 18-byte device descriptor.</td><td>ignored</td></tr>
                <tr><td><code>Config</code></td><td><code>1</code></td><td>A configuration descriptor.</td><td><code>cfg</code> is the configuration index</td></tr>
                <tr><td><code>Report</code></td><td><code>2</code></td><td>An interface's report descriptor.</td><td><code>cfg</code> + <code>index</code> are the interface number</td></tr>
                <tr><td><code>String</code></td><td><code>3</code></td><td>A string descriptor (the whole string).</td><td><code>index</code> is the string index</td></tr>
                <tr><td><code>Bos</code></td><td><code>4</code></td><td>The BOS descriptor.</td><td>ignored</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="patch" data-search-target>
        <Card>
          <CardHeader title="Patch" subtitle="The overwrite you store" />
          <p>
            The <code>offset</code> is where the overwrite starts within the descriptor, and{' '}
            <code>bytes</code> is what goes there. An empty <code>bytes</code> removes the patch at that
            key.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>section</code></td><td><A href="/library/developer/patch#section"><code>PatchSection</code></A></td><td>The descriptor this patch targets.</td></tr>
              <tr><td><code>cfg</code></td><td><code>u8</code></td><td>The configuration index, for <code>Config</code> / <code>Report</code>.</td></tr>
              <tr><td><code>index</code></td><td><code>u8</code></td><td>The interface or string index, for <code>Report</code> / <code>String</code>.</td></tr>
              <tr><td><code>offset</code></td><td><code>u16</code></td><td>The byte offset within the descriptor the overwrite starts at.</td></tr>
              <tr><td><code>bytes</code></td><td><code>Vec&lt;u8&gt;</code></td><td>The overwrite bytes; empty removes the patch at this key.</td></tr>
            </tbody>
          </table>
          <p>
            The Rust constructors match the sections: <code>Patch::new</code> for a whole-descriptor
            section (<code>Device</code> / <code>Bos</code>), <code>in_config</code>,{' '}
            <code>in_interface</code>, and <code>in_string</code> for the ones that take a{' '}
            <code>cfg</code> or <code>index</code>.
          </p>
          <div class="api-response-label">RUST</div>
          <pre><code class="language-rust">{`use medius::{Device, Patch, PatchSection};

let device = Device::find()?;

// Overwrite idVendor in the device descriptor (offset 8, little-endian), then re-present.
device.set_patch(&Patch::new(PatchSection::Device, 8, [0x34, 0x12]))?;
device.allow_imperfect_clones(true)?;
device.apply_patch()?;`}</code></pre>
          <div class="api-response-label">C</div>
          <pre><code class="language-c">{`MediusPatch p = {0};
p.section = MEDIUS_PATCH_SECTION_DEVICE;
p.offset = 8;                 // idVendor
p.len = 2;
p.bytes[0] = 0x34; p.bytes[1] = 0x12;
medius_device_set_patch(dev, &p);

medius_device_allow_imperfect_clones(dev, true);
medius_device_apply_patch(dev);`}</code></pre>
          <div class="api-response-label">PYTHON</div>
          <pre><code class="language-python">{`from medius import Patch, PatchSection

# Overwrite idVendor in the device descriptor (offset 8, little-endian), then re-present.
device.set_patch(Patch(PatchSection.DEVICE, 0, 0, 8, bytes([0x34, 0x12])))
device.allow_imperfect_clones(True)
device.apply_patch()`}</code></pre>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Store, apply, clear" subtitle="Building a set and showing it" />
          <p>
            Storing and applying are separate: <code>set_patch</code> builds the stored set,{' '}
            <code>apply_patch</code> re-presents the clone with it (one unplug/replug to the game PC),
            and <code>clear_patch</code> drops every patch for this device and re-presents unpatched.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Gated on the opt-in</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>set_patch(&amp;patch)</code></td><td>no</td><td>Store or overwrite one patch (or remove it, with empty bytes).</td></tr>
              <tr><td><code>apply_patch()</code></td><td>yes</td><td>Re-present the clone with the stored set.</td></tr>
              <tr><td><code>clear_patch()</code></td><td>no</td><td>Drop every patch and re-present unpatched.</td></tr>
              <tr><td><code>query_patches()</code></td><td>no</td><td>The stored set and its apply state.</td></tr>
              <tr><td><code>query_patch_entry(index)</code></td><td>no</td><td>One patch in full, in the shape <code>set_patch</code> takes.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">RUST</div>
          <pre><code class="language-rust">{`let set = device.query_patches()?;
println!("{} patches, applied={} pending={}", set.entries.len(), set.applied, set.pending);
if set.refused {
    eprintln!("the last apply was refused: a patched length no longer matched what it serves");
}`}</code></pre>
          <div class="api-response-label">PYTHON</div>
          <pre><code class="language-python">{`s = device.query_patches()
print(len(s.entries), "patches, applied=", s.applied, "pending=", s.pending)
if s.refused:
    print("the last apply was refused: a patched length no longer matched what it serves")`}</code></pre>
        </Card>
      </div>

      <div id="readback" data-search-target>
        <Card>
          <CardHeader title="PatchSet and PatchEntry" subtitle="The stored set and its apply state" />
          <p>
            <code>query_patches</code> returns the stored set plus the four flags that say where it
            stands against the live clone. Each row is a patch's key and length, without its bytes; read
            a full patch with <code>query_patch_entry</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>PatchSet flag</th><th>Set when</th></tr></thead>
            <tbody>
              <tr><td><code>applied</code></td><td>The stored set is applied to the live clone.</td></tr>
              <tr><td><code>pending</code></td><td>A stored change has not been applied yet; an <code>apply_patch</code> would re-present with it.</td></tr>
              <tr><td><code>refused</code></td><td>The last apply was refused &mdash; a patched descriptor's advertised length no longer matched what it serves. The box logged why.</td></tr>
              <tr><td><code>table_full</code></td><td>The store is full: a further patch was, or would be, refused.</td></tr>
            </tbody>
          </table>
          <p>
            The store holds up to 16 patches, and <code>entries</code> lists them, each a{' '}
            <code>PatchEntry</code> of <code>section</code>, <code>cfg</code>, <code>index</code>,{' '}
            <code>offset</code>, and <code>len</code>.
          </p>
          <pre class="diagram">{`  set_patch        --> stored          (survives reconnect; NVS, per VID:PID)
     |                     |
     | apply_patch         v
     +-------------> pending -> applied  (one replug; the clone re-presents patched)
                            \\
                             +-> refused (a patched length diverged; logged)`}</pre>
        </Card>
      </div>

      <div id="health" data-search-target>
        <Card>
          <CardHeader title="patch_on in HEALTH" subtitle="Reading an applied set back" />
          <p>
            <A href="/library/requests#health"><code>query_health</code></A> reports an applied patch set
            in its <code>patch_on</code> flag, one of the three developer flags the layer opened in the
            high byte of the <code>u16</code> <A href="/library/types/structs#health"><code>Health</code></A>{' '}
            word. The full 16-bit word is on the{' '}
            <A href="/library/developer/rewrite#health">rewrite page</A>.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Bit</th><th>Mask</th><th>Flag</th><th>Set when</th></tr></thead>
              <tbody>
                <tr><td>b8</td><td><code>0x0100</code></td><td><code>rewrite_on</code></td><td>The <A href="/library/developer/rewrite">rewrite-rule table</A> is non-empty.</td></tr>
                <tr><td>b9</td><td><code>0x0200</code></td><td><code>patch_on</code></td><td>A descriptor-patch set is applied to the clone.</td></tr>
                <tr><td>b10</td><td><code>0x0400</code></td><td><code>transform_on</code></td><td>A field transform is active (reserved).</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Patch;
