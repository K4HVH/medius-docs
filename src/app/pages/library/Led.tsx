import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Led: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="LED" subtitle="Drive a status LED, or hand it back to the box" />
        <p>
          <A href="/library/led#led"><code>led</code></A> overrides one of the box's two green status
          LEDs, or with <A href="/library/types/enums#led-mode"><code>LedMode::Auto</code></A> returns it
          to the box's own status display. It's{' '}
          <A href="/native/injection#fire-and-forget">fire-and-forget</A>: one frame, no reply.
        </p>
      </Card>

      <div id="led" data-search-target>
        <Card>
          <CardHeader title="led" subtitle="Override or restore a status LED" />
          <pre class="api-signature">fn led(&self, target: LedTarget, mode: LedMode, level: u8) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <A href="/library/types/enums#led-target"><code>LedTarget</code></A> picks which chip's LED,
            and <A href="/library/types/enums#led-mode"><code>LedMode</code></A> picks what to drive it
            to; both enums and their bytes are on <A href="/library/types/enums">Types</A>.
            <code>level</code> is brightness <code>0..=255</code>, used by{' '}
            <code>Solid</code> and <code>Blink</code> and ignored for <code>Off</code> and{' '}
            <code>Auto</code>.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>target</code></td><td><A href="/library/types/enums#led-target"><code>LedTarget</code></A></td><td>Which chip's LED: <code>Device</code>, <code>Host</code>, or <code>Both</code>.</td></tr>
              <tr><td><code>mode</code></td><td><A href="/library/types/enums#led-mode"><code>LedMode</code></A></td><td><code>Auto</code> restores the status display; <code>Off</code>, <code>Solid</code>, and <code>Blink</code> override it.</td></tr>
              <tr><td><code>level</code></td><td><code>u8</code></td><td>Brightness 0-255 for <code>Solid</code> and <code>Blink</code>; ignored otherwise.</td></tr>
            </tbody>
          </table>
          <p>
            An override holds until you send <code>Auto</code>, and the box also reverts the LED to its
            status display on control-PC silence, on{' '}
            <A href="/library/admin#reset"><code>reset</code></A>, or on inter-chip link loss. See the
            native <A href="/native/commands/led#led"><code>LED</code></A> command for the status
            patterns each chip shows.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Device, LedTarget, LedMode};

let device = Device::find()?;
device.led(LedTarget::Both, LedMode::Blink, 200)?;   // both LEDs blink, bright
device.led(LedTarget::Device, LedMode::Auto, 0)?;    // hand the device LED back`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Still fire-and-forget, no await" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> re-exposes <code>led</code>{' '}
            unchanged: it expects no reply, so there's no <code>.await</code> and no{' '}
            <a href="https://docs.rs/futures/latest/futures/executor/fn.block_on.html" target="_blank" rel="noreferrer"><code>block_on</code></a>.
            Only the queries are async.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{AsyncDevice, LedTarget, LedMode};

let device = AsyncDevice::open("/dev/ttyACM0")?;
device.led(LedTarget::Host, LedMode::Solid, 128)?;   // sync, no await`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Led;
