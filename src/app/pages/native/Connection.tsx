import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Connection: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Connection & handshake" subtitle="Open, find, and handshake" />
        <p>
          The handshake confirms the device on the serial port is a Medius box and speaks a protocol
          version you understand: one request, one reply. Open the port and start talking.
        </p>
        <ul>
          <li>No baud negotiation.</li>
          <li>No login.</li>
          <li>No <code>115200</code> startup step or baud-switch command.</li>
        </ul>
      </Card>

      <div id="handshake" data-search-target>
        <Card>
          <CardHeader title="Handshake" subtitle="One round-trip to confirm the box" />
          <ol>
            <li>
              Open the serial port at <code>4,000,000</code> baud
              (<A href="/native/transport">Transport</A>). The box speaks{' '}
              <A href="/native/frame">framed binary</A> from the first byte.
            </li>
            <li>
              Catch the unsolicited hello the box sends on its own
              (<A href="/native/connection#hello">below</A>), or send a{' '}
              <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> yourself.
              Both produce the same{' '}
              <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> frame.
            </li>
            <li>
              Read <code>proto_ver</code> from that reply and check it equals <code>3</code>.
            </li>
          </ol>
          <p>
            <code>proto_ver</code> is the protocol version the firmware speaks, one byte. These pages
            describe version <code>3</code>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Reply</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><code>proto_ver == 3</code></td><td>Speaks the protocol these pages describe.</td></tr>
              <tr><td><code>proto_ver != 3</code></td><td>Speaks a protocol they don't cover; don't assume the commands behave as described.</td></tr>
              <tr><td>No reply</td><td>Not a Medius box, or the port or baud is wrong.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">THE REPLY: RESP(VERSION)</div>
          <p>
            The first byte echoes the <code>what</code> selector you asked for (the byte that chose which
            thing to query), then the protocol and firmware version, the box MAC, and the box name follow.
            Full detail on the <A href="/native/commands/requests#version">Requests</A> page.
          </p>
          <table class="byte-table">
            <thead>
              <tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>what</code></td><td><code>u8</code></td><td>the selector byte, echoed back; <code>0x00</code> = <code>VERSION</code></td></tr>
              <tr><td>1</td><td><code>proto_ver</code></td><td><code>u8</code></td><td>protocol version, expected <code>3</code></td></tr>
              <tr><td>2</td><td><code>fw_major</code></td><td><code>u8</code></td><td>firmware major</td></tr>
              <tr><td>3</td><td><code>fw_minor</code></td><td><code>u8</code></td><td>firmware minor</td></tr>
              <tr><td>4</td><td><code>fw_patch</code></td><td><code>u8</code></td><td>firmware patch</td></tr>
              <tr><td>5</td><td><code>mac</code></td><td><code>u8[6]</code></td><td>the box MAC, a stable per-box id</td></tr>
              <tr><td>11..</td><td><code>name</code></td><td><code>ascii</code></td><td>the box's human-readable name (may be empty), delimited by the frame <code>LEN</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="hello" data-search-target>
        <Card>
          <CardHeader title="The ready hello" subtitle="Unsolicited RESP(VERSION) on link-up" />
          <p>
            The box sends one{' '}
            <A href="/native/commands/requests#version"><code>RESP(VERSION)</code></A> on its own as
            soon as its serial link is up. Treat it as "box is here and ready" and skip your own{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Trigger</th><th>When it fires</th></tr>
            </thead>
            <tbody>
              <tr><td>Power-on</td><td>Once, as the box boots.</td></tr>
              <tr><td>First contact</td><td>On the first valid frame after a program opens the port, so a program that connects after the power-on hello still gets one.</td></tr>
            </tbody>
          </table>
          <p>
            The hello carries <A href="/native/frame#seq"><code>SEQ=0</code></A> since no request
            prompted it. The payload is identical to a queried reply, so a program that ignores the
            hello loses nothing and just sends{' '}
            <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A> instead.
          </p>
          <div class="callout callout--info">
            <p>
              The <A href="/library/connection">medius library</A> does all of this inside{' '}
              <A href="/library/connection#open"><code>open</code></A> and{' '}
              <A href="/library/connection#open"><code>find</code></A>: it sends{' '}
              <A href="/native/commands/requests#version"><code>QUERY(VERSION)</code></A>, retries a
              few times, and checks <code>proto_ver == 3</code> before handing you a working
              connection.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Connection;
