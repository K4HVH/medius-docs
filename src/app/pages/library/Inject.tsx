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
          One field-generic verb drives every momentary input.{' '}
          <A href="/library/inject#inject"><code>inject</code></A> takes any{' '}
          <A href="/library/types/enums#usage"><code>Usage</code></A> (a button, key, or media usage);{' '}
          <A href="/library/inject#press"><code>press</code></A>,{' '}
          <A href="/library/inject#press"><code>release</code></A>, and{' '}
          <A href="/library/inject#press"><code>force_release</code></A> are convenience wrappers. Each
          call queues one <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> frame.
        </p>
      </Card>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="inject" subtitle="Press or release any usage" />
          <pre class="api-signature">fn inject(&self, usage: impl Into&lt;Usage&gt;, action: Action) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>usage</code> is any <A href="/library/types/enums#usage"><code>Usage</code></A>: a{' '}
            <A href="/library/types/enums#button"><code>Button</code></A>, a{' '}
            <A href="/library/types/structs#key"><code>Key</code></A>, or a{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> all convert into one.{' '}
            <code>action</code> is the shared{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> tri-state.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>usage</code></td><td><code>impl Into&lt;<A href="/library/types/enums#usage">Usage</A>&gt;</code></td><td>A <code>Button</code>, <code>Key</code>, or <code>MediaKey</code>, or a <code>Usage</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#action"><code>Action</code></A></td><td>Press, soft-release, or force-release.</td></tr>
            </tbody>
          </table>
          <p>
            A usage the cloned device can't report is a no-op, and there's no firmware click or chord
            (compose a press then a client-timed release).{' '}
            <A href="/library/admin#reset"><code>reset</code></A> releases every override.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key, MediaKey, Action};

device.inject(Button::Left, Action::Press)?;        // mouse button
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
            The convenience wrappers over <A href="/library/inject#inject"><code>inject</code></A>,
            generic over any <A href="/library/types/enums#usage"><code>Usage</code></A>.{' '}
            <code>press</code> holds it down, <code>release</code> clears the box's press or force while a
            physical hold stays down, and <code>force_release</code> forces it up over a physical press.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key};

device.press(Button::Left)?;          // held down
device.release(Button::Left)?;        // your press cleared; a physical hold survives
device.force_release(Key::LEFT_GUI)?; // forced up even under a physical hold`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Same calls, still synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> queues these frames too, so no{' '}
            <code>.await</code>; only the query methods are <code>async</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-rust">{`use medius::{Button, Key};

// async_device: medius::AsyncDevice
async_device.press(Button::Left)?;   // no .await, it just queues the frame
async_device.press(Key::ESCAPE)?;`}</code></pre>
          <div class="callout callout--info">
            <p>
              Build an <code>AsyncDevice</code> with{' '}
              <code>cargo add medius --features async</code> and{' '}
              <A href="/library/connection"><code>AsyncDevice::open</code></A> or{' '}
              <code>Device::into_async</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Inject;
