import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Inject: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Inject" subtitle="Press and release any input" />
        <p>
          <A href="/library/inject#inject"><code>inject</code></A> drives every momentary input and
          takes any <A href="/library/types/structs#usage"><code>Usage</code></A> (button, key, or
          media);{' '}
          <A href="/library/inject#press"><code>press</code></A>,{' '}
          <A href="/library/inject#press"><code>release</code></A>, and{' '}
          <A href="/library/inject#press"><code>force_release</code></A> wrap it. Each call queues one <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> frame.
        </p>
      </Card>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="inject" subtitle="Press or release any usage" />
          <pre class="api-signature">fn inject(&self, usage: impl Into&lt;Usage&gt;, action: Action) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>usage</code> is any <A href="/library/types/structs#usage"><code>Usage</code></A>;{' '}
            <A href="/library/types/structs#button"><code>Button</code></A>,{' '}
            <A href="/library/types/structs#key"><code>Key</code></A>, and{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> all convert into one.{' '}
            <code>action</code> is the <A href="/library/types/enums#action"><code>Action</code></A>{' '}
            tri-state: press, soft-release, or force-release.
          </p>
          <p>
            A usage the cloned device can't report is a no-op. A click or chord is a press then a
            client-timed release.{' '}
            <A href="/library/admin#reset"><code>reset</code></A> releases every override.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key, MediaKey, Action};

device.inject(Button::LEFT, Action::Press)?;        // mouse button
device.inject(Key::LEFT_SHIFT, Action::Press)?;     // keyboard key
device.inject(MediaKey::VOLUME_UP, Action::Press)?; // media key`}</code></pre>
        </Card>
      </div>

      <div id="press" data-search-target>
        <Card>
          <CardHeader title="Press and release" subtitle="press, release, force_release" />
          <pre class="api-signature">fn press(&self, usage: impl Into&lt;Usage&gt;) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn release(&self, usage: impl Into&lt;Usage&gt;) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn force_release(&self, usage: impl Into&lt;Usage&gt;) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Wrappers over <A href="/library/inject#inject"><code>inject</code></A>, generic over any{' '}
            <A href="/library/types/structs#usage"><code>Usage</code></A>. <code>press</code> holds it
            down; <code>release</code> clears the box's press or force, leaving a physical hold down;{' '}
            <code>force_release</code> forces it up over a physical press.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key};

device.press(Button::LEFT)?;          // held down
device.release(Button::LEFT)?;        // box press cleared; a physical hold stays
device.force_release(Key::LEFT_GUI)?; // forced up over a physical hold`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Same calls, still synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> queues these too, with no{' '}
            <code>.await</code>; only queries are <code>async</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key};

// async_device: medius::AsyncDevice
async_device.press(Button::LEFT)?;   // no .await; queues the frame
async_device.press(Key::ESCAPE)?;`}</code></pre>
          <div class="callout callout--info">
            <p>
              Build an <code>AsyncDevice</code> with{' '}
              <code>cargo add medius --features async</code> and{' '}
              <A href="/library/connection#async"><code>AsyncDevice::open</code></A> or{' '}
              <code>Device::into_async</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Inject;
