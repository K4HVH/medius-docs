import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Mock: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Mock" subtitle="Test without hardware" />
        <p>
          A <code>MockBox</code> is an in-process fake that pretends to be a Medius device, so tests
          run with no hardware plugged in. The <code>mock</code> cargo feature
          (<code>cargo add medius --features mock</code>) adds it. You hand it to a{' '}
          <A href="/library/connection"><code>Device</code></A> in place of a serial port and call
          the same <code>Device</code> methods you would in production; they run against the fake
          instead of the wire.
        </p>
      </Card>

      <div id="usage" data-search-target>
        <Card>
          <CardHeader title="Usage" subtitle="Wrap a MockBox in a Device" />
          <pre class="api-signature">fn with_mock(mock: MockBox) -&gt; Device</pre>
          <p><span class="api-badge api-badge--executed">No round-trip</span></p>
          <pre class="api-signature">fn open_mock(mock: MockBox) -&gt; Result&lt;Device&gt;</pre>
          <p><span class="api-badge api-badge--responded">Blocks</span></p>

          <p>
            Both wrap the fake and hand back a{' '}
            <A href="/library/connection"><code>Device</code></A> you drive with the normal API.
          </p>

          <div class="api-response-label">CONSTRUCTORS</div>
          <table class="api-params">
            <thead>
              <tr>
                <th>Constructor</th>
                <th>Handshake</th>
                <th>Returns</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>with_mock</code></td>
                <td>No</td>
                <td><code>Device</code></td>
                <td>Wraps the fake and hands back the device directly.</td>
              </tr>
              <tr>
                <td><code>open_mock</code></td>
                <td>Yes</td>
                <td><A href="/library/types#errors"><code>Result&lt;Device&gt;</code></A></td>
                <td>
                  Also runs the <A href="/library/connection#handshake">handshake</A>, the one
                  round-trip a real <code>open</code> makes to confirm a Medius box speaking a
                  protocol version the library understands; can fail, same as a real port.
                </td>
              </tr>
            </tbody>
          </table>

          <p>
            <code>MockBox::new()</code> answers the handshake's{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> on its own,
            so <code>open_mock</code> succeeds with no extra setup.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let device = Device::open_mock(MockBox::new())?;
device.move_rel(5, 5)?;`}</code></pre>

          <p>
            <A href="/library/movement"><code>move_rel</code></A> moves the pointer relatively (here 5
            right, 5 down) through the same <code>Device</code> API as a real box, so tests cover
            production call paths.
          </p>
          <div class="callout callout--info">
            <p>
              The other features are <A href="/library/features/async"><code>async</code></A>,{' '}
              <A href="/library/features/flash"><code>flash</code></A>, and{' '}
              <A href="/library/features/tracing"><code>tracing</code></A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Mock;
