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
              <tr><td><code>button</code></td><td><A href="/native/commands/buttons"><code>BUTTON</code></A></td><td>The generic form; you pass the <A href="#methods"><code>ButtonAction</code></A>.</td></tr>
            </tbody>
          </table>
          <p>See also: <A href="/library/guides/calls#clicking">clicking &amp; holds</A>, <A href="/library/guides/testing#testing">testing with MockBox</A>.</p>
        </Card>
      </div>

      <div id="button-arg" data-search-target>
        <Card>
          <CardHeader title="Button" subtitle="Which button, and its wire id" />
          <pre class="api-signature">enum Button {'{'} Left, Right, Middle, Side1, Side2 {'}'}</pre>
          <p>
            <A href="/library/types/enums#button"><code>Button</code></A> names the target; each maps to a
            one-byte wire <code>id</code> (<code>Left</code> 0 to <code>Side2</code> 4), tabled on{' '}
            <A href="/library/types/enums">Types</A>.
          </p>
          <p>
            Targeting a button the real mouse lacks (say <code>Side2</code> on a three-button mouse)
            is a no-op; map a wire byte with <code>Button::from_id(u8)</code> / <code>as_id()</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Button;

assert_eq!(Button::from_id(3), Some(Button::Side1));
assert_eq!(Button::Left.as_id(), 0);
assert_eq!(Button::from_id(99), None); // unknown id`}</code></pre>
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
            <A href="#methods"><code>button(button, ButtonAction::Press)</code></A>.
          </p>
          <div class="api-response-label">PARAMETERS</div>
          <table class="api-params">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>button</code></td><td><A href="#button-arg"><code>Button</code></A></td><td>Which clone button to hold down.</td></tr>
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
          <CardHeader title="button and ButtonAction" subtitle="The generic form and its action enum" />
          <pre class="api-signature">fn button(&self, button: Button, action: ButtonAction) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            The generic form behind <A href="#press"><code>press</code></A>,{' '}
            <A href="#soft-release"><code>soft_release</code></A>, and{' '}
            <A href="#force-release"><code>force_release</code></A>; reach for it when the{' '}
            <A href="/library/types/enums#button-action"><code>ButtonAction</code></A> is a value you're passing
            around.
          </p>
          <div class="api-response-label">ACTIONS</div>
          <table class="api-params">
            <thead>
              <tr><th>Helper</th><th><code>ButtonAction</code></th><th>byte</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>soft_release</code></td><td><code>SoftRelease</code></td><td><code>0</code></td><td>Clear your press; defer to physical state.</td></tr>
              <tr><td><code>press</code></td><td><code>Press</code></td><td><code>1</code></td><td>Force the button down regardless of physical state.</td></tr>
              <tr><td><code>force_release</code></td><td><code>ForceRelease</code></td><td><code>2</code></td><td>Force the button up, masking a physical hold.</td></tr>
            </tbody>
          </table>
          <p>
            Each discriminant is the wire <code>action</code> byte; convert with{' '}
            <code>ButtonAction::from_u8(u8)</code> and <code>as_u8()</code>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, ButtonAction};

// same as device.press(Button::Right)?
device.button(Button::Right, ButtonAction::Press)?;`}</code></pre>
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
