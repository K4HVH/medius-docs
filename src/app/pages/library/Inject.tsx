import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Inject: Component = () => {
  return (
    <>
      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="Inject" subtitle="Press and release any input" />
          <p>
            One field-generic verb drives every momentary input. Each call queues one{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
            <A href="/native/commands/inject#inject"><code>INJECT</code></A> frame.
          </p>
          <pre class="api-signature">fn inject(&self, input: impl Into&lt;Input&gt;, action: Action) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>input</code> is anything that turns into an{' '}
            <A href="/library/types/enums#input"><code>Input</code></A>: a{' '}
            <A href="/library/types/enums#button"><code>Button</code></A>, a{' '}
            <A href="/library/types/structs#key"><code>Key</code></A>, or a{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> (each has{' '}
            <code>From</code>, so you pass it directly). <code>action</code> is the shared{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> tri-state.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>input</code></td><td><code>impl Into&lt;<A href="/library/types/enums#input">Input</A>&gt;</code></td><td>A <code>Button</code>, <code>Key</code>, or <code>MediaKey</code>, or an <code>Input</code>.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#action"><code>Action</code></A></td><td>Press, soft-release, or force-release.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">PICK A METHOD</div>
          <table class="api-params">
            <thead><tr><th>Input</th><th>Hold down</th><th>Release</th></tr></thead>
            <tbody>
              <tr><td><A href="/library/inject#button">button</A></td><td><code>press</code></td><td><code>soft_release</code> / <code>force_release</code></td></tr>
              <tr><td><A href="/library/inject#key">key</A></td><td><code>key_down</code></td><td><code>key_up</code> / <code>key_force_release</code></td></tr>
              <tr><td><A href="/library/inject#media">media</A></td><td><code>media_down</code></td><td><code>media_up</code> / <code>media_force_release</code></td></tr>
            </tbody>
          </table>
          <p>
            Every row is a thin wrapper over <code>inject</code> with the matching class; call{' '}
            <code>inject(input, action)</code> directly when the input or action is a value you're
            passing around. A usage the cloned device can't report is a no-op, and there's no firmware
            click or chord (compose a press then a client-timed release).{' '}
            <A href="/library/admin#reset"><code>reset</code></A> releases every override.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Key, MediaKey, Action};

device.inject(Button::Left, Action::Press)?;        // mouse button
device.inject(Key::LEFT_SHIFT, Action::Press)?;     // keyboard key
device.inject(MediaKey::VOLUME_UP, Action::Press)?; // media key`}</code></pre>
        </Card>
      </div>

      <div id="button" data-search-target>
        <Card>
          <CardHeader title="Buttons" subtitle="press, soft_release, force_release" />
          <pre class="api-signature">fn button(&self, button: Button, action: Action) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn press(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn soft_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn force_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            Override a mouse <A href="/library/types/enums#button"><code>Button</code></A> on the clone.{' '}
            <code>press</code> holds it down, <code>soft_release</code> clears your press while a
            physical hold stays down, and <code>force_release</code> forces it up over a physical press.{' '}
            <code>button</code> is the generic form taking an{' '}
            <A href="/library/types/enums#action"><code>Action</code></A>. All four are wrappers over{' '}
            <A href="/library/inject#inject"><code>inject</code></A> with the button class.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

device.press(Button::Left)?;        // held down
device.soft_release(Button::Left)?; // your press cleared; a physical hold survives
device.force_release(Button::Left)?;// forced up even under a physical hold`}</code></pre>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="Keys" subtitle="key, key_down, key_up, key_force_release" />
          <pre class="api-signature">fn key(&self, key: Key, action: Action) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_down(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_up(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_force_release(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The same four for a keyboard{' '}
            <A href="/library/types/structs#key"><code>Key</code></A> (a HID keycode;{' '}
            <code>0xE0</code>-<code>0xE7</code> is a modifier). <code>key_down</code> holds it,{' '}
            <code>key_up</code> clears your press while a physical hold survives, and{' '}
            <code>key_force_release</code> forces it up. A keycode the cloned board can't report is a
            no-op; held keys survive a reconnect like buttons.{' '}
            <A href="/library/admin#reset"><code>reset</code></A> releases every key.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Key;

device.key_down(Key::LEFT_SHIFT)?;
device.key_down(Key::A)?;            // types an uppercase A
device.key_up(Key::A)?;
device.key_up(Key::LEFT_SHIFT)?;`}</code></pre>
        </Card>
      </div>

      <div id="media" data-search-target>
        <Card>
          <CardHeader title="Media keys" subtitle="media, media_down, media_up, media_force_release" />
          <pre class="api-signature">fn media(&self, key: MediaKey, action: Action) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_down(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_up(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_force_release(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The media counterpart, taking a{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> (a 16-bit Consumer
            usage). Present-gated to a board that declares a Consumer collection (read{' '}
            <A href="/library/requests#caps"><code>caps</code></A>); otherwise a
            no-op.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{MediaKey, Action};

device.media_down(MediaKey::VOLUME_UP)?;
device.media_up(MediaKey::VOLUME_UP)?;
device.media(MediaKey::PLAY_PAUSE, Action::Press)?;`}</code></pre>
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
          <pre><code>{`use medius::{Button, Key};

// async_device: medius::AsyncDevice
async_device.press(Button::Left)?;   // no .await, it just queues the frame
async_device.key_down(Key::ESCAPE)?;`}</code></pre>
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
