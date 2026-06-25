import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Architecture: Component = () => {
  return (
    <>
      <div id="data-flow" data-search-target>
        <Card>
          <CardHeader title="How it fits together" subtitle="Mouse, box, and PC" />
          <p>
            The box has two chips joined by an internal link, plus a third port for your program. The
            clone is a copy of the real mouse's USB identity.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Part</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Host chip</td>
                <td>Reads the real mouse.</td>
              </tr>
              <tr>
                <td>Device chip</td>
                <td>Presents the clone to the PC and merges your input into what it reports.</td>
              </tr>
              <tr>
                <td>Link</td>
                <td>Passes data between the two chips.</td>
              </tr>
            </tbody>
          </table>
          <pre class="diagram">{`   real mouse                     game PC
        |                            ^
        | USB3                       | USB1
        v                            |
  +-----------+                +-----------+
  | host chip | ---- link ---> |device chip|
  +-----------+                +-----------+
                                     ^
                                     | USB2 (CH343 serial)
                                     |
                                control PC`}</pre>
          <p>Three connections:</p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Port</th>
                <th>Connects to</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/native/hardware"><code>USB3</code></A></td>
                <td>The real mouse.</td>
              </tr>
              <tr>
                <td><A href="/native/hardware"><code>USB1</code></A></td>
                <td>The PC receiving the mouse.</td>
              </tr>
              <tr>
                <td><A href="/native/transport"><code>USB2</code></A></td>
                <td>
                  The program driving the box, over a{' '}
                  <A href="/native/transport">CH343 serial link</A>.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            That program speaks the <A href="/native/frame">binary protocol</A>, sending{' '}
            <A href="/native/commands/move">movement</A>,{' '}
            <A href="/native/commands/inject">button</A>, and{' '}
            <A href="/native/commands/move#wheel">scroll</A> commands.
          </p>
        </Card>
      </div>

      <div id="transparency" data-search-target>
        <Card>
          <CardHeader title="What the PC sees" subtitle="A real mouse, plus your input" />
          <p>
            To the PC the clone is the same model of mouse, with the same buttons and capabilities. Your
            input adds to the real mouse's input rather than replacing it (<A href="/native/injection">Injection
            Model</A>), so the physical mouse keeps working either way.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>When your program</th>
                <th>The box</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sends input</td>
                <td>Layers your movement, scroll, and button state onto the real mouse.</td>
              </tr>
              <tr>
                <td>Goes quiet</td>
                <td>
                  Returns to plain passthrough, just a wire, per the{' '}
                  <A href="/native/injection#safety">safety rule</A>.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="two-pcs" data-search-target>
        <Card>
          <CardHeader title="Two computers" subtitle="A separate driver host" />
          <p>
            Your program on <A href="/native/transport"><code>USB2</code></A> runs on a
            different computer from the one receiving the mouse on{' '}
            <A href="/native/hardware"><code>USB1</code></A>.
          </p>
          <div class="callout callout--info">
            <p>
              See <A href="/native/hardware">Hardware</A> for the ports and how to wire them, including
              the one pairing to avoid.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Architecture;
