import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Movement: Component = () => {
  return (
    <>
      <div id="movement-overview" data-search-target>
        <Card>
          <CardHeader title="Movement and scroll" subtitle="Relative cursor motion and wheel input" />
          <p>
            <code>move_rel</code> and <code>wheel</code> are{' '}
            <A href="/native/injection#fire-and-forget"><code>fire-and-forget</code></A> injection over passthrough.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Frame</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>move_rel</code></td><td><A href="/native/commands/movement#move"><code>MOVE</code></A></td><td>Carries relative cursor motion.</td></tr>
              <tr><td><code>wheel</code></td><td><A href="/native/commands/movement#wheel"><code>WHEEL</code></A></td><td>Carries wheel scroll steps.</td></tr>
            </tbody>
          </table>
          <p>See also: <A href="/library/guides/smooth-motion">smooth motion</A>, the <A href="/library/examples#move-scroll">worked example</A>, and how the box <A href="/native/injection#state">accumulates motion</A>.</p>
        </Card>
      </div>

      <div id="move-rel" data-search-target>
        <Card>
          <CardHeader title="move_rel" subtitle="Relative cursor movement" />
          <pre class="api-signature">fn move_rel(&self, dx: i16, dy: i16) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
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
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
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
            feeds the same <A href="/native/injection#state">accumulator</A> as movement, pacing large
            values across reports.
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
            <A href="/library/features/async"><code>AsyncDevice</code></A> keeps <code>move_rel</code>{' '}
            and <code>wheel</code> synchronous: no <code>.await</code>, same signatures. The{' '}
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

export default Movement;
