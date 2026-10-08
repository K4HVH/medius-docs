import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';

const Architecture: Component = () => {
  return (
    <>
      <PageHeader lead="Mouse, box, and PC">
        <span id="data-flow" data-search-target />
        <p>
          The clone copies the mouse's USB identity.
        </p>
        <div class="table-scroll">
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
        </div>
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
        <div class="table-scroll">
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
        </div>
        <p>
          The program sends <A href="/native/commands/move">movement</A>,{' '}
          <A href="/native/commands/inject">button</A>, and{' '}
          <A href="/native/commands/move#wheel">scroll</A> commands in the{' '}
          <A href="/native/frame">binary protocol</A>.
        </p>
      </PageHeader>

      <DocSection id="transparency" title="What reaches the PC" caption="Real mouse plus injected input">
        <p>
          The PC enumerates the same model of mouse, with the same buttons and capabilities.
          Injected input adds to native input (<A href="/native/injection">Injection Model</A>).
        </p>
        <div class="table-scroll">
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
        </div>
      </DocSection>

      <DocSection id="two-pcs" title="Two computers" caption="Separate control PC">
        <p>
          The program on <A href="/native/transport"><code>USB2</code></A> runs on a different
          computer from the PC on <A href="/native/hardware"><code>USB1</code></A>.
        </p>
        <div class="callout callout--info">
          <p>
            Port wiring, and the one pairing to avoid, on <A href="/native/hardware">Hardware</A>.
          </p>
        </div>
      </DocSection>
    </>
  );
};

export default Architecture;
