import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Transform: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transform" subtitle="Weigh, swap, or remap a field on the wire" />
        <p>
          A transform rewrites a field the clone's descriptor declares: weigh one axis, exchange two,
          or move a field into another. It needs no{' '}
          <A href="/library/options#allow-imperfect-clones">imperfect-clone opt-in</A>, unlike the{' '}
          <A href="/library/advanced/raw">advanced control layer</A>.
        </p>
        <p>
          Transforms run before rendering, so <A href="/library/inject">injection</A>, riding, and
          rendering see the transformed field. They are session state, re-asserted on reconnect like a{' '}
          <A href="/library/lock"><code>lock</code></A>, and cleared on control-PC silence,{' '}
          <A href="/library/admin#reset"><code>reset</code></A>, a detach, or a re-clone.
        </p>
        <pre class="diagram">{`  native report        the box's semantic path                          the wire

  X Y wheel pan  --> parse --> [ field transform ] --> lock --> render --> emit
  buttons/keys                  scale  swap
                                remap (X->Y, btn->btn, same report)
                                          |
                                          +-- btn->key / btn->media --> that interface's report`}</pre>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Transform a...</th><th>Negate or weigh it</th><th>Exchange it with another</th><th>Move it into another field</th></tr></thead>
            <tbody>
              <tr><td>relative axis (X / Y / wheel / pan)</td><td><A href="/library/transform#helpers"><code>transform_invert</code></A> / <A href="/library/transform#helpers"><code>transform_scale</code></A></td><td><A href="/library/transform#helpers"><code>transform_swap</code></A></td><td><A href="/library/transform#helpers"><code>transform_remap</code></A></td></tr>
              <tr><td>button, key, or media usage</td><td>a full pass only</td><td>axes only</td><td><A href="/library/transform#helpers"><code>transform_remap</code></A>, from a button</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          All are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.{' '}
          <A href="/library/transform#transform"><code>transform</code></A> takes any{' '}
          <A href="/library/types/structs#transform"><code>Transform</code></A> built from parts, and{' '}
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
              <tr><td><code>t</code></td><td><A href="/library/types/structs#transform"><code>Transform</code></A></td><td>The operation, the source and destination <A href="/library/types/enums#lock-target">fields</A>, and the signed scale. Installing one past <code>Transforms::CAPACITY</code> is <A href="/library/types/errors#errors"><code>Error::TransformTableFull</code></A>.</td></tr>
            </tbody>
          </table>
          <p>
            An entry is keyed by its{' '}
            <A href="/library/types/structs#transform-key"><code>(source, dest)</code></A>; setting one
            whose key exists overwrites it in place. An entry the box refuses is absent from{' '}
            <A href="/library/transform#query-transforms"><code>query_transforms</code></A>.
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
          <CardHeader title="transform_invert / transform_scale / transform_swap / transform_remap" subtitle="The common transforms, one call each" />
          <pre class="api-signature">fn transform_invert(&self, axis: Axis) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn transform_scale(&self, axis: Axis, percent: i16) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn transform_swap(&self, a: Axis, b: Axis) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn transform_remap(&self, source: impl Into&lt;LockTarget&gt;, dest: impl Into&lt;LockTarget&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Each installs the <A href="/library/types/structs#transform"><code>Transform</code></A> its
            matching constructor builds, and refuses on the same terms as{' '}
            <A href="/library/transform#transform"><code>transform</code></A>.
          </p>
          <div class="callout callout--info">
            <p>
              The names carry the <code>transform_</code> prefix because{' '}
              <A href="/library/lock#scale"><code>scale</code></A> and{' '}
              <A href="/library/lock#lock-axis"><code>scale_axis</code></A> are the{' '}
              <A href="/library/lock"><code>lock</code></A> weigh. A transform's scale is signed and
              rewrites the field.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, Axis, Button, Key};

let device = Device::find()?;
device.transform_invert(Axis::Y)?;             // flip Y
device.transform_scale(Axis::X, 150)?;         // 1.5x horizontal
device.transform_swap(Axis::X, Axis::Y)?;      // exchange the two axes
device.transform_remap(Button::new(4), Key::A)?; // the fifth button emits 'A' on the keyboard interface`}</code></pre>
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
            <A href="/library/types/structs#transform-key"><code>(source, dest)</code></A>; its op and
            scale are ignored. <code>clear_transforms</code> drops the whole table.
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
            Returns a <A href="/library/types/structs#transforms"><code>Transforms</code></A>: the held
            entries in the order the box applies them, and a full flag.{' '}
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
device.transform_invert(Axis::Y)?;                   // sync
let table = block_on(device.query_transforms())?;    // query awaits`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Transform;
