import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Move: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Move" subtitle="Cursor motion and scroll" />
        <p>
          One field-generic verb, <A href="/library/move#move"><code>move_axis</code></A>, drives the
          relative axes. <A href="/library/move#move-rel"><code>move_rel</code></A> and{' '}
          <A href="/library/move#wheel"><code>wheel</code></A> are thin wrappers over it. Each call
          queues one <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
          <A href="/native/commands/move#move"><code>MOVE</code></A> frame.
        </p>
        <table class="api-params">
          <thead><tr><th>You want</th><th>Method</th><th>Same as</th></tr></thead>
          <tbody>
            <tr><td>move the cursor</td><td><A href="/library/move#move-rel"><code>move_rel(dx, dy)</code></A></td><td><code>move_axis(Motion::Cursor {'{'} dx, dy {'}'})</code></td></tr>
            <tr><td>scroll the wheel</td><td><A href="/library/move#wheel"><code>wheel(dz)</code></A></td><td><code>move_axis(Motion::Wheel(dz))</code></td></tr>
          </tbody>
        </table>
      </Card>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="move_axis" subtitle="Field-generic motion verb" />
          <pre class="api-signature">fn move_axis(&self, motion: Motion) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>motion</code> is a <A href="/library/types/enums#motion"><code>Motion</code></A>:{' '}
            <code>Cursor {'{'} dx, dy {'}'}</code> for pointer movement or <code>Wheel(dz)</code> for
            scroll. Backs the <A href="/native/commands/move#move"><code>MOVE</code></A> command.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Motion;

device.move_axis(Motion::Cursor { dx: 20, dy: 20 })?; // right and down
device.move_axis(Motion::Wheel(1))?;                  // one notch up`}</code></pre>
        </Card>
      </div>

      <div id="move-rel" data-search-target>
        <Card>
          <CardHeader title="move_rel" subtitle="Relative cursor movement" />
          <pre class="api-signature">fn move_rel(&self, dx: i16, dy: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            A wrapper over <A href="/library/move#move"><code>move_axis</code></A> with{' '}
            <code>Motion::Cursor</code>.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset in mouse counts. Positive moves right, negative moves left.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset in mouse counts. Positive moves down, negative moves up (screen-style, not math-style).</td></tr>
            </tbody>
          </table>
          <p>
            Offsets are mouse counts, not pixels, scaled by the OS pointer-speed and acceleration
            curve. Both span the full <code>i16</code> range (<code>-32768 to 32767</code>).
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.move_rel(20, 20)?;  // right and down
device.move_rel(-40, 0)?;  // left
device.move_rel(0, -10)?;  // up`}</code></pre>
        </Card>
      </div>

      <div id="wheel" data-search-target>
        <Card>
          <CardHeader title="wheel" subtitle="Wheel scroll" />
          <pre class="api-signature">fn wheel(&self, delta: i16) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            A wrapper over <A href="/library/move#move"><code>move_axis</code></A> with{' '}
            <code>Motion::Wheel</code>.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>delta</code></td><td><code>i16</code></td><td>Scroll steps. Positive scrolls up, negative scrolls down.</td></tr>
            </tbody>
          </table>
          <p>
            <code>delta</code> spans the full <code>i16</code> range (<code>-32768 to 32767</code>) and
            feeds the same <A href="/native/injection#state">accumulator</A> as cursor motion, pacing
            large values across reports.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.wheel(3)?;   // up three notches
device.wheel(-1)?;  // down one notch`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Movement stays synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps{' '}
            <code>move_axis</code>, <code>move_rel</code>, and <code>wheel</code> synchronous: no{' '}
            <code>.await</code>, same signatures. The{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>{' '}
            pattern is only for async queries.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let dev = Device::find()?.into_async();
dev.move_rel(40, 0)?;  // no .await
dev.wheel(1)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Move;
