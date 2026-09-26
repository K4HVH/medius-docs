import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Transport: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Transport" subtitle="USB-serial port" />
        <p>
          The box enumerates as an ordinary USB-serial port carrying raw bytes. Open it at the fixed
          baud, send <A href="/native/frame">frames</A>, and confirm the box with the{' '}
          <A href="/native/connection">handshake</A>.
        </p>
      </Card>

      <div id="serial" data-search-target>
        <Card>
          <CardHeader title="Serial link" subtitle="Baud and framing" />
          <p>
            Fixed <code>6,000,000</code> baud (6 Mbaud), no negotiation; any other baud fails.
          </p>
          <p>
            The box speaks <A href="/native/frame">framed binary</A> from the first byte.
          </p>
          <ul>
            <li>No ASCII console.</li>
            <li>No <code>115200</code> startup step.</li>
            <li>No baud-switch frame.</li>
            <li>Baud is never saved on the box, so a bad setting can't lock a client out.</li>
          </ul>
        </Card>
      </div>

      <div id="usb-identity" data-search-target>
        <Card>
          <CardHeader title="USB identity" subtitle="WCH CH343 bridge" />
          <p>
            A <a href="https://www.wch-ic.com" target="_blank" rel="noreferrer">WCH</a> <a href="https://www.wch-ic.com/products/CH343.html" target="_blank" rel="noreferrer"><code>CH343</code></a> does the USB-to-serial conversion. Match its VID and PID to find
            the box among other serial devices.
          </p>
          <table class="api-params">
            <thead>
              <tr>
                <th>Property</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>VID</td>
                <td><code>0x1A86</code></td>
              </tr>
              <tr>
                <td>PID</td>
                <td><code>0x55D3</code></td>
              </tr>
              <tr>
                <td>Baud</td>
                <td><code>6,000,000</code></td>
              </tr>
              <tr>
                <td>Framing</td>
                <td><code>8N1</code></td>
              </tr>
              <tr>
                <td>Linux path</td>
                <td><code>/dev/ttyACM*</code></td>
              </tr>
              <tr>
                <td>Windows path</td>
                <td><code>COMx</code></td>
              </tr>
            </tbody>
          </table>
          <p>
            <code>8N1</code> is 8 data bits, no parity, 1 stop bit.
          </p>
          <div class="callout callout--info">
            <p>
              Handshake on <A href="/native/connection">Connection</A>, wire format on{' '}
              <A href="/native/frame">Frame Format</A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Transport;
