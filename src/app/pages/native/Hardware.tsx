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
                <th>Port</th>
                <th>Connects to</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>USB1</code></td>
                <td>Game PC</td>
                <td>
                  The clone (<A href="/native/architecture">device chip</A>), a copy of the
                  mouse's USB identity, so the PC sees the same device it would if the mouse were
                  plugged in directly.
                </td>
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

      <div id="disconnecting" data-search-target>
        <Card>
          <CardHeader title="Disconnecting" subtitle="No power switch, just unplug" />
          <p>
            The box is USB bus-powered: no battery, no power button, nothing to power down. Turning
            it off means unplugging it, and that is safe at any moment. Injected input never outlives
            the program that sent it, so a button or move can't get stuck.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>You unplug</th><th>What happens</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>USB2</code> (control), or the program stops</td>
                <td>After <code>1 s</code> of silence the box clears all <A href="/native/injection">injection</A> and falls back to pure passthrough. The real mouse keeps working.</td>
              </tr>
              <tr>
                <td><code>USB1</code> (clone)</td>
                <td>The game PC sees an ordinary mouse unplug; the box drops its injection state.</td>
              </tr>
              <tr>
                <td><code>USB3</code> (mouse)</td>
                <td>The box tears down the captured mouse cleanly and reports it detached.</td>
              </tr>
            </tbody>
          </table>
          <p>
            To return to passthrough instantly instead of waiting out the{' '}
            <A href="/native/injection#safety">silence timeout</A>, send a{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> before unplugging (the
            library's <A href="/library/admin#reset"><code>reset</code></A>). Dropping the{' '}
            <A href="/library/guides/connection#release"><code>Device</code></A> stops its threads, after
            which the same timeout clears the box. Port order otherwise does not matter.
          </p>
          <div class="callout callout--warning">
            <p>
              The one rule: <code>USB1</code> and <code>USB3</code> must not share a machine at any
              point, plugging in or unplugging. See the{' '}
              <A href="/native/hardware#hazard">power hazard</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Hardware;
