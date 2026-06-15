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

      <div id="accumulator" data-search-target>
        <Card>
          <CardHeader title="How motion adds up" subtitle="The accumulator and large moves" />
          <p>
            The box totals pending motion in the{' '}
            <A href="/native/injection#state">accumulator</A> and drains it into HID reports. Rapid
            calls sum instead of dropping, and a large value paces across several reports rather than
            teleporting.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`// These two calls land in the same place as a single move_rel(30, 10).
device.move_rel(20, 0)?;
device.move_rel(10, 10)?;

// A large value still arrives in full; the box just paces it
// across several reports instead of one giant jump.
device.move_rel(30000, 0)?;`}</code></pre>
        </Card>
      </div>

      <div id="smooth-motion" data-search-target>
        <Card>
          <CardHeader title="Smooth motion" subtitle="Glide instead of teleport, and 1 kHz loops" />
          <p>
            There's no <code>move_smooth</code>: subdivide and loop with a ~1 ms sleep for ~1 kHz glide.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread::sleep;
use std::time::Duration;

// Glide ~400 counts to the right over 200 steps (~200 ms at 1 kHz).
for _ in 0..200 {
    device.move_rel(2, 0)?;
    sleep(Duration::from_millis(1));
}`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The library applies no rate limit. A no-sleep loop floods the 4 Mbaud link; pace your
              own steps.
            </p>
          </div>
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

      <div id="reset-note" data-search-target>
        <Card>
          <CardHeader title="Movement and passthrough" subtitle="Motion doesn't stick" />
          <p>
            Movement and scroll are one-shot, nothing stays held like a{' '}
            <A href="/library/buttons"><code>button</code></A> override.{' '}
            <A href="/library/admin#reset"><code>reset</code></A> clears button overrides but has
            nothing to clear for movement.
          </p>
        </Card>
      </div>

      <div id="complete-example" data-search-target>
        <Card>
          <CardHeader title="Putting it together" subtitle="Open, glide the cursor, scroll, done" />
          <p>
            Find the box, glide the cursor, scroll, return.
          </p>
          <pre><code>cargo add medius</code></pre>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;
use std::thread::sleep;
use std::time::Duration;

fn main() -> medius::Result<()> {
    let device = Device::find()?;

    // Glide ~400 counts to the right at roughly 1 kHz.
    for _ in 0..200 {
        device.move_rel(2, 0)?;
        sleep(Duration::from_millis(1));
    }

    // Scroll down three notches.
    device.wheel(-3)?;

    Ok(())
}`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Movement;
