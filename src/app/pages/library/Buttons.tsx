import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Buttons: Component = () => {
  return (
    <>
      <div id="methods" data-search-target>
        <Card>
          <CardHeader title="Buttons" subtitle="Button overrides on the clone" />
          <p>
            The box holds a button down or up on top of whatever the real mouse is doing. That
            per-button decision is an <A href="/native/injection"><code>override</code></A>. Each call
            sends one <A href="/native/commands/buttons"><code>BUTTON</code></A> frame and returns once
            it's queued; <code>BUTTON</code> is{' '}
            <A href="/native/injection#fire-and-forget">fire-and-forget</A>, so the box sends nothing
            back.
          </p>
          <pre class="api-signature">fn press(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn soft_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn force_release(&self, button: Button) -&gt; Result&lt;()&gt;</pre>
          <pre class="api-signature">fn button(&self, button: Button, action: ButtonAction) -&gt; Result&lt;()&gt;</pre>
          <p>
            <span class="api-badge api-badge--executed">Fire-and-forget</span>
          </p>
          <p>
            <code>button</code> is the generic form; the others fill in its{' '}
            <A href="/library/types#enums"><code>ButtonAction</code></A> for you.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Method</th><th><code>ButtonAction</code></th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>press</code></td><td><code>Press</code></td><td>Force the button down regardless of physical state.</td></tr>
              <tr><td><code>soft_release</code></td><td><code>SoftRelease</code></td><td>Clear our injected press only; a physical hold stays pressed.</td></tr>
              <tr><td><code>force_release</code></td><td><code>ForceRelease</code></td><td>Force the button up, masking a physical press too.</td></tr>
              <tr><td><code>button</code></td><td>(your argument)</td><td>The generic form; you pass the action.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="button-arg" data-search-target>
        <Card>
          <CardHeader title="Which button" />
          <p>
            <A href="/library/types#enums"><code>Button</code></A> names the button. Each maps to a
            one-byte <code>id</code>. Buttons act on the{' '}
            <A href="/native/injection"><code>clone</code></A>, the copy of the real mouse the box
            presents to the PC, so a call for a button it doesn't have is a no-op.
          </p>
          <table class="api-params">
            <thead>
              <tr><th><code>Button</code></th><th><code>id</code></th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Left</code></td><td><code>0</code></td><td>Left button.</td></tr>
              <tr><td><code>Right</code></td><td><code>1</code></td><td>Right button.</td></tr>
              <tr><td><code>Middle</code></td><td><code>2</code></td><td>Middle button.</td></tr>
              <tr><td><code>Side1</code></td><td><code>3</code></td><td>First thumb button.</td></tr>
              <tr><td><code>Side2</code></td><td><code>4</code></td><td>Second thumb button.</td></tr>
            </tbody>
          </table>
          <p>
            There's no click helper: send <code>press</code>, then a <code>soft_release</code> you time
            yourself. To drop every override at once, call{' '}
            <A href="/library/admin#reset"><code>reset</code></A>.
          </p>
          <pre><code>{`device.press(Button::Left)?;
device.soft_release(Button::Left)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Buttons;
