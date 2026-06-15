import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Movement: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Movement & scroll" subtitle="Cursor motion and wheel input" />
        <p>
          The box is a USB bridge between a real mouse and the PC. Both methods send{' '}
          <A href="/native/injection"><code>injection</code></A>: motion the box adds on top of the
          real mouse's input (<A href="/native/injection#fire-and-forget">passthrough</A>). Both are{' '}
          <A href="/native/injection#fire-and-forget"><code>fire-and-forget</code></A> &mdash; each
          sends one <A href="/native/frame"><code>frame</code></A> (one packet on the wire) and returns
          without an acknowledgement, since the box sends none for these commands.
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
              <tr><td><code>dx</code></td><td><code>i16</code></td><td>Horizontal offset, in mouse counts (raw motion units the OS scales like any mouse, not pixels). Positive moves right.</td></tr>
              <tr><td><code>dy</code></td><td><code>i16</code></td><td>Vertical offset, in mouse counts. Positive moves down.</td></tr>
            </tbody>
          </table>
          <p>
            <code>dx</code> and <code>dy</code> are offsets from the current cursor position, not
            screen coordinates, each spanning the full <code>i16</code> range{' '}
            <code>−32768 to 32767</code>. They add into the{' '}
            <A href="/native/injection#state">accumulator</A>, a running total of pending injected
            motion the box drains into the reports it sends the PC (<code>accumulator += dx, dy</code>).
            The caller owns timing: sustained 1 kHz motion is a caller-driven <code>move_rel</code>{' '}
            loop. Returns a <A href="/library/types#errors"><code>Result</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.move_rel(40, 0)?;`}</code></pre>
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
            <code>delta</code> spans the full <code>i16</code> range{' '}
            <code>−32768 to 32767</code> and adds into the same{' '}
            <A href="/native/injection#state">accumulator</A> as movement{' '}
            (<code>accumulator += delta</code>), so multi-step scrolls are preserved rather than
            clamped to one notch. Returns a <A href="/library/types#errors"><code>Result</code></A>.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`device.wheel(3)?;`}</code></pre>
        </Card>
      </div>
    </>
  );
};

export default Movement;
