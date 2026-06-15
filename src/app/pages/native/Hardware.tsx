import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Hardware: Component = () => {
  return (
    <>
      <div id="ports" data-search-target>
        <Card>
          <CardHeader title="Ports" subtitle="The three USB ports and how to cable them" />
          <p>
            Wire the box once at first plug-in; after that everything is software.
          </p>
          <p>
            Inside are two <a href="https://www.espressif.com/en/products/socs" target="_blank" rel="noreferrer">ESP32</a>-S3 microcontrollers and a <a href="https://www.wch-ic.com/products/CH343.html" target="_blank" rel="noreferrer"><code>CH343</code></a> USB-serial bridge. Your
            program only ever speaks to the <code>CH343</code> serial port; the two chips talk over an
            internal 5 Mbaud link you never touch, separate from the 4 Mbaud control link.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Component</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/native/architecture">Host chip</A></td>
                <td>Reads the real mouse.</td>
              </tr>
              <tr>
                <td><A href="/native/architecture">Device chip</A></td>
                <td>
                  Presents <A href="/native/architecture">the clone</A>, a copy of the mouse's USB
                  identity, so the PC sees the same device it would if the mouse were plugged in
                  directly.
                </td>
              </tr>
              <tr>
                <td><code>CH343</code> bridge</td>
                <td>
                  Exposes the control port as a serial device (see{' '}
                  <A href="/native/transport">Transport</A>).
                </td>
              </tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead>
              <tr>
                <th>Port</th>
                <th>Connects to</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>USB1</code></td>
                <td>Game PC</td>
                <td>The clone (<A href="/native/architecture">device chip</A>)</td>
              </tr>
              <tr>
                <td><code>USB2</code></td>
                <td>Control PC</td>
                <td><A href="/native/transport">CH343</A> serial control, the{' '}
                  <code>/dev/ttyACM*</code> port your program opens</td>
              </tr>
              <tr>
                <td><code>USB3</code></td>
                <td>Mouse</td>
                <td>Real mouse (<A href="/native/architecture">host chip</A>)</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="hazard" data-search-target>
        <Card>
          <CardHeader title="USB3 power hazard" subtitle="The one wiring pairing to avoid" />
          <div class="callout callout--danger">
            <p>
              ⚠️ <code>USB1</code> and <code>USB3</code> must never both connect to the same machine.
            </p>
            <p>
              The <code>USB3</code> 5V rail can't be pulled low in firmware, so wiring both to one
              machine back-feeds power and can force a shutdown or drain the battery. Keep them on
              separate machines per the port table above.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Hardware;
