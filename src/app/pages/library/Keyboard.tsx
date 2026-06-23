import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Keyboard: Component = () => {
  return (
    <>
      <div id="overview" data-search-target>
        <Card>
          <CardHeader title="Keyboard" subtitle="Inject keys and media keys on the clone" />
          <p>
            Each call queues one <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
            <A href="/native/commands/keyboard#key"><code>KEY</code></A> or{' '}
            <A href="/native/commands/keyboard#consumer"><code>CONSUMER</code></A> frame.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Frame</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>key_down</code></td><td><A href="/native/commands/keyboard#key"><code>KEY</code></A></td><td>Force a key down and hold it.</td></tr>
              <tr><td><code>key_up</code></td><td><A href="/native/commands/keyboard#key"><code>KEY</code></A></td><td>Clear your press; a physical hold stays down.</td></tr>
              <tr><td><code>key_force_release</code></td><td><A href="/native/commands/keyboard#key"><code>KEY</code></A></td><td>Force the key up, masking a physical hold.</td></tr>
              <tr><td><code>key</code></td><td><A href="/native/commands/keyboard#key"><code>KEY</code></A></td><td>The generic form; you pass the <A href="/library/types/enums#action"><code>Action</code></A>.</td></tr>
              <tr><td><code>media_down</code> / <code>media_up</code> / <code>media_force_release</code> / <code>media</code></td><td><A href="/native/commands/keyboard#consumer"><code>CONSUMER</code></A></td><td>The same four, for a media key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="key" data-search-target>
        <Card>
          <CardHeader title="key" subtitle="Inject a key or modifier" />
          <pre class="api-signature">fn key(&self, key: Key, action: Action) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_down(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_up(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn key_force_release(&self, key: Key) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            <code>key_down</code> holds the key down, <code>key_up</code> clears your press while a
            physical hold survives, and <code>key_force_release</code> forces it up over a physical
            press. <code>key</code> is the generic form; reach for it when the{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> is a value you're passing
            around.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>key</code></td><td><A href="/library/types/structs#key"><code>Key</code></A></td><td>The HID keycode to inject (<code>0xE0</code>-<code>0xE7</code> is a modifier).</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#action"><code>Action</code></A></td><td>Press, soft-release, or force-release.</td></tr>
            </tbody>
          </table>
          <p>
            A keycode the cloned board can't report is a no-op; held keys survive a reconnect like
            buttons. <A href="/library/admin#reset"><code>reset</code></A> releases every key.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Key;

device.key_down(Key::LEFT_SHIFT)?;
device.key_down(Key::A)?;             // types an uppercase A
device.key_up(Key::A)?;
device.key_up(Key::LEFT_SHIFT)?;`}</code></pre>
        </Card>
      </div>

      <div id="media" data-search-target>
        <Card>
          <CardHeader title="media" subtitle="Inject a media key" />
          <pre class="api-signature">fn media(&self, key: MediaKey, action: Action) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_down(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_up(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn media_force_release(&self, key: MediaKey) -&gt; Result&lt;()&gt;</pre>
          <p><span class="api-badge api-badge--executed">Fire-and-forget</span></p>
          <p>
            The media counterpart to <A href="#key"><code>key</code></A>, taking a 16-bit Consumer
            usage. Present-gated to a board that declares a Consumer collection (read{' '}
            <A href="/library/requests#query-kbd-caps"><code>query_kbd_caps</code></A>); otherwise a
            no-op.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>key</code></td><td><A href="/library/types/structs#media-key"><code>MediaKey</code></A></td><td>The 16-bit Consumer usage to inject.</td></tr>
              <tr><td><code>action</code></td><td><A href="/library/types/enums#action"><code>Action</code></A></td><td>Press, soft-release, or force-release.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::MediaKey;

device.media_down(MediaKey::VOLUME_UP)?;
device.media_up(MediaKey::VOLUME_UP)?;
device.media(MediaKey::PLAY_PAUSE, medius::Action::Press)?;`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="On AsyncDevice" subtitle="Same calls, still synchronous" />
          <p>
            <A href="/library/features/async"><code>AsyncDevice</code></A> queues these frames too, so
            no <code>.await</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Key, MediaKey};

// async_device: medius::AsyncDevice
async_device.key_down(Key::ESCAPE)?;      // no .await, it just queues the frame
async_device.media_down(MediaKey::MUTE)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Keyboard;
