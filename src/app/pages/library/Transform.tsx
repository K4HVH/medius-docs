import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Transform: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transform" subtitle="Negate, scale, swap, or remap a field on the wire" />
        <p>
          A transform negates, scales, swaps, or remaps a field the clone's descriptor declares, clamped
          to that field's declared range so every emitted report is one <A href="/native/injection">native</A>{' '}
          could produce. It needs no <A href="/library/options#allow-imperfect-clones">imperfect-clone
          opt-in</A>, unlike the <A href="/library/advanced/raw">advanced control layer</A>.
        </p>
        <p>
          Transforms run before rendering, so <A href="/library/inject">injection</A>, riding, and
          rendering see the transformed field. They are session state, re-asserted on reconnect like a{' '}
          <A href="/library/lock"><code>lock</code></A>, and cleared on control-PC silence,{' '}
          <A href="/library/admin#reset"><code>reset</code></A>, a detach, or a re-clone.
        </p>
        <pre class="diagram">{`  native report        the box's semantic path                          the wire

  X Y wheel pan  --> parse --> [ field transform ] --> lock --> render --> emit
  buttons/keys                  invert  scale  swap
                                remap (X->Y, btn->btn, same report)
                                          |
                                          +-- btn->key / btn->media --> that interface's report`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>To...</th><th>Call</th><th>Operation</th></tr></thead>
            <tbody>
              <tr><td>flip an axis</td><td><A href="/library/transform#helpers"><code>invert</code></A></td><td><code>Invert</code></td></tr>
              <tr><td>weigh an axis by a signed percent</td><td><A href="/library/transform#helpers"><code>scale_transform</code></A></td><td><code>Scale</code></td></tr>
              <tr><td>exchange two axes</td><td><A href="/library/transform#helpers"><code>swap</code></A></td><td><code>Swap</code></td></tr>
              <tr><td>move a field into another</td><td><A href="/library/transform#helpers"><code>remap</code></A></td><td><code>Remap</code></td></tr>
              <tr><td>anything, from parts</td><td><A href="/library/transform#transform"><code>transform</code></A></td><td>any</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          All are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.{' '}
          <A href="/library/transform#query-transforms"><code>query_transforms</code></A> reads the
          active table.
        </p>
      </Card>

      <div id="transform" data-search-target>
        <Card>
          <CardHeader title="transform" subtitle="Install or overwrite one field transform" />
          <pre class="api-signature">fn transform(&self, t: &Transform) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>t</code></td><td><A href="/library/transform#transform-type"><code>Transform</code></A></td><td>The operation, the <A href="/library/transform#field">source and destination</A> fields, and the signed scale.</td></tr>
            </tbody>
          </table>
          <p>
            An entry is keyed by <code>(source, dest)</code>; setting one whose key exists overwrites
            it. The crate rejects an op a field pair cannot take and a zero scale on an invert; see the{' '}
            <A href="/library/transform#refusals">refusals</A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Transform};

let device = Device::find()?;
device.transform(&Transform::invert(Axis::Y))?;              // flip vertical motion on the wire
device.transform(&Transform::scale_axis(Axis::Wheel, 200))?; // double the wheel's detents`}</code></pre>
        </Card>
      </div>

      <div id="helpers" data-search-target>
        <Card>
          <CardHeader title="invert / scale_transform / swap / remap" subtitle="The common transforms, one call each" />
          <pre class="api-signature">fn invert(&self, axis: Axis) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn scale_transform(&self, axis: Axis, percent: i16) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn swap(&self, a: Axis, b: Axis) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn remap(&self, source: impl Into&lt;TransformField&gt;, dest: impl Into&lt;TransformField&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Each installs one <A href="/library/transform#transform-type"><code>Transform</code></A> of
            the matching <A href="/library/transform#op">op</A>. The scale is signed: <code>200</code>{' '}
            doubles, <code>-50</code> halves and flips.
          </p>
          <div class="callout callout--info">
            <p>
              It is <code>scale_transform</code>, not <A href="/library/lock#scale"><code>scale</code></A>:
              that and <A href="/library/lock#lock-axis"><code>scale_axis</code></A> are the{' '}
              <A href="/library/lock"><code>lock</code></A> weigh. A transform's scale is signed and
              rewrites the field.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Button, Key};

let device = Device::find()?;
device.invert(Axis::Y)?;                    // flip Y
device.scale_transform(Axis::X, 150)?;      // 1.5x horizontal
device.swap(Axis::X, Axis::Y)?;             // exchange the two axes
device.remap(Button(4), Key::A)?;           // the fourth button emits 'A' on the keyboard interface`}</code></pre>
        </Card>
      </div>

      <div id="untransform" data-search-target>
        <Card>
          <CardHeader title="untransform / clear_transforms" subtitle="Drop one entry or the whole table" />
          <pre class="api-signature">fn untransform(&self, t: &Transform) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn clear_transforms(&self) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>untransform</code> drops the entry keyed by this transform's{' '}
            <code>(source, dest)</code>; its op and scale are ignored. <code>clear_transforms</code>{' '}
            drops the whole table.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let flip = Transform::invert(Axis::Y);
device.transform(&flip)?;
device.untransform(&flip)?;   // the same key, dropped
device.clear_transforms()?;   // or drop everything`}</code></pre>
        </Card>
      </div>

      <div id="query-transforms" data-search-target>
        <Card>
          <CardHeader title="query_transforms" subtitle="Read the active table" />
          <pre class="api-signature">fn query_transforms(&self) -&gt; Result&lt;Transforms&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>
          <p>
            Returns a <A href="/library/transform#readback"><code>Transforms</code></A>: the held entries
            and a full flag. The box holds up to eight; a refused entry is absent.{' '}
            <A href="/library/requests#health"><code>query_health</code></A> reports a non-empty table in
            its <A href="/library/types/structs#health"><code>transform_on</code></A> flag.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`let table = device.query_transforms()?;
println!("{} transforms{}", table.entries.len(), if table.table_full { " (full)" } else { "" });
for t in &table.entries {
    println!("  {:?} {:?} -> {:?} x{}", t.op, t.source, t.dest, t.scale);
}`}</code></pre>
        </Card>
      </div>

      <div id="op" data-search-target>
        <Card>
          <CardHeader title="TransformOp" subtitle="What a transform does to its fields" />
          <p>
            How the source and destination relate. An op a field pair cannot take is{' '}
            <A href="/library/types/errors#errors"><code>Error::TransformOpFields</code></A>.
          </p>
          <div class="table-scroll">
            <table class="api-params">
              <thead><tr><th>Op</th><th>Value</th><th>Fields</th><th>Effect</th></tr></thead>
              <tbody>
                <tr><td><code>Remap</code></td><td><code>0</code></td><td>axis→axis, button→button, button→key, button→media</td><td>Move the source's contribution into the destination, clearing the source. A cross-class remap emits the destination through its own interface on the button's edge.</td></tr>
                <tr><td><code>Swap</code></td><td><code>1</code></td><td>two axes</td><td>Read both, then write both, so it is not two remaps.</td></tr>
                <tr><td><code>Invert</code></td><td><code>2</code></td><td>one axis</td><td>Negate the axis; the scale is ignored.</td></tr>
                <tr><td><code>Scale</code></td><td><code>3</code></td><td>one axis</td><td>Weigh the axis by the signed scale.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="transform-type" data-search-target>
        <Card>
          <CardHeader title="Transform" subtitle="One field operation" />
          <pre class="api-signature">fn new(op: TransformOp, source: impl Into&lt;TransformField&gt;, dest: impl Into&lt;TransformField&gt;, scale: i16) -&gt; Transform</pre>
          <pre class="api-signature">fn invert(axis: Axis) -&gt; Transform</pre>
          <pre class="api-signature">fn scale_axis(axis: Axis, percent: i16) -&gt; Transform</pre>
          <pre class="api-signature">fn swap(a: Axis, b: Axis) -&gt; Transform</pre>
          <pre class="api-signature">fn remap(source: impl Into&lt;TransformField&gt;, dest: impl Into&lt;TransformField&gt;) -&gt; Transform</pre>
          <pre class="api-signature">fn with_scale(self, scale: i16) -&gt; Transform</pre>
          <p>
            The named constructors cover the common cases; <code>new</code> is the general form, and{' '}
            <code>with_scale</code> weighs a swap or remap.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>op</code></td><td><A href="/library/transform#op"><code>TransformOp</code></A></td><td>What the transform does.</td></tr>
              <tr><td><code>source</code></td><td><A href="/library/transform#field"><code>TransformField</code></A></td><td>The field the transform reads.</td></tr>
              <tr><td><code>dest</code></td><td><A href="/library/transform#field"><code>TransformField</code></A></td><td>The field the transform writes (equal to <code>source</code> for invert and scale).</td></tr>
              <tr><td><code>scale</code></td><td><code>i16</code></td><td>The signed percent (see below). Ignored by <code>Invert</code>.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The <strong>signed scale</strong> is a percent with a sign: <code>-100</code> inverts,{' '}
              <code>100</code> identity, <code>200</code> doubles, <code>-50</code> halves and flips,{' '}
              <code>0</code> blocks. The result is clamped to the destination's declared range.{' '}
              <code>Invert</code> ignores it; the box refuses a zero scale on one.
            </p>
          </div>
        </Card>
      </div>

      <div id="field" data-search-target>
        <Card>
          <CardHeader title="TransformField" subtitle="A field a transform reads or writes" />
          <p>
            A relative <A href="/library/types/enums#axis"><code>Axis</code></A> or a momentary{' '}
            <A href="/library/types/structs#usage"><code>Usage</code></A>. Any <code>Axis</code>,{' '}
            <code>Button</code>, <code>Key</code>, <code>MediaKey</code>, or <code>Usage</code> converts
            in, so <A href="/library/transform#helpers"><code>remap</code></A> takes them directly.
          </p>
          <table class="api-params">
            <thead><tr><th>Variant</th><th>Holds</th><th>Addresses</th></tr></thead>
            <tbody>
              <tr><td><code>Axis</code></td><td>an <A href="/library/types/enums#axis"><code>Axis</code></A></td><td>a relative axis: X, Y, wheel, or pan.</td></tr>
              <tr><td><code>Usage</code></td><td>a <A href="/library/types/structs#usage"><code>Usage</code></A></td><td>a momentary button, key, or media usage.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="readback" data-search-target>
        <Card>
          <CardHeader title="Transforms" subtitle="What a query returns" />
          <p>
            No generation counter: the table is re-asserted wholesale on reconnect, and each read-back
            entry is a live one, with no add/remove state.
          </p>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code>table_full</code></td><td><code>bool</code></td><td>A further entry was, or would be, refused past the ceiling of eight.</td></tr>
              <tr><td><code>entries</code></td><td><code>Vec&lt;<A href="/library/transform#transform-type">Transform</A>&gt;</code></td><td>One entry per installed transform, in installation order.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="refusals" data-search-target>
        <Card>
          <CardHeader title="Refusals" subtitle="What is rejected, and by whom" />
          <p>
            The crate checks two refusals before the wire; the rest are the box's. A device-refused
            entry is absent from <A href="/library/transform#query-transforms"><code>query_transforms</code></A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Refusal</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              <tr><td><A href="/library/types/errors#errors"><code>TransformOpFields</code></A></td><td>crate</td><td>The op cannot take this source/destination pair (for example a swap of a button, or a cross-class remap that is not button to key or media).</td></tr>
              <tr><td><A href="/library/types/errors#errors"><code>TransformInvertZeroScale</code></A></td><td>crate</td><td>An <code>Invert</code> carries a zero scale, which would block the field the op is not meant to.</td></tr>
              <tr><td>absent from the readback</td><td>box</td><td>A source or destination the clone's descriptor does not declare, a cross-class remap with no destination collection, or the eight-entry table already full.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="the transforms fire, query_transforms awaits" />
          <p>
            Transforms carry no opt-in check, so <A href="/library/features/async"><code>AsyncDevice</code></A>{' '}
            keeps every setter synchronous. Only <code>query_transforms</code> is a future.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use futures::executor::block_on;
use medius::{AsyncDevice, Axis};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.invert(Axis::Y)?;                              // sync
let table = block_on(device.query_transforms())?;    // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Transform;
