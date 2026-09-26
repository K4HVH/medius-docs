import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Hardware: Component = () => {
  return (
    <>
      <div id="ports" data-search-target>
        <Card>
          <CardHeader title="Ports" subtitle="Three USB ports and cabling" />
          <p>
            Inside are two <a href="https://www.espressif.com/en/products/socs" target="_blank" rel="noreferrer">ESP32</a>-S3 microcontrollers and a <a href="https://www.wch-ic.com/products/CH343.html" target="_blank" rel="noreferrer"><code>CH343</code></a> USB-serial bridge. A
            program speaks only to the <code>CH343</code> serial port; the two chips share an internal
            20 Mbaud link, separate from the 6 Mbaud control link.
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
                  The clone (<A href="/native/architecture">device chip</A>), copying the mouse's
                  USB identity so the PC enumerates the same device as a direct connection.
                </td>
              </tr>
              <tr>
                <td><code>USB2</code></td>
                <td>Control PC</td>
                <td><A href="/native/transport">CH343</A> serial control (<code>/dev/ttyACM*</code>)</td>
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
          <CardHeader title="USB3 power hazard" subtitle="The one pairing to avoid" />
          <div class="callout callout--danger">
            <p>
              ⚠️ <code>USB1</code> and <code>USB3</code> must never both connect to the same machine.
            </p>
            <p>
              The <code>USB3</code> 5V rail can't be pulled low in firmware, so the pair back-feeds
              power, which can force a shutdown or drain the battery.
            </p>
          </div>
        </Card>
      </div>

      <div id="disconnecting" data-search-target>
        <Card>
          <CardHeader title="Disconnecting" subtitle="Unplug any time" />
          <p>
            The box is USB bus-powered, with no battery or power button, and safe to unplug at any
            moment. Injected input never outlives the program that sent it, so a button or move
            can't stick.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Unplugged</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>USB2</code> (control), or the program stops</td>
                <td>After <code>1 s</code> of silence the box clears all <A href="/native/injection">injection</A> and returns to pure passthrough; the mouse keeps working.</td>
              </tr>
              <tr>
                <td><code>USB1</code> (clone)</td>
                <td>An ordinary device detach on the game PC; the box drops its injection state.</td>
              </tr>
              <tr>
                <td><code>USB3</code> (mouse)</td>
                <td>The box tears down the captured mouse and reports it detached.</td>
              </tr>
            </tbody>
          </table>
          <p>
            For instant passthrough without the{' '}
            <A href="/native/injection#safety">silence timeout</A>, send{' '}
            <A href="/native/commands/admin#reset"><code>RESET</code></A> before unplugging (library:{' '}
            <A href="/library/admin#reset"><code>reset</code></A>). Dropping the{' '}
            <A href="/library/guides/connection#release"><code>Device</code></A> stops its threads;
            the same timeout then clears the box. Port order otherwise doesn't matter.
          </p>
          <div class="callout callout--warning">
            <p>
              <code>USB1</code> and <code>USB3</code> must not share a machine at any point,
              plugging in or unplugging. See the{' '}
              <A href="/native/hardware#hazard">power hazard</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Hardware;
