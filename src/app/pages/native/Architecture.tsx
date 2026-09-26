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
            The clone copies the mouse's USB identity.
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
                <td>
                  Reads the mouse on <code>USB3</code> and sets its four relative axes: what an
                  injected <A href="/native/commands/move">movement</A> comes to, and when it goes
                  out.
                </td>
              </tr>
              <tr>
                <td>Device chip</td>
                <td>
                  Presents the clone to the PC and merges the host chip's axes into each report it
                  sends.
                </td>
              </tr>
              <tr>
                <td>Link</td>
                <td>
                  Carries each report and the motion riding with it one way, and the PC's requests
                  for the mouse the other.
                </td>
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
                <td>Real mouse.</td>
              </tr>
              <tr>
                <td><A href="/native/hardware"><code>USB1</code></A></td>
                <td>PC receiving the mouse.</td>
              </tr>
              <tr>
                <td><A href="/native/transport"><code>USB2</code></A></td>
                <td>
                  Program driving the box, over a{' '}
                  <A href="/native/transport">CH343 serial link</A>.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            The program sends <A href="/native/commands/move">movement</A>,{' '}
            <A href="/native/commands/inject">button</A>, and{' '}
            <A href="/native/commands/move#wheel">scroll</A> commands in the{' '}
            <A href="/native/frame">binary protocol</A>.
          </p>
        </Card>
      </div>

      <div id="transparency" data-search-target>
        <Card>
          <CardHeader title="What reaches the PC" subtitle="Real mouse plus injected input" />
          <p>
            The PC enumerates the same model of mouse, with the same buttons and capabilities.
            Injected input adds to native input (<A href="/native/injection">Injection Model</A>).
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Program</th>
                <th>Box</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sends input</td>
                <td>Layers injected movement, scroll, and button state onto native input.</td>
              </tr>
              <tr>
                <td>Goes quiet</td>
                <td>
                  Returns to plain passthrough per the{' '}
                  <A href="/native/injection#safety">safety rule</A>.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="two-pcs" data-search-target>
        <Card>
          <CardHeader title="Two computers" subtitle="Separate control PC" />
          <p>
            The program on <A href="/native/transport"><code>USB2</code></A> runs on a different
            computer from the PC on <A href="/native/hardware"><code>USB1</code></A>.
          </p>
          <div class="callout callout--info">
            <p>
              Port wiring, and the one pairing to avoid, on <A href="/native/hardware">Hardware</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Architecture;
