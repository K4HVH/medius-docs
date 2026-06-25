import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Buttons: Component = () => {
  return (
    <>
      <div id="overview" data-search-target>
        <Card>
          <CardHeader title="Buttons" subtitle="Override mouse buttons on the clone" />
          <p>
            Each call queues one <A href="/native/injection#fire-and-forget">fire-and-forget</A>{' '}
            <A href="/native/commands/buttons"><code>BUTTON</code></A> frame.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th>Frame</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>press</code></td><td><A href="/native/commands/buttons"><code>BUTTON</code></A></td><td>Force the button down and hold it.</td></tr>
              <tr><td><code>soft_release</code></td><td><A href="/native/commands/buttons"><code>BUTTON</code></A></td><td>Clear your press; a physical hold stays down.</td></tr>
              <tr><td><code>force_release</code></td><td><A href="/native/commands/buttons"><code>BUTTON</code></A></td><td>Force the button up, masking a physical hold.</td></tr>
              <tr><td><code>button</code></td><td><A href="/native/commands/buttons"><code>BUTTON</code></A></td><td>The generic form; you pass the <A href="/library/types/enums#action"><code>Action</code></A>.</td></tr>
            </tbody>
          </table>
          <p>See also: <A href="/library/guides/calls#clicking">clicking &amp; holds</A>, <A href="/library/guides/testing#testing">testing with MockBox</A>.</p>
        </Card>
      </div>

      <div id="press" data-search-target>
        <Card>
          <CardHeader title="press" subtitle="Force a button down" />
          <pre class="api-signature">fn press(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            Latches the button down until you release it (
            <A href="#soft-release"><code>soft_release</code></A> or{' '}
            <A href="#force-release"><code>force_release</code></A>) or call{' '}
            <A href="/library/admin#reset"><code>reset</code></A>. Shorthand for{' '}
            <A href="#methods"><code>button(button, Action::Press)</code></A>.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>button</code></td><td><A href="/library/types/enums#button"><code>Button</code></A></td><td>Which clone button to hold down.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

device.press(Button::Left)?; // left button is now held down`}</code></pre>
        </Card>
      </div>

      <div id="soft-release" data-search-target>
        <Card>
          <CardHeader title="soft_release" subtitle="Clear your injected press only" />
          <pre class="api-signature">fn soft_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            Clears the <A href="#press"><code>press</code></A> and defers to the real mouse, so a
            physical hold stays down. To force the button up regardless, use{' '}
            <A href="#force-release"><code>force_release</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

device.soft_release(Button::Left)?; // your press is cleared; a physical hold survives`}</code></pre>
        </Card>
      </div>

      <div id="force-release" data-search-target>
        <Card>
          <CardHeader title="force_release" subtitle="Force a button up, masking a physical hold" />
          <pre class="api-signature">fn force_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            Forces the button up until you change the override or call{' '}
            <A href="/library/admin#reset"><code>reset</code></A>.
          </p>
          <div class="callout callout--info">
            <p>
              The releases differ only under a physical hold: <code>soft_release</code> leaves it down,{' '}
              <code>force_release</code> forces it up. Otherwise identical.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

device.force_release(Button::Left)?; // up even if the user is holding it

// soft vs force, same button:
device.soft_release(Button::Right)?;  // a physical hold of Right stays down
device.force_release(Button::Right)?; // a physical hold of Right is forced up`}</code></pre>
        </Card>
      </div>

      <div id="methods" data-search-target>
        <Card>
          <CardHeader title="button and Action" subtitle="The generic form and its action enum" />
          <pre class="api-signature">fn button(&self, button: Button, action: Action) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            The generic form behind <A href="#press"><code>press</code></A>,{' '}
            <A href="#soft-release"><code>soft_release</code></A>, and{' '}
            <A href="#force-release"><code>force_release</code></A>; reach for it when the{' '}
            <A href="/library/types/enums#action"><code>Action</code></A> is a value you're passing
            around.
          </p>
          <div class="api-response-label">ACTIONS</div>
          <table class="api-params">
            <thead>
              <tr><th>Helper</th><th><code>Action</code></th><th>byte</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>soft_release</code></td><td><code>SoftRelease</code></td><td><code>0</code></td><td>Clear your press; defer to physical state.</td></tr>
              <tr><td><code>press</code></td><td><code>Press</code></td><td><code>1</code></td><td>Force the button down regardless of physical state.</td></tr>
              <tr><td><code>force_release</code></td><td><code>ForceRelease</code></td><td><code>2</code></td><td>Force the button up, masking a physical hold.</td></tr>
            </tbody>
          </table>
          <p>
            Each discriminant is the wire <code>action</code> byte; convert with{' '}
            <code>Action::from_u8(u8)</code> and <code>as_u8()</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, Action};

// same as device.press(Button::Right)?
device.button(Button::Right, Action::Press)?;`}</code></pre>
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
          <pre><code>{`use medius::Button;

// async_device: medius::AsyncDevice
async_device.press(Button::Left)?; // no .await, it just queues the frame`}</code></pre>
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

export default Buttons;
