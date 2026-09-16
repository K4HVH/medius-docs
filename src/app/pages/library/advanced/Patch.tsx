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
          A descriptor patch overwrites bytes in what the clone presents at enumeration, keyed by{' '}
          <code>(section, cfg, index, offset)</code> and persisted per device (VID:PID) in the box's NVS.
        </p>
        <p>
          Unlike a <A href="/library/advanced/rewrite">rewrite rule</A>, a patch is configuration, not
          session state: it survives a reconnect and clears only on{' '}
          <A href="/library/advanced/patch#clear-patch"><code>clear_patch</code></A>. The box stores a
          patch whatever the opt-in, and applies the stored set only under it.
        </p>
        <pre class="diagram">{`  native device          the box  (host chip  |  device chip = the clone)         game PC

  descriptors  ------------------->  [ descriptor patches ]  ---enumerate--->  device descriptor
                                       overwrite what the                      configuration
                                       clone presents                          report / string / BOS

  HID report   ---IN--->  [ HID_IN ]--> renderer --> [ EMIT ]---interrupt-IN--->  reads report
  control      <-- EP0 -> [ CONTROL ]<-- proxy ------------------- EP0 <-------->  GET_DESCRIPTOR, SET_*`}</pre>
        <div class="callout callout--warning">
          <p>
            A patch never changes a descriptor's byte count; the box refuses (and logs) an apply that
            would. Applying is gated on the imperfect-clone opt-in; with{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>{' '}
            off, <code>apply_patch</code> returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>.
          </p>
        </div>
        <p>
          The setters are <A href="/native/injection#fire-and-forget">fire-and-forget</A>;{' '}
          <A href="/library/advanced/patch#query-patches"><code>query_patches</code></A> reads back the
          stored set and its apply state.
        </p>
      </Card>

      <div id="set-patch" data-search-target>
        <Card>
          <CardHeader title="set_patch" subtitle="Store or overwrite one patch" />
          <pre class="api-signature">fn set_patch(&self, patch: &Patch) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>patch</code></td><td><A href="/library/types/structs#patch"><code>Patch</code></A></td><td>The overwrite: its <A href="/library/types/enums#patch-section">section</A>, address, offset, and bytes.</td></tr>
            </tbody>
          </table>
          <p>
            A patch is keyed by <code>(section, cfg, index, offset)</code>; setting one whose key exists
            overwrites it, and empty <code>bytes</code> removes it. Storing is not gated and does not
            re-present the clone; <A href="/library/advanced/patch#apply-patch"><code>apply_patch</code></A> does.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Patch, PatchSection};

let device = Device::find()?;

// Overwrite idVendor in the device descriptor (offset 8, little-endian), then re-present.
device.set_patch(&Patch::new(PatchSection::Device, 8, [0x34, 0x12]))?;
device.allow_imperfect_clones(true)?;
device.apply_patch()?;`}</code></pre>
        </Card>
      </div>

      <div id="apply-patch" data-search-target>
        <Card>
          <CardHeader title="apply_patch" subtitle="Re-present the clone with the stored set" />
          <pre class="api-signature">fn apply_patch(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Re-presents the clone with the stored patch set: one unplug/replug to the game PC. Gated on{' '}
            <A href="/library/options#allow-imperfect-clones"><code>allow_imperfect_clones</code></A>;
            with the opt-in off it returns{' '}
            <A href="/library/types/errors#errors"><code>Error::ImperfectRequired</code></A>. A refused
            apply shows in{' '}
            <A href="/library/advanced/patch#query-patches"><code>query_patches</code></A>'s{' '}
            <code>refused</code> flag.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.allow_imperfect_clones(true)?;
device.apply_patch()?; // the clone replugs and re-presents patched`}</code></pre>
        </Card>
      </div>

      <div id="clear-patch" data-search-target>
        <Card>
          <CardHeader title="clear_patch" subtitle="Drop every patch for this device" />
          <pre class="api-signature">fn clear_patch(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Drops every patch stored for this device (VID:PID) and re-presents the clone unpatched. This
            is the only thing that clears the stored set; a reconnect does not.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`device.clear_patch()?;`}</code></pre>
        </Card>
      </div>

      <div id="query-patches" data-search-target>
        <Card>
          <CardHeader title="query_patches" subtitle="Read the stored set and its apply state" />
          <pre class="api-signature">fn query_patches(&self) -&gt; Result&lt;PatchSet&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/types/structs#patch-set"><code>PatchSet</code></A>: the four
            apply-state flags and a row per stored patch, without its bytes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let set = device.query_patches()?;
println!("{} patches, applied={} pending={}", set.entries.len(), set.applied, set.pending);
if set.refused {
    eprintln!("the last apply was refused: a patched length no longer matched what it serves");
}`}</code></pre>
        </Card>
      </div>

      <div id="query-patch-entry" data-search-target>
        <Card>
          <CardHeader title="query_patch_entry" subtitle="Read one patch in full" />
          <pre class="api-signature">fn query_patch_entry(&self, index: u8) -&gt; Result&lt;Patch&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>index</code></td><td><code>u8</code></td><td>The row in the <A href="/library/advanced/patch#query-patches"><code>query_patches</code></A> summary.</td></tr>
            </tbody>
          </table>
          <p>
            Returns one <A href="/library/types/structs#patch"><code>Patch</code></A> in full, in the
            shape <A href="/library/advanced/patch#set-patch"><code>set_patch</code></A> takes.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let set = device.query_patches()?;
for i in 0..set.entries.len() as u8 {
    let patch = device.query_patch_entry(i)?; // replayable as a set
    let _ = patch;
}`}</code></pre>
        </Card>
      </div>

      <div id="section" data-search-target>
        <Card>
          <CardHeader title="The section (patch)" subtitle="Which descriptor a patch overwrites" />
          <p>
            A patch names one descriptor and a byte offset inside it: the device descriptor, a
            configuration, an interface's report descriptor, a string, or the BOS. Which section takes a{' '}
            <code>cfg</code> and which takes an <code>index</code> is on{' '}
            <A href="/library/types/enums#patch-section"><code>PatchSection</code></A>.
          </p>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="apply_patch and the queries await; set and clear fire" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> makes <code>apply_patch</code>{' '}
            a future (it awaits the opt-in check), as are <code>query_patches</code> and{' '}
            <code>query_patch_entry</code>. <code>set_patch</code> and <code>clear_patch</code> stay
            synchronous.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Patch, PatchSection};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.set_patch(&Patch::new(PatchSection::Device, 8, [0x34, 0x12]))?;  // sync
device.allow_imperfect_clones(true)?;
block_on(device.apply_patch())?;                                        // awaits the opt-in gate
let set = block_on(device.query_patches())?;                            // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Patch;
